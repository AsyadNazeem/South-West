'use strict';

const { ItemImage, Item } = require('../models');

// GET /api/item-images
const getItemImages = async (req, res) => {
    try {
        const images = await ItemImage.findAll({
            include: [
                {
                    model: Item,
                    as: 'item',
                    attributes: [
                        'id',
                        'item_code',
                        'item_name'
                    ]
                }
            ],
            order: [
                ['item_id', 'ASC'],
                ['sort_order', 'ASC'],
                ['id', 'ASC']
            ]
        });

        return res.status(200).json({
            message: 'Item images retrieved successfully',
            data: images
        });
    } catch (error) {
        console.error('Get item images error:', error);

        return res.status(500).json({
            message: 'Failed to retrieve item images'
        });
    }
};


// GET /api/item-images/:id
const getItemImageById = async (req, res) => {
    try {
        const { id } = req.params;

        const image = await ItemImage.findByPk(id, {
            include: [
                {
                    model: Item,
                    as: 'item',
                    attributes: [
                        'id',
                        'item_code',
                        'item_name'
                    ]
                }
            ]
        });

        if (!image) {
            return res.status(404).json({
                message: 'Item image not found'
            });
        }

        return res.status(200).json({
            message: 'Item image retrieved successfully',
            data: image
        });
    } catch (error) {
        console.error('Get item image error:', error);

        return res.status(500).json({
            message: 'Failed to retrieve item image'
        });
    }
};


// POST /api/item-images
const createItemImage = async (req, res) => {
    try {
        const {
            item_id,
            image_url,
            alt_text,
            sort_order,
            is_primary,
            is_active
        } = req.body;

        if (!item_id) {
            return res.status(400).json({
                message: 'Item ID is required'
            });
        }

        if (!image_url) {
            return res.status(400).json({
                message: 'Image URL is required'
            });
        }

        const item = await Item.findByPk(item_id);

        if (!item) {
            return res.status(404).json({
                message: 'Item not found'
            });
        }

        const image = await ItemImage.create({
            item_id,
            image_url,
            alt_text: alt_text || null,
            sort_order: sort_order ?? 0,
            is_primary: is_primary ?? false,
            is_active: is_active ?? true
        });

        return res.status(201).json({
            message: 'Item image created successfully',
            data: image
        });
    } catch (error) {
        console.error('Create item image error:', error);

        return res.status(500).json({
            message: 'Failed to create item image'
        });
    }
};


// PUT /api/item-images/:id
const updateItemImage = async (req, res) => {
    try {
        const { id } = req.params;

        const image = await ItemImage.findByPk(id);

        if (!image) {
            return res.status(404).json({
                message: 'Item image not found'
            });
        }

        const {
            item_id,
            image_url,
            alt_text,
            sort_order,
            is_primary,
            is_active
        } = req.body;

        if (item_id !== undefined) {
            const item = await Item.findByPk(item_id);

            if (!item) {
                return res.status(404).json({
                    message: 'Item not found'
                });
            }
        }

        await image.update({
            ...(item_id !== undefined && { item_id }),
            ...(image_url !== undefined && { image_url }),
            ...(alt_text !== undefined && { alt_text }),
            ...(sort_order !== undefined && { sort_order }),
            ...(is_primary !== undefined && { is_primary }),
            ...(is_active !== undefined && { is_active })
        });

        return res.status(200).json({
            message: 'Item image updated successfully',
            data: image
        });
    } catch (error) {
        console.error('Update item image error:', error);

        return res.status(500).json({
            message: 'Failed to update item image'
        });
    }
};


// DELETE /api/item-images/:id
const deleteItemImage = async (req, res) => {
    try {
        const { id } = req.params;

        const image = await ItemImage.findByPk(id);

        if (!image) {
            return res.status(404).json({
                message: 'Item image not found'
            });
        }

        await image.destroy();

        return res.status(200).json({
            message: 'Item image deleted successfully'
        });
    } catch (error) {
        console.error('Delete item image error:', error);

        return res.status(500).json({
            message: 'Failed to delete item image'
        });
    }
};


module.exports = {
    getItemImages,
    getItemImageById,
    createItemImage,
    updateItemImage,
    deleteItemImage
};
