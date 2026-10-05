const {
    Item,
    Brand,
    Category,
    Unit,
    ItemType,
    Warranty,
    ItemSpecificationValue,
    ItemSpecification
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
                },
                {
                    model: Warranty,
                    as: 'warranty'
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
                },
                {
                    model: Warranty,
                    as: 'warranty'
                },
                {
                    model: ItemSpecificationValue,
                    as: 'specificationValues',
                    include: [
                        {
                            model: ItemSpecification,
                            as: 'specification'
                        }
                    ]
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
        console.error('Get Item By ID error:', error);

        return res.status(500).json({
            message: 'Failed to retrieve item',
            error: error.message
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
            warranty_id,
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
            warranty_id: warranty_id || null,
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
                    model: Warranty,
                    as: 'warranty'
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

const updateItem = async (req, res) => {
    try {
        const { id } = req.params

        const item = await Item.findByPk(id)

        if (!item) {
            return res.status(404).json({
                message: 'Item not found'
            })
        }

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
        } = req.body

        // Check duplicate item code
        if (item_code && item_code !== item.item_code) {
            const existingItem = await Item.findOne({
                where: {
                    item_code
                }
            })

            if (existingItem) {
                return res.status(409).json({
                    message: 'Item code already exists'
                })
            }
        }

        await item.update({
            category_id: category_id !== undefined
                ? category_id
                : item.category_id,

            brand_id: brand_id !== undefined
                ? brand_id
                : item.brand_id,

            unit_id: unit_id !== undefined
                ? unit_id
                : item.unit_id,

            item_type_id: item_type_id !== undefined
                ? item_type_id
                : item.item_type_id,

            warranty_id: warranty_id !== undefined
                ? warranty_id
                : item.warranty_id,

            item_code: item_code !== undefined
                ? item_code
                : item.item_code,

            item_name: item_name !== undefined
                ? item_name
                : item.item_name,

            description: description !== undefined
                ? description
                : item.description,

            condition: condition !== undefined
                ? condition
                : item.condition,

            is_serialized: is_serialized !== undefined
                ? is_serialized
                : item.is_serialized,

            is_active: is_active !== undefined
                ? is_active
                : item.is_active
        })

        const updatedItem = await Item.findByPk(id, {
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
                    model: Warranty,
                    as: 'warranty'
                },
                {
                    model: ItemType,
                    as: 'itemType'
                }
            ]
        })

        return res.status(200).json({
            message: 'Item updated successfully',
            data: updatedItem
        })

    } catch (error) {
        console.error('Update item error:', error)

        return res.status(500).json({
            message: 'Failed to update item'
        })
    }
}


module.exports = {
    getItems,
    getItemById,
    createItem,
    updateItem
};
