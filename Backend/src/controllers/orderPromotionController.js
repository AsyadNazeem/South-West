'use strict';

const { OrderPromotion, Order, Promotion } = require('../models');

// GET /api/order-promotions
exports.getAllOrderPromotions = async (req, res) => {
    try {
        const orderPromotions = await OrderPromotion.findAll({
            include: [
                {
                    model: Order,
                    as: 'order',
                    attributes: ['id', 'order_number', 'customer_id', 'status']
                },
                {
                    model: Promotion,
                    as: 'promotion'
                }
            ],
            order: [['id', 'DESC']]
        });

        res.status(200).json({
            message: 'Order promotions retrieved successfully',
            data: orderPromotions
        });
    } catch (error) {
        console.error('Get order promotions error:', error);

        res.status(500).json({
            message: 'Failed to retrieve order promotions',
            error: error.message
        });
    }
};


// GET /api/order-promotions/:id
exports.getOrderPromotionById = async (req, res) => {
    try {
        const { id } = req.params;

        const orderPromotion = await OrderPromotion.findByPk(id, {
            include: [
                {
                    model: Order,
                    as: 'order',
                    attributes: ['id', 'order_number', 'customer_id', 'status']
                },
                {
                    model: Promotion,
                    as: 'promotion'
                }
            ]
        });

        if (!orderPromotion) {
            return res.status(404).json({
                message: 'Order promotion not found'
            });
        }

        res.status(200).json({
            message: 'Order promotion retrieved successfully',
            data: orderPromotion
        });
    } catch (error) {
        console.error('Get order promotion error:', error);

        res.status(500).json({
            message: 'Failed to retrieve order promotion',
            error: error.message
        });
    }
};


// POST /api/order-promotions
exports.createOrderPromotion = async (req, res) => {
    try {
        const {
            order_id,
            promotion_id,
            promotion_code,
            discount_amount
        } = req.body;

        if (!order_id || !promotion_id || !promotion_code) {
            return res.status(400).json({
                message: 'order_id, promotion_id and promotion_code are required'
            });
        }

        const order = await Order.findByPk(order_id);

        if (!order) {
            return res.status(404).json({
                message: 'Order not found'
            });
        }

        const promotion = await Promotion.findByPk(promotion_id);

        if (!promotion) {
            return res.status(404).json({
                message: 'Promotion not found'
            });
        }

        const orderPromotion = await OrderPromotion.create({
            order_id,
            promotion_id,
            promotion_code,
            discount_amount: discount_amount || 0
        });

        const createdOrderPromotion = await OrderPromotion.findByPk(
            orderPromotion.id,
            {
                include: [
                    {
                        model: Order,
                        as: 'order',
                        attributes: ['id', 'order_number', 'customer_id', 'status']
                    },
                    {
                        model: Promotion,
                        as: 'promotion'
                    }
                ]
            }
        );

        res.status(201).json({
            message: 'Order promotion created successfully',
            data: createdOrderPromotion
        });
    } catch (error) {
        console.error('Create order promotion error:', error);

        res.status(500).json({
            message: 'Failed to create order promotion',
            error: error.message
        });
    }
};


// PUT /api/order-promotions/:id
exports.updateOrderPromotion = async (req, res) => {
    try {
        const { id } = req.params;

        const orderPromotion = await OrderPromotion.findByPk(id);

        if (!orderPromotion) {
            return res.status(404).json({
                message: 'Order promotion not found'
            });
        }

        const {
            order_id,
            promotion_id,
            promotion_code,
            discount_amount
        } = req.body;

        if (order_id !== undefined) {
            const order = await Order.findByPk(order_id);

            if (!order) {
                return res.status(404).json({
                    message: 'Order not found'
                });
            }
        }

        if (promotion_id !== undefined) {
            const promotion = await Promotion.findByPk(promotion_id);

            if (!promotion) {
                return res.status(404).json({
                    message: 'Promotion not found'
                });
            }
        }

        await orderPromotion.update({
            order_id: order_id ?? orderPromotion.order_id,
            promotion_id: promotion_id ?? orderPromotion.promotion_id,
            promotion_code: promotion_code ?? orderPromotion.promotion_code,
            discount_amount: discount_amount ?? orderPromotion.discount_amount
        });

        res.status(200).json({
            message: 'Order promotion updated successfully',
            data: orderPromotion
        });
    } catch (error) {
        console.error('Update order promotion error:', error);

        res.status(500).json({
            message: 'Failed to update order promotion',
            error: error.message
        });
    }
};


// DELETE /api/order-promotions/:id
exports.deleteOrderPromotion = async (req, res) => {
    try {
        const { id } = req.params;

        const orderPromotion = await OrderPromotion.findByPk(id);

        if (!orderPromotion) {
            return res.status(404).json({
                message: 'Order promotion not found'
            });
        }

        await orderPromotion.destroy();

        res.status(200).json({
            message: 'Order promotion deleted successfully'
        });
    } catch (error) {
        console.error('Delete order promotion error:', error);

        res.status(500).json({
            message: 'Failed to delete order promotion',
            error: error.message
        });
    }
};
