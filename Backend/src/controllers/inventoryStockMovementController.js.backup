const {
    sequelize,
    InventoryStockMovement,
    InventoryStock,
    Item,
    InventoryLocation,
    User
} = require('../models');


// GET ALL STOCK MOVEMENTS
const getInventoryStockMovements = async (req, res) => {
    try {
        const movements = await InventoryStockMovement.findAll({
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
                },
                {
                    model: User,
                    as: 'creator',
                    attributes: [
                        'id',
                        'email'
                    ]
                }
            ],
            order: [['id', 'DESC']]
        });

        return res.status(200).json({
            message: 'Inventory stock movements retrieved successfully',
            data: movements
        });

    } catch (error) {
        console.error(
            'Get inventory stock movements error:',
            error
        );

        return res.status(500).json({
            message: 'Failed to retrieve inventory stock movements'
        });
    }
};


// GET STOCK MOVEMENT BY ID
const getInventoryStockMovementById = async (req, res) => {
    try {
        const { id } = req.params;

        const movement = await InventoryStockMovement.findByPk(id, {
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
                },
                {
                    model: User,
                    as: 'creator',
                    attributes: [
                        'id',
                        'email'
                    ]
                }
            ]
        });

        if (!movement) {
            return res.status(404).json({
                message: 'Inventory stock movement not found'
            });
        }

        return res.status(200).json({
            message: 'Inventory stock movement retrieved successfully',
            data: movement
        });

    } catch (error) {
        console.error(
            'Get inventory stock movement error:',
            error
        );

        return res.status(500).json({
            message: 'Failed to retrieve inventory stock movement'
        });
    }
};


// CREATE STOCK MOVEMENT
// CREATE STOCK MOVEMENT
const createInventoryStockMovement = async (req, res) => {
    const transaction = await sequelize.transaction();

    try {
        const {
            item_id,
            location_id,
            movement_type,
            quantity,
            reference_type,
            reference_id,
            notes
        } = req.body;

        // Check item
        const item = await Item.findByPk(item_id);

        if (!item) {
            await transaction.rollback();

            return res.status(404).json({
                message: 'Item not found'
            });
        }

        // Check location
        const location = await InventoryLocation.findByPk(location_id);

        if (!location) {
            await transaction.rollback();

            return res.status(404).json({
                message: 'Inventory location not found'
            });
        }

        // Validate quantity
        if (quantity === undefined || quantity === null) {
            await transaction.rollback();

            return res.status(400).json({
                message: 'Quantity is required'
            });
        }

        if (Number(quantity) <= 0) {
            await transaction.rollback();

            return res.status(400).json({
                message: 'Quantity must be greater than zero'
            });
        }

        // Validate movement type
        const validMovementTypes = [
            'purchase',
            'sale',
            'customer_return',
            'supplier_return',
            'adjustment',
            'transfer_in',
            'transfer_out'
        ];

        if (!validMovementTypes.includes(movement_type)) {
            await transaction.rollback();

            return res.status(400).json({
                message: 'Invalid movement type'
            });
        }

        // Find existing stock record
        let stock = await InventoryStock.findOne({
            where: {
                item_id,
                location_id
            },
            transaction,
            lock: transaction.LOCK.UPDATE
        });

        // Create stock record if it does not exist
        if (!stock) {
            stock = await InventoryStock.create(
                {
                    item_id,
                    location_id,
                    quantity_on_hand: 0,
                    quantity_reserved: 0,
                    reorder_level: 0,
                    reorder_quantity: 0,
                    is_active: true
                },
                {
                    transaction
                }
            );
        }

        // Calculate stock quantity change
        let quantityChange = 0;

        switch (movement_type) {
            case 'purchase':
            case 'customer_return':
            case 'transfer_in':
                quantityChange = Number(quantity);
                break;

            case 'sale':
            case 'supplier_return':
            case 'transfer_out':
                quantityChange = -Number(quantity);
                break;

            case 'adjustment_in':
                quantityChange = Number(quantity);
                break;

            case 'adjustment_out':
                quantityChange = -Number(quantity);
                break;
        }

        // Prevent negative stock
        const newQuantity =
            Number(stock.quantity_on_hand) + quantityChange;

        if (newQuantity < 0) {
            await transaction.rollback();

            return res.status(400).json({
                message: 'Insufficient stock'
            });
        }

        // Update stock
        await stock.update(
            {
                quantity_on_hand: newQuantity
            },
            {
                transaction
            }
        );

        // Create movement
        const movement = await InventoryStockMovement.create(
            {
                item_id,
                location_id,
                movement_type,
                quantity,
                reference_type,
                reference_id,
                notes,
                created_by: req.user.id,
                created_at: new Date()
            },
            {
                transaction
            }
        );

        // Commit transaction
        await transaction.commit();

        // Retrieve complete movement
        const createdMovement =
            await InventoryStockMovement.findByPk(
                movement.id,
                {
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
                        },
                        {
                            model: User,
                            as: 'creator',
                            attributes: [
                                'id',
                                'email'
                            ]
                        }
                    ]
                }
            );

        return res.status(201).json({
            message: 'Inventory stock movement created successfully',
            data: {
                movement: createdMovement,
                stock: {
                    item_id: stock.item_id,
                    location_id: stock.location_id,
                    quantity_on_hand: newQuantity
                }
            }
        });

    } catch (error) {
        await transaction.rollback();

        console.error(
            'Create inventory stock movement error:',
            error
        );

        return res.status(500).json({
            message: 'Failed to create inventory stock movement'
        });
    }
};


module.exports = {
    getInventoryStockMovements,
    getInventoryStockMovementById,
    createInventoryStockMovement
};
