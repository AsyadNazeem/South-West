const {
    GoodsReceiptItem,
    GoodsReceipt,
    PurchaseOrderItem,
    Item,
    sequelize
} = require('../models');

const { recordAuditLog } = require('../services/auditLogService');

// GET ALL
const getGoodsReceiptItems = async (req, res) => {
    try {
        const items = await GoodsReceiptItem.findAll({
            include: [
                {
                    model: GoodsReceipt,
                    as: 'goodsReceipt',
                    attributes: [
                        'id',
                        'purchase_order_id',
                        'receipt_number',
                        'receipt_date',
                        'status'
                    ]
                },
                {
                    model: PurchaseOrderItem,
                    as: 'purchaseOrderItem',
                    attributes: [
                        'id',
                        'purchase_order_id',
                        'item_id',
                        'quantity_ordered',
                        'quantity_received',
                        'unit_cost'
                    ]
                },
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
            message: 'Goods receipt items retrieved successfully',
            data: items
        });

    } catch (error) {
        console.error(
            'Get goods receipt items error:',
            error
        );

        return res.status(500).json({
            message: 'Failed to retrieve goods receipt items'
        });
    }
};


// GET BY ID
const getGoodsReceiptItemById = async (req, res) => {
    try {
        const { id } = req.params;

        const item = await GoodsReceiptItem.findByPk(id, {
            include: [
                {
                    model: GoodsReceipt,
                    as: 'goodsReceipt',
                    attributes: [
                        'id',
                        'purchase_order_id',
                        'receipt_number',
                        'receipt_date',
                        'status'
                    ]
                },
                {
                    model: PurchaseOrderItem,
                    as: 'purchaseOrderItem',
                    attributes: [
                        'id',
                        'purchase_order_id',
                        'item_id',
                        'quantity_ordered',
                        'quantity_received',
                        'unit_cost'
                    ]
                },
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

        if (!item) {
            return res.status(404).json({
                message: 'Goods receipt item not found'
            });
        }

        return res.status(200).json({
            message: 'Goods receipt item retrieved successfully',
            data: item
        });

    } catch (error) {
        console.error(
            'Get goods receipt item error:',
            error
        );

        return res.status(500).json({
            message: 'Failed to retrieve goods receipt item'
        });
    }
};

// CREATE

const createGoodsReceiptItem = async (req, res) => {
    let transaction;

    try {
        transaction = await sequelize.transaction();

        const {
            goods_receipt_id,
            purchase_order_item_id,
            item_id,
            quantity_received,
            unit_cost,
            condition,
            notes
        } = req.body;

        if (
            notes !== undefined &&
            notes !== null &&
            typeof notes !== 'string'
        ) {
            await transaction.rollback();

            return res.status(400).json({
                message: 'Notes must be a string or null'
            });
        }

        // 1. Lock the receipt and ensure it is still editable.
        const goodsReceipt = await GoodsReceipt.findByPk(
            goods_receipt_id,
            {
                transaction,
                lock: transaction.LOCK.UPDATE
            }
        );

        if (!goodsReceipt) {
            await transaction.rollback();

            return res.status(404).json({
                message: 'Goods receipt not found'
            });
        }

        if (goodsReceipt.status !== 'draft') {
            await transaction.rollback();

            return res.status(400).json({
                message: 'Only draft goods receipts can have items added'
            });
        }

        // 2. Lock the purchase order item.
        const purchaseOrderItem = await PurchaseOrderItem.findByPk(
            purchase_order_item_id,
            {
                transaction,
                lock: transaction.LOCK.UPDATE
            }
        );

        if (!purchaseOrderItem) {
            await transaction.rollback();

            return res.status(404).json({
                message: 'Purchase order item not found'
            });
        }

        if (
            Number(purchaseOrderItem.purchase_order_id) !==
            Number(goodsReceipt.purchase_order_id)
        ) {
            await transaction.rollback();

            return res.status(400).json({
                message: 'Purchase order item does not belong to this purchase order'
            });
        }

        // 3. Validate item.
        const item = await Item.findByPk(item_id, { transaction });

        if (!item) {
            await transaction.rollback();

            return res.status(404).json({
                message: 'Item not found'
            });
        }

        if (Number(purchaseOrderItem.item_id) !== Number(item_id)) {
            await transaction.rollback();

            return res.status(400).json({
                message: 'Item does not match the purchase order item'
            });
        }

        // 4. Validate quantity.
        if (
            quantity_received === undefined ||
            quantity_received === null ||
            quantity_received === '' ||
            !Number.isFinite(Number(quantity_received)) ||
            Number(quantity_received) <= 0 ||
            Number(quantity_received) >= 1e12 ||
            Math.abs(
                Number(quantity_received) * 1000 -
                Math.round(Number(quantity_received) * 1000)
            ) >= 1e-7
        ) {
            await transaction.rollback();

            return res.status(400).json({
                message: 'Quantity received must be a positive number with at most 3 decimal places'
            });
        }


        const receivedQuantity = Number(quantity_received);


        // 5. Validate unit cost.
        if (
            unit_cost === undefined ||
            unit_cost === null ||
            unit_cost === '' ||
            !Number.isFinite(Number(unit_cost)) ||
            Number(unit_cost) < 0 ||
            Number(unit_cost) >= 1e13 ||
            Math.abs(
                Number(unit_cost) * 100 -
                Math.round(Number(unit_cost) * 100)
            ) >= 1e-7
        ) {
            await transaction.rollback();

            return res.status(400).json({
                message: 'Unit cost must be a non-negative amount with at most 2 decimal places'
            });
        }

        const receivedUnitCost = Number(unit_cost);

        // 6. Validate condition.
        const receiptCondition = condition ?? 'good';
        const validConditions = ['good', 'damaged', 'defective'];

        if (!validConditions.includes(receiptCondition)) {
            await transaction.rollback();

            return res.status(400).json({
                message: 'Condition must be good, damaged, or defective'
            });
        }

        // 7. Prevent duplicate receipt items.
        const existingItem = await GoodsReceiptItem.findOne({
            where: {
                goods_receipt_id: goodsReceipt.id,
                purchase_order_item_id,
                item_id
            },
            transaction
        });

        if (existingItem) {
            await transaction.rollback();

            return res.status(409).json({
                message: 'This purchase order item is already added to this goods receipt'
            });
        }

        // 8. Create receipt item.
        const receiptItem = await GoodsReceiptItem.create(
            {
                goods_receipt_id: goodsReceipt.id,
                purchase_order_item_id,
                item_id,
                quantity_received: receivedQuantity,
                unit_cost: receivedUnitCost,
                condition: receiptCondition,
                notes
            },
            { transaction }
        );


        // 10. Audit the creation in the same transaction.
        await recordAuditLog({
            userId: req.user.id,
            action: 'GOODS_RECEIPT_ITEM_CREATED',
            module: 'inventory',
            entityType: 'goods_receipt_item',
            entityId: receiptItem.id,
            description: `Item ${item_id} added to goods receipt ${goodsReceipt.receipt_number}`,
            oldValues: null,
            newValues: {
                goods_receipt_id: goodsReceipt.id,
                purchase_order_item_id: purchase_order_item_id,
                item_id,
                quantity_received: receivedQuantity,
                unit_cost: receivedUnitCost,
                condition: receiptCondition,
                notes: notes ?? null,
            },
            ipAddress: req.ip || null,
            userAgent: req.get('user-agent') || null,
            requestId: req.id || null,
            transaction
        });

        // 11. Retrieve the created item.
        const createdItem = await GoodsReceiptItem.findByPk(
            receiptItem.id,
            {
                include: [
                    {
                        model: GoodsReceipt,
                        as: 'goodsReceipt',
                        attributes: [
                            'id',
                            'receipt_number',
                            'receipt_date',
                            'status'
                        ]
                    },
                    {
                        model: PurchaseOrderItem,
                        as: 'purchaseOrderItem',
                        attributes: [
                            'id',
                            'purchase_order_id',
                            'item_id',
                            'quantity_ordered',
                            'quantity_received',
                            'unit_cost'
                        ]
                    },
                    {
                        model: Item,
                        as: 'item',
                        attributes: ['id', 'item_code', 'item_name']
                    }
                ],
                transaction
            }
        );

        await transaction.commit();

        return res.status(201).json({
            message: 'Goods receipt item created successfully',
            data: createdItem
        });
    } catch (error) {
        if (transaction && !transaction.finished) {
            await transaction.rollback();
        }

        console.error('Create goods receipt item error:', error);

        return res.status(500).json({
            message: 'Failed to create goods receipt item'
        });
    }
};



// UPDATE

const updateGoodsReceiptItem = async (req, res) => {
    let transaction;

    try {
        transaction = await sequelize.transaction();

        const { id } = req.params;

        if (!/^\d+$/.test(String(id)) || Number(id) <= 0) {
            await transaction.rollback();

            return res.status(400).json({
                message: 'Invalid goods receipt item ID'
            });
        }

        // Find the item to identify its parent receipt.
        const initialItem = await GoodsReceiptItem.findByPk(id, {
            transaction
        });

        if (!initialItem) {
            await transaction.rollback();

            return res.status(404).json({
                message: 'Goods receipt item not found'
            });
        }

        // Lock the receipt first, then the receipt item and PO item.
        const goodsReceipt = await GoodsReceipt.findByPk(
            initialItem.goods_receipt_id,
            {
                transaction,
                lock: transaction.LOCK.UPDATE
            }
        );

        if (!goodsReceipt) {
            await transaction.rollback();

            return res.status(404).json({
                message: 'Goods receipt not found'
            });
        }

        if (goodsReceipt.status !== 'draft') {
            await transaction.rollback();

            return res.status(400).json({
                message: 'Cannot modify items after receipt is received or cancelled'
            });
        }

        const receiptItem = await GoodsReceiptItem.findByPk(id, {
            transaction,
            lock: transaction.LOCK.UPDATE
        });

        if (
            !receiptItem ||
            Number(receiptItem.goods_receipt_id) !== Number(goodsReceipt.id)
        ) {
            await transaction.rollback();

            return res.status(409).json({
                message: 'Goods receipt item changed during the request; please retry'
            });
        }

        const purchaseOrderItem = await PurchaseOrderItem.findByPk(
            receiptItem.purchase_order_item_id,
            {
                transaction,
                lock: transaction.LOCK.UPDATE
            }
        );

        if (!purchaseOrderItem) {
            await transaction.rollback();

            return res.status(404).json({
                message: 'Purchase order item not found'
            });
        }

        const {
            quantity_received,
            unit_cost,
            condition,
            notes
        } = req.body;

        const oldValues = {
            quantity_received: Number(receiptItem.quantity_received),
            unit_cost: Number(receiptItem.unit_cost),
            condition: receiptItem.condition,
            notes: receiptItem.notes
        };

        // Validate new quantity.
        const newQuantity = quantity_received === undefined
            ? oldValues.quantity_received
            : Number(quantity_received);

        if (
            quantity_received !== undefined &&
            (
                quantity_received === null ||
                quantity_received === '' ||
                !Number.isFinite(newQuantity) ||
                newQuantity <= 0 ||
                newQuantity >= 1e12 ||
                Math.abs(newQuantity * 1000 - Math.round(newQuantity * 1000)) >= 1e-7
            )
        ) {
            await transaction.rollback();

            return res.status(400).json({
                message: 'Quantity received must be positive with at most 3 decimal places'
            });
        }

        // Validate unit cost.
        const newUnitCost = unit_cost === undefined
            ? oldValues.unit_cost
            : Number(unit_cost);

        if (
            unit_cost !== undefined &&
            (
                unit_cost === null ||
                unit_cost === '' ||
                !Number.isFinite(newUnitCost) ||
                newUnitCost < 0 ||
                newUnitCost >= 1e13 ||
                Math.abs(newUnitCost * 100 - Math.round(newUnitCost * 100)) >= 1e-7
            )
        ) {
            await transaction.rollback();

            return res.status(400).json({
                message: 'Unit cost must be non-negative with at most 2 decimal places'
            });
        }

        // Validate condition.
        const newCondition = condition === undefined
            ? oldValues.condition
            : condition;

        if (!['good', 'damaged', 'defective'].includes(newCondition)) {
            await transaction.rollback();

            return res.status(400).json({
                message: 'Condition must be good, damaged, or defective'
            });
        }

        // Validate notes.
        if (
            notes !== undefined &&
            notes !== null &&
            typeof notes !== 'string'
        ) {
            await transaction.rollback();

            return res.status(400).json({
                message: 'Notes must be a string or null'
            });
        }

        // Update the receipt item.
        await receiptItem.update(
            {
                quantity_received: newQuantity,
                unit_cost: newUnitCost,
                condition: newCondition,
                notes: notes === undefined ? receiptItem.notes : notes
            },
            { transaction }
        );

        const newValues = {
            quantity_received: Number(receiptItem.quantity_received),
            unit_cost: Number(receiptItem.unit_cost),
            condition: receiptItem.condition,
            notes: receiptItem.notes ?? null
        };

        const changed = Object.keys(oldValues).some(
            key => (oldValues[key] ?? null) !== (newValues[key] ?? null)
        );
        if (changed) {
            await recordAuditLog({
                userId: req.user.id,
                action: 'GOODS_RECEIPT_ITEM_UPDATED',
                module: 'inventory',
                entityType: 'goods_receipt_item',
                entityId: receiptItem.id,
                description: `Item ${receiptItem.item_id} updated in goods receipt ${goodsReceipt.receipt_number}`,
                oldValues,
                newValues,
                ipAddress: req.ip || null,
                userAgent: req.get('user-agent') || null,
                requestId: req.id || null,
                transaction
            });
        }

        const updatedItem = await GoodsReceiptItem.findByPk(id, {
            include: [
                {
                    model: GoodsReceipt,
                    as: 'goodsReceipt',
                    attributes: [
                        'id',
                        'purchase_order_id',
                        'receipt_number',
                        'receipt_date',
                        'status'
                    ]
                },
                {
                    model: PurchaseOrderItem,
                    as: 'purchaseOrderItem',
                    attributes: [
                        'id',
                        'purchase_order_id',
                        'item_id',
                        'quantity_ordered',
                        'quantity_received',
                        'unit_cost'
                    ]
                },
                {
                    model: Item,
                    as: 'item',
                    attributes: ['id', 'item_code', 'item_name']
                }
            ],
            transaction
        });

        await transaction.commit();

        return res.status(200).json({
            message: 'Goods receipt item updated successfully',
            data: updatedItem
        });
    } catch (error) {
        if (transaction && !transaction.finished) {
            await transaction.rollback();
        }

        console.error('Update goods receipt item error:', error);

        return res.status(500).json({
            message: 'Failed to update goods receipt item'
        });
    }
};



// DELETE

const deleteGoodsReceiptItem = async (req, res) => {
    let transaction;

    try {
        transaction = await sequelize.transaction();

        const { id } = req.params;

        if (!/^\d+$/.test(String(id)) || Number(id) <= 0) {
            await transaction.rollback();

            return res.status(400).json({
                message: 'Invalid goods receipt item ID'
            });
        }

        // Find the item to identify its parent receipt.
        const initialItem = await GoodsReceiptItem.findByPk(id, {
            transaction
        });

        if (!initialItem) {
            await transaction.rollback();

            return res.status(404).json({
                message: 'Goods receipt item not found'
            });
        }

        // Lock the parent receipt first.
        const goodsReceipt = await GoodsReceipt.findByPk(
            initialItem.goods_receipt_id,
            {
                transaction,
                lock: transaction.LOCK.UPDATE
            }
        );

        if (!goodsReceipt) {
            await transaction.rollback();

            return res.status(404).json({
                message: 'Goods receipt not found'
            });
        }

        if (goodsReceipt.status !== 'draft') {
            await transaction.rollback();

            return res.status(400).json({
                message: 'Cannot delete an item from a received or cancelled goods receipt'
            });
        }

        const receiptItem = await GoodsReceiptItem.findByPk(id, {
            transaction,
            lock: transaction.LOCK.UPDATE
        });

        if (
            !receiptItem ||
            Number(receiptItem.goods_receipt_id) !== Number(goodsReceipt.id)
        ) {
            await transaction.rollback();

            return res.status(409).json({
                message: 'Goods receipt item changed during the request; please retry'
            });
        }

        const purchaseOrderItem = await PurchaseOrderItem.findByPk(
            receiptItem.purchase_order_item_id,
            {
                transaction,
                lock: transaction.LOCK.UPDATE
            }
        );

        if (!purchaseOrderItem) {
            await transaction.rollback();

            return res.status(404).json({
                message: 'Purchase order item not found'
            });
        }

        // Capture the details before deleting the item.
        const oldValues = {
            goods_receipt_id: receiptItem.goods_receipt_id,
            purchase_order_item_id: receiptItem.purchase_order_item_id,
            item_id: receiptItem.item_id,
            quantity_received: Number(receiptItem.quantity_received),
            unit_cost: Number(receiptItem.unit_cost),
            condition: receiptItem.condition,
            notes: receiptItem.notes
        };

        // Delete the receipt item.
        await receiptItem.destroy({ transaction });

        // Record deletion in the same transaction.
        await recordAuditLog({
            userId: req.user.id,
            action: 'GOODS_RECEIPT_ITEM_DELETED',
            module: 'inventory',
            entityType: 'goods_receipt_item',
            entityId: receiptItem.id,
            description: `Item ${receiptItem.item_id} deleted from goods receipt ${goodsReceipt.receipt_number}`,
            oldValues,
            newValues: {
                deleted: true
            },
            ipAddress: req.ip || null,
            userAgent: req.get('user-agent') || null,
            requestId: req.id || null,
            transaction
        });

        await transaction.commit();

        return res.status(200).json({
            message: 'Goods receipt item deleted successfully'
        });
    } catch (error) {
        if (transaction && !transaction.finished) {
            await transaction.rollback();
        }

        console.error('Delete goods receipt item error:', error);

        return res.status(500).json({
            message: 'Failed to delete goods receipt item'
        });
    }
};



module.exports = {
    getGoodsReceiptItems,
    getGoodsReceiptItemById,
    createGoodsReceiptItem,
    updateGoodsReceiptItem,
    deleteGoodsReceiptItem
};
