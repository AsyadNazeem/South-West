const {
    Item,
    Brand,
    Category,
    Unit,
    ItemType
} = require('../models');

const getItems = async (req, res) => {
    try {
        const items = await Item.findAll({
            include: [
                {
                    model: Brand,
                    as: 'brand'
                },
                {
                    model: Category,
                    as: 'category'
                },
                {
                    model: Unit,
                    as: 'unitOfMeasure'
                },
                {
                    model: ItemType,
                    as: 'itemType'
                }
            ]
        });

        return res.status(200).json({
            message: 'Item retrieved successfully',
            data: items
        });

    } catch (error) {
        console.error('Get Item error:', error);

        return res.status(500).json({
            message: 'Failed to retrieve Item'
        });
    }
};


const getItemById = async (req, res) => {
    try {
        const { id } = req.params;

        const item = await Item.findByPk(id, {
            include: [
                {
                    model: Brand,
                    as: 'brand'
                },
                {
                    model: Category,
                    as: 'category'
                },
                {
                    model: Unit,
                    as: 'unitOfMeasure'
                },
                {
                    model: ItemType,
                    as: 'itemType'
                }
            ]
        });

        if (!item) {
            return res.status(404).json({
                message: 'Item not found'
            });
        }

        return res.status(200).json({
            message: 'Item retrieved successfully',
            data: item
        });

    } catch (error) {
        console.error('Get Item error:', error);

        return res.status(500).json({
            message: 'Failed to retrieve Item'
        });
    }
};


const createItem = async (req, res) => {
    try {
        const {
            category_id,
            brand_id,
            unit_id,
            item_type_id,
            item_code,
            item_name,
            description,
            condition,
            is_serialized,
            is_active
        } = req.body;

        if (!item_code || !item_name) {
            return res.status(400).json({
                message: 'item_code and item_name are required'
            });
        }

        const existingItem = await Item.findOne({
            where: {
                item_code
            }
        });

        if (existingItem) {
            return res.status(409).json({
                message: 'Item code already exists'
            });
        }

        const item = await Item.create({
            category_id: category_id || null,
            brand_id: brand_id || null,
            unit_id: unit_id || null,
            item_type_id: item_type_id || null,
            item_code,
            item_name,
            description: description || null,
            condition: condition || 'new',
            is_serialized: is_serialized ?? false,
            is_active: is_active ?? true
        });

        const createdItem = await Item.findByPk(item.id, {
            include: [
                {
                    model: Brand,
                    as: 'brand'
                },
                {
                    model: Category,
                    as: 'category'
                },
                {
                    model: Unit,
                    as: 'unitOfMeasure'
                },
                {
                    model: ItemType,
                    as: 'itemType'
                }
            ]
        });

        return res.status(201).json({
            message: 'Item created successfully',
            data: createdItem
        });

    } catch (error) {
        console.error('Create item error:', error);

        return res.status(500).json({
            message: 'Failed to create item'
        });
    }
};


module.exports = {
    getItems,
    getItemById,
    createItem
};
