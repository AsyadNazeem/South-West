const {
    GoodsReceiptItem,
    GoodsReceipt,
    PurchaseOrderItem,
    Item
} = require('../models');

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
    const transaction = await GoodsReceiptItem.sequelize.transaction();

    try {
        const {
            goods_receipt_id,
            purchase_order_item_id,
            item_id,
            quantity_received,
            unit_cost,
            condition,
            notes
        } = req.body;


        // ==========================================
        // 1. VALIDATE GOODS RECEIPT
        // ==========================================

        const goodsReceipt = await GoodsReceipt.findByPk(
            goods_receipt_id,
            {
                transaction
            }
        );

        if (!goodsReceipt) {
            await transaction.rollback();

            return res.status(404).json({
                message: 'Goods receipt not found'
            });
        }


        // Cannot modify cancelled receipt
        if (goodsReceipt.status === 'cancelled') {
            await transaction.rollback();

            return res.status(400).json({
                message:
                    'Cannot add items to a cancelled goods receipt'
            });
        }


        // Cannot modify received receipt
        if (goodsReceipt.status === 'received') {
            await transaction.rollback();

            return res.status(400).json({
                message:
                    'Cannot add items to a received goods receipt'
            });
        }


        // ==========================================
        // 2. VALIDATE PURCHASE ORDER ITEM
        // ==========================================

        const purchaseOrderItem =
            await PurchaseOrderItem.findByPk(
                purchase_order_item_id,
                {
                    transaction
                }
            );

        if (!purchaseOrderItem) {
            await transaction.rollback();

            return res.status(404).json({
                message:
                    'Purchase order item not found'
            });
        }


        // Make sure PO item belongs to same PO
        if (
            Number(purchaseOrderItem.purchase_order_id) !==
            Number(goodsReceipt.purchase_order_id)
        ) {
            await transaction.rollback();

            return res.status(400).json({
                message:
                    'Purchase order item does not belong to this purchase order'
            });
        }


        // ==========================================
        // 3. VALIDATE ITEM
        // ==========================================

        const item = await Item.findByPk(
            item_id,
            {
                transaction
            }
        );

        if (!item) {
            await transaction.rollback();

            return res.status(404).json({
                message: 'Item not found'
            });
        }


        // Make sure item matches PO item
        if (
            Number(purchaseOrderItem.item_id) !==
            Number(item_id)
        ) {
            await transaction.rollback();

            return res.status(400).json({
                message:
                    'Item does not match the purchase order item'
            });
        }


        // ==========================================
        // 4. VALIDATE QUANTITY
        // ==========================================

        if (
            quantity_received === undefined ||
            quantity_received === null
        ) {
            await transaction.rollback();

            return res.status(400).json({
                message:
                    'Quantity received is required'
            });
        }


        const receivedQuantity =
            Number(quantity_received);


        if (
            !Number.isFinite(receivedQuantity) ||
            receivedQuantity <= 0
        ) {
            await transaction.rollback();

            return res.status(400).json({
                message:
                    'Quantity received must be greater than zero'
            });
        }


        // ==========================================
        // 5. CHECK REMAINING PO QUANTITY
        // ==========================================

        const orderedQuantity =
            Number(purchaseOrderItem.quantity_ordered);

        const alreadyReceived =
            Number(
                purchaseOrderItem.quantity_received || 0
            );

        const remainingQuantity =
            orderedQuantity - alreadyReceived;


        if (receivedQuantity > remainingQuantity) {
            await transaction.rollback();

            return res.status(400).json({
                message:
                    `Quantity received cannot exceed remaining quantity of ${remainingQuantity}`
            });
        }


        // ==========================================
        // 6. VALIDATE UNIT COST
        // ==========================================

        if (
            unit_cost === undefined ||
            unit_cost === null
        ) {
            await transaction.rollback();

            return res.status(400).json({
                message:
                    'Unit cost is required'
            });
        }


        const receivedUnitCost =
            Number(unit_cost);


        if (
            !Number.isFinite(receivedUnitCost) ||
            receivedUnitCost < 0
        ) {
            await transaction.rollback();

            return res.status(400).json({
                message:
                    'Unit cost cannot be negative'
            });
        }


        // ==========================================
        // 7. VALIDATE CONDITION
        // ==========================================

        const validConditions = [
            'good',
            'damaged',
            'defective'
        ];


        const receiptCondition =
            condition || 'good';


        if (
            !validConditions.includes(receiptCondition)
        ) {
            await transaction.rollback();

            return res.status(400).json({
                message:
                    'Condition must be good, damaged, or defective'
            });
        }


        // ==========================================
        // 8. CHECK DUPLICATE
        // ==========================================

        const existingItem =
            await GoodsReceiptItem.findOne({
                where: {
                    goods_receipt_id,
                    purchase_order_item_id,
                    item_id
                },
                transaction
            });


        if (existingItem) {
            await transaction.rollback();

            return res.status(409).json({
                message:
                    'This purchase order item is already added to this goods receipt'
            });
        }


        // ==========================================
        // 9. CREATE GOODS RECEIPT ITEM
        // ==========================================

        const receiptItem =
            await GoodsReceiptItem.create(
                {
                    goods_receipt_id,
                    purchase_order_item_id,
                    item_id,
                    quantity_received:
                    receivedQuantity,
                    unit_cost:
                    receivedUnitCost,
                    condition:
                    receiptCondition,
                    notes
                },
                {
                    transaction
                }
            );


        // ==========================================
        // 10. UPDATE PO RECEIVED QUANTITY
        // ==========================================

        const newReceivedQuantity =
            alreadyReceived + receivedQuantity;


        await purchaseOrderItem.update(
            {
                quantity_received:
                newReceivedQuantity
            },
            {
                transaction
            }
        );


        // ==========================================
        // 11. COMMIT TRANSACTION
        // ==========================================

        await transaction.commit();


        // ==========================================
        // 12. GET CREATED RECORD WITH RELATIONS
        // ==========================================

        const createdItem =
            await GoodsReceiptItem.findByPk(
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
                            attributes: [
                                'id',
                                'item_code',
                                'item_name'
                            ]
                        }
                    ]
                }
            );


        // ==========================================
        // 13. RESPONSE
        // ==========================================

        return res.status(201).json({
            message:
                'Goods receipt item created successfully',
            data: createdItem
        });


    } catch (error) {

        // Rollback if anything fails
        if (!transaction.finished) {
            await transaction.rollback();
        }


        console.error(
            'Create goods receipt item error:',
            error
        );


        return res.status(500).json({
            message:
                'Failed to create goods receipt item'
        });
    }
};


// UPDATE
const updateGoodsReceiptItem = async (req, res) => {
    const transaction =
        await GoodsReceiptItem.sequelize.transaction();

    try {
        const { id } = req.params;

        const {
            quantity_received,
            unit_cost,
            condition,
            notes
        } = req.body;


        // ==========================================
        // 1. FIND GOODS RECEIPT ITEM
        // ==========================================

        const receiptItem =
            await GoodsReceiptItem.findByPk(id, {
                include: [
                    {
                        model: GoodsReceipt,
                        as: 'goodsReceipt'
                    },
                    {
                        model: PurchaseOrderItem,
                        as: 'purchaseOrderItem'
                    }
                ],
                transaction
            });


        if (!receiptItem) {
            await transaction.rollback();

            return res.status(404).json({
                message: 'Goods receipt item not found'
            });
        }


        // ==========================================
        // 2. CHECK GOODS RECEIPT STATUS
        // ==========================================

        if (
            receiptItem.goodsReceipt.status === 'cancelled' ||
            receiptItem.goodsReceipt.status === 'received'
        ) {
            await transaction.rollback();

            return res.status(400).json({
                message:
                    'Cannot modify items after receipt is received or cancelled'
            });
        }


        // ==========================================
        // 3. VALIDATE QUANTITY
        // ==========================================

        let newQuantity =
            Number(receiptItem.quantity_received);


        if (quantity_received !== undefined) {

            newQuantity =
                Number(quantity_received);


            if (
                !Number.isFinite(newQuantity) ||
                newQuantity <= 0
            ) {
                await transaction.rollback();

                return res.status(400).json({
                    message:
                        'Quantity received must be greater than zero'
                });
            }
        }


        // ==========================================
        // 4. VALIDATE UNIT COST
        // ==========================================

        let newUnitCost =
            Number(receiptItem.unit_cost);


        if (unit_cost !== undefined) {

            newUnitCost =
                Number(unit_cost);


            if (
                !Number.isFinite(newUnitCost) ||
                newUnitCost < 0
            ) {
                await transaction.rollback();

                return res.status(400).json({
                    message:
                        'Unit cost cannot be negative'
                });
            }
        }


        // ==========================================
        // 5. VALIDATE CONDITION
        // ==========================================

        const validConditions = [
            'good',
            'damaged',
            'defective'
        ];


        const newCondition =
            condition !== undefined
                ? condition
                : receiptItem.condition;


        if (
            !validConditions.includes(newCondition)
        ) {
            await transaction.rollback();

            return res.status(400).json({
                message:
                    'Condition must be good, damaged, or defective'
            });
        }


        // ==========================================
        // 6. GET PO ITEM
        // ==========================================

        const purchaseOrderItem =
            await PurchaseOrderItem.findByPk(
                receiptItem.purchase_order_item_id,
                {
                    transaction
                }
            );


        if (!purchaseOrderItem) {
            await transaction.rollback();

            return res.status(404).json({
                message:
                    'Purchase order item not found'
            });
        }


        // ==========================================
        // 7. CALCULATE QUANTITY DIFFERENCE
        // ==========================================

        const oldQuantity =
            Number(receiptItem.quantity_received);


        const quantityDifference =
            newQuantity - oldQuantity;


        const currentPOReceived =
            Number(
                purchaseOrderItem.quantity_received || 0
            );


        const newPOReceived =
            currentPOReceived +
            quantityDifference;


        // ==========================================
        // 8. PREVENT INVALID PO QUANTITY
        // ==========================================

        if (newPOReceived < 0) {

            await transaction.rollback();

            return res.status(400).json({
                message:
                    'Updated quantity would result in an invalid purchase order received quantity'
            });
        }


        // ==========================================
        // 9. CHECK AGAINST ORDERED QUANTITY
        // ==========================================

        const orderedQuantity =
            Number(
                purchaseOrderItem.quantity_ordered
            );


        if (newPOReceived > orderedQuantity) {

            await transaction.rollback();

            return res.status(400).json({
                message:
                    `Total received quantity cannot exceed ordered quantity of ${orderedQuantity}`
            });
        }


        // ==========================================
        // 10. UPDATE GOODS RECEIPT ITEM
        // ==========================================

        await receiptItem.update(
            {
                quantity_received:
                newQuantity,

                unit_cost:
                newUnitCost,

                condition:
                newCondition,

                notes:
                    notes !== undefined
                        ? notes
                        : receiptItem.notes
            },
            {
                transaction
            }
        );


        // ==========================================
        // 11. UPDATE PO RECEIVED QUANTITY
        // ==========================================

        await purchaseOrderItem.update(
            {
                quantity_received:
                newPOReceived
            },
            {
                transaction
            }
        );


        // ==========================================
        // 12. COMMIT
        // ==========================================

        await transaction.commit();


        // ==========================================
        // 13. GET UPDATED RECORD
        // ==========================================

        const updatedItem =
            await GoodsReceiptItem.findByPk(
                id,
                {
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
                }
            );


        return res.status(200).json({
            message:
                'Goods receipt item updated successfully',
            data: updatedItem
        });


    } catch (error) {

        if (!transaction.finished) {
            await transaction.rollback();
        }


        console.error(
            'Update goods receipt item error:',
            error
        );


        return res.status(500).json({
            message:
                'Failed to update goods receipt item'
        });
    }
};


// DELETE
const deleteGoodsReceiptItem = async (req, res) => {
    const transaction =
        await GoodsReceiptItem.sequelize.transaction();

    try {
        const { id } = req.params;


        // ==========================================
        // 1. FIND GOODS RECEIPT ITEM
        // ==========================================

        const receiptItem =
            await GoodsReceiptItem.findByPk(id, {
                include: [
                    {
                        model: GoodsReceipt,
                        as: 'goodsReceipt'
                    }
                ],
                transaction
            });


        if (!receiptItem) {
            await transaction.rollback();

            return res.status(404).json({
                message:
                    'Goods receipt item not found'
            });
        }


        // ==========================================
        // 2. CHECK RECEIPT STATUS
        // ==========================================

        if (
            receiptItem.goodsReceipt.status ===
            'received'
        ) {
            await transaction.rollback();

            return res.status(400).json({
                message:
                    'Cannot delete an item from a received goods receipt'
            });
        }


        if (
            receiptItem.goodsReceipt.status ===
            'cancelled'
        ) {
            await transaction.rollback();

            return res.status(400).json({
                message:
                    'Cannot delete an item from a cancelled goods receipt'
            });
        }


        // ==========================================
        // 3. FIND PO ITEM
        // ==========================================

        const purchaseOrderItem =
            await PurchaseOrderItem.findByPk(
                receiptItem.purchase_order_item_id,
                {
                    transaction
                }
            );


        if (!purchaseOrderItem) {
            await transaction.rollback();

            return res.status(404).json({
                message:
                    'Purchase order item not found'
            });
        }


        // ==========================================
        // 4. CALCULATE NEW PO RECEIVED QUANTITY
        // ==========================================

        const currentPOReceived =
            Number(
                purchaseOrderItem.quantity_received || 0
            );


        const receiptQuantity =
            Number(
                receiptItem.quantity_received
            );


        const newPOReceived =
            currentPOReceived -
            receiptQuantity;


        if (newPOReceived < 0) {

            await transaction.rollback();

            return res.status(400).json({
                message:
                    'Cannot delete item because purchase order received quantity would become negative'
            });
        }


        // ==========================================
        // 5. UPDATE PO ITEM
        // ==========================================

        await purchaseOrderItem.update(
            {
                quantity_received:
                newPOReceived
            },
            {
                transaction
            }
        );


        // ==========================================
        // 6. DELETE GOODS RECEIPT ITEM
        // ==========================================

        await receiptItem.destroy({
            transaction
        });


        // ==========================================
        // 7. COMMIT
        // ==========================================

        await transaction.commit();


        return res.status(200).json({
            message:
                'Goods receipt item deleted successfully'
        });


    } catch (error) {

        if (!transaction.finished) {
            await transaction.rollback();
        }


        console.error(
            'Delete goods receipt item error:',
            error
        );


        return res.status(500).json({
            message:
                'Failed to delete goods receipt item'
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
