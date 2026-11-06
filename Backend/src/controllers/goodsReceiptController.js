const { Op } = require('sequelize');
const {
    GoodsReceipt,
    GoodsReceiptItem,
    PurchaseOrder,
    PurchaseOrderItem,
    InventoryLocation,
    InventoryStock,
    InventoryStockMovement,
    ItemVariant,
    User,
    sequelize
} = require('../models');

const { recordAuditLog } = require('../services/auditLogService');


// GET ALL GOODS RECEIPTS
const getGoodsReceipts = async (req, res) => {
    try {
        const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
        const pageSize = Math.min(100, Math.max(1, Number.parseInt(req.query.pageSize ?? req.query.limit, 10) || 25));
        const paginationEnabled = req.query.page !== undefined || req.query.pageSize !== undefined || req.query.limit !== undefined;
        const search = String(req.query.search || '').trim();
        const where = {};
        if (search) where[Op.or] = [
            { receipt_number: { [Op.like]: `%${search}%` } },
            { supplier_delivery_note: { [Op.like]: `%${search}%` } },
            { '$purchaseOrder.purchase_order_number$': { [Op.like]: `%${search}%` } },
            { '$location.name$': { [Op.like]: `%${search}%` } },
        ];
        if (req.query.status) where.status = req.query.status;
        const result = await GoodsReceipt.findAndCountAll({
            where,
            include: [
                {
                    model: PurchaseOrder,
                    as: 'purchaseOrder'
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
                    as: 'receiver',
                    attributes: [
                        'id',
                        'email'
                    ]
                }
            ],
            order: [['id', 'DESC']], limit: paginationEnabled ? pageSize : undefined, offset: paginationEnabled ? (page - 1) * pageSize : undefined, distinct: true
        });
        const receipts = result.rows;

        return res.status(200).json({
            message: 'Goods receipts retrieved successfully',
            data: receipts,
            pagination: { page, pageSize, total: result.count, totalPages: Math.ceil(result.count / pageSize) }
        });

    } catch (error) {
        console.error(
            'Get goods receipts error:',
            error
        );

        return res.status(500).json({
            message: 'Failed to retrieve goods receipts'
        });
    }
};


// GET GOODS RECEIPT BY ID
const getGoodsReceiptById = async (req, res) => {
    try {
        const { id } = req.params;

        const receipt = await GoodsReceipt.findByPk(id, {
            include: [
                {
                    model: PurchaseOrder,
                    as: 'purchaseOrder'
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
                    as: 'receiver',
                    attributes: [
                        'id',
                        'email'
                    ]
                }
            ]
        });

        if (!receipt) {
            return res.status(404).json({
                message: 'Goods receipt not found'
            });
        }

        return res.status(200).json({
            message: 'Goods receipt retrieved successfully',
            data: receipt
        });

    } catch (error) {
        console.error(
            'Get goods receipt error:',
            error
        );

        return res.status(500).json({
            message: 'Failed to retrieve goods receipt'
        });
    }
};


// CREATE GOODS RECEIPT


const createGoodsReceipt = async (req, res) => {
    let transaction;

    try {
        transaction = await sequelize.transaction();

        const {
            receipt_number,
            purchase_order_id,
            location_id,
            receipt_date,
            supplier_delivery_note,
            notes,
        } = req.body;

        // Validate receipt number.
        if (
            typeof receipt_number !== 'string' ||
            !receipt_number.trim() ||
            receipt_number.trim().length > 50
        ) {
            await transaction.rollback();
            return res.status(400).json({
                message: 'A valid receipt number is required',
            });
        }

        const normalizedReceiptNumber = receipt_number.trim();

        // Purchase Order is optional. Validate it only when supplied.
        let normalizedPurchaseOrderId = null;

        if (
            purchase_order_id !== undefined &&
            purchase_order_id !== null &&
            purchase_order_id !== ''
        ) {
            if (
                !/^\d+$/.test(String(purchase_order_id)) ||
                Number(purchase_order_id) <= 0
            ) {
                await transaction.rollback();
                return res.status(400).json({
                    message: 'Invalid purchase order ID',
                });
            }

            const purchaseOrder = await PurchaseOrder.findByPk(
                purchase_order_id,
                { transaction }
            );

            if (!purchaseOrder) {
                await transaction.rollback();
                return res.status(404).json({
                    message: 'Purchase order not found',
                });
            }

            normalizedPurchaseOrderId = purchaseOrder.id;
        }

        // Validate inventory location.
        if (
            location_id === undefined ||
            location_id === null ||
            !/^\d+$/.test(String(location_id)) ||
            Number(location_id) <= 0
        ) {
            await transaction.rollback();
            return res.status(400).json({
                message: 'A valid inventory location is required',
            });
        }

        const location = await InventoryLocation.findByPk(location_id, {
            transaction,
            lock: transaction.LOCK.UPDATE,
        });

        if (!location) {
            await transaction.rollback();
            return res.status(404).json({
                message: 'Inventory location not found',
            });
        }

        // Validate receipt date.
        const validDate =
            typeof receipt_date === 'string' &&
            /^\d{4}-\d{2}-\d{2}$/.test(receipt_date) &&
            Number.isFinite(
                Date.parse(`${receipt_date}T00:00:00Z`)
            ) &&
            new Date(`${receipt_date}T00:00:00Z`)
                .toISOString()
                .slice(0, 10) === receipt_date;

        if (!validDate) {
            await transaction.rollback();
            return res.status(400).json({
                message: 'A valid receipt date in YYYY-MM-DD format is required',
            });
        }

        if (
            supplier_delivery_note !== undefined &&
            supplier_delivery_note !== null &&
            (
                typeof supplier_delivery_note !== 'string' ||
                supplier_delivery_note.length > 100
            )
        ) {
            await transaction.rollback();
            return res.status(400).json({
                message: 'Supplier delivery note must be a string of at most 100 characters',
            });
        }

        if (
            notes !== undefined &&
            notes !== null &&
            typeof notes !== 'string'
        ) {
            await transaction.rollback();
            return res.status(400).json({
                message: 'Notes must be a string or null',
            });
        }

        // Check duplicate receipt number.
        const existingReceipt = await GoodsReceipt.findOne({
            where: { receipt_number: normalizedReceiptNumber },
            transaction,
        });

        if (existingReceipt) {
            await transaction.rollback();
            return res.status(409).json({
                message: 'Receipt number already exists',
            });
        }

        // Create as draft. Creating a draft never changes stock.
        const receipt = await GoodsReceipt.create(
            {
                receipt_number: normalizedReceiptNumber,
                purchase_order_id: normalizedPurchaseOrderId,
                location_id: location.id,
                receipt_date,
                supplier_delivery_note:
                    supplier_delivery_note?.trim() || null,
                status: 'draft',
                notes: notes ?? null,
                created_at: new Date(),
                updated_at: new Date(),
            },
            { transaction }
        );

        await recordAuditLog({
            userId: req.user.id,
            action: 'GOODS_RECEIPT_CREATED',
            module: 'inventory',
            entityType: 'goods_receipt',
            entityId: receipt.id,
            description: `Goods receipt ${receipt.receipt_number} created`,
            oldValues: null,
            newValues: {
                receipt_number: receipt.receipt_number,
                purchase_order_id: receipt.purchase_order_id,
                location_id: receipt.location_id,
                receipt_date: receipt.receipt_date,
                supplier_delivery_note: receipt.supplier_delivery_note,
                status: receipt.status,
                notes: receipt.notes,
            },
            ipAddress: req.ip || null,
            userAgent: req.get('user-agent') || null,
            requestId: req.id || null,
            transaction,
        });

        const createdReceipt = await GoodsReceipt.findByPk(receipt.id, {
            include: [
                {
                    model: PurchaseOrder,
                    as: 'purchaseOrder',
                },
                {
                    model: InventoryLocation,
                    as: 'location',
                    attributes: ['id', 'code', 'name', 'location_type'],
                },
                {
                    model: User,
                    as: 'receiver',
                    attributes: ['id', 'email'],
                },
            ],
            transaction,
        });

        await transaction.commit();

        return res.status(201).json({
            message: 'Goods receipt created successfully',
            data: createdReceipt,
        });
    } catch (error) {
        if (transaction && !transaction.finished) {
            await transaction.rollback();
        }

        console.error('Create goods receipt error:', error);

        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(409).json({
                message: 'Receipt number already exists',
            });
        }

        return res.status(500).json({
            message: 'Failed to create goods receipt',
        });
    }
};




// UPDATE GOODS RECEIPT

const updateGoodsReceipt = async (req, res) => {
    let transaction;

    try {
        transaction = await sequelize.transaction();

        const { id } = req.params;

        if (!/^\d+$/.test(String(id)) || Number(id) <= 0) {
            await transaction.rollback();

            return res.status(400).json({
                message: 'Invalid goods receipt ID'
            });
        }

        // Lock the receipt before checking its status.
        const receipt = await GoodsReceipt.findByPk(id, {
            transaction,
            lock: transaction.LOCK.UPDATE
        });

        if (!receipt) {
            await transaction.rollback();

            return res.status(404).json({
                message: 'Goods receipt not found'
            });
        }

        if (receipt.status !== 'draft') {
            await transaction.rollback();

            return res.status(400).json({
                message: 'Only draft goods receipts can be updated'
            });
        }

        const {
            receipt_date,
            supplier_delivery_note,
            notes
        } = req.body;

        // Validate receipt date when supplied.
        if (receipt_date !== undefined) {
            const validDate =
                typeof receipt_date === 'string' &&
                /^\d{4}-\d{2}-\d{2}$/.test(receipt_date) &&
                Number.isFinite(
                    Date.parse(`${receipt_date}T00:00:00Z`)
                ) &&
                new Date(`${receipt_date}T00:00:00Z`)
                    .toISOString()
                    .slice(0, 10) === receipt_date;

            if (!validDate) {
                await transaction.rollback();

                return res.status(400).json({
                    message: 'A valid receipt date in YYYY-MM-DD format is required'
                });
            }
        }

        // Capture the original values before updating.
        const oldValues = {
            receipt_date: receipt.receipt_date,
            supplier_delivery_note: receipt.supplier_delivery_note,
            notes: receipt.notes
        };

        const updates = {
            updated_at: new Date()
        };

        if (receipt_date !== undefined) {
            updates.receipt_date = receipt_date;
        }

        if (supplier_delivery_note !== undefined) {
            updates.supplier_delivery_note = supplier_delivery_note;
        }

        if (notes !== undefined) {
            updates.notes = notes;
        }

        await receipt.update(updates, { transaction });

        const newValues = {
            receipt_date: receipt.receipt_date,
            supplier_delivery_note: receipt.supplier_delivery_note,
            notes: receipt.notes
        };

        // Only create an audit entry if a business field changed.
        const changed = Object.keys(oldValues).some(
            key => oldValues[key] !== newValues[key]
        );

        if (changed) {
            await recordAuditLog({
                userId: req.user.id,
                action: 'GOODS_RECEIPT_UPDATED',
                module: 'inventory',
                entityType: 'goods_receipt',
                entityId: receipt.id,
                description: `Goods receipt ${receipt.receipt_number} updated`,
                oldValues,
                newValues,
                ipAddress: req.ip || null,
                userAgent: req.get('user-agent') || null,
                requestId: req.id || null,
                transaction
            });
        }

        const updatedReceipt = await GoodsReceipt.findByPk(id, {
            include: [
                {
                    model: PurchaseOrder,
                    as: 'purchaseOrder'
                },
                {
                    model: InventoryLocation,
                    as: 'location',
                    attributes: ['id', 'code', 'name', 'location_type']
                },
                {
                    model: User,
                    as: 'receiver',
                    attributes: ['id', 'email']
                }
            ],
            transaction
        });

        await transaction.commit();

        return res.status(200).json({
            message: 'Goods receipt updated successfully',
            data: updatedReceipt
        });
    } catch (error) {
        if (transaction && !transaction.finished) {
            await transaction.rollback();
        }

        console.error('Update goods receipt error:', error);

        return res.status(500).json({
            message: 'Failed to update goods receipt'
        });
    }
};



// RECEIVE GOODS RECEIPT


const receiveGoodsReceipt = async (req, res) => {
    let transaction;

    try {
        transaction = await sequelize.transaction();

        const { id } = req.params;
        const userId = req.user?.id ?? req.user?.userId ?? null;

        const receipt = await GoodsReceipt.findByPk(id, {
            transaction,
            lock: transaction.LOCK.UPDATE
        });

        if (!receipt) {
            await transaction.rollback();
            return res.status(404).json({
                message: 'Goods receipt not found'
            });
        }

        if (receipt.status !== 'draft') {
            await transaction.rollback();
            return res.status(400).json({
                message: 'Only draft goods receipts can be received'
            });
        }

        const location = await InventoryLocation.findByPk(
            receipt.location_id,
            {
                transaction,
                lock: transaction.LOCK.UPDATE
            }
        );

        if (!location) {
            await transaction.rollback();
            return res.status(404).json({
                message: 'Inventory location not found'
            });
        }

        const receiptItems = await GoodsReceiptItem.findAll({
            where: { goods_receipt_id: receipt.id },
            transaction,
            lock: transaction.LOCK.UPDATE,
            order: [['id', 'ASC']]
        });

        if (receiptItems.length === 0) {
            await transaction.rollback();
            return res.status(400).json({
                message: 'Cannot receive a goods receipt without items'
            });
        }

        // 1. Validate every receipt line and its variant before changing stock.
        for (const receiptItem of receiptItems) {
            const quantity = Number(receiptItem.quantity_received);

            if (
                !Number.isFinite(quantity) ||
                quantity <= 0 ||
                quantity >= 1e12 ||
                Math.abs(quantity * 1000 - Math.round(quantity * 1000)) >= 1e-7
            ) {
                throw new Error(
                    `Invalid received quantity for receipt item ${receiptItem.id}`
                );
            }

            if (!['good', 'damaged', 'defective'].includes(receiptItem.condition)) {
                throw new Error(
                    `Invalid condition for receipt item ${receiptItem.id}`
                );
            }

            if (
                !receiptItem.item_id ||
                !Number.isSafeInteger(Number(receiptItem.item_id)) ||
                Number(receiptItem.item_id) <= 0
            ) {
                throw new Error(
                    `Invalid item ID for receipt item ${receiptItem.id}`
                );
            }

            if (
                receiptItem.variant_id === null ||
                receiptItem.variant_id === undefined ||
                receiptItem.variant_id === '' ||
                !Number.isSafeInteger(Number(receiptItem.variant_id)) ||
                Number(receiptItem.variant_id) <= 0
            ) {
                const error = new Error(
                    `A valid variant is required for receipt item ${receiptItem.id}.`
                );
                error.statusCode = 400;
                throw error;
            }

            const variant = await ItemVariant.findOne({
                where: {
                    id: Number(receiptItem.variant_id),
                    item_id: Number(receiptItem.item_id)
                },
                transaction,
                lock: transaction.LOCK.UPDATE
            });

            if (!variant) {
                const error = new Error(
                    `The variant does not belong to the item on receipt line ${receiptItem.id}.`
                );
                error.statusCode = 400;
                throw error;
            }

            if (!variant.is_active) {
                const error = new Error(
                    `The variant on receipt line ${receiptItem.id} is inactive.`
                );
                error.statusCode = 409;
                throw error;
            }
        }

        // 2. Update purchase-order quantities when this receipt has a PO.
        // Receipts without a PO can still be received, but cannot update PO totals.
        if (receipt.purchase_order_id) {
            const receivedQuantityByPOItem = new Map();

            for (const receiptItem of receiptItems) {
                const poItemId = Number(receiptItem.purchase_order_item_id);

                if (
                    !Number.isSafeInteger(poItemId) ||
                    poItemId <= 0
                ) {
                    throw new Error(
                        `Invalid purchase order item for receipt line ${receiptItem.id}`
                    );
                }

                receivedQuantityByPOItem.set(
                    poItemId,
                    (receivedQuantityByPOItem.get(poItemId) || 0) +
                        Number(receiptItem.quantity_received)
                );
            }

            // Lock and validate all relevant PO items before changing any quantities.
            const purchaseOrderItems = new Map();

            for (const [poItemId, quantityToReceive] of receivedQuantityByPOItem) {
                const poItem = await PurchaseOrderItem.findByPk(poItemId, {
                    transaction,
                    lock: transaction.LOCK.UPDATE
                });

                if (
                    !poItem ||
                    Number(poItem.purchase_order_id) !==
                        Number(receipt.purchase_order_id)
                ) {
                    const error = new Error(
                        `Invalid purchase order item ${poItemId} for receipt ${receipt.id}`
                    );
                    error.statusCode = 400;
                    throw error;
                }

                // Ensure the GRN line matches the exact PO item and variant.
                const matchingReceiptItems = receiptItems.filter(
                    (receiptItem) =>
                        Number(receiptItem.purchase_order_item_id) === poItemId
                );

                const hasMismatch = matchingReceiptItems.some(
                    (receiptItem) =>
                        Number(receiptItem.item_id) !== Number(poItem.item_id) ||
                        receiptItem.variant_id === null ||
                        receiptItem.variant_id === undefined ||
                        Number(receiptItem.variant_id) !== Number(poItem.variant_id)
                );

                if (hasMismatch) {
                    const error = new Error(
                        `Item or variant mismatch for purchase order item ${poItemId}`
                    );
                    error.statusCode = 400;
                    throw error;
                }

                const orderedQuantity = Number(poItem.quantity_ordered);
                const alreadyReceived = Number(poItem.quantity_received || 0);
                const newReceivedQuantity = alreadyReceived + quantityToReceive;

                if (
                    !Number.isFinite(orderedQuantity) ||
                    !Number.isFinite(alreadyReceived) ||
                    !Number.isFinite(newReceivedQuantity) ||
                    quantityToReceive <= 0 ||
                    newReceivedQuantity > orderedQuantity
                ) {
              const error = new Error(
    `Receiving quantity exceeds the remaining ordered quantity for PO item ${poItemId}`
);

error.statusCode = 400;
throw error;
                }

                purchaseOrderItems.set(poItemId, {
                    poItem,
                    alreadyReceived,
                    newReceivedQuantity
                });
            }

            // 3. Update confirmed PO quantities and audit them in this transaction.
            for (const [poItemId, data] of purchaseOrderItems) {
                await data.poItem.update(
                    { quantity_received: data.newReceivedQuantity },
                    { transaction }
                );

                await recordAuditLog({
                    userId,
                    action: 'PURCHASE_ORDER_ITEM_RECEIVED',
                    module: 'purchasing',
                    entityType: 'purchase_order_item',
                    entityId: poItemId,
                    description: `Received goods against purchase order item ${poItemId}`,
                    oldValues: {
                        quantity_received: data.alreadyReceived
                    },
                    newValues: {
                        quantity_received: data.newReceivedQuantity
                    },
                    ipAddress: req.ip || null,
                    userAgent: req.get('user-agent') || null,
                    requestId: req.id || null,
                    transaction
                });
            }
        }

        // 4. Add good-condition goods to normal inventory only.
        const stockChanges = [];

        for (const receiptItem of receiptItems) {
            if (receiptItem.condition !== 'good') {
                continue;
            }

            const quantity = Number(receiptItem.quantity_received);


const variantId = Number(receiptItem.variant_id);

let stockRecord = await InventoryStock.findOne({
    where: {
        variant_id: variantId,
        location_id: receipt.location_id,
        item_id: receiptItem.item_id
    },
    transaction,
    lock: transaction.LOCK.UPDATE
});

          if (!stockRecord) {
    stockRecord = await InventoryStock.create(
        {
            item_id: receiptItem.item_id,
            variant_id: variantId,
            location_id: receipt.location_id,
            quantity_on_hand: 0,
            quantity_reserved: 0
        },
        { transaction }
    );
}

            const previousQuantity = Number(stockRecord.quantity_on_hand);
            const newQuantity = previousQuantity + quantity;

            if (
                !Number.isFinite(previousQuantity) ||
                previousQuantity < 0 ||
                !Number.isFinite(newQuantity) ||
                newQuantity >= 1e12 ||
                Math.abs(newQuantity * 1000 - Math.round(newQuantity * 1000)) >= 1e-7
            ) {
                throw new Error(
                    `Invalid resulting stock quantity for item ${receiptItem.item_id}`
                );
            }

            await stockRecord.update(
                { quantity_on_hand: newQuantity },
                { transaction }
            );

            const movement = await InventoryStockMovement.create(
               {
    item_id: receiptItem.item_id,
    variant_id: variantId,
    location_id: receipt.location_id,
    movement_type: 'goods_receipt',
    quantity,
    reference_type: 'goods_receipt',
    reference_id: receipt.id,
    notes: `Goods receipt ${receipt.receipt_number}`,
    created_by: userId,
    created_at: new Date()
},
                { transaction }
            );

            await recordAuditLog({
                userId,
                action: 'INVENTORY_STOCK_MOVEMENT_CREATED',
                module: 'inventory',
                entityType: 'inventory_stock_movement',
                entityId: movement.id,
                description: `Stock received through goods receipt ${receipt.receipt_number}`,
                oldValues: {
                    quantity_on_hand: previousQuantity
                },
               newValues: {
    item_id: receiptItem.item_id,
    variant_id: variantId,
    quantity_on_hand: newQuantity,
    movement_type: 'goods_receipt',
    quantity,
    reference_type: 'goods_receipt',
    reference_id: receipt.id
},
                ipAddress: req.ip || null,
                userAgent: req.get('user-agent') || null,
                requestId: req.id || null,
                transaction
            });

          stockChanges.push({
    item_id: receiptItem.item_id,
    variant_id: variantId,
    quantity_received: quantity,
    previous_quantity_on_hand: previousQuantity,
    new_quantity_on_hand: newQuantity
});
        }

        // 5. Mark the receipt as received only after all operations succeed.
        await receipt.update(
            {
                status: 'received',
                received_by: userId,
                received_at: new Date(),
                updated_at: new Date()
            },
            { transaction }
        );

        await recordAuditLog({
            userId,
            action: 'GOODS_RECEIPT_RECEIVED',
            module: 'inventory',
            entityType: 'goods_receipt',
            entityId: receipt.id,
            description: `Goods receipt ${receipt.receipt_number} received`,
            oldValues: {
                status: 'draft'
            },
            newValues: {
                status: 'received',
                location_id: receipt.location_id,
                stock_changes: stockChanges,
                excluded_items: receiptItems
                    .filter(item => item.condition !== 'good')
                    .map(item => ({
                        item_id: item.item_id,
                        quantity_received: Number(item.quantity_received),
                        variant_id: item.variant_id ?? null,
                        condition: item.condition

                    }))
            },
            ipAddress: req.ip || null,
            userAgent: req.get('user-agent') || null,
            requestId: req.id || null,
            transaction
        });

// 6. Commit only after stock, receipt and audit changes succeed.
        await transaction.commit();

        const updatedReceipt = await GoodsReceipt.findByPk(id, {
            include: [
                {
                    model: PurchaseOrder,
                    as: 'purchaseOrder'
                },
                {
                    model: InventoryLocation,
                    as: 'location',
                    attributes: ['id', 'code', 'name', 'location_type']
                },
                {
                    model: User,
                    as: 'receiver',
                    attributes: ['id', 'email']
                },
                {
                    model: GoodsReceiptItem,
                    as: 'items'
                }
            ]
        });

        return res.status(200).json({
            message: 'Goods receipt received successfully',
            data: updatedReceipt
        });
   } catch (error) {
    if (transaction && !transaction.finished) {
        await transaction.rollback();
    }

    console.error('Receive goods receipt error:', error);

    return res.status(error.statusCode || 500).json({
        message: error.statusCode
            ? error.message
            : 'Failed to receive goods receipt'
    });
}
};




// CANCEL GOODS RECEIPT

const cancelGoodsReceipt = async (req, res) => {
    let transaction;

    try {
        transaction = await sequelize.transaction();

        const { id } = req.params;

        if (!/^\d+$/.test(String(id)) || Number(id) <= 0) {
            await transaction.rollback();

            return res.status(400).json({
                message: 'Invalid goods receipt ID'
            });
        }

        // Lock the receipt before checking its status.
        const receipt = await GoodsReceipt.findByPk(id, {
            transaction,
            lock: transaction.LOCK.UPDATE
        });

        if (!receipt) {
            await transaction.rollback();

            return res.status(404).json({
                message: 'Goods receipt not found'
            });
        }

        if (receipt.status !== 'draft') {
            await transaction.rollback();

            return res.status(400).json({
                message: 'Only draft goods receipts can be cancelled'
            });
        }

        const oldValues = {
            status: receipt.status
        };

        await receipt.update(
            {
                status: 'cancelled',
                updated_at: new Date()
            },
            { transaction }
        );

        await recordAuditLog({
            userId: req.user.id,
            action: 'GOODS_RECEIPT_CANCELLED',
            module: 'inventory',
            entityType: 'goods_receipt',
            entityId: receipt.id,
            description: `Goods receipt ${receipt.receipt_number} cancelled`,
            oldValues,
            newValues: {
                status: receipt.status
            },
            ipAddress: req.ip || null,
            userAgent: req.get('user-agent') || null,
            requestId: req.id || null,
            transaction
        });

        await transaction.commit();

        return res.status(200).json({
            message: 'Goods receipt cancelled successfully',
            data: receipt
        });
    } catch (error) {
        if (transaction && !transaction.finished) {
            await transaction.rollback();
        }

        console.error('Cancel goods receipt error:', error);

        return res.status(500).json({
            message: 'Failed to cancel goods receipt'
        });
    }
};



// DELETE GOODS RECEIPT

const deleteGoodsReceipt = async (req, res) => {
    let transaction;

    try {
        transaction = await sequelize.transaction();

        const { id } = req.params;

        if (!/^\d+$/.test(String(id)) || Number(id) <= 0) {
            await transaction.rollback();

            return res.status(400).json({
                message: 'Invalid goods receipt ID'
            });
        }

        // Lock the receipt before checking whether it can be deleted.
        const receipt = await GoodsReceipt.findByPk(id, {
            transaction,
            lock: transaction.LOCK.UPDATE
        });

        if (!receipt) {
            await transaction.rollback();

            return res.status(404).json({
                message: 'Goods receipt not found'
            });
        }

        if (receipt.status !== 'draft') {
            await transaction.rollback();

            return res.status(400).json({
                message: 'Only draft goods receipts can be deleted'
            });
        }

        // Capture details before deletion.
        const oldValues = {
            receipt_number: receipt.receipt_number,
            purchase_order_id: receipt.purchase_order_id,
            location_id: receipt.location_id,
            receipt_date: receipt.receipt_date,
            supplier_delivery_note: receipt.supplier_delivery_note,
            status: receipt.status,
            notes: receipt.notes
        };

        const receiptId = receipt.id;
        const receiptNumber = receipt.receipt_number;

        await receipt.destroy({ transaction });

        // Record the deletion in the same transaction.
        await recordAuditLog({
            userId: req.user.id,
            action: 'GOODS_RECEIPT_DELETED',
            module: 'inventory',
            entityType: 'goods_receipt',
            entityId: receiptId,
            description: `Draft goods receipt ${receiptNumber} deleted`,
            oldValues,
            newValues: null,
            ipAddress: req.ip || null,
            userAgent: req.get('user-agent') || null,
            requestId: req.id || null,
            transaction
        });

        await transaction.commit();

        return res.status(200).json({
            message: 'Goods receipt deleted successfully'
        });
    } catch (error) {
        if (transaction && !transaction.finished) {
            await transaction.rollback();
        }

        console.error('Delete goods receipt error:', error);

        return res.status(500).json({
            message: 'Failed to delete goods receipt'
        });
    }
};



module.exports = {
    getGoodsReceipts,
    getGoodsReceiptById,
    createGoodsReceipt,
    updateGoodsReceipt,
    receiveGoodsReceipt,
    cancelGoodsReceipt,
    deleteGoodsReceipt
};
