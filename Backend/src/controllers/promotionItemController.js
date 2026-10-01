'use strict';

const { PromotionItem, Promotion, Item } = require('../models');

// GET /api/promotion-items
const getAllPromotionItems = async (req, res) => {
    try {
        const promotionItems = await PromotionItem.findAll({
            include: [
                {
                    model: Promotion,
                    as: 'promotion',
                    attributes: [
                        'id',
                        'promotion_code',
                        'promotion_name',
                        'status',
                        'is_active'
                    ]
                },
                {
                    model: Item,
                    as: 'item'
                }
            ],
            order: [['id', 'ASC']]
        });

        return res.status(200).json({
            message: 'Promotion items retrieved successfully',
            data: promotionItems
        });
    } catch (error) {
        console.error('Get promotion items error:', error);

        return res.status(500).json({
            message: 'Failed to retrieve promotion items',
            error: error.message
        });
    }
};


// GET /api/promotion-items/:id
const getPromotionItemById = async (req, res) => {
    try {
        const { id } = req.params;

        const promotionItem = await PromotionItem.findByPk(id, {
            include: [
                {
                    model: Promotion,
                    as: 'promotion',
                    attributes: [
                        'id',
                        'promotion_code',
                        'promotion_name',
                        'status',
                        'is_active'
                    ]
                },
                {
                    model: Item,
                    as: 'item'
                }
            ]
        });

        if (!promotionItem) {
            return res.status(404).json({
                message: 'Promotion item not found'
            });
        }

        return res.status(200).json({
            message: 'Promotion item retrieved successfully',
            data: promotionItem
        });
    } catch (error) {
        console.error('Get promotion item error:', error);

        return res.status(500).json({
            message: 'Failed to retrieve promotion item',
            error: error.message
        });
    }
};


// POST /api/promotion-items
const createPromotionItem = async (req, res) => {
    try {
        const {
            promotion_id,
            item_id
        } = req.body;

        if (!promotion_id || !item_id) {
            return res.status(400).json({
                message: 'promotion_id and item_id are required'
            });
        }

        // Check promotion exists
        const promotion = await Promotion.findByPk(promotion_id);

        if (!promotion) {
            return res.status(404).json({
                message: 'Promotion not found'
            });
        }

        // Check item exists
        const item = await Item.findByPk(item_id);

        if (!item) {
            return res.status(404).json({
                message: 'Item not found'
            });
        }

        // Prevent duplicate relationship
        const existingPromotionItem = await PromotionItem.findOne({
            where: {
                promotion_id,
                item_id
            }
        });

        if (existingPromotionItem) {
            return res.status(409).json({
                message: 'This item is already assigned to this promotion'
            });
        }

        const promotionItem = await PromotionItem.create({
            promotion_id,
            item_id
        });

        const createdPromotionItem = await PromotionItem.findByPk(
            promotionItem.id,
            {
                include: [
                    {
                        model: Promotion,
                        as: 'promotion',
                        attributes: [
                            'id',
                            'promotion_code',
                            'promotion_name',
                            'status',
                            'is_active'
                        ]
                    },
                    {
                        model: Item,
                        as: 'item'
                    }
                ]
            }
        );

        return res.status(201).json({
            message: 'Promotion item created successfully',
            data: createdPromotionItem
        });
    } catch (error) {
        console.error('Create promotion item error:', error);

        return res.status(500).json({
            message: 'Failed to create promotion item',
            error: error.message
        });
    }
};


// PUT /api/promotion-items/:id
const updatePromotionItem = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            promotion_id,
            item_id
        } = req.body;

        const promotionItem = await PromotionItem.findByPk(id);

        if (!promotionItem) {
            return res.status(404).json({
                message: 'Promotion item not found'
            });
        }

        // If promotion_id is being changed
        if (promotion_id !== undefined) {
            const promotion = await Promotion.findByPk(promotion_id);

            if (!promotion) {
                return res.status(404).json({
                    message: 'Promotion not found'
                });
            }
        }

        // If item_id is being changed
        if (item_id !== undefined) {
            const item = await Item.findByPk(item_id);

            if (!item) {
                return res.status(404).json({
                    message: 'Item not found'
                });
            }
        }

        const newPromotionId =
            promotion_id !== undefined
                ? promotion_id
                : promotionItem.promotion_id;

        const newItemId =
            item_id !== undefined
                ? item_id
                : promotionItem.item_id;

        // Prevent duplicate relationship
        const duplicate = await PromotionItem.findOne({
            where: {
                promotion_id: newPromotionId,
                item_id: newItemId
            }
        });

        if (duplicate && duplicate.id !== promotionItem.id) {
            return res.status(409).json({
                message: 'This item is already assigned to this promotion'
            });
        }

        await promotionItem.update({
            promotion_id: newPromotionId,
            item_id: newItemId
        });

        const updatedPromotionItem = await PromotionItem.findByPk(id, {
            include: [
                {
                    model: Promotion,
                    as: 'promotion',
                    attributes: [
                        'id',
                        'promotion_code',
                        'promotion_name',
                        'status',
                        'is_active'
                    ]
                },
                {
                    model: Item,
                    as: 'item'
                }
            ]
        });

        return res.status(200).json({
            message: 'Promotion item updated successfully',
            data: updatedPromotionItem
        });
    } catch (error) {
        console.error('Update promotion item error:', error);

        return res.status(500).json({
            message: 'Failed to update promotion item',
            error: error.message
        });
    }
};


// DELETE /api/promotion-items/:id
const deletePromotionItem = async (req, res) => {
    try {
        const { id } = req.params;

        const promotionItem = await PromotionItem.findByPk(id);

        if (!promotionItem) {
            return res.status(404).json({
                message: 'Promotion item not found'
            });
        }

        await promotionItem.destroy();

        return res.status(200).json({
            message: 'Promotion item deleted successfully'
        });
    } catch (error) {
        console.error('Delete promotion item error:', error);

        return res.status(500).json({
            message: 'Failed to delete promotion item',
            error: error.message
        });
    }
};


module.exports = {
    getAllPromotionItems,
    getPromotionItemById,
    createPromotionItem,
    updatePromotionItem,
    deletePromotionItem
};
