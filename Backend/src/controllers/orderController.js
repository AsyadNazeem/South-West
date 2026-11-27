const { Op, Sequelize } = require('sequelize');
const { buildOrderPhoneSearch } = require('../utils/orderPhoneSearch');

const {
    Order,
    Customer,
    CustomerAddress,
    DeliveryDistrict,
    DeliveryArea,
    User,
    OrderItem,
    OrderAddress,
    Payment,
    Delivery,
    Invoice,
    OrderPromotion,
    ProductReview,
    Item,
    ItemVariant
} = require('../models');

const getOrderIncludes = ({ includeAddressLocations = false } = {}) => [
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
        required: false,
        include: includeAddressLocations ? [
            {
                model: DeliveryDistrict,
                as: 'district',
                attributes: ['id', 'district_name'],
                required: false
            },
            {
                model: DeliveryArea,
                as: 'area',
                attributes: ['id', 'area_name'],
                required: false
            }
        ] : []
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
        let replacements;
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
            const phoneSearch = buildOrderPhoneSearch(search, {
                orderAlias: 'Order',
                replacementPrefix: 'orderPhone'
            });
            if (phoneSearch) where[Op.or].push(phoneSearch.condition);
            replacements = phoneSearch?.replacements;
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
            replacements
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
            include: getOrderIncludes({ includeAddressLocations: true })
        });

        if (!order) {
            return res.status(404).json({
                message: 'Order not found'
            });
        }

        const data = order.toJSON();
        const shippingAddress = data.addresses?.find(
            address => address.address_type === 'shipping'
        );

        // Orders created before delivery location IDs were snapshotted can only
        // be enriched when the original customer address still matches exactly.
        // A failed match deliberately leaves district/area unknown rather than
        // substituting Province (state) or another current customer address.
        if (
            shippingAddress &&
            (!shippingAddress.district || !shippingAddress.area) &&
            data.customer?.id
        ) {
            const matchingAddress = await CustomerAddress.findOne({
                where: {
                    customer_id: data.customer.id,
                    recipient_name: shippingAddress.recipient_name,
                    phone: shippingAddress.phone,
                    address_line_1: shippingAddress.address_line_1,
                    address_line_2: shippingAddress.address_line_2,
                    city: shippingAddress.city,
                    state: shippingAddress.state,
                    postal_code: shippingAddress.postal_code,
                    country: shippingAddress.country
                },
                include: [
                    {
                        model: DeliveryDistrict,
                        as: 'district',
                        attributes: ['id', 'district_name'],
                        required: true
                    },
                    {
                        model: DeliveryArea,
                        as: 'area',
                        attributes: ['id', 'area_name'],
                        required: true
                    }
                ]
            });

            if (matchingAddress) {
                const location = matchingAddress.toJSON();
                shippingAddress.district_id = location.district_id;
                shippingAddress.area_id = location.area_id;
                shippingAddress.district = location.district;
                shippingAddress.area = location.area;
            }
        }

        return res.status(200).json({
            message: 'Order retrieved successfully',
            data
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
