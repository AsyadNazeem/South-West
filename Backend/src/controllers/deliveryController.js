
'use strict';

const {
    sequelize,
    Delivery,
    Order,
    Customer,
    DeliveryStatusHistory
} = require('../models');

const { recordAuditLog } = require('../services/auditLogService');
const { sendDeliveryTrackingEmail } = require('../services/emailService');

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


// Update delivery
exports.updateDelivery = async (req, res) => {
    const { id } = req.params;
    let transaction;
    let emailPayload = null;
    let committed = false;
    let updatedDelivery;

    try {
        transaction = await sequelize.transaction();

        const delivery = await Delivery.findByPk(id, {
            transaction,
            lock: transaction.LOCK.UPDATE
        });

        if (!delivery) {
            await transaction.rollback();
            transaction = null;

            await auditDeliveryAction(req, {
                action: 'DELIVERY_UPDATE_REJECTED',
                entityId: id,
                description: `Update rejected because delivery ${id} was not found`
            });

            return res.status(404).json({
                message: 'Delivery not found'
            });
        }

        // Existing deliveries cannot be reassigned to another order.
        if (
            req.body?.order_id !== undefined &&
            String(req.body.order_id) !== String(delivery.order_id)
        ) {
            await transaction.rollback();
            transaction = null;

            await auditDeliveryAction(req, {
                action: 'DELIVERY_UPDATE_REJECTED',
                entityId: id,
                description: 'Changing the order linked to a delivery is not permitted'
            });

            return res.status(400).json({
                message: 'A delivery cannot be reassigned to another order.'
            });
        }

        const oldValues = getDeliverySnapshot(delivery);

        const allowedFields = [
            'delivery_reference',
            'order_id',
            'delivery_method',
            'delivery_status',
            'recipient_name',
            'recipient_phone',
            'address_line_1',
            'address_line_2',
            'city',
            'state',
            'postal_code',
            'country',
            'delivery_charge',
            'tracking_number',
            'courier_name',
            'expected_delivery_date',
            'dispatched_at',
            'delivered_at',
            'notes'
        ];

        const updates = {};

        for (const field of allowedFields) {
            if (Object.prototype.hasOwnProperty.call(req.body, field)) {
                updates[field] = req.body[field];
            }
        }

        if (Object.keys(updates).length === 0) {
            await transaction.rollback();
            transaction = null;

            return res.status(400).json({
                message: 'No valid delivery fields provided'
            });
        }

        if (
            updates.delivery_reference &&
            updates.delivery_reference !== delivery.delivery_reference
        ) {
            const existingReference = await Delivery.findOne({
                where: { delivery_reference: updates.delivery_reference },
                transaction
            });

            if (existingReference) {
                await transaction.rollback();
                transaction = null;

                await auditDeliveryAction(req, {
                    action: 'DELIVERY_UPDATE_REJECTED',
                    entityId: id,
                    description: 'Delivery reference already exists',
                    oldValues
                });

                return res.status(409).json({
                    message: 'Delivery reference already exists'
                });
            }
        }

        if (
            updates.order_id !== undefined &&
            String(updates.order_id) !== String(delivery.order_id)
        ) {
            const order = await Order.findByPk(updates.order_id, {
                transaction
            });

            if (!order) {
                await transaction.rollback();
                transaction = null;

                return res.status(404).json({
                    message: 'Order not found'
                });
            }
        }

        const validStatuses = new Set([
            'pending',
            'processing',
            'ready_for_dispatch',
            'dispatched',
            'in_transit',
            'out_for_delivery',
            'delivered',
            'failed',
            'cancelled',
            'returned'
        ]);

        if (
            updates.delivery_status !== undefined &&
            !validStatuses.has(updates.delivery_status)
        ) {
            await transaction.rollback();
            transaction = null;

            await auditDeliveryAction(req, {
                action: 'DELIVERY_UPDATE_REJECTED',
                entityId: id,
                description: 'Update rejected because the delivery status is invalid'
            });

            return res.status(400).json({
                message: 'Invalid delivery status.'
            });
        }
        
        const previousStatus = delivery.delivery_status;
        const nextStatus =
            updates.delivery_status !== undefined
                ? updates.delivery_status
                : previousStatus;

        const isNewDispatch =
            nextStatus === 'dispatched' &&
            previousStatus !== 'dispatched';

        if (nextStatus === 'dispatched') {
            const trackingNumber =
                updates.tracking_number !== undefined
                    ? updates.tracking_number
                    : delivery.tracking_number;

            const courierName =
                updates.courier_name !== undefined
                    ? updates.courier_name
                    : delivery.courier_name;

            if (
                typeof trackingNumber !== 'string' ||
                !trackingNumber.trim() ||
                typeof courierName !== 'string' ||
                !courierName.trim()
            ) {
                await transaction.rollback();
                transaction = null;

                await auditDeliveryAction(req, {
                    action: 'DELIVERY_DISPATCH_REJECTED',
                    entityId: id,
                    description: 'Dispatch requires a tracking number and courier',
                    oldValues
                });

                return res.status(400).json({
                    message: 'Enter a tracking number and courier before dispatching.'
                });
            }

            updates.tracking_number = trackingNumber.trim();
            updates.courier_name = courierName.trim();

            if (isNewDispatch && !updates.dispatched_at) {
                updates.dispatched_at = new Date();
            }
        }

        if (nextStatus === 'delivered' && !delivery.delivered_at &&
            !updates.delivered_at) {
            updates.delivered_at = new Date();
        }

        await delivery.update(updates, { transaction });

        if (previousStatus !== delivery.delivery_status) {
            await DeliveryStatusHistory.create(
                {
                    delivery_id: delivery.id,
                    status: delivery.delivery_status,
                    notes:
                        typeof req.body.status_notes === 'string'
                            ? req.body.status_notes.trim() || null
                            : `Delivery status changed from ${previousStatus} to ${delivery.delivery_status}`,
                    changed_by: getActorId(req)
                },
                { transaction }
            );
        }

        if (isNewDispatch) {
            const order = await Order.findByPk(delivery.order_id, {
                include: [
                    {
                        model: Customer,
                        as: 'customer',
                        attributes: ['id', 'first_name', 'last_name', 'email']
                    }
                ],
                transaction
            });

            const customer = order?.customer;

            if (customer?.email) {
                emailPayload = {
                    email: customer.email,
                    customerName: [customer.first_name, customer.last_name]
                        .filter(Boolean)
                        .join(' '),
                    orderNumber: order.order_number,
                    trackingNumber: delivery.tracking_number,
                    courierName: delivery.courier_name,
                    expectedDeliveryDate: delivery.expected_delivery_date
                };
            } else {
                console.warn(
                    `Tracking email skipped for delivery ${delivery.id}: customer email unavailable`
                );
            }
        }

        updatedDelivery = delivery;
        await transaction.commit();
        transaction = null;
        committed = true;

        await auditDeliveryAction(req, {
            action: 'DELIVERY_UPDATED',
            entityId: updatedDelivery.id,
            description: `Delivery ${updatedDelivery.id} updated`,
            oldValues,
            newValues: getDeliverySnapshot(updatedDelivery)
        });

        let emailStatus = 'not_required';

        if (isNewDispatch && emailPayload) {
            try {
                await sendDeliveryTrackingEmail(emailPayload);
                emailStatus = 'sent';
            } catch (emailError) {
                emailStatus = 'failed';

                console.error(
                    `Tracking email failed for delivery ${updatedDelivery.id}:`,
                    emailError.message
                );

                await auditDeliveryAction(req, {
                    action: 'DELIVERY_TRACKING_EMAIL_FAILED',
                    entityId: updatedDelivery.id,
                    description: 'Dispatch was saved but the tracking email failed'
                });
            }
        } else if (isNewDispatch) {
            emailStatus = 'skipped_missing_customer_email';

            await auditDeliveryAction(req, {
                action: 'DELIVERY_TRACKING_EMAIL_SKIPPED',
                entityId: updatedDelivery.id,
                description: 'Dispatch was saved but the customer email was unavailable'
            });
        }

        return res.status(200).json({
            message:
                emailStatus === 'failed'
                    ? 'Delivery updated, but the tracking email could not be sent.'
                    : 'Delivery updated successfully',
            data: updatedDelivery,
            tracking_email_status: emailStatus
        });
    } catch (error) {
        if (transaction && !committed) {
            try {
                await transaction.rollback();
            } catch (rollbackError) {
                console.error('Delivery transaction rollback failed:', rollbackError.message);
            }
        }

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
