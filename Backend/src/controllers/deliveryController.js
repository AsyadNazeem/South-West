
'use strict';

const {
    Delivery,
    Order,
    DeliveryStatusHistory
} = require('../models');

const { recordAuditLog } = require('../services/auditLogService');

const AUDIT_MODULE = 'DELIVERY';

function getActorId(req) {
    return req.user?.id ?? req.user?.user_id ?? null;
}

// Capture operational fields only; avoid logging recipient contact details.
function getDeliverySnapshot(delivery) {
    if (!delivery) return null;

    return {
        id: delivery.id,
        delivery_reference: delivery.delivery_reference,
        order_id: delivery.order_id,
        delivery_method: delivery.delivery_method,
        delivery_status: delivery.delivery_status,
        delivery_charge: delivery.delivery_charge,
        tracking_number: delivery.tracking_number,
        courier_name: delivery.courier_name,
        expected_delivery_date: delivery.expected_delivery_date,
        dispatched_at: delivery.dispatched_at,
        delivered_at: delivery.delivered_at
    };
}

// Best-effort audit logging so audit failures don't break delivery operations.
async function auditDeliveryAction(req, {
    action,
    entityId = null,
    description,
    oldValues = null,
    newValues = null
}) {
    try {
        await recordAuditLog({
            userId: getActorId(req),
            action,
            module: AUDIT_MODULE,
            entityType: 'Delivery',
            entityId: entityId == null ? null : String(entityId),
            description,
            oldValues,
            newValues,
            ipAddress: req.ip ?? null,
            userAgent: req.get?.('user-agent') ?? null,
            requestId: req.id ?? req.requestId ?? null
        });
    } catch (error) {
        console.error('Delivery audit logging failed:', error.message);
    }
}

// Get all deliveries
exports.getAllDeliveries = async (req, res) => {
    try {
        const deliveries = await Delivery.findAll({
            include: [
                {
                    model: Order,
                    as: 'order'
                },
                {
                    model: DeliveryStatusHistory,
                    as: 'statusHistory'
                }
            ],
            order: [['id', 'DESC']]
        });

        await auditDeliveryAction(req, {
            action: 'DELIVERY_LIST_VIEWED',
            description: 'Deliveries list retrieved',
            newValues: {
                returned_count: deliveries.length
            }
        });

        return res.status(200).json({
            message: 'Deliveries retrieved successfully',
            data: deliveries
        });
    } catch (error) {
        console.error('Get deliveries error:', error);

        await auditDeliveryAction(req, {
            action: 'DELIVERY_LIST_VIEW_FAILED',
            description: 'Failed to retrieve deliveries list'
        });

        return res.status(500).json({
            message: 'Failed to retrieve deliveries'
        });
    }
};

// Get delivery by ID
exports.getDeliveryById = async (req, res) => {
    const { id } = req.params;

    try {
        const delivery = await Delivery.findByPk(id, {
            include: [
                {
                    model: Order,
                    as: 'order'
                },
                {
                    model: DeliveryStatusHistory,
                    as: 'statusHistory'
                }
            ]
        });

        if (!delivery) {
            await auditDeliveryAction(req, {
                action: 'DELIVERY_DETAIL_NOT_FOUND',
                entityId: id,
                description: `Delivery ${id} was not found`
            });

            return res.status(404).json({
                message: 'Delivery not found'
            });
        }

        await auditDeliveryAction(req, {
            action: 'DELIVERY_DETAIL_VIEWED',
            entityId: delivery.id,
            description: `Delivery ${delivery.id} details retrieved`,
            newValues: {
                delivery_id: delivery.id,
                order_id: delivery.order_id,
                delivery_status: delivery.delivery_status
            }
        });

        return res.status(200).json({
            message: 'Delivery retrieved successfully',
            data: delivery
        });
    } catch (error) {
        console.error('Get delivery error:', error);

        await auditDeliveryAction(req, {
            action: 'DELIVERY_DETAIL_VIEW_FAILED',
            entityId: id,
            description: `Failed to retrieve delivery ${id}`
        });

        return res.status(500).json({
            message: 'Failed to retrieve delivery'
        });
    }
};

// Create delivery
exports.createDelivery = async (req, res) => {
    try {
        const {
            delivery_reference,
            order_id,
            delivery_method,
            delivery_status,
            recipient_name,
            recipient_phone,
            address_line_1,
            address_line_2,
            city,
            state,
            postal_code,
            country,
            delivery_charge,
            tracking_number,
            courier_name,
            expected_delivery_date,
            dispatched_at,
            delivered_at,
            notes
        } = req.body;

        // Check delivery reference
        const existingReference = await Delivery.findOne({
            where: { delivery_reference }
        });

        if (existingReference) {
            await auditDeliveryAction(req, {
                action: 'DELIVERY_CREATE_REJECTED',
                description: 'Delivery creation rejected because the reference already exists',
                newValues: {
                    order_id: order_id ?? null,
                    reason: 'Duplicate delivery reference'
                }
            });

            return res.status(409).json({
                message: 'Delivery reference already exists'
            });
        }

        // Check order exists
        const order = await Order.findByPk(order_id);

        if (!order) {
            await auditDeliveryAction(req, {
                action: 'DELIVERY_CREATE_REJECTED',
                description: 'Delivery creation rejected because the order was not found',
                newValues: {
                    order_id: order_id ?? null,
                    reason: 'Order not found'
                }
            });

            return res.status(404).json({
                message: 'Order not found'
            });
        }

        const delivery = await Delivery.create({
            delivery_reference,
            order_id,
            delivery_method,
            delivery_status,
            recipient_name,
            recipient_phone,
            address_line_1,
            address_line_2,
            city,
            state,
            postal_code,
            country,
            delivery_charge,
            tracking_number,
            courier_name,
            expected_delivery_date,
            dispatched_at,
            delivered_at,
            notes
        });

        await auditDeliveryAction(req, {
            action: 'DELIVERY_CREATED',
            entityId: delivery.id,
            description: `Delivery ${delivery.id} created for order ${order_id}`,
            newValues: getDeliverySnapshot(delivery)
        });

        return res.status(201).json({
            message: 'Delivery created successfully',
            data: delivery
        });
    } catch (error) {
        console.error('Create delivery error:', error);

        await auditDeliveryAction(req, {
            action: 'DELIVERY_CREATE_FAILED',
            description: 'Unexpected error while creating delivery',
            newValues: {
                order_id: req.body?.order_id ?? null
            }
        });

        return res.status(500).json({
            message: 'Failed to create delivery'
        });
    }
};

// Update delivery
exports.updateDelivery = async (req, res) => {
    const { id } = req.params;

    try {
        const delivery = await Delivery.findByPk(id);

        if (!delivery) {
            await auditDeliveryAction(req, {
                action: 'DELIVERY_UPDATE_REJECTED',
                entityId: id,
                description: `Update rejected because delivery ${id} was not found`
            });

            return res.status(404).json({
                message: 'Delivery not found'
            });
        }

        const oldValues = getDeliverySnapshot(delivery);

        const {
            delivery_reference,
            order_id,
            delivery_method,
            delivery_status,
            recipient_name,
            recipient_phone,
            address_line_1,
            address_line_2,
            city,
            state,
            postal_code,
            country,
            delivery_charge,
            tracking_number,
            courier_name,
            expected_delivery_date,
            dispatched_at,
            delivered_at,
            notes
        } = req.body;

        // Check duplicate reference
        if (
            delivery_reference &&
            delivery_reference !== delivery.delivery_reference
        ) {
            const existingReference = await Delivery.findOne({
                where: { delivery_reference }
            });

            if (existingReference) {
                await auditDeliveryAction(req, {
                    action: 'DELIVERY_UPDATE_REJECTED',
                    entityId: id,
                    description: `Update rejected because delivery reference already exists for delivery ${id}`
                });

                return res.status(409).json({
                    message: 'Delivery reference already exists'
                });
            }
        }

        // Check order if being changed
        if (order_id && String(order_id) !== String(delivery.order_id)) {
            const order = await Order.findByPk(order_id);

            if (!order) {
                await auditDeliveryAction(req, {
                    action: 'DELIVERY_UPDATE_REJECTED',
                    entityId: id,
                    description: `Update rejected because order ${order_id} was not found`,
                    oldValues
                });

                return res.status(404).json({
                    message: 'Order not found'
                });
            }
        }

        await delivery.update({
            delivery_reference,
            order_id,
            delivery_method,
            delivery_status,
            recipient_name,
            recipient_phone,
            address_line_1,
            address_line_2,
            city,
            state,
            postal_code,
            country,
            delivery_charge,
            tracking_number,
            courier_name,
            expected_delivery_date,
            dispatched_at,
            delivered_at,
            notes
        });

        await auditDeliveryAction(req, {
            action: 'DELIVERY_UPDATED',
            entityId: delivery.id,
            description: `Delivery ${delivery.id} updated`,
            oldValues,
            newValues: getDeliverySnapshot(delivery)
        });

        return res.status(200).json({
            message: 'Delivery updated successfully',
            data: delivery
        });
    } catch (error) {
        console.error('Update delivery error:', error);

        await auditDeliveryAction(req, {
            action: 'DELIVERY_UPDATE_FAILED',
            entityId: id,
            description: `Unexpected error while updating delivery ${id}`
        });

        return res.status(500).json({
            message: 'Failed to update delivery'
        });
    }
};

// Delete delivery
exports.deleteDelivery = async (req, res) => {
    const { id } = req.params;

    try {
        const delivery = await Delivery.findByPk(id);

        if (!delivery) {
            await auditDeliveryAction(req, {
                action: 'DELIVERY_DELETE_REJECTED',
                entityId: id,
                description: `Delete rejected because delivery ${id} was not found`
            });

            return res.status(404).json({
                message: 'Delivery not found'
            });
        }

        const oldValues = getDeliverySnapshot(delivery);

        await delivery.destroy();

        await auditDeliveryAction(req, {
            action: 'DELIVERY_DELETED',
            entityId: delivery.id,
            description: `Delivery ${delivery.id} deleted`,
            oldValues,
            newValues: {
                deleted: true,
                delivery_id: delivery.id,
                order_id: delivery.order_id
            }
        });

        return res.status(200).json({
            message: 'Delivery deleted successfully'
        });
    } catch (error) {
        console.error('Delete delivery error:', error);

        await auditDeliveryAction(req, {
            action: 'DELIVERY_DELETE_FAILED',
            entityId: id,
            description: `Unexpected error while deleting delivery ${id}`
        });

        return res.status(500).json({
            message: 'Failed to delete delivery'
        });
    }
};
