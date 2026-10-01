const {
    PurchaseOrderItem,
    PurchaseOrder,
    Item
} = require('../models');


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
    try {
        const {
            purchase_order_id,
            item_id,
            quantity_ordered,
            unit_cost,
            discount_amount,
            tax_amount,
            notes
        } = req.body;


        // Validate purchase order
        const purchaseOrder = await PurchaseOrder.findByPk(
            purchase_order_id
        );

        if (!purchaseOrder) {
            return res.status(404).json({
                message: 'Purchase order not found'
            });
        }


        // Prevent modification after approval
        if (
            purchaseOrder.status === 'approved' ||
            purchaseOrder.status === 'received' ||
            purchaseOrder.status === 'cancelled'
        ) {
            return res.status(400).json({
                message:
                    'Cannot add items to an approved, received, or cancelled purchase order'
            });
        }


        // Validate item
        const item = await Item.findByPk(item_id);

        if (!item) {
            return res.status(404).json({
                message: 'Item not found'
            });
        }


        // Validate quantity
        if (
            quantity_ordered === undefined ||
            quantity_ordered === null
        ) {
            return res.status(400).json({
                message: 'Quantity ordered is required'
            });
        }

        if (Number(quantity_ordered) <= 0) {
            return res.status(400).json({
                message:
                    'Quantity ordered must be greater than zero'
            });
        }


        // Validate unit cost
        if (
            unit_cost === undefined ||
            unit_cost === null
        ) {
            return res.status(400).json({
                message: 'Unit cost is required'
            });
        }

        if (Number(unit_cost) < 0) {
            return res.status(400).json({
                message: 'Unit cost cannot be negative'
            });
        }


        // Validate discount
        if (
            discount_amount !== undefined &&
            discount_amount !== null &&
            Number(discount_amount) < 0
        ) {
            return res.status(400).json({
                message:
                    'Discount amount cannot be negative'
            });
        }


        // Validate tax
        if (
            tax_amount !== undefined &&
            tax_amount !== null &&
            Number(tax_amount) < 0
        ) {
            return res.status(400).json({
                message:
                    'Tax amount cannot be negative'
            });
        }


        // Prevent duplicate item in same PO
        const existingItem =
            await PurchaseOrderItem.findOne({
                where: {
                    purchase_order_id,
                    item_id
                }
            });

        if (existingItem) {
            return res.status(409).json({
                message:
                    'Item is already added to this purchase order'
            });
        }


        // Calculate line total
        const quantity = Number(quantity_ordered);
        const cost = Number(unit_cost);
        const discount = Number(discount_amount || 0);
        const tax = Number(tax_amount || 0);

        const lineTotal =
            (quantity * cost) -
            discount +
            tax;


        // Create item
        const purchaseOrderItem =
            await PurchaseOrderItem.create({
                purchase_order_id,
                item_id,
                quantity_ordered,
                unit_cost,
                discount_amount: discount,
                tax_amount: tax,
                line_total: lineTotal,
                quantity_received: 0,
                notes,
                created_at: new Date(),
                updated_at: new Date()
            });


        // Retrieve created item
        const createdItem =
            await PurchaseOrderItem.findByPk(
                purchaseOrderItem.id,
                {
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


        return res.status(201).json({
            message:
                'Purchase order item created successfully',
            data: createdItem
        });

    } catch (error) {
        console.error(
            'Create purchase order item error:',
            error
        );

        return res.status(500).json({
            message:
                'Failed to create purchase order item'
        });
    }
};


// UPDATE
const updatePurchaseOrderItem = async (req, res) => {
    try {
        const { id } = req.params;

        const purchaseOrderItem =
            await PurchaseOrderItem.findByPk(id, {
                include: [
                    {
                        model: PurchaseOrder,
                        as: 'purchaseOrder'
                    }
                ]
            });

        if (!purchaseOrderItem) {
            return res.status(404).json({
                message:
                    'Purchase order item not found'
            });
        }


        if (
            purchaseOrderItem.purchaseOrder.status ===
            'approved' ||
            purchaseOrderItem.purchaseOrder.status ===
            'received' ||
            purchaseOrderItem.purchaseOrder.status ===
            'cancelled'
        ) {
            return res.status(400).json({
                message:
                    'Cannot modify items after purchase order is approved, received, or cancelled'
            });
        }


        const {
            item_id,
            quantity_ordered,
            unit_cost,
            discount_amount,
            tax_amount,
            notes
        } = req.body;


        // Validate item if supplied
        if (item_id !== undefined) {
            const item = await Item.findByPk(item_id);

            if (!item) {
                return res.status(404).json({
                    message: 'Item not found'
                });
            }
        }


        // Validate quantity
        if (
            quantity_ordered !== undefined &&
            Number(quantity_ordered) <= 0
        ) {
            return res.status(400).json({
                message:
                    'Quantity ordered must be greater than zero'
            });
        }


        // Validate unit cost
        if (
            unit_cost !== undefined &&
            Number(unit_cost) < 0
        ) {
            return res.status(400).json({
                message:
                    'Unit cost cannot be negative'
            });
        }


        // Validate discount
        if (
            discount_amount !== undefined &&
            Number(discount_amount) < 0
        ) {
            return res.status(400).json({
                message:
                    'Discount amount cannot be negative'
            });
        }


        // Validate tax
        if (
            tax_amount !== undefined &&
            Number(tax_amount) < 0
        ) {
            return res.status(400).json({
                message:
                    'Tax amount cannot be negative'
            });
        }


        const finalQuantity =
            quantity_ordered !== undefined
                ? Number(quantity_ordered)
                : Number(
                    purchaseOrderItem.quantity_ordered
                );

        const finalUnitCost =
            unit_cost !== undefined
                ? Number(unit_cost)
                : Number(
                    purchaseOrderItem.unit_cost
                );

        const finalDiscount =
            discount_amount !== undefined
                ? Number(discount_amount)
                : Number(
                    purchaseOrderItem.discount_amount
                );

        const finalTax =
            tax_amount !== undefined
                ? Number(tax_amount)
                : Number(
                    purchaseOrderItem.tax_amount
                );


        const lineTotal =
            (finalQuantity * finalUnitCost) -
            finalDiscount +
            finalTax;


        await purchaseOrderItem.update({
            item_id:
                item_id !== undefined
                    ? item_id
                    : purchaseOrderItem.item_id,

            quantity_ordered:
                quantity_ordered !== undefined
                    ? quantity_ordered
                    : purchaseOrderItem.quantity_ordered,

            unit_cost:
                unit_cost !== undefined
                    ? unit_cost
                    : purchaseOrderItem.unit_cost,

            discount_amount:
                discount_amount !== undefined
                    ? discount_amount
                    : purchaseOrderItem.discount_amount,

            tax_amount:
                tax_amount !== undefined
                    ? tax_amount
                    : purchaseOrderItem.tax_amount,

            line_total: lineTotal,

            notes:
                notes !== undefined
                    ? notes
                    : purchaseOrderItem.notes,

            updated_at: new Date()
        });


        const updatedItem =
            await PurchaseOrderItem.findByPk(
                id,
                {
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


        return res.status(200).json({
            message:
                'Purchase order item updated successfully',
            data: updatedItem
        });

    } catch (error) {
        console.error(
            'Update purchase order item error:',
            error
        );

        return res.status(500).json({
            message:
                'Failed to update purchase order item'
        });
    }
};


// DELETE
const deletePurchaseOrderItem = async (req, res) => {
    try {
        const { id } = req.params;

        const purchaseOrderItem =
            await PurchaseOrderItem.findByPk(id, {
                include: [
                    {
                        model: PurchaseOrder,
                        as: 'purchaseOrder'
                    }
                ]
            });

        if (!purchaseOrderItem) {
            return res.status(404).json({
                message:
                    'Purchase order item not found'
            });
        }


        if (
            purchaseOrderItem.purchaseOrder.status ===
            'approved' ||
            purchaseOrderItem.purchaseOrder.status ===
            'received' ||
            purchaseOrderItem.purchaseOrder.status ===
            'cancelled'
        ) {
            return res.status(400).json({
                message:
                    'Cannot delete items after purchase order is approved, received, or cancelled'
            });
        }


        await purchaseOrderItem.destroy();

        return res.status(200).json({
            message:
                'Purchase order item deleted successfully'
        });

    } catch (error) {
        console.error(
            'Delete purchase order item error:',
            error
        );

        return res.status(500).json({
            message:
                'Failed to delete purchase order item'
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
