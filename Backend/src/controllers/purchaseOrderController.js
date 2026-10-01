const {
    PurchaseOrder,
    PurchaseOrderItem,
    Supplier,
    Item,
    User
} = require('../models');


// GET ALL PURCHASE ORDERS
const getPurchaseOrders = async (req, res) => {
    try {
        const purchaseOrders = await PurchaseOrder.findAll({
            include: [
                {
                    model: Supplier,
                    as: 'supplier',
                    attributes: [
                        'id',
                        'supplier_code',
                        'company_name',
                        'contact_person',
                        'email',
                        'phone'
                    ]
                },
                {
                    model: User,
                    as: 'creator',
                    attributes: [
                        'id',
                        'email'
                    ]
                },
                {
                    model: User,
                    as: 'approver',
                    attributes: [
                        'id',
                        'email'
                    ]
                },
                {
                    model: PurchaseOrderItem,
                    as: 'items',
                    include: [
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
            ],
            order: [['id', 'DESC']]
        });

        return res.status(200).json({
            message: 'Purchase orders retrieved successfully',
            data: purchaseOrders
        });

    } catch (error) {
        console.error(
            'Get purchase orders error:',
            error
        );

        return res.status(500).json({
            message: 'Failed to retrieve purchase orders'
        });
    }
};


// GET PURCHASE ORDER BY ID
const getPurchaseOrderById = async (req, res) => {
    try {
        const { id } = req.params;

        const purchaseOrder = await PurchaseOrder.findByPk(id, {
            include: [
                {
                    model: Supplier,
                    as: 'supplier',
                    attributes: [
                        'id',
                        'supplier_code',
                        'company_name',
                        'contact_person',
                        'email',
                        'phone'
                    ]
                },
                {
                    model: User,
                    as: 'creator',
                    attributes: [
                        'id',
                        'email'
                    ]
                },
                {
                    model: User,
                    as: 'approver',
                    attributes: [
                        'id',
                        'email'
                    ]
                },
                {
                    model: PurchaseOrderItem,
                    as: 'items',
                    include: [
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
            ]
        });

        if (!purchaseOrder) {
            return res.status(404).json({
                message: 'Purchase order not found'
            });
        }

        return res.status(200).json({
            message: 'Purchase order retrieved successfully',
            data: purchaseOrder
        });

    } catch (error) {
        console.error(
            'Get purchase order error:',
            error
        );

        return res.status(500).json({
            message: 'Failed to retrieve purchase order'
        });
    }
};


// CREATE PURCHASE ORDER
const createPurchaseOrder = async (req, res) => {
    try {
        const {
            purchase_order_number,
            supplier_id,
            order_date,
            expected_date,
            status,
            discount_amount,
            tax_amount,
            shipping_amount,
            notes,
            items
        } = req.body;

        // Validate supplier
        const supplier = await Supplier.findByPk(supplier_id);

        if (!supplier) {
            return res.status(404).json({
                message: 'Supplier not found'
            });
        }

        // Validate items
        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                message: 'At least one purchase order item is required'
            });
        }

        let subtotal = 0;

        const processedItems = [];

        for (const orderItem of items) {
            const {
                item_id,
                quantity_ordered,
                unit_cost,
                discount_amount: itemDiscount = 0,
                tax_amount: itemTax = 0,
                notes: itemNotes
            } = orderItem;

            const item = await Item.findByPk(item_id);

            if (!item) {
                return res.status(404).json({
                    message: `Item ${item_id} not found`
                });
            }

            if (
                quantity_ordered === undefined ||
                Number(quantity_ordered) <= 0
            ) {
                return res.status(400).json({
                    message: 'Quantity ordered must be greater than zero'
                });
            }

            if (
                unit_cost === undefined ||
                Number(unit_cost) < 0
            ) {
                return res.status(400).json({
                    message: 'Unit cost must be valid'
                });
            }

            const lineTotal =
                (
                    Number(quantity_ordered) *
                    Number(unit_cost)
                ) -
                Number(itemDiscount) +
                Number(itemTax);

            subtotal += lineTotal;

            processedItems.push({
                item_id,
                quantity_ordered,
                unit_cost,
                discount_amount: itemDiscount,
                tax_amount: itemTax,
                line_total: lineTotal,
                quantity_received: 0,
                notes: itemNotes
            });
        }

        const finalDiscount = Number(discount_amount || 0);
        const finalTax = Number(tax_amount || 0);
        const shipping = Number(shipping_amount || 0);

        const totalAmount =
            subtotal -
            finalDiscount +
            finalTax +
            shipping;

        const purchaseOrder = await PurchaseOrder.create({
            purchase_order_number,
            supplier_id,
            order_date,
            expected_date,
            status: status || 'draft',
            subtotal,
            discount_amount: finalDiscount,
            tax_amount: finalTax,
            shipping_amount: shipping,
            total_amount: totalAmount,
            notes,
            created_by: req.user.id,
            created_at: new Date(),
            updated_at: new Date()
        });

        for (const orderItem of processedItems) {
            await PurchaseOrderItem.create({
                purchase_order_id: purchaseOrder.id,
                ...orderItem,
                created_at: new Date(),
                updated_at: new Date()
            });
        }

        const createdPurchaseOrder =
            await PurchaseOrder.findByPk(
                purchaseOrder.id,
                {
                    include: [
                        {
                            model: Supplier,
                            as: 'supplier'
                        },
                        {
                            model: PurchaseOrderItem,
                            as: 'items',
                            include: [
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
            message: 'Purchase order created successfully',
            data: createdPurchaseOrder
        });

    } catch (error) {
        console.error(
            'Create purchase order error:',
            error
        );

        return res.status(500).json({
            message: 'Failed to create purchase order'
        });
    }
};


module.exports = {
    getPurchaseOrders,
    getPurchaseOrderById,
    createPurchaseOrder
};
