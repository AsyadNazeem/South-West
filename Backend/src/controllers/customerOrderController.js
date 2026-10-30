
'use strict';

const {
    Order,
    OrderItem,
    Item,
    OrderAddress,
    Delivery,
    Payment,
    Invoice
} = require('../models');

const { recordAuditLog } = require('../services/auditLogService');

const AUDIT_MODULE = 'CUSTOMER_ORDERS';

function getCustomerId(req) {
    return req.customer?.id;
}

// Best-effort audit logging for read operations.
async function auditCustomerOrder(req, {
    action,
    customerId = null,
    orderId = null,
    description,
    newValues = null
}) {
    try {
        await recordAuditLog({
            userId: req.user?.id ?? req.user?.user_id ?? null,
            action,
            module: AUDIT_MODULE,
            entityType: 'Order',
            entityId: orderId == null ? null : String(orderId),
            description,
            oldValues: null,
            newValues,
            ipAddress: req.ip ?? null,
            userAgent: req.get?.('user-agent') ?? null,
            requestId: req.id ?? req.requestId ?? null
        });
    } catch (error) {
        // A read request should not fail because audit logging is unavailable.
        console.error('Customer order audit logging failed:', error.message);
    }
}

// GET /api/customer-orders
async function getMyOrders(req, res) {
    const customerId = getCustomerId(req);

    if (!customerId) {
        await auditCustomerOrder(req, {
            action: 'CUSTOMER_ORDER_LIST_UNAUTHORIZED',
            description: 'Order list request rejected because customer authentication was missing'
        });

        return res.status(401).json({
            message: 'Customer authentication required.'
        });
    }

    try {
        const page = Math.max(
            1,
            Number.parseInt(req.query.page, 10) || 1
        );

        const limit = Math.min(
            50,
            Math.max(
                1,
                Number.parseInt(req.query.limit, 10) || 10
            )
        );

        const offset = (page - 1) * limit;

        const { count, rows } = await Order.findAndCountAll({
            where: {
                customer_id: customerId,
                order_type: 'online'
            },
            attributes: [
                'id',
                'order_number',
                'order_date',
                'status',
                'payment_status',
                'fulfillment_status',
                'subtotal',
                'discount_amount',
                'tax_amount',
                'shipping_amount',
                'total_amount'
            ],
            include: [
                {
                    model: OrderItem,
                    as: 'items',
                    attributes: [
                        'id',
                        'quantity',
                        'unit_price',
                        'line_total'
                    ],
                    include: [
                        {
                            model: Item,
                            as: 'item',
                          attributes: [
    'id',
    'public_id',
    'slug',
    'item_name',
    'item_code'
],
                            required: false
                        }
                    ],
                    required: false
                },
                {
                    model: Delivery,
                    as: 'deliveries',
                    attributes: [
                        'id',
                        'delivery_reference',
                        'delivery_status',
                        'tracking_number',
                        'courier_name',
                        'expected_delivery_date',
                        'dispatched_at',
                        'delivered_at'
                    ],
                    required: false
                }
            ],
            order: [
                ['order_date', 'DESC'],
                ['id', 'DESC']
            ],
            limit,
            offset,
            distinct: true
        });

        await auditCustomerOrder(req, {
            action: 'CUSTOMER_ORDER_LIST_VIEWED',
            customerId,
            description: `Customer ${customerId} viewed their online orders`,
            newValues: {
                customer_id: customerId,
                page,
                limit,
                returned_count: rows.length,
                total_orders: count
            }
        });

        return res.status(200).json({
            message: 'Customer orders retrieved successfully.',
            data: rows,
            pagination: {
                page,
                limit,
                total: count,
                totalPages: Math.ceil(count / limit)
            }
        });
    } catch (error) {
        console.error('Get customer orders error:', error);

        await auditCustomerOrder(req, {
            action: 'CUSTOMER_ORDER_LIST_FAILED',
            customerId,
            description: `Failed to retrieve online orders for customer ${customerId}`
        });

        return res.status(500).json({
            message: 'Unable to retrieve your orders.'
        });
    }
}

// GET /api/customer-orders/:orderId
async function getMyOrderById(req, res) {
    const customerId = getCustomerId(req);
    const orderId = Number(req.params.orderId);

    if (!customerId) {
        await auditCustomerOrder(req, {
            action: 'CUSTOMER_ORDER_DETAIL_UNAUTHORIZED',
            orderId: Number.isSafeInteger(orderId) && orderId > 0
                ? orderId
                : null,
            description: 'Order detail request rejected because customer authentication was missing'
        });

        return res.status(401).json({
            message: 'Customer authentication required.'
        });
    }

    if (!Number.isSafeInteger(orderId) || orderId <= 0) {
        await auditCustomerOrder(req, {
            action: 'CUSTOMER_ORDER_DETAIL_INVALID_ID',
            customerId,
            description: `Customer ${customerId} submitted an invalid order ID`
        });

        return res.status(400).json({
            message: 'A valid order ID is required.'
        });
    }

    try {
        const order = await Order.findOne({
            where: {
                id: orderId,
                customer_id: customerId,
                order_type: 'online'
            },
            attributes: [
                'id',
                'order_number',
                'order_date',
                'status',
                'payment_status',
                'fulfillment_status',
                'subtotal',
                'discount_amount',
                'tax_amount',
                'shipping_amount',
                'total_amount',
                'notes'
            ],
            include: [
                {
                    model: OrderItem,
                    as: 'items',
                    attributes: [
                        'id',
                        'item_id',
                        'quantity',
                        'unit_price',
                        'discount_amount',
                        'tax_amount',
                        'line_total'
                    ],
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
                        }
                    ],
                    required: false
                },
                {
                    model: OrderAddress,
                    as: 'addresses',
                    attributes: [
                        'address_type',
                        'recipient_name',
                        'phone',
                        'address_line_1',
                        'address_line_2',
                        'city',
                        'state',
                        'postal_code',
                        'country'
                    ],
                    required: false
                },
                {
                    model: Delivery,
                    as: 'deliveries',
                    attributes: [
                        'delivery_reference',
                        'delivery_method',
                        'delivery_status',
                        'tracking_number',
                        'courier_name',
                        'recipient_name',
                        'recipient_phone',
                        'expected_delivery_date',
                        'dispatched_at',
                        'delivered_at'
                    ],
                    required: false
                },
                {
                    model: Payment,
                    as: 'payments',
                    attributes: [
                        'payment_method',
                        'payment_status',
                        'amount',
                        'transaction_reference',
                        'payment_date'
                    ],
                    required: false
                },
                {
                    model: Invoice,
                    as: 'invoices',
                    attributes: [
                        'invoice_number',
                        'invoice_date',
                        'status',
                        'subtotal',
                        'discount_amount',
                        'tax_amount',
                        'shipping_amount',
                        'total_amount',
                        'paid_amount',
                        'balance_amount'
                    ],
                    required: false
                }
            ]
        });

        if (!order) {
            // Deliberately do not reveal whether another customer's order exists.
            await auditCustomerOrder(req, {
                action: 'CUSTOMER_ORDER_DETAIL_NOT_FOUND',
                customerId,
                orderId,
                description: `Customer ${customerId} requested an unavailable online order`,
                newValues: {
                    customer_id: customerId,
                    requested_order_id: orderId
                }
            });

            return res.status(404).json({
                message: 'Order not found.'
            });
        }

        await auditCustomerOrder(req, {
            action: 'CUSTOMER_ORDER_DETAIL_VIEWED',
            customerId,
            orderId: order.id,
            description: `Customer ${customerId} viewed order ${order.id}`,
            newValues: {
                customer_id: customerId,
                order_id: order.id,
                order_number: order.order_number,
                order_status: order.status,
                payment_status: order.payment_status
            }
        });

        return res.status(200).json({
            message: 'Order details retrieved successfully.',
            data: order
        });
    } catch (error) {
        console.error('Get customer order details error:', error);

        await auditCustomerOrder(req, {
            action: 'CUSTOMER_ORDER_DETAIL_FAILED',
            customerId,
            orderId,
            description: `Failed to retrieve order ${orderId} for customer ${customerId}`
        });

        return res.status(500).json({
            message: 'Unable to retrieve order details.'
        });
    }
}

module.exports = {
    getMyOrders,
    getMyOrderById
};
