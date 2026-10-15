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
    const {
        order_id,
        item_id,
        quantity,
        unit_price,
        discount_amount,
        tax_amount,
        line_total
    } = req.body;

    try {
        if (
            !order_id ||
            !item_id ||
            quantity === undefined ||
            unit_price === undefined
        ) {
            await auditOrderItem(req, {
                action: 'ORDER_ITEM_CREATE_REJECTED',
                description: 'Order item creation rejected: required fields missing',
                newValues: {
                    order_id: order_id ?? null,
                    item_id: item_id ?? null,
                    quantity: quantity ?? null
                }
            });

            return res.status(400).json({
                message: 'order_id, item_id, quantity and unit_price are required'
            });
        }

        const parsedQuantity = Number(quantity);
        const parsedUnitPrice = Number(unit_price);
        const parsedDiscount = Number(discount_amount ?? 0);
        const parsedTax = Number(tax_amount ?? 0);

        if (
            !Number.isFinite(parsedQuantity) ||
            parsedQuantity <= 0 ||
            !Number.isFinite(parsedUnitPrice) ||
            parsedUnitPrice < 0 ||
            !Number.isFinite(parsedDiscount) ||
            parsedDiscount < 0 ||
            !Number.isFinite(parsedTax) ||
            parsedTax < 0
        ) {
            await auditOrderItem(req, {
                action: 'ORDER_ITEM_CREATE_REJECTED',
                description: 'Order item creation rejected: invalid quantity or monetary values',
                newValues: {
                    order_id,
                    item_id,
                    quantity,
                    unit_price,
                    discount_amount: discount_amount ?? 0,
                    tax_amount: tax_amount ?? 0
                }
            });

            return res.status(400).json({
                message: 'Quantity must be positive and monetary values must be valid non-negative numbers'
            });
        }

        const order = await Order.findByPk(order_id);

        if (!order) {
            await auditOrderItem(req, {
                action: 'ORDER_ITEM_CREATE_REJECTED',
                description: 'Order item creation rejected: order not found',
                newValues: { order_id, item_id }
            });

            return res.status(404).json({
                message: 'Order not found'
            });
        }

        const item = await Item.findByPk(item_id);

        if (!item) {
            await auditOrderItem(req, {
                action: 'ORDER_ITEM_CREATE_REJECTED',
                description: 'Order item creation rejected: item not found',
                newValues: { order_id, item_id }
            });

            return res.status(404).json({
                message: 'Item not found'
            });
        }

        const calculatedLineTotal =
            parsedQuantity * parsedUnitPrice -
            parsedDiscount +
            parsedTax;

        if (
            !Number.isFinite(calculatedLineTotal) ||
            calculatedLineTotal < 0
        ) {
            await auditOrderItem(req, {
                action: 'ORDER_ITEM_CREATE_REJECTED',
                description: 'Order item creation rejected: invalid calculated line total',
                newValues: { order_id, item_id }
            });

            return res.status(400).json({
                message: 'Calculated line total must be valid and non-negative'
            });
        }

        // Calculate totals on the server; do not trust a client-supplied total.
        const orderItem = await OrderItem.create({
            order_id,
            item_id,
            quantity: parsedQuantity,
            unit_price: parsedUnitPrice,
            discount_amount: parsedDiscount,
            tax_amount: parsedTax,
            line_total: calculatedLineTotal
        });

        await auditOrderItem(req, {
            action: 'ORDER_ITEM_CREATED',
            entityId: orderItem.id,
            description: 'Created an order item',
            newValues: getOrderItemSnapshot(orderItem)
        });

        return res.status(201).json({
            message: 'Order item created successfully',
            data: orderItem
        });
    } catch (error) {
        console.error('Create order item error:', error);

        await auditOrderItem(req, {
            action: 'ORDER_ITEM_CREATE_FAILED',
            description: 'Failed to create order item',
            newValues: {
                order_id: order_id ?? null,
                item_id: item_id ?? null
            }
        });

        return res.status(500).json({
            message: 'Failed to create order item'
        });
    }
};

// UPDATE order item
exports.updateOrderItem = async (req, res) => {
    const { id } = req.params;

    try {
        const orderItem = await OrderItem.findByPk(id);

        if (!orderItem) {
            await auditOrderItem(req, {
                action: 'ORDER_ITEM_UPDATE_REJECTED',
                entityId: id,
                description: 'Order item update rejected: record not found'
            });

            return res.status(404).json({
                message: 'Order item not found'
            });
        }

        const oldValues = getOrderItemSnapshot(orderItem);

        const allowedFields = [
            'quantity',
            'unit_price',
            'discount_amount',
            'tax_amount'
        ];

        const updates = {};

        for (const field of allowedFields) {
            if (req.body[field] !== undefined) {
                updates[field] = Number(req.body[field]);
            }
        }

        if (Object.keys(updates).length === 0) {
            await auditOrderItem(req, {
                action: 'ORDER_ITEM_UPDATE_REJECTED',
                entityId: orderItem.id,
                description: 'Order item update rejected: no permitted fields supplied',
                oldValues
            });

            return res.status(400).json({
                message: 'No valid fields provided for update'
            });
        }

        if (
            (
                updates.quantity !== undefined &&
                (!Number.isFinite(updates.quantity) || updates.quantity <= 0)
            ) ||
            (
                updates.unit_price !== undefined &&
                (!Number.isFinite(updates.unit_price) || updates.unit_price < 0)
            ) ||
            (
                updates.discount_amount !== undefined &&
                (!Number.isFinite(updates.discount_amount) || updates.discount_amount < 0)
            ) ||
            (
                updates.tax_amount !== undefined &&
                (!Number.isFinite(updates.tax_amount) || updates.tax_amount < 0)
            )
        ) {
            await auditOrderItem(req, {
                action: 'ORDER_ITEM_UPDATE_REJECTED',
                entityId: orderItem.id,
                description: 'Order item update rejected: invalid quantity or monetary values',
                oldValues
            });

            return res.status(400).json({
                message: 'Quantity must be positive and monetary values must be valid non-negative numbers'
            });
        }

        const newQuantity = updates.quantity ?? Number(orderItem.quantity);
        const newUnitPrice = updates.unit_price ?? Number(orderItem.unit_price);
        const newDiscount = updates.discount_amount ?? Number(orderItem.discount_amount ?? 0);
        const newTax = updates.tax_amount ?? Number(orderItem.tax_amount ?? 0);

        const calculatedLineTotal =
            newQuantity * newUnitPrice - newDiscount + newTax;

        if (
            !Number.isFinite(calculatedLineTotal) ||
            calculatedLineTotal < 0
        ) {
            await auditOrderItem(req, {
                action: 'ORDER_ITEM_UPDATE_REJECTED',
                entityId: orderItem.id,
                description: 'Order item update rejected: invalid calculated line total',
                oldValues
            });

            return res.status(400).json({
                message: 'Calculated line total must be valid and non-negative'
            });
        }

        updates.line_total = calculatedLineTotal;

        await orderItem.update(updates);

        await auditOrderItem(req, {
            action: 'ORDER_ITEM_UPDATED',
            entityId: orderItem.id,
            description: 'Updated an order item',
            oldValues,
            newValues: getOrderItemSnapshot(orderItem)
        });

        return res.status(200).json({
            message: 'Order item updated successfully',
            data: orderItem
        });
    } catch (error) {
        console.error('Update order item error:', error);

        await auditOrderItem(req, {
            action: 'ORDER_ITEM_UPDATE_FAILED',
            entityId: id,
            description: 'Failed to update order item'
        });

        return res.status(500).json({
            message: 'Failed to update order item'
        });
    }
};

// DELETE order item
exports.deleteOrderItem = async (req, res) => {
    const { id } = req.params;

    try {
        const orderItem = await OrderItem.findByPk(id);

        if (!orderItem) {
            await auditOrderItem(req, {
                action: 'ORDER_ITEM_DELETE_REJECTED',
                entityId: id,
                description: 'Order item deletion rejected: record not found'
            });

            return res.status(404).json({
                message: 'Order item not found'
            });
        }

        const oldValues = getOrderItemSnapshot(orderItem);

        await orderItem.destroy();

        await auditOrderItem(req, {
            action: 'ORDER_ITEM_DELETED',
            entityId: id,
            description: 'Deleted an order item',
            oldValues
        });

        return res.status(200).json({
            message: 'Order item deleted successfully'
        });
    } catch (error) {
        console.error('Delete order item error:', error);

        await auditOrderItem(req, {
            action: 'ORDER_ITEM_DELETE_FAILED',
            entityId: id,
            description: 'Failed to delete order item'
        });

        return res.status(500).json({
            message: 'Failed to delete order item'
        });
    }
};
