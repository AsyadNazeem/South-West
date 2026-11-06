const {
    sequelize,
    InventoryStockMovement,
    InventoryStock,
    Item,
    InventoryLocation,
    User,
    ItemVariant
} = require('../models');
const { Op } = require('sequelize');
const { recordAuditLog } = require('../services/auditLogService');


// GET ALL STOCK MOVEMENTS
const getInventoryStockMovements = async (req, res) => {
    try {
        const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
        const pageSize = Math.min(100, Math.max(1, Number.parseInt(req.query.pageSize ?? req.query.limit, 10) || 25));
        const paginationEnabled = req.query.page !== undefined || req.query.pageSize !== undefined || req.query.limit !== undefined;
        const where = {};
        const search = String(req.query.search || '').trim();
        if (search) where[Op.or] = [
            { '$item.item_code$': { [Op.like]: `%${search}%` } },
            { '$item.item_name$': { [Op.like]: `%${search}%` } },
            { '$location.code$': { [Op.like]: `%${search}%` } },
            { '$location.name$': { [Op.like]: `%${search}%` } },
            { reference_type: { [Op.like]: `%${search}%` } },
            { reference_id: { [Op.like]: `%${search}%` } },
            { '$creator.email$': { [Op.like]: `%${search}%` } },
        ];
        if (req.query.type && req.query.type !== 'all') where.movement_type = req.query.type;
        const result = await InventoryStockMovement.findAndCountAll({
            where,
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
            order: [['id', 'DESC']], limit: paginationEnabled ? pageSize : undefined, offset: paginationEnabled ? (page - 1) * pageSize : undefined, distinct: true
        });
        const movements = result.rows;

        return res.status(200).json({
            message: 'Inventory stock movements retrieved successfully',
            data: movements,
            pagination: { page, pageSize, total: result.count, totalPages: Math.ceil(result.count / pageSize) }
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
const createInventoryStockMovement = async (req, res) => {
    let transaction;

    try {
        transaction = await sequelize.transaction();
   const {
    item_id,
    variant_id,
    location_id,
    movement_type,
    quantity,
    reference_type,
    reference_id,
    notes
} = req.body;

        // Check item
        const item = await Item.findByPk(item_id, {
            transaction
        });

        if (!item) {
            await transaction.rollback();

            return res.status(404).json({
                message: 'Item not found'
            });
        }

        // A stock movement must always belong to an active variant of this item.
if (
    variant_id === undefined ||
    variant_id === null ||
    variant_id === '' ||
    !Number.isSafeInteger(Number(variant_id)) ||
    Number(variant_id) <= 0
) {
    await transaction.rollback();
    return res.status(400).json({
        message: 'A valid variant is required for every stock movement.'
    });
}

const variant = await ItemVariant.findOne({
    where: {
        id: Number(variant_id),
        item_id: item.id
    },
    transaction,
    lock: transaction.LOCK.UPDATE
});

if (!variant) {
    await transaction.rollback();
    return res.status(400).json({
        message: 'The selected variant does not belong to this item.'
    });
}

if (!variant.is_active) {
    await transaction.rollback();
    return res.status(409).json({
        message: 'Stock movements cannot be recorded for inactive variants.'
    });
}

        // Check location
        const location = await InventoryLocation.findByPk(location_id, {
            transaction,
            lock: transaction.LOCK.UPDATE
        });

        if (!location) {
            await transaction.rollback();

            return res.status(404).json({
                message: 'Inventory location not found'
            });
        }

        if (
            quantity === undefined ||
            quantity === null ||
            quantity === '' ||
            !Number.isFinite(Number(quantity)) ||
            Number(quantity) <= 0
        ) {
            await transaction.rollback();

            return res.status(400).json({
                message: 'Quantity must be a positive number'
            });
        }


        // Validate movement type

        const validMovementTypes = [
            'purchase',
            'goods_receipt',
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


        let quantityChange = 0;

        switch (movement_type) {
            case 'purchase':
            case 'goods_receipt':
            case 'customer_return':
            case 'transfer_in':
                quantityChange = Number(quantity);
                break;

            case 'sale':
            case 'supplier_return':
            case 'transfer_out':
                quantityChange = -Number(quantity);
                break;

            case 'adjustment':
                await transaction.rollback();

                return res.status(400).json({
                    message: 'Use a dedicated stock adjustment flow to specify the adjustment direction'
                });
        }

        // Find and lock the stock record
        let stock = await InventoryStock.findOne({
            where: {
                item_id,
                  variant_id,
                location_id
            },
            transaction,
            lock: transaction.LOCK.UPDATE
        });

        if (!stock) {
            stock = await InventoryStock.create(
                {
                    item_id,
                    location_id,
                    variant_id: Number(variant_id),
                    quantity_on_hand: 0,
                    quantity_reserved: 0
                },
                { transaction }
            );
        }

        const previousQuantity = Number(stock.quantity_on_hand);

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
        variant_id: Number(variant_id),
        location_id,
        movement_type,
        quantity,
        reference_type,
        reference_id,
        notes,
        created_by: req.user.id,
        created_at: new Date()
    },
    { transaction }
);


        await recordAuditLog({
            userId: req.user
                ? (req.user.id ?? req.user.userId)
                : null,
            action: 'INVENTORY_STOCK_MOVEMENT_CREATED',
            module: 'inventory',
            entityType: 'inventory_stock_movement',
            entityId: movement.id,
            description: `Stock movement ${movement_type} recorded for item ${item_id} at location ${location_id}`,
            oldValues: {
                quantity_on_hand: previousQuantity
            },
            newValues: {
                quantity_on_hand: newQuantity,
                movement_type,
                quantity: Number(quantity),
                reference_type: reference_type ?? null,
                reference_id: reference_id ?? null
            },
            ipAddress: req.ip || null,
            userAgent: req.get('user-agent') || null,
            requestId: req.id || null,
            transaction
        });


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
        if (transaction && !transaction.finished) {
            await transaction.rollback();
        }

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
