const {Op} = require('sequelize');
const { recordAuditLog } = require('../services/auditLogService');

const {
    Order,
    Customer,
    CustomerAddress,
    User,
    OrderItem,
    OrderAddress,
    Payment,
    Delivery,
    Invoice,
    OrderPromotion,
    ProductReview,
    Item,
    ItemPrice
} = require('../models');

const getCurrentSellingPrice = async (
    itemId,
    transaction
) => {
    const now = new Date();

    const price = await ItemPrice.findOne({
        where: {
            item_id: itemId,
            price_type: 'selling',
            currency: 'LKR',
            is_active: true,
            [Op.and]: [
                {
                    [Op.or]: [
                        {effective_from: null},
                        {effective_from: {[Op.lte]: now}}
                    ]
                },
                {
                    [Op.or]: [
                        {effective_to: null},
                        {effective_to: {[Op.gte]: now}}
                    ]
                }
            ]
        },
        order: [
            ['effective_from', 'DESC'],
            ['id', 'DESC']
        ],
        transaction
    });

    if (!price) {
        const error = new Error(
            `No active selling price configured for item ${itemId}`
        );
        error.statusCode = 400;
        throw error;
    }

    const amount = Number(price.price);

    if (!Number.isFinite(amount) || amount < 0) {
        const error = new Error(
            `Invalid selling price configured for item ${itemId}`
        );
        error.statusCode = 500;
        throw error;
    }

    return amount;
};

const getOrderIncludes = () => [
    {
        model: Customer,
        as: 'customer',
        attributes: [
            'id',
            'first_name',
            'last_name',
            'email',
            'phone'
        ],
        required: false
    },
    {
        model: User,
        as: 'creator',
        attributes: {
            exclude: ['password_hash']
        },
        required: false
    },
    {
        model: OrderItem,
        as: 'items',
        required: false
    },
    {
        model: OrderAddress,
        as: 'addresses',
        required: false
    },
    {
        model: Payment,
        as: 'payments',
        required: false
    },
    {
        model: Delivery,
        as: 'deliveries',
        required: false
    },
    {
        model: Invoice,
        as: 'invoices',
        required: false
    },
    {
        model: OrderPromotion,
        as: 'promotions',
        required: false
    },
    {
        model: ProductReview,
        as: 'productReviews',
        required: false
    }
];


// GET ALL ORDERS
exports.getAllOrders = async (req, res) => {
    try {
        const orders = await Order.findAll({
            include: getOrderIncludes(),
            order: [['id', 'DESC']]
        });

        return res.status(200).json({
            message: 'Orders retrieved successfully',
            data: orders
        });
    } catch (error) {
        console.error('Get orders error:', error);

        return res.status(500).json({
            message: 'Failed to retrieve orders',
            error: error.message
        });
    }
};


// GET ORDER BY ID
exports.getOrderById = async (req, res) => {
    try {
        const {id} = req.params;

        const order = await Order.findByPk(id, {
            include: getOrderIncludes()
        });

        if (!order) {
            return res.status(404).json({
                message: 'Order not found'
            });
        }

        return res.status(200).json({
            message: 'Order retrieved successfully',
            data: order
        });
    } catch (error) {
        console.error('Get order error:', error);

        return res.status(500).json({
            message: 'Failed to retrieve order',
            error: error.message
        });
    }
};

// CREATE ORDER
exports.createOrder = async (req, res) => {
    const transaction = await Order.sequelize.transaction()

    try {
        const {
            order_number,
            customer_id,
            order_date,
            order_type,
            status,
            payment_status,
            fulfillment_status,
            subtotal,
            discount_amount,
            tax_amount,
            shipping_amount,
            total_amount,
            notes,

            // Related data
            items,
            address,
            payment,
            delivery
        } = req.body

        const forbiddenFields = [
            'subtotal',
            'discount_amount',
            'tax_amount',
            'shipping_amount',
            'total_amount',
            'payment_status',
            'status',
            'fulfillment_status'
        ];

        const suppliedForbiddenFields = forbiddenFields.filter(
            field => Object.prototype.hasOwnProperty.call(req.body, field)
        );

        if (suppliedForbiddenFields.length > 0) {
            await transaction.rollback();

            return res.status(400).json({
                message: 'Order totals and statuses are calculated by the server',
                fields: suppliedForbiddenFields
            });
        }

        // ==========================================
        // VALIDATION
        // ==========================================

        if (!order_number) {
            await transaction.rollback()

            return res.status(400).json({
                message: 'Order number is required'
            })
        }

        if (!order_date) {
            await transaction.rollback()

            return res.status(400).json({
                message: 'Order date is required'
            })
        }

        if (!items || !Array.isArray(items) || items.length === 0) {
            await transaction.rollback()

            return res.status(400).json({
                message: 'At least one order item is required'
            })
        }

        // ==========================================
        // CHECK DUPLICATE ORDER NUMBER
        // ==========================================

        const existingOrder = await Order.findOne({
            where: {
                order_number
            },
            transaction
        })

        if (existingOrder) {
            await transaction.rollback()

            return res.status(409).json({
                message: 'Order number already exists'
            })
        }

        // ==========================================
        // CHECK CUSTOMER
        // ==========================================

        let customer = null

        if (customer_id) {
            customer = await Customer.findByPk(customer_id, {
                transaction
            })

            if (!customer) {
                await transaction.rollback()

                return res.status(404).json({
                    message: 'Customer not found'
                })
            }
        }

        // ==========================================
        // CHECK CUSTOMER ADDRESS
        // ==========================================

        let customerAddress = null

        if (delivery && delivery.required === true) {

            if (!customer_id) {
                await transaction.rollback()

                return res.status(400).json({
                    message: 'Customer is required for delivery orders'
                })
            }

            if (!address || !address.address_id) {
                await transaction.rollback()

                return res.status(400).json({
                    message: 'Delivery address is required'
                })
            }

            customerAddress = await CustomerAddress.findOne({
                where: {
                    id: address.address_id,
                    customer_id: customer_id
                },
                transaction
            })

            if (!customerAddress) {
                await transaction.rollback()

                return res.status(404).json({
                    message: 'Selected customer address not found'
                })
            }
        }

        // CALCULATE ORDER TOTALS FROM DATABASE PRICES

        const validatedItems = [];
        let calculatedSubtotal = 0;

        for (const item of items) {
            const itemId = Number(item.item_id);
            const quantity = Number(item.quantity);

            if (
                !Number.isSafeInteger(itemId) ||
                itemId <= 0 ||
                !Number.isFinite(quantity) ||
                quantity <= 0 ||
                Math.round(quantity * 1000) !== quantity * 1000
            ) {
                const error = new Error(
                    'Each item must have a valid item_id and quantity'
                );
                error.statusCode = 400;
                throw error;
            }

            const product = await Item.findByPk(itemId, {
                transaction
            });

            if (!product) {
                const error = new Error(
                    `Item ${itemId} was not found`
                );
                error.statusCode = 400;
                throw error;
            }

            const unitPrice = await getCurrentSellingPrice(
                itemId,
                transaction
            );

            const lineTotal = Number(
                (quantity * unitPrice).toFixed(2)
            );

            calculatedSubtotal = Number(
                (calculatedSubtotal + lineTotal).toFixed(2)
            );

            validatedItems.push({
                item_id: itemId,
                quantity,
                unit_price: unitPrice,
                discount_amount: 0,
                line_total: lineTotal
            });
        }

        const orderDiscount = 0;

// Tax and delivery must come from trusted server-side
// configuration/calculation, not request-body values.
// Keep them at zero until those calculations are implemented.
        const orderTax = 0;
        const shippingAmount = 0;

        const calculatedTotal = Number(
            (
                calculatedSubtotal -
                orderDiscount +
                orderTax +
                shippingAmount
            ).toFixed(2)
        );

        // ==========================================
        // CREATE ORDER
        // ==========================================

        const order = await Order.create(
            {
                order_number,
                customer_id: customer_id || null,
                order_date,
                order_type: order_type || 'online',
                status: 'pending',
                payment_status: 'unpaid',
                fulfillment_status: 'unfulfilled',

                subtotal: calculatedSubtotal,
                discount_amount: orderDiscount,
                tax_amount: orderTax,
                shipping_amount: shippingAmount,
                total_amount: calculatedTotal,

                notes: notes || null,

                created_by: req.user ? req.user.id : null
            },
            {
                transaction
            }
        )

        // ==========================================
        // CREATE ORDER ITEMS
        // ==========================================

        const orderItems = [];

        for (const item of validatedItems) {
            const orderItem = await OrderItem.create(
                {
                    order_id: order.id,
                    item_id: item.item_id,
                    quantity: item.quantity,
                    unit_price: item.unit_price,
                    discount_amount: item.discount_amount,
                    line_total: item.line_total
                },
                {transaction}
            );

            orderItems.push(orderItem);
        }

        // ==========================================
// CREATE ORDER ADDRESS FROM CUSTOMER ADDRESS
// ==========================================

        let orderAddress = null
        let selectedCustomerAddress = null

        if (delivery && delivery.required === true) {

            // Address is required when delivery is enabled
            if (!address || !address.address_id) {
                throw new Error(
                    'A saved customer address is required for delivery'
                )
            }

            // Make sure the selected address belongs to the selected customer
            if (!customer_id) {
                throw new Error(
                    'A customer is required when delivery is enabled'
                )
            }

            selectedCustomerAddress = await CustomerAddress.findOne({
                where: {
                    id: address.address_id,
                    customer_id: customer_id
                },
                transaction
            })

            if (!selectedCustomerAddress) {
                throw new Error(
                    'Selected customer address was not found'
                )
            }

            // Create historical snapshot of the address
            orderAddress = await OrderAddress.create(
                {
                    order_id: order.id,

                    address_type:
                        address.address_type || 'shipping',

                    recipient_name:
                    selectedCustomerAddress.recipient_name,

                    phone:
                        selectedCustomerAddress.phone || null,

                    address_line_1:
                    selectedCustomerAddress.address_line_1,

                    address_line_2:
                        selectedCustomerAddress.address_line_2 || null,

                    city:
                    selectedCustomerAddress.city,

                    state:
                        selectedCustomerAddress.state || null,

                    postal_code:
                        selectedCustomerAddress.postal_code || null,

                    country:
                        selectedCustomerAddress.country || 'Sri Lanka'
                },
                {
                    transaction
                }
            )
        }


        // ==========================================
        // CREATE INVOICE
        // ==========================================

        // Manual order creation must never trust a
        // payment amount or payment status supplied
        // by the client.
        if (
            payment &&
            (
                Object.prototype.hasOwnProperty.call(payment, 'amount') ||
                Object.prototype.hasOwnProperty.call(payment, 'status') ||
                Object.prototype.hasOwnProperty.call(payment, 'payment_status') ||
                Object.prototype.hasOwnProperty.call(payment, 'payment_date') ||
                Object.prototype.hasOwnProperty.call(payment, 'transaction_reference')
            )
        ) {
            const error = new Error(
                'Payment amounts, statuses, dates and transaction references cannot be supplied when creating an order.'
            );
            error.statusCode = 400;
            throw error;
        }

        const invoiceNumber = `INV-${order.order_number}`;

        const invoice = await Invoice.create(
            {
                invoice_number: invoiceNumber,
                order_id: order.id,
                customer_id: customer_id || null,
                invoice_date: order_date,
                status: 'issued',
                subtotal: calculatedSubtotal,
                discount_amount: orderDiscount,
                tax_amount: orderTax,
                shipping_amount: shippingAmount,
                total_amount: calculatedTotal,
                paid_amount: 0,
                balance_amount: calculatedTotal,
                notes: notes || null,
                created_by: req.user ? req.user.id : null
            },
            {transaction}
        );

        // ==========================================
        // CREATE PAYMENT
        // ==========================================

        // Do not create a payment record until a
        // trusted payment workflow records it.
        const createdPayment = null;


        // ==========================================
// CREATE DELIVERY
// ==========================================

        let createdDelivery = null

        if (delivery && delivery.required === true) {

            if (!selectedCustomerAddress) {
                throw new Error(
                    'Customer address is required before creating delivery'
                )
            }

            const deliveryReference =
                `DEL-${order.order_number}`

            createdDelivery = await Delivery.create(
                {
                    delivery_reference:
                    deliveryReference,

                    order_id:
                    order.id,

                    delivery_method:
                        delivery.method || 'standard',

                    delivery_status:
                        'pending',

                    recipient_name:
                    selectedCustomerAddress.recipient_name,

                    recipient_phone:
                        selectedCustomerAddress.phone || null,

                    address_line_1:
                    selectedCustomerAddress.address_line_1,

                    address_line_2:
                        selectedCustomerAddress.address_line_2 || null,

                    city:
                    selectedCustomerAddress.city,

                    state:
                        selectedCustomerAddress.state || null,

                    postal_code:
                        selectedCustomerAddress.postal_code || null,

                    country:
                        selectedCustomerAddress.country || 'Sri Lanka',

                    delivery_charge:
                        Number(
                            delivery.charge ||
                            shippingAmount ||
                            0
                        ),

                    tracking_number:
                        delivery.tracking_number || null,

                    courier_name:
                        delivery.courier_name || null,

                    expected_delivery_date:
                        delivery.expected_delivery_date || null,

                    dispatched_at:
                        null,

                    delivered_at:
                        null,

                    notes:
                        delivery.notes || null
                },
                {
                    transaction
                }
            )
        }

        // ==========================================
        // UPDATE ORDER PAYMENT STATUS
        // ==========================================

        // Manual orders start unpaid.
        // Payment status can only change through a
        // trusted payment recording workflow.

        await order.update(
            {
                payment_status: 'unpaid'
            },
            {
                transaction
            }
        )


        await recordAuditLog({
            userId: req.user ? req.user.id : null,
            action: 'ORDER_CREATED',
            module: 'orders',
            entityType: 'order',
            entityId: order.id,
            description: `Order ${order.order_number} created`,
            newValues: {
                order_number: order.order_number,
                customer_id: order.customer_id,
                order_type: order.order_type,
                status: order.status,
                payment_status: order.payment_status,
                fulfillment_status: order.fulfillment_status,
                subtotal: order.subtotal,
                discount_amount: order.discount_amount,
                tax_amount: order.tax_amount,
                shipping_amount: order.shipping_amount,
                total_amount: order.total_amount,
                item_count: orderItems.length,
                invoice_id: invoice.id,
                delivery_id: createdDelivery ? createdDelivery.id : null
            },
            ipAddress: req.ip || null,
            userAgent: req.get('user-agent') || null,
            requestId: null,
            transaction
        });

        await transaction.commit()


        // ==========================================
        // COMMIT TRANSACTION
        // ==========================================

        await transaction.commit()

        // ==========================================
        // RETURN COMPLETE ORDER
        // ==========================================

        const createdOrder =
            await Order.findByPk(
                order.id,
                {
                    include:
                        getOrderIncludes()
                }
            )

        return res.status(201).json({
            message:
                'Order and related records created successfully',

            data:
            createdOrder,

            created: {
                order: true,
                order_items:
                orderItems.length,

                address:
                    Boolean(orderAddress),

                invoice:
                    Boolean(invoice),

                payment:
                    Boolean(createdPayment),

                delivery:
                    Boolean(createdDelivery)
            }
        })

    } catch (error) {

        // ==========================================
        // ROLLBACK
        // ==========================================

        try {
            await transaction.rollback()
        } catch (rollbackError) {
            console.error(
                'Transaction rollback error:',
                rollbackError
            )
        }

        console.error(
            'Create order transaction error:',
            error
        )

        return res.status(500).json({
            message:
                'Failed to create order and related records',

            error:
            error.message

        })
    }
}


// UPDATE ORDER


exports.updateOrder = async (req, res) => {
    let transaction;

    try {
        const { id } = req.params;

        if (!/^[1-9]\d*$/.test(id)) {
            return res.status(400).json({
                message: 'Invalid order ID'
            });
        }

        const allowedFields = ['notes'];
        const receivedFields = Object.keys(req.body || {});

        const unsupportedFields = receivedFields.filter(
            field => !allowedFields.includes(field)
        );

        if (unsupportedFields.length > 0) {
            return res.status(400).json({
                message: 'Unsupported order update fields',
                fields: unsupportedFields
            });
        }

        if (req.body.notes === undefined) {
            return res.status(400).json({
                message: 'No valid fields provided for update'
            });
        }

        const { notes } = req.body;

        if (
            notes !== null &&
            (
                typeof notes !== 'string' ||
                notes.length > 2000
            )
        ) {
            return res.status(400).json({
                message: 'Notes must be a string of up to 2000 characters'
            });
        }

        transaction = await Order.sequelize.transaction();

        const order = await Order.findByPk(id, {
            transaction,
            lock: transaction.LOCK.UPDATE
        });

        if (!order) {
            await transaction.rollback();
            transaction = null;

            return res.status(404).json({
                message: 'Order not found'
            });
        }

        const oldNotes = order.notes;

        if (oldNotes === notes) {
            await transaction.commit();
            transaction = null;

            return res.status(200).json({
                message: 'Order notes updated successfully',
                data: {
                    id: order.id,
                    order_number: order.order_number,
                    notes: order.notes
                }
            });
        }

        await order.update(
            { notes },
            { transaction }
        );

        await recordAuditLog({
            userId: req.user ? req.user.id : null,
            action: 'ORDER_UPDATED',
            module: 'orders',
            entityType: 'order',
            entityId: order.id,
            description: `Notes updated for order ${order.order_number}`,
            oldValues: {
                notes_changed: true,
                notes_length: oldNotes == null
                    ? 0
                    : oldNotes.length
            },
            newValues: {
                notes_changed: true,
                notes_length: notes == null
                    ? 0
                    : notes.length
            },
            ipAddress: req.ip || null,
            userAgent: req.get('user-agent') || null,
            requestId: null,
            transaction
        });

        await transaction.commit();
        transaction = null;

        return res.status(200).json({
            message: 'Order notes updated successfully',
            data: {
                id: order.id,
                order_number: order.order_number,
                notes: order.notes
            }
        });
    } catch (error) {
        if (transaction && !transaction.finished) {
            try {
                await transaction.rollback();
            } catch (rollbackError) {
                console.error(
                    'Order update rollback error:',
                    rollbackError
                );
            }
        }

        console.error('Update order error:', error);

        return res.status(500).json({
            message: 'Failed to update order'
        });
    }
};



// DELETE ORDER

exports.deleteOrder = async (req, res) => {
    return res.status(405).json({
        message:
            'Orders cannot be permanently deleted. Use an authorized cancellation workflow.'
    });
};
