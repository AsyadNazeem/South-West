const {
    GoodsReceipt,
    GoodsReceiptItem,
    PurchaseOrder,
    InventoryLocation,
    User
} = require('../models');


// GET ALL GOODS RECEIPTS
const getGoodsReceipts = async (req, res) => {
    try {
        const receipts = await GoodsReceipt.findAll({
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
            order: [['id', 'DESC']]
        });

        return res.status(200).json({
            message: 'Goods receipts retrieved successfully',
            data: receipts
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
    try {
        const {
            receipt_number,
            purchase_order_id,
            location_id,
            receipt_date,
            supplier_delivery_note,
            notes
        } = req.body;


        // ==========================================
        // 1. VALIDATE RECEIPT NUMBER
        // ==========================================

        if (!receipt_number) {
            return res.status(400).json({
                message: 'Receipt number is required'
            });
        }


        // ==========================================
        // 2. VALIDATE PURCHASE ORDER
        // ==========================================

        if (!purchase_order_id) {
            return res.status(400).json({
                message: 'Purchase order is required'
            });
        }

        const purchaseOrder = await PurchaseOrder.findByPk(
            purchase_order_id
        );

        if (!purchaseOrder) {
            return res.status(404).json({
                message: 'Purchase order not found'
            });
        }


        // ==========================================
        // 3. VALIDATE LOCATION
        // ==========================================

        if (!location_id) {
            return res.status(400).json({
                message: 'Inventory location is required'
            });
        }

        const location = await InventoryLocation.findByPk(
            location_id
        );

        if (!location) {
            return res.status(404).json({
                message: 'Inventory location not found'
            });
        }


        // ==========================================
        // 4. VALIDATE RECEIPT DATE
        // ==========================================

        if (!receipt_date) {
            return res.status(400).json({
                message: 'Receipt date is required'
            });
        }


        // ==========================================
        // 5. CHECK DUPLICATE RECEIPT NUMBER
        // ==========================================

        const existingReceipt =
            await GoodsReceipt.findOne({
                where: {
                    receipt_number
                }
            });

        if (existingReceipt) {
            return res.status(409).json({
                message: 'Receipt number already exists'
            });
        }


        // ==========================================
        // 6. CREATE AS DRAFT
        // ==========================================

        const receipt = await GoodsReceipt.create({
            receipt_number,
            purchase_order_id,
            location_id,
            receipt_date,
            supplier_delivery_note,
            status: 'draft',
            notes,
            created_at: new Date(),
            updated_at: new Date()
        });


        // ==========================================
        // 7. GET CREATED RECEIPT
        // ==========================================

        const createdReceipt =
            await GoodsReceipt.findByPk(
                receipt.id,
                {
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
                }
            );


        return res.status(201).json({
            message:
                'Goods receipt created successfully',
            data: createdReceipt
        });

    } catch (error) {

        console.error(
            'Create goods receipt error:',
            error
        );

        return res.status(500).json({
            message:
                'Failed to create goods receipt'
        });
    }
};


// UPDATE GOODS RECEIPT
const updateGoodsReceipt = async (req, res) => {
    try {
        const { id } = req.params;

        const receipt =
            await GoodsReceipt.findByPk(id);

        if (!receipt) {
            return res.status(404).json({
                message: 'Goods receipt not found'
            });
        }


        // ==========================================
        // ONLY DRAFT RECEIPTS CAN BE UPDATED
        // ==========================================

        if (receipt.status !== 'draft') {
            return res.status(400).json({
                message:
                    'Only draft goods receipts can be updated'
            });
        }


        const {
            receipt_date,
            supplier_delivery_note,
            notes
        } = req.body;


        // ==========================================
        // UPDATE RECEIPT
        // ==========================================

        await receipt.update({
            receipt_date:
                receipt_date !== undefined
                    ? receipt_date
                    : receipt.receipt_date,

            supplier_delivery_note:
                supplier_delivery_note !== undefined
                    ? supplier_delivery_note
                    : receipt.supplier_delivery_note,

            notes:
                notes !== undefined
                    ? notes
                    : receipt.notes,

            updated_at: new Date()
        });


        // ==========================================
        // GET UPDATED RECEIPT
        // ==========================================

        const updatedReceipt =
            await GoodsReceipt.findByPk(
                id,
                {
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
                }
            );


        return res.status(200).json({
            message:
                'Goods receipt updated successfully',
            data: updatedReceipt
        });

    } catch (error) {

        console.error(
            'Update goods receipt error:',
            error
        );

        return res.status(500).json({
            message:
                'Failed to update goods receipt'
        });
    }
};


// RECEIVE GOODS RECEIPT
const receiveGoodsReceipt = async (req, res) => {
    const transaction =
        await GoodsReceipt.sequelize.transaction();

    try {
        const { id } = req.params;


        // ==========================================
        // 1. FIND GOODS RECEIPT
        // ==========================================

        const receipt =
            await GoodsReceipt.findByPk(id, {
                transaction
            });

        if (!receipt) {
            await transaction.rollback();

            return res.status(404).json({
                message:
                    'Goods receipt not found'
            });
        }


        // ==========================================
        // 2. CHECK STATUS
        // ==========================================

        if (receipt.status !== 'draft') {
            await transaction.rollback();

            return res.status(400).json({
                message:
                    'Only draft goods receipts can be received'
            });
        }


        // ==========================================
        // 3. GET RECEIPT ITEMS
        // ==========================================

        const receiptItems =
            await GoodsReceiptItem.findAll({
                where: {
                    goods_receipt_id: id
                },
                transaction
            });


        // ==========================================
        // 4. CHECK ITEMS
        // ==========================================

        if (receiptItems.length === 0) {
            await transaction.rollback();

            return res.status(400).json({
                message:
                    'Cannot receive a goods receipt without items'
            });
        }


        // ==========================================
        // 5. UPDATE RECEIPT STATUS
        // ==========================================

        await receipt.update(
            {
                status: 'received',
                received_by: req.user.userId,
                received_at: new Date(),
                updated_at: new Date()
            },
            {
                transaction
            }
        );


        // ==========================================
        // 6. COMMIT
        // ==========================================

        await transaction.commit();


        // ==========================================
        // 7. GET UPDATED RECEIPT
        // ==========================================

        const updatedReceipt =
            await GoodsReceipt.findByPk(
                id,
                {
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
                        },
                        {
                            model: GoodsReceiptItem,
                            as: 'items'
                        }
                    ]
                }
            );


        return res.status(200).json({
            message:
                'Goods receipt received successfully',
            data: updatedReceipt
        });

    } catch (error) {

        if (!transaction.finished) {
            await transaction.rollback();
        }

        console.error(
            'Receive goods receipt error:',
            error
        );

        return res.status(500).json({
            message:
                'Failed to receive goods receipt'
        });
    }
};


// CANCEL GOODS RECEIPT
const cancelGoodsReceipt = async (req, res) => {
    try {
        const { id } = req.params;

        const receipt =
            await GoodsReceipt.findByPk(id);

        if (!receipt) {
            return res.status(404).json({
                message:
                    'Goods receipt not found'
            });
        }


        // ==========================================
        // ONLY DRAFT RECEIPTS CAN BE CANCELLED
        // ==========================================

        if (receipt.status !== 'draft') {
            return res.status(400).json({
                message:
                    'Only draft goods receipts can be cancelled'
            });
        }


        // ==========================================
        // CANCEL RECEIPT
        // ==========================================

        await receipt.update({
            status: 'cancelled',
            updated_at: new Date()
        });


        return res.status(200).json({
            message:
                'Goods receipt cancelled successfully',
            data: receipt
        });

    } catch (error) {

        console.error(
            'Cancel goods receipt error:',
            error
        );

        return res.status(500).json({
            message:
                'Failed to cancel goods receipt'
        });
    }
};


// DELETE GOODS RECEIPT
const deleteGoodsReceipt = async (req, res) => {
    try {
        const { id } = req.params;

        const receipt = await GoodsReceipt.findByPk(id);

        if (
            receipt.status === 'received' ||
            receipt.status === 'cancelled'
        ) {
            return res.status(400).json({
                message:
                    'Only draft goods receipts can be deleted'
            });
        }

        if (!receipt) {
            return res.status(404).json({
                message: 'Goods receipt not found'
            });
        }


        if (receipt.status === 'received') {
            return res.status(400).json({
                message: 'Received goods receipts cannot be deleted'
            });
        }


        await receipt.destroy();

        return res.status(200).json({
            message: 'Goods receipt deleted successfully'
        });

    } catch (error) {
        console.error(
            'Delete goods receipt error:',
            error
        );

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
