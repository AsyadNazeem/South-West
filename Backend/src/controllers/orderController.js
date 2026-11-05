const { Op, Sequelize } = require('sequelize');
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
    ItemPrice,
    ItemVariant
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
        required: false,
        include: [
            {
                model: Item,
                as: 'item',
                attributes: [
                    'id',
                    'item_name',
                    'item_code'
                ],
                required: false
            },
            {
                model: ItemVariant,
                as: 'variant',
                attributes: [
                    'id',
                    'variant_sku',
                    'variant_name',
                    'attributes'
                ],
                required: false
            }
        ]
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

// GET ORDER SUMMARIES for the Admin listing. The legacy list and detail
// endpoints retain their full response shape for existing consumers.
exports.getOrderSummaries = async (req, res) => {
    try {
        const requestedPageSize = Number.parseInt(
            req.query.pageSize ?? req.query.limit,
            10
        );
        const pageSize = Number.isInteger(requestedPageSize) && requestedPageSize > 0
            ? Math.min(requestedPageSize, 100)
            : 25;
        const requestedPage = Number.parseInt(req.query.page, 10);
        const page = Number.isInteger(requestedPage) && requestedPage > 0
            ? requestedPage
            : 1;
        const offset = (page - 1) * pageSize;
        const where = {};
        const search = String(req.query.search || '').trim();
        const status = String(req.query.status || '');
        const paymentStatus = String(req.query.paymentStatus || '');
        const orderStatuses = new Set([
            'pending', 'confirmed', 'processing', 'partially_shipped',
            'shipped', 'delivered', 'cancelled', 'returned',
        ]);
        const paymentStatuses = new Set([
            'unpaid', 'partially_paid', 'paid', 'refunded', 'partially_refunded',
        ]);
        const sortableFields = new Set([
            'id', 'order_number', 'order_date', 'total_amount', 'status',
            'payment_status', 'order_type',
        ]);
        const requestedSort = String(req.query.sortBy || 'id');
        const sortBy = sortableFields.has(requestedSort) ? requestedSort : 'id';
        const sortOrder = String(req.query.sortOrder || 'DESC').toUpperCase() === 'ASC'
            ? 'ASC'
            : 'DESC';
        const order = sortBy === 'id'
            ? [['id', sortOrder]]
            : [[sortBy, sortOrder], ['id', 'DESC']];

        if (orderStatuses.has(status)) where.status = status;
        if (paymentStatuses.has(paymentStatus)) where.payment_status = paymentStatus;

        if (search) {
            const pattern = `%${search}%`;
            where[Op.or] = [
                { order_number: { [Op.like]: pattern } },
                { customer_email: { [Op.like]: pattern } },
                Sequelize.where(
                    Sequelize.fn(
                        'CONCAT',
                        Sequelize.col('customer.first_name'),
                        ' ',
                        Sequelize.col('customer.last_name')
                    ),
                    { [Op.like]: pattern }
                ),
            ];
        }

        const result = await Order.findAndCountAll({
            where,
            attributes: [
                'id',
                'order_number',
                'order_date',
                'order_type',
                'status',
                'payment_status',
                'total_amount',
            ],
            include: [{
                model: Customer,
                as: 'customer',
                attributes: ['id', 'first_name', 'last_name'],
                required: false,
            }],
            order,
            limit: pageSize,
            offset,
            distinct: true,
            col: 'id',
        });

        const data = result.rows.map(orderRecord => {
            const row = orderRecord.toJSON();
            return {
                id: row.id,
                order_number: row.order_number,
                order_date: row.order_date,
                order_type: row.order_type,
                status: row.status,
                payment_status: row.payment_status,
                total_amount: row.total_amount,
                customer: row.customer ? {
                    id: row.customer.id,
                    name: `${row.customer.first_name || ''} ${row.customer.last_name || ''}`.trim(),
                } : null,
            };
        });

        return res.status(200).json({
            message: 'Orders retrieved successfully',
            data,
            pagination: {
                total: result.count,
                page,
                pageSize,
                totalPages: Math.ceil(result.count / pageSize),
            },
        });
    } catch (error) {
        console.error('Get order summaries error:', error);

        return res.status(500).json({
            message: 'Failed to retrieve order summaries',
            error: error.message,
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




// DELETE ORDER

exports.deleteOrder = async (req, res) => {
    return res.status(405).json({
        message:
            'Orders cannot be permanently deleted. Use an authorized cancellation workflow.'
    });
};
