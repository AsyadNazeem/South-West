const { Order, Customer, User, OrderItem, OrderAddress, Payment, Delivery, Invoice, OrderPromotion, ProductReview } = require('../models');

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
            notes
        } = req.body;

        if (!order_number) {
            return res.status(400).json({
                message: 'Order number is required'
            });
        }

        if (!order_date) {
            return res.status(400).json({
                message: 'Order date is required'
            });
        }

        // Check duplicate order number
        const existingOrder = await Order.findOne({
            where: { order_number }
        });

        if (existingOrder) {
            return res.status(409).json({
                message: 'Order number already exists'
            });
        }

        const order = await Order.create({
            order_number,
            customer_id: customer_id || null,
            order_date,
            order_type: order_type || 'online',
            status: status || 'pending',
            payment_status: payment_status || 'unpaid',
            fulfillment_status: fulfillment_status || 'unfulfilled',
            subtotal: subtotal || 0,
            discount_amount: discount_amount || 0,
            tax_amount: tax_amount || 0,
            shipping_amount: shipping_amount || 0,
            total_amount: total_amount || 0,
            notes: notes || null,
            created_by: req.user ? req.user.id : null
        });

        return res.status(201).json({
            message: 'Order created successfully',
            data: order
        });
    } catch (error) {
        console.error('Create order error:', error);

        return res.status(500).json({
            message: 'Failed to create order',
            error: error.message
        });
    }
};


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
