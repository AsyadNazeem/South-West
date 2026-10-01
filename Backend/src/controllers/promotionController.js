'use strict';

const { Promotion, User, PromotionItem, PromotionCategory, OrderPromotion } = require('../models');


// GET ALL PROMOTIONS
exports.getAllPromotions = async (req, res) => {
    try {
        const promotions = await Promotion.findAll({
            include: [
                {
                    model: User,
                    as: 'creator',
                    attributes: ['id', 'email', 'is_active']
                },
                {
                    model: PromotionItem,
                    as: 'items'
                },
                {
                    model: PromotionCategory,
                    as: 'categories'
                }
            ],
            order: [['id', 'DESC']]
        });

        return res.status(200).json({
            message: 'Promotions retrieved successfully',
            data: promotions
        });

    } catch (error) {
        console.error('Get promotions error:', error);

        return res.status(500).json({
            message: 'Failed to retrieve promotions',
            error: error.message
        });
    }
};


// GET PROMOTION BY ID
exports.getPromotionById = async (req, res) => {
    try {
        const { id } = req.params;

        const promotion = await Promotion.findByPk(id, {
            include: [
                {
                    model: User,
                    as: 'creator',
                    attributes: ['id', 'email', 'is_active']
                },
                {
                    model: PromotionItem,
                    as: 'items'
                },
                {
                    model: PromotionCategory,
                    as: 'categories'
                },
                {
                    model: OrderPromotion,
                    as: 'orderPromotions'
                }
            ]
        });

        if (!promotion) {
            return res.status(404).json({
                message: 'Promotion not found'
            });
        }

        return res.status(200).json({
            message: 'Promotion retrieved successfully',
            data: promotion
        });

    } catch (error) {
        console.error('Get promotion error:', error);

        return res.status(500).json({
            message: 'Failed to retrieve promotion',
            error: error.message
        });
    }
};


// CREATE PROMOTION
exports.createPromotion = async (req, res) => {
    try {
        const {
            promotion_code,
            promotion_name,
            description,
            promotion_type,
            discount_value,
            minimum_order_amount,
            maximum_discount_amount,
            usage_limit,
            usage_limit_per_customer,
            start_date,
            end_date,
            status,
            is_active,
            created_by
        } = req.body;

        if (!promotion_code || !promotion_name || !promotion_type) {
            return res.status(400).json({
                message: 'promotion_code, promotion_name and promotion_type are required'
            });
        }

        if (!start_date || !end_date) {
            return res.status(400).json({
                message: 'start_date and end_date are required'
            });
        }

        const existingPromotion = await Promotion.findOne({
            where: {
                promotion_code
            }
        });

        if (existingPromotion) {
            return res.status(409).json({
                message: 'Promotion code already exists'
            });
        }

        const promotion = await Promotion.create({
            promotion_code,
            promotion_name,
            description: description || null,
            promotion_type,
            discount_value: discount_value ?? null,
            minimum_order_amount: minimum_order_amount ?? null,
            maximum_discount_amount: maximum_discount_amount ?? null,
            usage_limit: usage_limit ?? null,
            usage_limit_per_customer: usage_limit_per_customer ?? null,
            used_count: 0,
            start_date,
            end_date,
            status: status || 'draft',
            is_active: is_active ?? true,
            created_by: created_by || req.user?.userId || null
        });

        return res.status(201).json({
            message: 'Promotion created successfully',
            data: promotion
        });

    } catch (error) {
        console.error('Create promotion error:', error);

        return res.status(500).json({
            message: 'Failed to create promotion',
            error: error.message
        });
    }
};


// UPDATE PROMOTION
exports.updatePromotion = async (req, res) => {
    try {
        const { id } = req.params;

        const promotion = await Promotion.findByPk(id);

        if (!promotion) {
            return res.status(404).json({
                message: 'Promotion not found'
            });
        }

        const {
            promotion_code,
            promotion_name,
            description,
            promotion_type,
            discount_value,
            minimum_order_amount,
            maximum_discount_amount,
            usage_limit,
            usage_limit_per_customer,
            start_date,
            end_date,
            status,
            is_active
        } = req.body;

        if (
            promotion_code &&
            promotion_code !== promotion.promotion_code
        ) {
            const existingPromotion = await Promotion.findOne({
                where: {
                    promotion_code
                }
            });

            if (
                existingPromotion &&
                existingPromotion.id !== promotion.id
            ) {
                return res.status(409).json({
                    message: 'Promotion code already exists'
                });
            }
        }

        await promotion.update({
            promotion_code:
                promotion_code ?? promotion.promotion_code,

            promotion_name:
                promotion_name ?? promotion.promotion_name,

            description:
                description ?? promotion.description,

            promotion_type:
                promotion_type ?? promotion.promotion_type,

            discount_value:
                discount_value ?? promotion.discount_value,

            minimum_order_amount:
                minimum_order_amount ?? promotion.minimum_order_amount,

            maximum_discount_amount:
                maximum_discount_amount ?? promotion.maximum_discount_amount,

            usage_limit:
                usage_limit ?? promotion.usage_limit,

            usage_limit_per_customer:
                usage_limit_per_customer ??
                promotion.usage_limit_per_customer,

            start_date:
                start_date ?? promotion.start_date,

            end_date:
                end_date ?? promotion.end_date,

            status:
                status ?? promotion.status,

            is_active:
                is_active ?? promotion.is_active
        });

        return res.status(200).json({
            message: 'Promotion updated successfully',
            data: promotion
        });

    } catch (error) {
        console.error('Update promotion error:', error);

        return res.status(500).json({
            message: 'Failed to update promotion',
            error: error.message
        });
    }
};


// UPDATE PROMOTION STATUS
exports.updatePromotionStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const allowedStatuses = [
            'draft',
            'scheduled',
            'active',
            'paused',
            'expired',
            'cancelled'
        ];

        if (!status || !allowedStatuses.includes(status)) {
            return res.status(400).json({
                message: 'Invalid promotion status',
                allowed_statuses: allowedStatuses
            });
        }

        const promotion = await Promotion.findByPk(id);

        if (!promotion) {
            return res.status(404).json({
                message: 'Promotion not found'
            });
        }

        await promotion.update({
            status
        });

        return res.status(200).json({
            message: 'Promotion status updated successfully',
            data: promotion
        });

    } catch (error) {
        console.error('Update promotion status error:', error);

        return res.status(500).json({
            message: 'Failed to update promotion status',
            error: error.message
        });
    }
};


// DELETE PROMOTION
exports.deletePromotion = async (req, res) => {
    try {
        const { id } = req.params;

        const promotion = await Promotion.findByPk(id);

        if (!promotion) {
            return res.status(404).json({
                message: 'Promotion not found'
            });
        }

        await promotion.destroy();

        return res.status(200).json({
            message: 'Promotion deleted successfully'
        });

    } catch (error) {
        console.error('Delete promotion error:', error);

        return res.status(500).json({
            message: 'Failed to delete promotion',
            error: error.message
        });
    }
};
