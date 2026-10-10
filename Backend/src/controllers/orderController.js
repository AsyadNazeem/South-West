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
    ProductReview
} = require('../models');

const getOrderIncludes = () => [
    {
        model: Customer,
        as: 'customer',
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
        const { id } = req.params;

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

        // ==========================================
        // CALCULATE ORDER TOTALS
        // ==========================================

        const calculatedSubtotal = items.reduce((sum, item) => {
            const quantity = Number(item.quantity || 0)
            const unitPrice = Number(item.unit_price || 0)
            const discount = Number(item.discount || 0)

            return sum + ((quantity * unitPrice) - discount)
        }, 0)

        const orderDiscount = Number(discount_amount || 0)
        const orderTax = Number(tax_amount || 0)
        const shippingAmount = Number(shipping_amount || 0)

        const calculatedTotal =
            calculatedSubtotal -
            orderDiscount +
            orderTax +
            shippingAmount

        // ==========================================
        // CREATE ORDER
        // ==========================================

        const order = await Order.create(
            {
                order_number,
                customer_id: customer_id || null,
                order_date,
                order_type: order_type || 'online',
                status: status || 'pending',
                payment_status: payment_status || 'unpaid',
                fulfillment_status:
                    fulfillment_status || 'unfulfilled',

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

        const orderItems = []

        for (const item of items) {

            if (!item.item_id) {
                throw new Error(
                    'Item ID is required for every order item'
                )
            }

            const quantity = Number(item.quantity || 0)
            const unitPrice = Number(item.unit_price || 0)
            const discount = Number(item.discount || 0)

            if (quantity <= 0) {
                throw new Error(
                    'Order item quantity must be greater than zero'
                )
            }

            const itemTotal =
                (quantity * unitPrice) - discount

            const orderItem = await OrderItem.create(
                {
                    order_id: order.id,
                    item_id: item.item_id,
                    quantity,
                    unit_price: unitPrice,
                    discount,
                    total: itemTotal
                },
                {
                    transaction
                }
            )

            orderItems.push(orderItem)
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

        const invoiceNumber =
            `INV-${order.order_number}`

        const paymentAmount =
            Number(payment?.amount || 0)

        const invoiceBalance =
            calculatedTotal - paymentAmount

        let invoiceStatus = 'draft'

        if (
            paymentAmount >= calculatedTotal &&
            calculatedTotal > 0
        ) {
            invoiceStatus = 'paid'
        } else if (paymentAmount > 0) {
            invoiceStatus = 'partially_paid'
        }

        const invoice = await Invoice.create(
            {
                invoice_number: invoiceNumber,
                order_id: order.id,
                customer_id: customer_id || null,

                invoice_date: order_date,

                status: invoiceStatus,

                subtotal: calculatedSubtotal,
                discount_amount: orderDiscount,
                tax_amount: orderTax,
                shipping_amount: shippingAmount,
                total_amount: calculatedTotal,

                paid_amount: paymentAmount,
                balance_amount: Math.max(invoiceBalance, 0),

                notes: notes || null,

                created_by:
                    req.user ? req.user.id : null
            },
            {
                transaction
            }
        )

        // ==========================================
        // CREATE PAYMENT
        // ==========================================

        let createdPayment = null

        if (paymentAmount > 0) {

            const paymentReference =
                `PAY-${order.order_number}`

            const paymentStatus =
                payment.status || 'paid'

            createdPayment = await Payment.create(
                {
                    payment_reference:
                    paymentReference,

                    order_id:
                    order.id,

                    payment_method:
                        payment.method || 'cash',

                    payment_status:
                    paymentStatus,

                    amount:
                    paymentAmount,

                    transaction_reference:
                        payment.transaction_reference || null,

                    payment_date:
                        payment.payment_date || new Date(),

                    notes:
                        payment.notes || null,

                    processed_by:
                        req.user ? req.user.id : null
                },
                {
                    transaction
                }
            )
        }

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

        let finalPaymentStatus = 'unpaid'

        if (
            paymentAmount >= calculatedTotal &&
            calculatedTotal > 0
        ) {
            finalPaymentStatus = 'paid'
        } else if (paymentAmount > 0) {
            finalPaymentStatus = 'partially_paid'
        }

        await order.update(
            {
                payment_status:
                finalPaymentStatus
            },
            {
                transaction
            }
        )

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
    try {
        const { id } = req.params;

        const order = await Order.findByPk(id);

        if (!order) {
            return res.status(404).json({
                message: 'Order not found'
            });
        }

        const allowedFields = [
            'customer_id',
            'order_date',
            'order_type',
            'status',
            'payment_status',
            'fulfillment_status',
            'subtotal',
            'discount_amount',
            'tax_amount',
            'shipping_amount',
            'total_amount',
            'notes'
        ];

        const updates = {};

        allowedFields.forEach(field => {
            if (req.body[field] !== undefined) {
                updates[field] = req.body[field];
            }
        });

        await order.update(updates);

        return res.status(200).json({
            message: 'Order updated successfully',
            data: order
        });

    } catch (error) {
        console.error('Update order error:', error);

        return res.status(500).json({
            message: 'Failed to update order',
            error: error.message
        });
    }
};

// DELETE ORDER
exports.deleteOrder = async (req, res) => {
    try {
        const { id } = req.params;

        const order = await Order.findByPk(id);

        if (!order) {
            return res.status(404).json({
                message: 'Order not found'
            });
        }

        await order.destroy();

        return res.status(200).json({
            message: 'Order deleted successfully'
        });
    } catch (error) {
        console.error('Delete order error:', error);

        return res.status(500).json({
            message: 'Failed to delete order',
            error: error.message
        });
    }
};
