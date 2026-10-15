const {
    sequelize,
    PurchaseOrderItem,
    PurchaseOrder,
    Item
} = require('../models');

const { recordAuditLog } = require('../services/auditLogService');

const isEditablePurchaseOrder = (status) =>
    status === 'draft';


const recalculatePurchaseOrderTotals = async (
    purchaseOrder,
    transaction
) => {
    const orderItems = await PurchaseOrderItem.findAll({
        where: {
            purchase_order_id: purchaseOrder.id
        },
        attributes: ['line_total'],
        transaction
    });

    const subtotal = Number(
        orderItems.reduce(
            (sum, item) => sum + Number(item.line_total || 0),
            0
        ).toFixed(2)
    );

    const discount = Number(purchaseOrder.discount_amount || 0);
    const tax = Number(purchaseOrder.tax_amount || 0);
    const shipping = Number(purchaseOrder.shipping_amount || 0);

    if (
        !Number.isFinite(subtotal) ||
        !Number.isFinite(discount) ||
        !Number.isFinite(tax) ||
        !Number.isFinite(shipping) ||
        subtotal < 0 ||
        subtotal >= 1e13 ||
        !isValidAmount(discount) ||
        !isValidAmount(tax) ||
        !isValidAmount(shipping) ||
        discount > subtotal
    ) {
        throw new Error('Purchase order totals are invalid');
    }

    const totalAmount = Number(
        (subtotal - discount + tax + shipping).toFixed(2)
    );

    if (
        !Number.isFinite(totalAmount) ||
        totalAmount < 0 ||
        totalAmount >= 1e13 ||
        !isValidAmount(totalAmount)
    ) {
        throw new Error('Calculated purchase order total is invalid');
    }

    await purchaseOrder.update(
        {
            subtotal,
            total_amount: totalAmount,
            updated_at: new Date()
        },
        { transaction }
    );

    return {
        subtotal,
        total_amount: totalAmount
    };
};


// GET ALL
const getPurchaseOrderItems = async (req, res) => {
    try {
        const items = await PurchaseOrderItem.findAll({
            include: [
                {
                    model: PurchaseOrder,
                    as: 'purchaseOrder',
                    attributes: [
                        'id',
                        'purchase_order_number',
                        'order_date',
                        'status'
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
            message: 'Purchase order items retrieved successfully',
            data: items
        });

    } catch (error) {
        console.error(
            'Get purchase order items error:',
            error
        );

        return res.status(500).json({
            message: 'Failed to retrieve purchase order items'
        });
    }
};


// GET BY ID
const getPurchaseOrderItemById = async (req, res) => {
    try {
        const { id } = req.params;

        const item = await PurchaseOrderItem.findByPk(id, {
            include: [
                {
                    model: PurchaseOrder,
                    as: 'purchaseOrder',
                    attributes: [
                        'id',
                        'purchase_order_number',
                        'order_date',
                        'status'
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
                message: 'Purchase order item not found'
            });
        }

        return res.status(200).json({
            message: 'Purchase order item retrieved successfully',
            data: item
        });

    } catch (error) {
        console.error(
            'Get purchase order item error:',
            error
        );

        return res.status(500).json({
            message: 'Failed to retrieve purchase order item'
        });
    }
};


// CREATE
const createPurchaseOrderItem = async (req, res) => {
    let transaction;

    try {
        transaction = await sequelize.transaction();

        const {
            purchase_order_id,
            item_id,
            quantity_ordered,
            unit_cost,
            discount_amount = 0,
            tax_amount = 0,
            notes
        } = req.body;

        if (!purchase_order_id || !item_id) {
            await transaction.rollback();

            return res.status(400).json({
                message: 'Purchase order and item are required'
            });
        }

        if (!isValidPositiveQuantity(quantity_ordered)) {
            await transaction.rollback();

            return res.status(400).json({
                message: 'Quantity ordered must be a positive number'
            });
        }

        if (!isValidAmount(unit_cost)) {
            await transaction.rollback();

            return res.status(400).json({
                message: 'Unit cost must be a valid non-negative number'
            });
        }

        if (
            !isValidAmount(discount_amount) ||
            !isValidAmount(tax_amount)
        ) {
            await transaction.rollback();

            return res.status(400).json({
                message: 'Discount and tax must be valid non-negative amounts'
            });
        }

        const purchaseOrder = await PurchaseOrder.findByPk(
            purchase_order_id,
            {
                transaction,
                lock: transaction.LOCK.UPDATE
            }
        );

        if (!purchaseOrder) {
            await transaction.rollback();

            return res.status(404).json({
                message: 'Purchase order not found'
            });
        }

        if (!isEditablePurchaseOrder(purchaseOrder.status)) {
            await transaction.rollback();

            return res.status(400).json({
                message:
                    'Cannot add items to an approved, received, or cancelled purchase order'
            });
        }

        const item = await Item.findByPk(item_id, {
            transaction
        });

        if (!item) {
            await transaction.rollback();

            return res.status(404).json({
                message: 'Item not found'
            });
        }

        const existingItem = await PurchaseOrderItem.findOne({
            where: {
                purchase_order_id,
                item_id
            },
            transaction
        });

        if (existingItem) {
            await transaction.rollback();

            return res.status(409).json({
                message: 'Item is already added to this purchase order'
            });
        }

        const quantity = Number(quantity_ordered);
        const cost = Number(unit_cost);
        const discount = Number(discount_amount);
        const tax = Number(tax_amount);
        const grossLineTotal = quantity * cost;

        if (
            !Number.isFinite(grossLineTotal) ||
            discount > grossLineTotal
        ) {
            await transaction.rollback();

            return res.status(400).json({
                message: 'Item discount cannot exceed the item subtotal'
            });
        }

        const lineTotal = Number(
            (grossLineTotal - discount + tax).toFixed(2)
        );

        if (
            !Number.isFinite(lineTotal) ||
            lineTotal < 0 ||
            lineTotal >= 1e13 ||
            Math.abs(lineTotal * 100 - Math.round(lineTotal * 100)) >= 1e-7
        ) {
            await transaction.rollback();

            return res.status(400).json({
                message: 'Calculated line total is invalid'
            });
        }

        const purchaseOrderItem = await PurchaseOrderItem.create(
            {
                purchase_order_id,
                item_id,
                quantity_ordered: quantity,
                unit_cost: cost,
                discount_amount: discount,
                tax_amount: tax,
                line_total: lineTotal,
                quantity_received: 0,
                notes,
                created_at: new Date(),
                updated_at: new Date()
            },
            {
                transaction
            }
        );

        const totals = await recalculatePurchaseOrderTotals(
            purchaseOrder,
            transaction
        );

        await recordAuditLog({
            userId: req.user?.id ?? req.user?.userId ?? null,
            action: 'PURCHASE_ORDER_ITEM_CREATED',
            module: 'purchasing',
            entityType: 'purchase_order_item',
            entityId: purchaseOrderItem.id,
            description: `Item added to purchase order ${purchaseOrder.purchase_order_number}`,
            oldValues: null,
            newValues: {
                purchase_order_id: purchaseOrder.id,
                item_id,
                quantity_ordered: quantity,
                unit_cost: cost,
                discount_amount: discount,
                tax_amount: tax,
                line_total: lineTotal,
                ...totals
            },
            ipAddress: req.ip || null,
            userAgent: req.get('user-agent') || null,
            requestId: req.id || null,
            transaction
        });

        const createdItem = await PurchaseOrderItem.findByPk(
            purchaseOrderItem.id,
            {
                transaction,
                include: [
                    {
                        model: PurchaseOrder,
                        as: 'purchaseOrder',
                        attributes: [
                            'id',
                            'purchase_order_number',
                            'order_date',
                            'status'
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
            }
        );

        await transaction.commit();

        return res.status(201).json({
            message: 'Purchase order item created successfully',
            data: createdItem
        });
    } catch (error) {
        if (transaction && !transaction.finished) {
            await transaction.rollback();
        }

        const isDuplicateKey =
            error.original?.code === 'ER_DUP_ENTRY' ||
            error.parent?.code === 'ER_DUP_ENTRY';

        if (isDuplicateKey) {
            return res.status(409).json({
                message: 'Item is already added to this purchase order'
            });
        }

        console.error('Create purchase order item error:', error);

        return res.status(500).json({
            message: 'Failed to create purchase order item'
        });
    }
};


// UPDATE
const updatePurchaseOrderItem = async (req, res) => {
    let transaction;

    try {
        transaction = await sequelize.transaction();

        const { id } = req.params;
        const {
            item_id,
            quantity_ordered,
            unit_cost,
            discount_amount,
            tax_amount,
            notes
        } = req.body;

        if (!/^\d+$/.test(String(id)) || Number(id) <= 0) {
            await transaction.rollback();
            return res.status(400).json({
                message: 'Invalid purchase order item ID'
            });
        }

        // Read the item first to identify its parent purchase order.
        // Do not lock the item until the parent order is locked.
        const initialItem = await PurchaseOrderItem.findByPk(id, {
            transaction
        });

        if (!initialItem) {
            await transaction.rollback();

            return res.status(404).json({
                message: 'Purchase order item not found'
            });
        }

        const purchaseOrder = await PurchaseOrder.findByPk(
            initialItem.purchase_order_id,
            {
                transaction,
                lock: transaction.LOCK.UPDATE
            }
        );

        if (!purchaseOrder) {
            await transaction.rollback();

            return res.status(404).json({
                message: 'Purchase order not found'
            });
        }

        // Lock and re-read the item after locking its parent.
        const purchaseOrderItem = await PurchaseOrderItem.findByPk(id, {
            transaction,
            lock: transaction.LOCK.UPDATE
        });

        if (!purchaseOrderItem) {
            await transaction.rollback();

            return res.status(404).json({
                message: 'Purchase order item not found'
            });
        }

        // Ensure the item still belongs to the parent order we locked.
        if (
            Number(purchaseOrderItem.purchase_order_id) !==
            Number(purchaseOrder.id)
        ) {
            await transaction.rollback();

            return res.status(409).json({
                message: 'Purchase order item changed. Please retry the request.'
            });
        }

        if (!isEditablePurchaseOrder(purchaseOrder.status)) {
            await transaction.rollback();
            return res.status(400).json({
                message:
                    'Cannot modify items after purchase order is approved, received, or cancelled'
            });
        }

        const oldValues = {
            purchase_order_id: purchaseOrderItem.purchase_order_id,
            item_id: purchaseOrderItem.item_id,
            quantity_ordered: purchaseOrderItem.quantity_ordered,
            unit_cost: purchaseOrderItem.unit_cost,
            discount_amount: purchaseOrderItem.discount_amount,
            tax_amount: purchaseOrderItem.tax_amount,
            line_total: purchaseOrderItem.line_total,
            quantity_received: purchaseOrderItem.quantity_received,
            notes: purchaseOrderItem.notes
        };

        const finalItemId =
            item_id !== undefined ? item_id : purchaseOrderItem.item_id;

        const finalQuantity =
            quantity_ordered !== undefined
                ? quantity_ordered
                : purchaseOrderItem.quantity_ordered;

        const finalUnitCost =
            unit_cost !== undefined
                ? unit_cost
                : purchaseOrderItem.unit_cost;

        const finalDiscount =
            discount_amount !== undefined
                ? discount_amount
                : purchaseOrderItem.discount_amount;

        const finalTax =
            tax_amount !== undefined
                ? tax_amount
                : purchaseOrderItem.tax_amount;

        const isValidItemId =
            (typeof finalItemId === 'number' &&
                Number.isSafeInteger(finalItemId) &&
                finalItemId > 0) ||
            (typeof finalItemId === 'string' &&
                /^[1-9]\d*$/.test(finalItemId) &&
                Number.isSafeInteger(Number(finalItemId)));

        if (!isValidItemId) {
            await transaction.rollback();

            return res.status(400).json({
                message: 'A valid item ID is required'
            });
        }

        if (!isValidPositiveQuantity(finalQuantity)) {
            await transaction.rollback();
            return res.status(400).json({
                message: 'Quantity ordered must be a positive number'
            });
        }

        if (!isValidAmount(finalUnitCost)) {
            await transaction.rollback();
            return res.status(400).json({
                message: 'Unit cost must be a valid non-negative number'
            });
        }

        if (
            !isValidAmount(finalDiscount) ||
            !isValidAmount(finalTax)
        ) {
            await transaction.rollback();
            return res.status(400).json({
                message: 'Discount and tax must be valid non-negative amounts'
            });
        }

        const receivedQuantity = Number(
            purchaseOrderItem.quantity_received || 0
        );

        if (Number(finalQuantity) < receivedQuantity) {
            await transaction.rollback();
            return res.status(400).json({
                message:
                    'Ordered quantity cannot be less than the quantity already received'
            });
        }

        const item = await Item.findByPk(finalItemId, {
            transaction
        });

        if (!item) {
            await transaction.rollback();
            return res.status(404).json({
                message: 'Item not found'
            });
        }

        if (Number(finalItemId) !== Number(purchaseOrderItem.item_id)) {
            const duplicateItem = await PurchaseOrderItem.findOne({
                where: {
                    purchase_order_id: purchaseOrder.id,
                    item_id: finalItemId
                },
                transaction
            });

            if (duplicateItem) {
                await transaction.rollback();
                return res.status(409).json({
                    message:
                        'Item is already added to this purchase order'
                });
            }

            if (receivedQuantity > 0) {
                await transaction.rollback();
                return res.status(400).json({
                    message:
                        'Cannot replace an item that has already been received'
                });
            }
        }

        const grossLineTotal =
            Number(finalQuantity) * Number(finalUnitCost);

        if (
            !Number.isFinite(grossLineTotal) ||
            Number(finalDiscount) > grossLineTotal
        ) {
            await transaction.rollback();
            return res.status(400).json({
                message: 'Item discount cannot exceed the item subtotal'
            });
        }

        const lineTotal = Number(
            (
                grossLineTotal -
                Number(finalDiscount) +
                Number(finalTax)
            ).toFixed(2)
        );

        if (
            !Number.isFinite(lineTotal) ||
            lineTotal < 0 ||
            lineTotal >= 1e13 ||
            Math.abs(lineTotal * 100 - Math.round(lineTotal * 100)) >= 1e-7
        ) {
            await transaction.rollback();
            return res.status(400).json({
                message: 'Calculated line total is invalid'
            });
        }

        await purchaseOrderItem.update(
            {
                item_id: finalItemId,
                quantity_ordered: Number(finalQuantity),
                unit_cost: Number(finalUnitCost),
                discount_amount: Number(finalDiscount),
                tax_amount: Number(finalTax),
                line_total: lineTotal,
                notes:
                    notes !== undefined
                        ? notes
                        : purchaseOrderItem.notes,
                updated_at: new Date()
            },
            { transaction }
        );

        const totals = await recalculatePurchaseOrderTotals(
            purchaseOrder,
            transaction
        );

        const newValues = {
            purchase_order_id: purchaseOrder.id,
            item_id: Number(finalItemId),
            quantity_ordered: Number(finalQuantity),
            unit_cost: Number(finalUnitCost),
            discount_amount: Number(finalDiscount),
            tax_amount: Number(finalTax),
            line_total: lineTotal,
            quantity_received: receivedQuantity,
            notes:
                notes !== undefined
                    ? notes
                    : purchaseOrderItem.notes,
            ...totals
        };

        await recordAuditLog({
            userId: req.user?.id ?? req.user?.userId ?? null,
            action: 'PURCHASE_ORDER_ITEM_UPDATED',
            module: 'purchasing',
            entityType: 'purchase_order_item',
            entityId: purchaseOrderItem.id,
            description:
                `Item updated on purchase order ${purchaseOrder.purchase_order_number}`,
            oldValues,
            newValues,
            ipAddress: req.ip || null,
            userAgent: req.get('user-agent') || null,
            requestId: req.id || null,
            transaction
        });

        const updatedItem = await PurchaseOrderItem.findByPk(
            purchaseOrderItem.id,
            {
                transaction,
                include: [
                    {
                        model: PurchaseOrder,
                        as: 'purchaseOrder',
                        attributes: [
                            'id',
                            'purchase_order_number',
                            'order_date',
                            'status'
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
            }
        );

        await transaction.commit();

        return res.status(200).json({
            message: 'Purchase order item updated successfully',
            data: updatedItem
        });

    } catch (error) {
        if (transaction && !transaction.finished) {
            await transaction.rollback();
        }

        const isDuplicateKey =
            error.original?.code === 'ER_DUP_ENTRY' ||
            error.parent?.code === 'ER_DUP_ENTRY';

        if (isDuplicateKey) {
            return res.status(409).json({
                message:
                    'Item is already added to this purchase order'
            });
        }

        console.error(
            'Update purchase order item error:',
            error
        );

        return res.status(500).json({
            message: 'Failed to update purchase order item'
        });
    }
};

// DELETE
const deletePurchaseOrderItem = async (req, res) => {
    let transaction;

    try {
        transaction = await sequelize.transaction();

        const { id } = req.params;

        if (!/^\d+$/.test(String(id)) || Number(id) <= 0) {
            await transaction.rollback();

            return res.status(400).json({
                message: 'Invalid purchase order item ID'
            });
        }

        // Read the item first to identify its parent purchase order.
        // Do not lock the item until the parent order is locked.
        const initialItem = await PurchaseOrderItem.findByPk(id, {
            transaction
        });

        if (!initialItem) {
            await transaction.rollback();

            return res.status(404).json({
                message: 'Purchase order item not found'
            });
        }

        const purchaseOrder = await PurchaseOrder.findByPk(
            initialItem.purchase_order_id,
            {
                transaction,
                lock: transaction.LOCK.UPDATE
            }
        );

        if (!purchaseOrder) {
            await transaction.rollback();

            return res.status(404).json({
                message: 'Purchase order not found'
            });
        }

        // Lock and re-read the item after locking its parent.
        const purchaseOrderItem = await PurchaseOrderItem.findByPk(id, {
            transaction,
            lock: transaction.LOCK.UPDATE
        });

        if (!purchaseOrderItem) {
            await transaction.rollback();

            return res.status(404).json({
                message: 'Purchase order item not found'
            });
        }

        // Ensure the item still belongs to the parent order we locked.
        if (
            Number(purchaseOrderItem.purchase_order_id) !==
            Number(purchaseOrder.id)
        ) {
            await transaction.rollback();

            return res.status(409).json({
                message: 'Purchase order item changed. Please retry the request.'
            });
        }

        if (!isEditablePurchaseOrder(purchaseOrder.status)) {
            await transaction.rollback();

            return res.status(400).json({
                message:
                    'Cannot delete items after purchase order is approved, received, or cancelled'
            });
        }

        if (Number(purchaseOrderItem.quantity_received || 0) > 0) {
            await transaction.rollback();

            return res.status(400).json({
                message:
                    'Cannot delete an item that has already been received'
            });
        }

        const oldValues = {
            purchase_order_id: purchaseOrderItem.purchase_order_id,
            item_id: purchaseOrderItem.item_id,
            quantity_ordered: purchaseOrderItem.quantity_ordered,
            unit_cost: purchaseOrderItem.unit_cost,
            discount_amount: purchaseOrderItem.discount_amount,
            tax_amount: purchaseOrderItem.tax_amount,
            line_total: purchaseOrderItem.line_total,
            quantity_received: purchaseOrderItem.quantity_received,
            notes: purchaseOrderItem.notes
        };

        await purchaseOrderItem.destroy({ transaction });

        const totals = await recalculatePurchaseOrderTotals(
            purchaseOrder,
            transaction
        );

        await recordAuditLog({
            userId: req.user?.id ?? req.user?.userId ?? null,
            action: 'PURCHASE_ORDER_ITEM_DELETED',
            module: 'purchasing',
            entityType: 'purchase_order_item',
            entityId: Number(id),
            description:
                `Item deleted from purchase order ${purchaseOrder.purchase_order_number}`,
            oldValues,
            newValues: {
                purchase_order_id: purchaseOrder.id,
                ...totals
            },
            ipAddress: req.ip || null,
            userAgent: req.get('user-agent') || null,
            requestId: req.id || null,
            transaction
        });

        await transaction.commit();

        return res.status(200).json({
            message: 'Purchase order item deleted successfully'
        });
    } catch (error) {
        if (transaction && !transaction.finished) {
            await transaction.rollback();
        }

        console.error('Delete purchase order item error:', error);

        return res.status(500).json({
            message: 'Failed to delete purchase order item'
        });
    }
};



module.exports = {
    getPurchaseOrderItems,
    getPurchaseOrderItemById,
    createPurchaseOrderItem,
    updatePurchaseOrderItem,
    deletePurchaseOrderItem
};
