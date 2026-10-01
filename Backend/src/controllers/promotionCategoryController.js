const { PromotionCategory, Promotion, Category } = require('../models');

const getAllPromotionCategories = async (req, res) => {
    try {
        const data = await PromotionCategory.findAll({
            include: [
                {
                    model: Promotion,
                    as: 'promotion',
                    attributes: [
                        'id',
                        'promotion_code',
                        'promotion_name',
                        'promotion_type',
                        'status',
                        'is_active'
                    ]
                },
                {
                    model: Category,
                    as: 'category',
                    attributes: [
                        'id',
                        'category_name'
                    ]
                }
            ],
            order: [['id', 'DESC']]
        });

        res.status(200).json({
            message: 'Promotion categories retrieved successfully',
            data
        });
    } catch (error) {
        console.error('Get promotion categories error:', error);

        res.status(500).json({
            message: 'Failed to retrieve promotion categories',
            error: error.message
        });
    }
};


const getPromotionCategoryById = async (req, res) => {
    try {
        const { id } = req.params;

        const data = await PromotionCategory.findByPk(id, {
            include: [
                {
                    model: Promotion,
                    as: 'promotion',
                    attributes: [
                        'id',
                        'promotion_code',
                        'promotion_name',
                        'promotion_type',
                        'status',
                        'is_active'
                    ]
                },
                {
                    model: Category,
                    as: 'category',
                    attributes: [
                        'id',
                        'category_name'
                    ]
                }
            ]
        });

        if (!data) {
            return res.status(404).json({
                message: 'Promotion category not found'
            });
        }

        res.status(200).json({
            message: 'Promotion category retrieved successfully',
            data
        });
    } catch (error) {
        console.error('Get promotion category error:', error);

        res.status(500).json({
            message: 'Failed to retrieve promotion category',
            error: error.message
        });
    }
};


const createPromotionCategory = async (req, res) => {
    try {
        const {
            promotion_id,
            category_id
        } = req.body;

        if (!promotion_id || !category_id) {
            return res.status(400).json({
                message: 'promotion_id and category_id are required'
            });
        }

        const promotion = await Promotion.findByPk(promotion_id);

        if (!promotion) {
            return res.status(404).json({
                message: 'Promotion not found'
            });
        }

        const category = await Category.findByPk(category_id);

        if (!category) {
            return res.status(404).json({
                message: 'Category not found'
            });
        }

        const existing = await PromotionCategory.findOne({
            where: {
                promotion_id,
                category_id
            }
        });

        if (existing) {
            return res.status(409).json({
                message: 'This category is already assigned to the promotion'
            });
        }

        const data = await PromotionCategory.create({
            promotion_id,
            category_id
        });

        res.status(201).json({
            message: 'Promotion category created successfully',
            data
        });
    } catch (error) {
        console.error('Create promotion category error:', error);

        res.status(500).json({
            message: 'Failed to create promotion category',
            error: error.message
        });
    }
};


const updatePromotionCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            promotion_id,
            category_id
        } = req.body;

        const data = await PromotionCategory.findByPk(id);

        if (!data) {
            return res.status(404).json({
                message: 'Promotion category not found'
            });
        }

        if (promotion_id) {
            const promotion = await Promotion.findByPk(promotion_id);

            if (!promotion) {
                return res.status(404).json({
                    message: 'Promotion not found'
                });
            }
        }

        if (category_id) {
            const category = await Category.findByPk(category_id);

            if (!category) {
                return res.status(404).json({
                    message: 'Category not found'
                });
            }
        }

        const newPromotionId = promotion_id || data.promotion_id;
        const newCategoryId = category_id || data.category_id;

        const existing = await PromotionCategory.findOne({
            where: {
                promotion_id: newPromotionId,
                category_id: newCategoryId
            }
        });

        if (existing && existing.id !== data.id) {
            return res.status(409).json({
                message: 'This category is already assigned to the promotion'
            });
        }

        await data.update({
            promotion_id: newPromotionId,
            category_id: newCategoryId
        });

        res.status(200).json({
            message: 'Promotion category updated successfully',
            data
        });
    } catch (error) {
        console.error('Update promotion category error:', error);

        res.status(500).json({
            message: 'Failed to update promotion category',
            error: error.message
        });
    }
};


const deletePromotionCategory = async (req, res) => {
    try {
        const { id } = req.params;

        const data = await PromotionCategory.findByPk(id);

        if (!data) {
            return res.status(404).json({
                message: 'Promotion category not found'
            });
        }

        await data.destroy();

        res.status(200).json({
            message: 'Promotion category deleted successfully'
        });
    } catch (error) {
        console.error('Delete promotion category error:', error);

        res.status(500).json({
            message: 'Failed to delete promotion category',
            error: error.message
        });
    }
};


module.exports = {
    getAllPromotionCategories,
    getPromotionCategoryById,
    createPromotionCategory,
    updatePromotionCategory,
    deletePromotionCategory
};
