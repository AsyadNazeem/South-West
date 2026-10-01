const {
    InventoryStock,
    Item,
    InventoryLocation
} = require('../models');


// GET ALL STOCK
const getInventoryStocks = async (req, res) => {
    try {
        const stocks = await InventoryStock.findAll({
            include: [
                {
                    model: Item,
                    as: 'item',
                    attributes: [
                        'id',
                        'item_code',
                        'item_name'
                    ]
                },
                {
                    model: InventoryLocation,
                    as: 'location',
                    attributes: [
                        'id',
                        'code',
                        'name',
                        'location_type'
                    ]
                }
            ],
            order: [['id', 'DESC']]
        });

        return res.status(200).json({
            message: 'Inventory stocks retrieved successfully',
            data: stocks
        });

    } catch (error) {
        console.error('Get inventory stocks error:', error);

        return res.status(500).json({
            message: 'Failed to retrieve inventory stocks'
        });
    }
};


// GET STOCK BY ID
const getInventoryStockById = async (req, res) => {
    try {
        const { id } = req.params;

        const stock = await InventoryStock.findByPk(id, {
            include: [
                {
                    model: Item,
                    as: 'item',
                    attributes: [
                        'id',
                        'item_code',
                        'item_name'
                    ]
                },
                {
                    model: InventoryLocation,
                    as: 'location',
                    attributes: [
                        'id',
                        'code',
                        'name',
                        'location_type'
                    ]
                }
            ]
        });

        if (!stock) {
            return res.status(404).json({
                message: 'Inventory stock not found'
            });
        }

        return res.status(200).json({
            message: 'Inventory stock retrieved successfully',
            data: stock
        });

    } catch (error) {
        console.error('Get inventory stock error:', error);

        return res.status(500).json({
            message: 'Failed to retrieve inventory stock'
        });
    }
};


// CREATE STOCK
const createInventoryStock = async (req, res) => {
    try {
        const {
            item_id,
            location_id,
            quantity_on_hand,
            quantity_reserved,
            reorder_level,
            reorder_quantity
        } = req.body;

        // Check item
        const item = await Item.findByPk(item_id);

        if (!item) {
            return res.status(404).json({
                message: 'Item not found'
            });
        }

        // Check location
        const location = await InventoryLocation.findByPk(location_id);

        if (!location) {
            return res.status(404).json({
                message: 'Inventory location not found'
            });
        }

        // Prevent duplicate item/location stock record
        const existingStock = await InventoryStock.findOne({
            where: {
                item_id,
                location_id
            }
        });

        if (existingStock) {
            return res.status(409).json({
                message: 'Stock record already exists for this item and location'
            });
        }

        const stock = await InventoryStock.create({
            item_id,
            location_id,
            quantity_on_hand: quantity_on_hand ?? 0,
            quantity_reserved: quantity_reserved ?? 0,
            reorder_level: reorder_level ?? 0,
            reorder_quantity: reorder_quantity ?? 0,
            is_active: true
        });

        const createdStock = await InventoryStock.findByPk(stock.id, {
            include: [
                {
                    model: Item,
                    as: 'item',
                    attributes: [
                        'id',
                        'item_code',
                        'item_name'
                    ]
                },
                {
                    model: InventoryLocation,
                    as: 'location',
                    attributes: [
                        'id',
                        'code',
                        'name',
                        'location_type'
                    ]
                }
            ]
        });

        return res.status(201).json({
            message: 'Inventory stock created successfully',
            data: createdStock
        });

    } catch (error) {
        console.error('Create inventory stock error:', error);

        return res.status(500).json({
            message: 'Failed to create inventory stock'
        });
    }
};


// UPDATE STOCK SETTINGS
const updateInventoryStock = async (req, res) => {
    try {
        const { id } = req.params;

        const stock = await InventoryStock.findByPk(id);

        if (!stock) {
            return res.status(404).json({
                message: 'Inventory stock not found'
            });
        }

        const {
            quantity_reserved,
            reorder_level,
            reorder_quantity,
            is_active
        } = req.body;

        await stock.update({
            quantity_reserved,
            reorder_level,
            reorder_quantity,
            is_active
        });

        const updatedStock = await InventoryStock.findByPk(id, {
            include: [
                {
                    model: Item,
                    as: 'item',
                    attributes: [
                        'id',
                        'item_code',
                        'item_name'
                    ]
                },
                {
                    model: InventoryLocation,
                    as: 'location',
                    attributes: [
                        'id',
                        'code',
                        'name',
                        'location_type'
                    ]
                }
            ]
        });

        return res.status(200).json({
            message: 'Inventory stock updated successfully',
            data: updatedStock
        });

    } catch (error) {
        console.error('Update inventory stock error:', error);

        return res.status(500).json({
            message: 'Failed to update inventory stock'
        });
    }
};


// DELETE STOCK
const deleteInventoryStock = async (req, res) => {
    try {
        const { id } = req.params;

        const stock = await InventoryStock.findByPk(id);

        if (!stock) {
            return res.status(404).json({
                message: 'Inventory stock not found'
            });
        }

        await stock.destroy();

        return res.status(200).json({
            message: 'Inventory stock deleted successfully'
        });

    } catch (error) {
        console.error('Delete inventory stock error:', error);

        return res.status(500).json({
            message: 'Failed to delete inventory stock'
        });
    }
};


module.exports = {
    getInventoryStocks,
    getInventoryStockById,
    createInventoryStock,
    updateInventoryStock,
    deleteInventoryStock
};
