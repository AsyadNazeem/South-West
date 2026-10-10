const {
    sequelize,
    InventoryStock,
    InventoryStockMovement,
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

// SET ACTUAL ONLINE STOCK COUNT
const setOnlineStockCount = async (req, res) => {
    const { item_id, counted_quantity, notes } = req.body;

    // Accept only the fields supported by this endpoint.
    const allowedFields = ['item_id', 'counted_quantity', 'notes'];

    if (
        !req.body ||
        Object.keys(req.body).some((key) => !allowedFields.includes(key))
    ) {
        return res.status(400).json({
            message: 'Unsupported field in request'
        });
    }

    const itemId = Number(item_id);
    const counted = Number(counted_quantity);

    if (!Number.isSafeInteger(itemId) || itemId <= 0) {
        return res.status(400).json({
            message: 'A valid item_id is required'
        });
    }

    if (
        counted_quantity === undefined ||
        counted_quantity === null ||
        counted_quantity === '' ||
        !Number.isFinite(counted) ||
        counted < 0 ||
        !/^\d+(\.\d{1,3})?$/.test(String(counted_quantity))
    ) {
        return res.status(400).json({
            message: 'counted_quantity must be a non-negative number with up to 3 decimal places'
        });
    }

    if (
        notes !== undefined &&
        notes !== null &&
        (typeof notes !== 'string' || notes.length > 2000)
    ) {
        return res.status(400).json({
            message: 'notes must be a string of up to 2000 characters'
        });
    }

    const transaction = await sequelize.transaction();

    try {
        // Resolve the online location on the server.
        const onlineLocations = await InventoryLocation.findAll({
            where: {
                location_type: 'online',
                is_active: true
            },
            transaction,
            lock: transaction.LOCK.UPDATE
        });

        if (onlineLocations.length !== 1) {
            await transaction.rollback();

            return res.status(409).json({
                message: 'Exactly one active online inventory location must be configured'
            });
        }

        const onlineLocation = onlineLocations[0];

        const item = await Item.findByPk(itemId, {
            transaction,
            lock: transaction.LOCK.UPDATE
        });

        if (!item) {
            await transaction.rollback();

            return res.status(404).json({
                message: 'Item not found'
            });
        }

        if (!item.is_active) {
            await transaction.rollback();

            return res.status(409).json({
                message: 'Cannot update stock for an inactive item'
            });
        }

        let stock = await InventoryStock.findOne({
            where: {
                item_id: itemId,
                location_id: onlineLocation.id
            },
            transaction,
            lock: transaction.LOCK.UPDATE
        });

        if (!stock) {
            stock = await InventoryStock.create(
                {
                    item_id: itemId,
                    location_id: onlineLocation.id,
                    quantity_on_hand: 0,
                    quantity_reserved: 0,
                    reorder_level: 0,
                    reorder_quantity: 0,
                    is_active: true
                },
                { transaction }
            );
        }

        if (!stock.is_active) {
            await transaction.rollback();

            return res.status(409).json({
                message: 'The online stock record is inactive'
            });
        }

        const previous = Number(stock.quantity_on_hand);
        const reserved = Number(stock.quantity_reserved);
        const difference = Number((counted - previous).toFixed(3));

        // Never set physical stock below quantities already reserved.
        if (counted < reserved) {
            await transaction.rollback();

            return res.status(409).json({
                message: 'Counted quantity cannot be below the reserved quantity',
                reserved_quantity: reserved
            });
        }

        if (difference === 0) {
            await transaction.commit();

            return res.status(200).json({
                message: 'Online stock count verified; no quantity change required',
                data: {
                    item_id: itemId,
                    location_id: onlineLocation.id,
                    previous_quantity: previous,
                    counted_quantity: counted,
                    quantity_on_hand: previous,
                    adjustment: 0
                }
            });
        }

        // Set the absolute count. Never add the count to the old balance.
        await stock.update(
            { quantity_on_hand: counted },
            { transaction }
        );

        await InventoryStockMovement.create(
            {
                item_id: itemId,
                location_id: onlineLocation.id,
                movement_type: 'adjustment',
                quantity: Math.abs(difference),
                reference_type: 'daily_stock_count',
                reference_id: null,
                notes: [
                    `Daily online stock count`,
                    `Previous quantity: ${previous}`,
                    `Counted quantity: ${counted}`,
                    `Signed difference: ${difference}`,
                    notes ? `Staff notes: ${notes}` : null
                ].filter(Boolean).join(' | '),
                created_by: req.user.id,
                created_at: new Date()
            },
            { transaction }
        );

        await transaction.commit();

        return res.status(200).json({
            message: 'Online stock count updated successfully',
            data: {
                item_id: itemId,
                location_id: onlineLocation.id,
                previous_quantity: previous,
                counted_quantity: counted,
                quantity_on_hand: counted,
                adjustment: difference
            }
        });
    } catch (error) {
        if (!transaction.finished) {
            await transaction.rollback();
        }

        console.error('Set online stock count error:', error);

        return res.status(500).json({
            message: 'Failed to update online stock count'
        });
    }
};


module.exports = {
    getInventoryStocks,
    getInventoryStockById,
    createInventoryStock,
    updateInventoryStock,
    deleteInventoryStock,
    setOnlineStockCount
};
