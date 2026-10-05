'use strict';

const { ItemType } = require('../models');

// Get all item types
const getAllItemTypes = async (req, res) => {
    try {
        const itemTypes = await ItemType.findAll({
            order: [['name', 'ASC']]
        });

        res.status(200).json({
            message: 'Item types retrieved successfully',
            data: itemTypes
        });
    } catch (error) {
        console.error('Error fetching item types:', error);

        res.status(500).json({
            message: 'Failed to fetch item types',
            error: error.message
        });
    }
};


// Get one item type
const getItemTypeById = async (req, res) => {
    try {
        const { id } = req.params;

        const itemType = await ItemType.findByPk(id);

        if (!itemType) {
            return res.status(404).json({
                message: 'Item type not found'
            });
        }

        res.status(200).json(itemType);
    } catch (error) {
        console.error('Error fetching item type:', error);

        res.status(500).json({
            message: 'Failed to fetch item type',
            error: error.message
        });
    }
};


// Create item type
const createItemType = async (req, res) => {
    try {
        const {
            name,
            code,
            description,
            is_active
        } = req.body;

        // Required fields
        if (!name || !code) {
            return res.status(400).json({
                message: 'Name and code are required'
            });
        }

        // Check duplicate name
        const existingName = await ItemType.findOne({
            where: { name }
        });

        if (existingName) {
            return res.status(409).json({
                message: 'An item type with this name already exists'
            });
        }

        // Check duplicate code
        const existingCode = await ItemType.findOne({
            where: { code }
        });

        if (existingCode) {
            return res.status(409).json({
                message: 'An item type with this code already exists'
            });
        }

        const itemType = await ItemType.create({
            name,
            code,
            description: description || null,
            is_active: is_active !== undefined ? is_active : true
        });

        res.status(201).json({
            message: 'Item type created successfully',
            itemType
        });

    } catch (error) {
        console.error('Error creating item type:', error);

        res.status(500).json({
            message: 'Failed to create item type',
            error: error.message
        });
    }
};


// Update item type
const updateItemType = async (req, res) => {
    try {
        const { id } = req.params;

        const {
            name,
            code,
            description,
            is_active
        } = req.body;

        const itemType = await ItemType.findByPk(id);

        if (!itemType) {
            return res.status(404).json({
                message: 'Item type not found'
            });
        }

        // Check duplicate name
        if (name && name !== itemType.name) {
            const existingName = await ItemType.findOne({
                where: { name }
            });

            if (existingName) {
                return res.status(409).json({
                    message: 'An item type with this name already exists'
                });
            }
        }

        // Check duplicate code
        if (code && code !== itemType.code) {
            const existingCode = await ItemType.findOne({
                where: { code }
            });

            if (existingCode) {
                return res.status(409).json({
                    message: 'An item type with this code already exists'
                });
            }
        }

        await itemType.update({
            name,
            code,
            description: description || null,
            is_active
        });

        res.status(200).json({
            message: 'Item type updated successfully',
            itemType
        });

    } catch (error) {
        console.error('Error updating item type:', error);

        res.status(500).json({
            message: 'Failed to update item type',
            error: error.message
        });
    }
};


// Delete item type
const deleteItemType = async (req, res) => {
    try {
        const { id } = req.params;

        const itemType = await ItemType.findByPk(id);

        if (!itemType) {
            return res.status(404).json({
                message: 'Item type not found'
            });
        }

        await itemType.destroy();

        res.status(200).json({
            message: 'Item type deleted successfully'
        });

    } catch (error) {
        console.error('Error deleting item type:', error);

        res.status(500).json({
            message: 'Failed to delete item type',
            error: error.message
        });
    }
};


module.exports = {
    getAllItemTypes,
    getItemTypeById,
    createItemType,
    updateItemType,
    deleteItemType
};
