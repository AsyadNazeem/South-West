const {
    sequelize,
    PurchaseOrder,
    PurchaseOrderItem,
    Supplier,
    Item,
    User
} = require('../models');

const {recordAuditLog} = require('../services/auditLogService');


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
        const {id} = req.params;

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
    let transaction;

    try {
        transaction = await sequelize.transaction();
        const {
            purchase_order_number,
            supplier_id,
            order_date,
            expected_date,
            discount_amount,
            tax_amount,
            shipping_amount,
            notes,
            items
        } = req.body;


        const isValidAmount = (value) => {
            if (
                value === undefined ||
                value === null ||
                value === '' ||
                !Number.isFinite(Number(value)) ||
                Number(value) < 0
            ) {
                return false;
            }

            const amount = Number(value);

            return (
                amount < 1e13 &&
                Math.abs(amount * 100 - Math.round(amount * 100)) < 1e-7
            );
        };

        const isValidPositiveQuantity = (value) => {
            if (
                value === undefined ||
                value === null ||
                value === '' ||
                !Number.isFinite(Number(value)) ||
                Number(value) <= 0
            ) {
                return false;
            }

            const quantity = Number(value);

            return (
                quantity < 1e12 &&
                Math.abs(quantity * 1000 - Math.round(quantity * 1000)) < 1e-7
            );
        };

        if (
            !isValidAmount(discount_amount ?? 0) ||
            !isValidAmount(tax_amount ?? 0) ||
            !isValidAmount(shipping_amount ?? 0)
        ) {
            await transaction.rollback();
            return res.status(400).json({
                message: 'Discount, tax, and shipping must be valid amounts'
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

            const item = await Item.findByPk(item_id, { transaction });

            if (!item) {
                await transaction.rollback();
                return res.status(404).json({
                    message: `Item ${item_id} not found`
                });
            }

            if (!isValidPositiveQuantity(quantity_ordered)) {
                await transaction.rollback();
                return res.status(400).json({
                    message: 'Quantity must be positive with up to 3 decimal places'
                });
            }

            if (
                !isValidAmount(unit_cost) ||
                !isValidAmount(itemDiscount) ||
                !isValidAmount(itemTax)
            ) {
                await transaction.rollback();
                return res.status(400).json({
                    message: 'Unit cost, discount, and tax must be valid amounts with up to 2 decimal places'
                });
            }

            const grossLineTotal = Number(
                (Number(quantity_ordered) * Number(unit_cost)).toFixed(2)
            );

            if (
                !Number.isFinite(grossLineTotal) ||
                grossLineTotal >= 1e13 ||
                Number(itemDiscount) > grossLineTotal
            ) {
                await transaction.rollback();
                return res.status(400).json({
                    message: 'Item subtotal is invalid or discount exceeds subtotal'
                });
            }

            const lineTotal = Number(
                (
                    grossLineTotal -
                    Number(itemDiscount) +
                    Number(itemTax)
                ).toFixed(2)
            );

            if (!isValidAmount(lineTotal)) {
                await transaction.rollback();
                return res.status(400).json({
                    message: 'Calculated line total is invalid'
                });
            }

            subtotal = Number((subtotal + lineTotal).toFixed(2));

            if (!isValidAmount(subtotal)) {
                await transaction.rollback();
                return res.status(400).json({
                    message: 'Purchase order subtotal exceeds the allowed range'
                });
            }

            processedItems.push({
                item_id: Number(item_id),
                quantity_ordered: Number(quantity_ordered),
                unit_cost: Number(unit_cost),
                discount_amount: Number(itemDiscount),
                tax_amount: Number(itemTax),
                line_total: lineTotal,
                quantity_received: 0,
                notes: itemNotes
            });
        }

        const finalDiscount = Number(discount_amount ?? 0);
        const finalTax = Number(tax_amount ?? 0);
        const shipping = Number(shipping_amount ?? 0);

        if (finalDiscount > subtotal) {
            await transaction.rollback();
            return res.status(400).json({
                message: 'Purchase order discount cannot exceed subtotal'
            });
        }

        const totalAmount = Number(
            (subtotal - finalDiscount + finalTax + shipping).toFixed(2)
        );

        if (!isValidAmount(totalAmount)) {
            await transaction.rollback();
            return res.status(400).json({
                message: 'Calculated purchase order total is invalid'
            });
        }


        const purchaseOrder = await PurchaseOrder.create({
                purchase_order_number,
                supplier_id,
                order_date,
                expected_date,
                status: 'draft',
                subtotal,
                discount_amount: finalDiscount,
                tax_amount: finalTax,
                shipping_amount: shipping,
                total_amount: totalAmount,
                notes,
                created_by: req.user.id,
                created_at: new Date(),
                updated_at: new Date()
            },
            {transaction}
        );

        for (const orderItem of processedItems) {
            await PurchaseOrderItem.create({
                    purchase_order_id: purchaseOrder.id,
                    ...orderItem,
                    created_at: new Date(),
                    updated_at: new Date()
                },
                {transaction}
            );
        }

        const createdPurchaseOrder =
            await PurchaseOrder.findByPk(
                purchaseOrder.id,
                {
                    transaction,
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

        await recordAuditLog({
            userId: req.user
                ? (req.user.id ?? req.user.userId)
                : null,
            action: 'PURCHASE_ORDER_CREATED',
            module: 'purchasing',
            entityType: 'purchase_order',
            entityId: purchaseOrder.id,
            description: `Purchase order ${purchase_order_number} created`,
            oldValues: null,
            newValues: {
                purchase_order_number,
                supplier_id,
                status: status || 'draft',
                subtotal,
                discount_amount: finalDiscount,
                tax_amount: finalTax,
                shipping_amount: shipping,
                total_amount: totalAmount,
                item_count: processedItems.length
            },
            ipAddress: req.ip || null,
            userAgent: req.get('user-agent') || null,
            requestId: req.id || null,
            transaction
        });

        await transaction.commit();

        return res.status(201).json({
            message: 'Purchase order created successfully',
            data: createdPurchaseOrder
        });

    } catch (error) {
        if (transaction && !transaction.finished) {
            await transaction.rollback();
        }

        console.error('Create purchase order error:', error);

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
