const { ItemPrice, Item } = require('../models');

const getItemPrices = async (req, res) => {
    try {
        const prices = await ItemPrice.findAll({
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
            order: [['id', 'DESC']]
        });

        return res.status(200).json({
            message: 'Item prices retrieved successfully',
            data: prices
        });

    } catch (error) {
        console.error('Get item prices error:', error);

        return res.status(500).json({
            message: 'Failed to retrieve item prices'
        });
    }
};


const getItemPriceById = async (req, res) => {
    try {
        const { id } = req.params;

        const price = await ItemPrice.findByPk(id, {
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

        if (!price) {
            return res.status(404).json({
                message: 'Item price not found'
            });
        }

        return res.status(200).json({
            message: 'Item price retrieved successfully',
            data: price
        });

    } catch (error) {
        console.error('Get item price error:', error);

        return res.status(500).json({
            message: 'Failed to retrieve item price'
        });
    }
};


const createItemPrice = async (req, res) => {
    try {
        const {
            item_id,
            price_type,
            price,
            currency,
            effective_from,
            effective_to
        } = req.body;

        const item = await Item.findByPk(item_id);

        if (!item) {
            return res.status(404).json({
                message: 'Item not found'
            });
        }

        const itemPrice = await ItemPrice.create({
            item_id,
            price_type,
            price,
            currency: currency || 'LKR',
            effective_from,
            effective_to,
            is_active: true
        });

        const createdPrice = await ItemPrice.findByPk(itemPrice.id, {
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

        return res.status(201).json({
            message: 'Item price created successfully',
            data: createdPrice
        });

    } catch (error) {
        console.error('Create item price error:', error);

        return res.status(500).json({
            message: 'Failed to create item price'
        });
    }
};


const updateItemPrice = async (req, res) => {
    try {
        const { id } = req.params;

        const itemPrice = await ItemPrice.findByPk(id);

        if (!itemPrice) {
            return res.status(404).json({
                message: 'Item price not found'
            });
        }

        const {
            price_type,
            price,
            currency,
            effective_from,
            effective_to,
            is_active
        } = req.body;

        await itemPrice.update({
            price_type,
            price,
            currency,
            effective_from,
            effective_to,
            is_active
        });

        const updatedPrice = await ItemPrice.findByPk(id, {
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

        return res.status(200).json({
            message: 'Item price updated successfully',
            data: updatedPrice
        });

    } catch (error) {
        console.error('Update item price error:', error);

        return res.status(500).json({
            message: 'Failed to update item price'
        });
    }
};


const deleteItemPrice = async (req, res) => {
    try {
        const { id } = req.params;

        const itemPrice = await ItemPrice.findByPk(id);

        if (!itemPrice) {
            return res.status(404).json({
                message: 'Item price not found'
            });
        }

        await itemPrice.destroy();

        return res.status(200).json({
            message: 'Item price deleted successfully'
        });

    } catch (error) {
        console.error('Delete item price error:', error);

        return res.status(500).json({
            message: 'Failed to delete item price'
        });
    }
};


module.exports = {
    getItemPrices,
    getItemPriceById,
    createItemPrice,
    updateItemPrice,
    deleteItemPrice
};
