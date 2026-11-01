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
