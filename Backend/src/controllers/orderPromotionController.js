'use strict';

const { OrderPromotion, Order, Promotion } = require('../models');
const { recordAuditLog } = require('../services/auditLogService');

const AUDIT_MODULE = 'ORDER_PROMOTION';

const getActorId = (req) =>
    req.user?.id ?? req.user?.user_id ?? null;

const getOrderPromotionSnapshot = (record) => {
    if (!record) return null;

    return {
        id: record.id,
        order_id: record.order_id,
        promotion_id: record.promotion_id,
        promotion_code: record.promotion_code,
        discount_amount: record.discount_amount
    };
};

const auditOrderPromotion = async (
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
            entityType: 'OrderPromotion',
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
            'Order promotion audit logging failed:',
            auditError.message
        );
    }
};

const getOrderPromotionIncludes = () => [
    {
        model: Order,
        as: 'order',
        attributes: ['id', 'order_number', 'customer_id', 'status']
    },
    {
        model: Promotion,
        as: 'promotion'
    }
];

const validateDiscountAmount = (value) => {
    if (value === undefined || value === null || value === '') {
        return false;
    }

    const amount = Number(value);

    return Number.isFinite(amount) && amount >= 0;
};

// GET /api/order-promotions
exports.getAllOrderPromotions = async (req, res) => {
    try {
        const orderPromotions = await OrderPromotion.findAll({
            include: getOrderPromotionIncludes(),
            order: [['id', 'DESC']]
        });

        await auditOrderPromotion(req, {
            action: 'ORDER_PROMOTION_LIST_VIEWED',
            description: 'Retrieved order promotion records'
        });

        return res.status(200).json({
            message: 'Order promotions retrieved successfully',
            data: orderPromotions
        });
    } catch (error) {
        console.error('Get order promotions error:', error);

        await auditOrderPromotion(req, {
            action: 'ORDER_PROMOTION_LIST_FAILED',
            description: 'Failed to retrieve order promotions'
        });

        return res.status(500).json({
            message: 'Failed to retrieve order promotions'
        });
    }
};

// GET /api/order-promotions/:id
exports.getOrderPromotionById = async (req, res) => {
    const { id } = req.params;

    try {
        const orderPromotion = await OrderPromotion.findByPk(id, {
            include: getOrderPromotionIncludes()
        });

        if (!orderPromotion) {
            await auditOrderPromotion(req, {
                action: 'ORDER_PROMOTION_NOT_FOUND',
                entityId: id,
                description: 'Requested order promotion was not found'
            });

            return res.status(404).json({
                message: 'Order promotion not found'
            });
        }

        await auditOrderPromotion(req, {
            action: 'ORDER_PROMOTION_VIEWED',
            entityId: orderPromotion.id,
            description: 'Retrieved an order promotion'
        });

        return res.status(200).json({
            message: 'Order promotion retrieved successfully',
            data: orderPromotion
        });
    } catch (error) {
        console.error('Get order promotion error:', error);

        await auditOrderPromotion(req, {
            action: 'ORDER_PROMOTION_VIEW_FAILED',
            entityId: id,
            description: 'Failed to retrieve order promotion'
        });

        return res.status(500).json({
            message: 'Failed to retrieve order promotion'
        });
    }
};

// POST /api/order-promotions
exports.createOrderPromotion = async (req, res) => {
    const {
        order_id,
        promotion_id,
        promotion_code,
        discount_amount
    } = req.body;

    try {
        if (!order_id || !promotion_id || !promotion_code) {
            await auditOrderPromotion(req, {
                action: 'ORDER_PROMOTION_CREATE_REJECTED',
                description: 'Creation rejected: required fields missing',
                newValues: {
                    order_id: order_id ?? null,
                    promotion_id: promotion_id ?? null,
                    promotion_code: promotion_code ?? null
                }
            });

            return res.status(400).json({
                message: 'order_id, promotion_id and promotion_code are required'
            });
        }

        if (
            discount_amount !== undefined &&
            !validateDiscountAmount(discount_amount)
        ) {
            await auditOrderPromotion(req, {
                action: 'ORDER_PROMOTION_CREATE_REJECTED',
                description: 'Creation rejected: invalid discount amount',
                newValues: {
                    order_id,
                    promotion_id,
                    promotion_code
                }
            });

            return res.status(400).json({
                message: 'Discount amount must be a valid non-negative number'
            });
        }

        const order = await Order.findByPk(order_id);

        if (!order) {
            await auditOrderPromotion(req, {
                action: 'ORDER_PROMOTION_CREATE_REJECTED',
                description: 'Creation rejected: order not found',
                newValues: { order_id, promotion_id }
            });

            return res.status(404).json({
                message: 'Order not found'
            });
        }

        const promotion = await Promotion.findByPk(promotion_id);

        if (!promotion) {
            await auditOrderPromotion(req, {
                action: 'ORDER_PROMOTION_CREATE_REJECTED',
                description: 'Creation rejected: promotion not found',
                newValues: { order_id, promotion_id }
            });

            return res.status(404).json({
                message: 'Promotion not found'
            });
        }

        const orderPromotion = await OrderPromotion.create({
            order_id,
            promotion_id,
            promotion_code,
            discount_amount: discount_amount === undefined
                ? 0
                : Number(discount_amount)
        });

        await auditOrderPromotion(req, {
            action: 'ORDER_PROMOTION_CREATED',
            entityId: orderPromotion.id,
            description: 'Created an order promotion',
            newValues: getOrderPromotionSnapshot(orderPromotion)
        });

        const createdOrderPromotion = await OrderPromotion.findByPk(
            orderPromotion.id,
            {
                include: getOrderPromotionIncludes()
            }
        );

        return res.status(201).json({
            message: 'Order promotion created successfully',
            data: createdOrderPromotion
        });
    } catch (error) {
        console.error('Create order promotion error:', error);

        await auditOrderPromotion(req, {
            action: 'ORDER_PROMOTION_CREATE_FAILED',
            description: 'Failed to create order promotion',
            newValues: {
                order_id: order_id ?? null,
                promotion_id: promotion_id ?? null
            }
        });

        return res.status(500).json({
            message: 'Failed to create order promotion'
        });
    }
};

// PUT /api/order-promotions/:id
exports.updateOrderPromotion = async (req, res) => {
    const { id } = req.params;

    try {
        const orderPromotion = await OrderPromotion.findByPk(id);

        if (!orderPromotion) {
            await auditOrderPromotion(req, {
                action: 'ORDER_PROMOTION_UPDATE_REJECTED',
                entityId: id,
                description: 'Update rejected: order promotion not found'
            });

            return res.status(404).json({
                message: 'Order promotion not found'
            });
        }

        const oldValues = getOrderPromotionSnapshot(orderPromotion);

        const {
            order_id,
            promotion_id,
            promotion_code,
            discount_amount
        } = req.body;

        const updates = {};

        if (order_id !== undefined) {
            const order = await Order.findByPk(order_id);

            if (!order) {
                await auditOrderPromotion(req, {
                    action: 'ORDER_PROMOTION_UPDATE_REJECTED',
                    entityId: orderPromotion.id,
                    description: 'Update rejected: order not found',
                    oldValues
                });

                return res.status(404).json({
                    message: 'Order not found'
                });
            }

            updates.order_id = order_id;
        }

        if (promotion_id !== undefined) {
            const promotion = await Promotion.findByPk(promotion_id);

            if (!promotion) {
                await auditOrderPromotion(req, {
                    action: 'ORDER_PROMOTION_UPDATE_REJECTED',
                    entityId: orderPromotion.id,
                    description: 'Update rejected: promotion not found',
                    oldValues
                });

                return res.status(404).json({
                    message: 'Promotion not found'
                });
            }

            updates.promotion_id = promotion_id;
        }

        if (promotion_code !== undefined) {
            if (
                typeof promotion_code !== 'string' ||
                !promotion_code.trim()
            ) {
                await auditOrderPromotion(req, {
                    action: 'ORDER_PROMOTION_UPDATE_REJECTED',
                    entityId: orderPromotion.id,
                    description: 'Update rejected: invalid promotion code',
                    oldValues
                });

                return res.status(400).json({
                    message: 'Promotion code must be a non-empty string'
                });
            }

            updates.promotion_code = promotion_code.trim();
        }

        if (discount_amount !== undefined) {
            if (!validateDiscountAmount(discount_amount)) {
                await auditOrderPromotion(req, {
                    action: 'ORDER_PROMOTION_UPDATE_REJECTED',
                    entityId: orderPromotion.id,
                    description: 'Update rejected: invalid discount amount',
                    oldValues
                });

                return res.status(400).json({
                    message: 'Discount amount must be a valid non-negative number'
                });
            }

            updates.discount_amount = Number(discount_amount);
        }

        if (Object.keys(updates).length === 0) {
            await auditOrderPromotion(req, {
                action: 'ORDER_PROMOTION_UPDATE_REJECTED',
                entityId: orderPromotion.id,
                description: 'Update rejected: no permitted fields supplied',
                oldValues
            });

            return res.status(400).json({
                message: 'No valid fields provided for update'
            });
        }

        await orderPromotion.update(updates);

        await auditOrderPromotion(req, {
            action: 'ORDER_PROMOTION_UPDATED',
            entityId: orderPromotion.id,
            description: 'Updated an order promotion',
            oldValues,
            newValues: getOrderPromotionSnapshot(orderPromotion)
        });

        const updatedOrderPromotion = await OrderPromotion.findByPk(
            orderPromotion.id,
            {
                include: getOrderPromotionIncludes()
            }
        );

        return res.status(200).json({
            message: 'Order promotion updated successfully',
            data: updatedOrderPromotion
        });
    } catch (error) {
        console.error('Update order promotion error:', error);

        await auditOrderPromotion(req, {
            action: 'ORDER_PROMOTION_UPDATE_FAILED',
            entityId: id,
            description: 'Failed to update order promotion'
        });

        return res.status(500).json({
            message: 'Failed to update order promotion'
        });
    }
};

// DELETE /api/order-promotions/:id
exports.deleteOrderPromotion = async (req, res) => {
    const { id } = req.params;

    try {
        const orderPromotion = await OrderPromotion.findByPk(id);

        if (!orderPromotion) {
            await auditOrderPromotion(req, {
                action: 'ORDER_PROMOTION_DELETE_REJECTED',
                entityId: id,
                description: 'Deletion rejected: order promotion not found'
            });

            return res.status(404).json({
                message: 'Order promotion not found'
            });
        }

        const oldValues = getOrderPromotionSnapshot(orderPromotion);

        await orderPromotion.destroy();

        await auditOrderPromotion(req, {
            action: 'ORDER_PROMOTION_DELETED',
            entityId: id,
            description: 'Deleted an order promotion',
            oldValues
        });

        return res.status(200).json({
            message: 'Order promotion deleted successfully'
        });
    } catch (error) {
        console.error('Delete order promotion error:', error);

        await auditOrderPromotion(req, {
            action: 'ORDER_PROMOTION_DELETE_FAILED',
            entityId: id,
            description: 'Failed to delete order promotion'
        });

        return res.status(500).json({
            message: 'Failed to delete order promotion'
        });
    }
};
