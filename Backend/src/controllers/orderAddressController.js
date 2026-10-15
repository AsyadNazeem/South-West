'use strict';

const { OrderAddress, Order } = require('../models');
const { recordAuditLog } = require('../services/auditLogService');

const AUDIT_MODULE = 'ORDER_ADDRESS';

const getActorId = (req) =>
    req.user?.id ?? req.user?.user_id ?? null;

const getAddressSnapshot = (address) => {
    if (!address) return null;

    return {
        id: address.id,
        order_id: address.order_id,
        address_type: address.address_type
    };
};

const auditOrderAddress = async (
    req,
    {
        action,
        entityId = null,
        description = null,
        oldValues = null,
        newValues = null
    }
) => {
    try {
        await recordAuditLog({
            userId: getActorId(req),
            action,
            module: AUDIT_MODULE,
            entityType: 'OrderAddress',
            entityId: entityId != null ? String(entityId) : null,
            description,
            oldValues,
            newValues,
            ipAddress: req.ip ?? null,
            userAgent: req.get('user-agent') ?? null,
            requestId: req.id ?? req.requestId ?? null
        });
    } catch (auditError) {
        console.error(
            'Order address audit logging failed:',
            auditError.message
        );
    }
};

const getOrderAddressInclude = () => [
    {
        model: Order,
        as: 'order',
        attributes: [
            'id',
            'order_number',
            'customer_id',
            'order_date',
            'status'
        ]
    }
];

// Get all order addresses
const getOrderAddresses = async (req, res) => {
    try {
        const addresses = await OrderAddress.findAll({
            include: getOrderAddressInclude(),
            order: [['id', 'ASC']]
        });

        await auditOrderAddress(req, {
            action: 'ORDER_ADDRESS_LIST_VIEWED',
            description: 'Retrieved order address records'
        });

        return res.status(200).json({
            message: 'Order addresses retrieved successfully',
            data: addresses
        });
    } catch (error) {
        console.error('Get order addresses error:', error);

        await auditOrderAddress(req, {
            action: 'ORDER_ADDRESS_LIST_FAILED',
            description: 'Failed to retrieve order addresses'
        });

        return res.status(500).json({
            message: 'Failed to retrieve order addresses'
        });
    }
};

// Get single order address
const getOrderAddressById = async (req, res) => {
    const { id } = req.params;

    try {
        const address = await OrderAddress.findByPk(id, {
            include: getOrderAddressInclude()
        });

        if (!address) {
            await auditOrderAddress(req, {
                action: 'ORDER_ADDRESS_NOT_FOUND',
                entityId: id,
                description: 'Requested order address was not found'
            });

            return res.status(404).json({
                message: 'Order address not found'
            });
        }

        await auditOrderAddress(req, {
            action: 'ORDER_ADDRESS_VIEWED',
            entityId: address.id,
            description: 'Retrieved an order address'
        });

        return res.status(200).json({
            message: 'Order address retrieved successfully',
            data: address
        });
    } catch (error) {
        console.error('Get order address error:', error);

        await auditOrderAddress(req, {
            action: 'ORDER_ADDRESS_VIEW_FAILED',
            entityId: id,
            description: 'Failed to retrieve order address'
        });

        return res.status(500).json({
            message: 'Failed to retrieve order address'
        });
    }
};

// Create order address
const createOrderAddress = async (req, res) => {
    const {
        order_id,
        address_type,
        recipient_name,
        phone,
        address_line_1,
        address_line_2,
        city,
        state,
        postal_code,
        country
    } = req.body;

    try {
        if (
            !order_id ||
            !address_type ||
            !recipient_name ||
            !address_line_1 ||
            !city ||
            !country
        ) {
            await auditOrderAddress(req, {
                action: 'ORDER_ADDRESS_CREATE_REJECTED',
                description: 'Order address creation rejected: required fields missing',
                newValues: {
                    order_id: order_id ?? null,
                    address_type: address_type ?? null
                }
            });

            return res.status(400).json({
                message: 'order_id, address_type, recipient_name, address_line_1, city and country are required'
            });
        }

        if (!['billing', 'shipping'].includes(address_type)) {
            await auditOrderAddress(req, {
                action: 'ORDER_ADDRESS_CREATE_REJECTED',
                description: 'Order address creation rejected: invalid address type',
                newValues: {
                    order_id,
                    address_type
                }
            });

            return res.status(400).json({
                message: 'Invalid address_type',
                allowed_types: ['billing', 'shipping']
            });
        }

        const order = await Order.findByPk(order_id);

        if (!order) {
            await auditOrderAddress(req, {
                action: 'ORDER_ADDRESS_CREATE_REJECTED',
                description: 'Order address creation rejected: order not found',
                newValues: {
                    order_id,
                    address_type
                }
            });

            return res.status(404).json({
                message: 'Order not found'
            });
        }

        const address = await OrderAddress.create({
            order_id,
            address_type,
            recipient_name,
            phone,
            address_line_1,
            address_line_2,
            city,
            state,
            postal_code,
            country
        });

        await auditOrderAddress(req, {
            action: 'ORDER_ADDRESS_CREATED',
            entityId: address.id,
            description: 'Created an order address',
            newValues: getAddressSnapshot(address)
        });

        const createdAddress = await OrderAddress.findByPk(
            address.id,
            {
                include: getOrderAddressInclude()
            }
        );

        return res.status(201).json({
            message: 'Order address created successfully',
            data: createdAddress
        });
    } catch (error) {
        console.error('Create order address error:', error);

        await auditOrderAddress(req, {
            action: 'ORDER_ADDRESS_CREATE_FAILED',
            description: 'Failed to create order address',
            newValues: {
                order_id: order_id ?? null,
                address_type: address_type ?? null
            }
        });

        return res.status(500).json({
            message: 'Failed to create order address'
        });
    }
};

// Update order address
const updateOrderAddress = async (req, res) => {
    const { id } = req.params;

    try {
        const address = await OrderAddress.findByPk(id);

        if (!address) {
            await auditOrderAddress(req, {
                action: 'ORDER_ADDRESS_UPDATE_REJECTED',
                entityId: id,
                description: 'Order address update rejected: address not found'
            });

            return res.status(404).json({
                message: 'Order address not found'
            });
        }

        const oldValues = getAddressSnapshot(address);

        const allowedFields = [
            'address_type',
            'recipient_name',
            'phone',
            'address_line_1',
            'address_line_2',
            'city',
            'state',
            'postal_code',
            'country'
        ];

        const updateData = {};

        allowedFields.forEach((field) => {
            if (req.body[field] !== undefined) {
                updateData[field] = req.body[field];
            }
        });

        if (Object.keys(updateData).length === 0) {
            await auditOrderAddress(req, {
                action: 'ORDER_ADDRESS_UPDATE_REJECTED',
                entityId: address.id,
                description: 'Order address update rejected: no permitted fields supplied',
                oldValues
            });

            return res.status(400).json({
                message: 'No valid fields provided for update'
            });
        }

        if (
            updateData.address_type !== undefined &&
            !['billing', 'shipping'].includes(updateData.address_type)
        ) {
            await auditOrderAddress(req, {
                action: 'ORDER_ADDRESS_UPDATE_REJECTED',
                entityId: address.id,
                description: 'Order address update rejected: invalid address type',
                oldValues,
                newValues: {
                    address_type: updateData.address_type
                }
            });

            return res.status(400).json({
                message: 'Invalid address_type',
                allowed_types: ['billing', 'shipping']
            });
        }

        await address.update(updateData);

        await auditOrderAddress(req, {
            action: 'ORDER_ADDRESS_UPDATED',
            entityId: address.id,
            description: 'Updated an order address',
            oldValues,
            newValues: getAddressSnapshot(address)
        });

        const updatedAddress = await OrderAddress.findByPk(
            address.id,
            {
                include: getOrderAddressInclude()
            }
        );

        return res.status(200).json({
            message: 'Order address updated successfully',
            data: updatedAddress
        });
    } catch (error) {
        console.error('Update order address error:', error);

        await auditOrderAddress(req, {
            action: 'ORDER_ADDRESS_UPDATE_FAILED',
            entityId: id,
            description: 'Failed to update order address'
        });

        return res.status(500).json({
            message: 'Failed to update order address'
        });
    }
};

// Delete order address
const deleteOrderAddress = async (req, res) => {
    const { id } = req.params;

    try {
        const address = await OrderAddress.findByPk(id);

        if (!address) {
            await auditOrderAddress(req, {
                action: 'ORDER_ADDRESS_DELETE_REJECTED',
                entityId: id,
                description: 'Order address deletion rejected: address not found'
            });

            return res.status(404).json({
                message: 'Order address not found'
            });
        }

        const oldValues = getAddressSnapshot(address);

        await address.destroy();

        await auditOrderAddress(req, {
            action: 'ORDER_ADDRESS_DELETED',
            entityId: id,
            description: 'Deleted an order address',
            oldValues
        });

        return res.status(200).json({
            message: 'Order address deleted successfully'
        });
    } catch (error) {
        console.error('Delete order address error:', error);

        await auditOrderAddress(req, {
            action: 'ORDER_ADDRESS_DELETE_FAILED',
            entityId: id,
            description: 'Failed to delete order address'
        });

        return res.status(500).json({
            message: 'Failed to delete order address'
        });
    }
};

module.exports = {
    getOrderAddresses,
    getOrderAddressById,
    createOrderAddress,
    updateOrderAddress,
    deleteOrderAddress
};
