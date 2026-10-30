'use strict';

const { OrderItem, Order, Item } = require('../models');
const { recordAuditLog } = require('../services/auditLogService');

const AUDIT_MODULE = 'ORDER_ITEM';

const getActorId = (req) =>
    req.user?.id ?? req.user?.user_id ?? null;

const getOrderItemSnapshot = (orderItem) => {
    if (!orderItem) return null;

    return {
        id: orderItem.id,
        order_id: orderItem.order_id,
        item_id: orderItem.item_id,
        quantity: orderItem.quantity,
        unit_price: orderItem.unit_price,
        discount_amount: orderItem.discount_amount,
        tax_amount: orderItem.tax_amount,
        line_total: orderItem.line_total
    };
};

const auditOrderItem = async (
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
            entityType: 'OrderItem',
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
            'Order item audit logging failed:',
            auditError.message
        );
    }
};

const getOrderItemIncludes = () => [
    {
        model: Order,
        as: 'order',
        attributes: [
            'id',
            'order_number',
            'customer_id',
            'status'
        ]
    },
    {
        model: Item,
        as: 'item',
        attributes: [
            'id',
            'item_code',
            'item_name'
        ]
    }
];

// GET all order items
exports.getAllOrderItems = async (req, res) => {
    try {
        const orderItems = await OrderItem.findAll({
            include: getOrderItemIncludes(),
            order: [['id', 'ASC']]
        });

        await auditOrderItem(req, {
            action: 'ORDER_ITEM_LIST_VIEWED',
            description: 'Retrieved order item records'
        });

        return res.status(200).json({
            message: 'Order items retrieved successfully',
            data: orderItems
        });
    } catch (error) {
        console.error('Get order items error:', error);

        await auditOrderItem(req, {
            action: 'ORDER_ITEM_LIST_FAILED',
            description: 'Failed to retrieve order items'
        });

        return res.status(500).json({
            message: 'Failed to retrieve order items'
        });
    }
};

// GET order item by ID
exports.getOrderItemById = async (req, res) => {
    const { id } = req.params;

    try {
        const orderItem = await OrderItem.findByPk(id, {
            include: getOrderItemIncludes()
        });

        if (!orderItem) {
            await auditOrderItem(req, {
                action: 'ORDER_ITEM_NOT_FOUND',
                entityId: id,
                description: 'Requested order item was not found'
            });

            return res.status(404).json({
                message: 'Order item not found'
            });
        }

        await auditOrderItem(req, {
            action: 'ORDER_ITEM_VIEWED',
            entityId: orderItem.id,
            description: 'Retrieved an order item'
        });

        return res.status(200).json({
            message: 'Order item retrieved successfully',
            data: orderItem
        });
    } catch (error) {
        console.error('Get order item error:', error);

        await auditOrderItem(req, {
            action: 'ORDER_ITEM_VIEW_FAILED',
            entityId: id,
            description: 'Failed to retrieve order item'
        });

        return res.status(500).json({
            message: 'Failed to retrieve order item'
        });
    }
};

// CREATE order item

exports.createOrderItem = async (req, res) => {
    await auditOrderItem(req, {
        action: 'ORDER_ITEM_CREATE_REJECTED',
        description:
            'Direct order-item creation is disabled until pricing and inventory validation are enforced',
        newValues: {
            order_id: req.body?.order_id ?? null,
            item_id: req.body?.item_id ?? null
        }
    });

    return res.status(403).json({
        message:
            'Direct order-item creation is disabled. Use the authorized order workflow.'
    });
};


// UPDATE order item


exports.updateOrderItem = async (req, res) => {
    const { id } = req.params;

    try {
        await auditOrderItem(req, {
            action: 'ORDER_ITEM_UPDATE_REJECTED',
            entityId: id,
            description:
                'Order item update blocked until inventory and financial reconciliation is implemented',
            newValues: {
                requested_fields:
                    req.body && typeof req.body === 'object'
                        ? Object.keys(req.body)
                        : []
            }
        });

        return res.status(409).json({
            message:
                'Order item updates are temporarily disabled. Use the authorized order workflow.'
        });
    } catch (error) {
        console.error('Update order item error:', error);

        return res.status(500).json({
            message: 'Failed to process order item update'
        });
    }
};

// DELETE order item

exports.deleteOrderItem = async (req, res) => {
    const { id } = req.params;

    try {
        await auditOrderItem(req, {
            action: 'ORDER_ITEM_DELETE_REJECTED',
            entityId: id,
            description:
                'Order item deletion blocked until inventory and financial reconciliation is implemented'
        });

        return res.status(409).json({
            message:
                'Direct order item deletion is temporarily disabled. Use the authorized order workflow.'
        });
    } catch (error) {
        console.error('Delete order item error:', error);

        return res.status(500).json({
            message: 'Failed to process order item deletion'
        });
    }
};

