const {
    GoodsReceiptItem,
    GoodsReceipt,
    PurchaseOrderItem,
    Item,
    ItemVariant,
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
            variant_id,
            quantity_received,
            unit_cost,
            condition,
            notes
        } = req.body;

        // Validate receipt ID.
        if (
            !/^\d+$/.test(String(goods_receipt_id ?? '')) ||
            Number(goods_receipt_id) <= 0
        ) {
            await transaction.rollback();
            return res.status(400).json({
                message: 'A valid goods receipt ID is required'
            });
        }

        // Lock the parent receipt. This also serializes item additions
        // to the same draft receipt.
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

        // Validate product ID.
        if (
            !/^\d+$/.test(String(item_id ?? '')) ||
            Number(item_id) <= 0
        ) {
            await transaction.rollback();
            return res.status(400).json({
                message: 'A valid item ID is required'
            });
        }

        const item = await Item.findByPk(item_id, { transaction });

        if (!item) {
            await transaction.rollback();
            return res.status(404).json({
                message: 'Item not found'
            });
        }

        // A variant is mandatory for every new goods-receipt line.
        if (variant_id === undefined || variant_id === null || variant_id === '') {
            await transaction.rollback();
            return res.status(400).json({
                message: 'A variant is required for each goods receipt item'
            });
        }

        let normalizedVariantId = null;

        if (
            variant_id !== undefined &&
            variant_id !== null &&
            variant_id !== ''
        ) {
            if (
                !/^\d+$/.test(String(variant_id)) ||
                Number(variant_id) <= 0
            ) {
                await transaction.rollback();
                return res.status(400).json({
                    message: 'Invalid variant ID'
                });
            }

            const variant = await ItemVariant.findByPk(variant_id, {
                transaction,
                lock: transaction.LOCK.UPDATE
            });

            if (!variant) {
                await transaction.rollback();
                return res.status(404).json({
                    message: 'Item variant not found'
                });
            }

            if (Number(variant.item_id) !== Number(item.id)) {
                await transaction.rollback();
                return res.status(400).json({
                    message: 'The selected variant does not belong to this item'
                });
            }

            if (!variant.is_active) {
                await transaction.rollback();
                return res.status(409).json({
                    message: 'Cannot receive stock for an inactive variant'
                });
            }

            normalizedVariantId = variant.id;
        }

        // Link PO-backed receipt lines to their exact purchase-order item.
        let normalizedPOItemId = null;

        if (goodsReceipt.purchase_order_id) {
            if (
                !/^\d+$/.test(String(purchase_order_item_id ?? '')) ||
                !Number.isSafeInteger(Number(purchase_order_item_id)) ||
                Number(purchase_order_item_id) <= 0
            ) {
                await transaction.rollback();
                return res.status(400).json({
                    message: 'A valid purchase order item is required for this receipt'
                });
            }

            const poItem = await PurchaseOrderItem.findByPk(
                purchase_order_item_id,
                {
                    transaction,
                    lock: transaction.LOCK.UPDATE
                }
            );

            if (
                !poItem ||
                Number(poItem.purchase_order_id) !== Number(goodsReceipt.purchase_order_id)
            ) {
                await transaction.rollback();
                return res.status(400).json({
                    message: 'The selected purchase order item does not belong to this receipt purchase order'
                });
            }

            if (
                Number(poItem.item_id) !== Number(item.id) ||
                Number(poItem.variant_id) !== Number(normalizedVariantId)
            ) {
                await transaction.rollback();
                return res.status(400).json({
                    message: 'The receipt item and variant must match the selected purchase order item'
                });
            }

            normalizedPOItemId = poItem.id;
        } else if (
            purchase_order_item_id !== undefined &&
            purchase_order_item_id !== null &&
            purchase_order_item_id !== ''
        ) {
            await transaction.rollback();
            return res.status(400).json({
                message: 'A standalone receipt cannot reference a purchase order item'
            });
        }

        // Validate quantity: positive, maximum 3 decimal places.
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
                message: 'Quantity received must be positive with at most 3 decimal places'
            });
        }

        const receivedQuantity = Number(quantity_received);

        // Keep unit cost required for compatibility with the current schema.
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
        const receiptCondition = condition ?? 'good';

        if (!['good', 'damaged', 'defective'].includes(receiptCondition)) {
            await transaction.rollback();
            return res.status(400).json({
                message: 'Condition must be good, damaged, or defective'
            });
        }

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

        // Prevent duplicate product/variant lines in the same receipt.
        // The parent receipt lock serializes additions to this receipt.
        const duplicateWhere = {
            goods_receipt_id: goodsReceipt.id,
            item_id,
            variant_id: normalizedVariantId
        };

        const existingItem = await GoodsReceiptItem.findOne({
            where: duplicateWhere,
            transaction
        });

        if (existingItem) {
            await transaction.rollback();
            return res.status(409).json({
                message: 'This product and variant are already on this goods receipt'
            });
        }

        const receiptItem = await GoodsReceiptItem.create(
            {
                goods_receipt_id: goodsReceipt.id,
                purchase_order_item_id: normalizedPOItemId,
                item_id: item.id,
                variant_id: normalizedVariantId,
                quantity_received: receivedQuantity,
                unit_cost: receivedUnitCost,
                condition: receiptCondition,
                notes: notes ?? null
            },
            { transaction }
        );

        await recordAuditLog({
            userId: req.user.id,
            action: 'GOODS_RECEIPT_ITEM_CREATED',
            module: 'inventory',
            entityType: 'goods_receipt_item',
            entityId: receiptItem.id,
            description: `Item ${item.id} added to goods receipt ${goodsReceipt.receipt_number}`,
            oldValues: null,
            newValues: {
                goods_receipt_id: goodsReceipt.id,
                item_id: item.id,
                variant_id: normalizedVariantId,
                quantity_received: receivedQuantity,
                unit_cost: receivedUnitCost,
                condition: receiptCondition,
                notes: notes ?? null
            },
            ipAddress: req.ip || null,
            userAgent: req.get('user-agent') || null,
            requestId: req.id || null,
            transaction
        });

        const createdItem = await GoodsReceiptItem.findByPk(receiptItem.id, {
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
                    model: Item,
                    as: 'item',
                    attributes: ['id', 'item_code', 'item_name']
                },
                {
                    model: ItemVariant,
                    as: 'variant'
                }
            ],
            transaction
        });

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
},
{
    model: ItemVariant,
    as: 'variant',
    attributes: ['id', 'item_id', 'sku', 'barcode'],
    required: false
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

        // Capture the details before deleting the item.
const oldValues = {
    goods_receipt_id: receiptItem.goods_receipt_id,
    purchase_order_item_id: receiptItem.purchase_order_item_id,
    item_id: receiptItem.item_id,
    variant_id: receiptItem.variant_id,
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
