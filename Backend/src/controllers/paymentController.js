'use strict';

const {
    Payment,
    Order,
    User,
    Delivery,
    Notification,
    Customer
} = require('../models');
const { recordAuditLog } = require('../services/auditLogService');
const { sendOrderStatusEmail } = require('../services/emailService');


const updatePaymentStatus = async (req, res) => {
    let transaction;
    let completionEmailPayload = null;
    let completedOrderNumber = null;

    try {
        const { id } = req.params;
        const actorId = req.user?.id ?? req.user?.user_id ?? null;
        const requestBody = req.body;

        if (
            !requestBody ||
            typeof requestBody !== 'object' ||
            Array.isArray(requestBody) ||
            Object.keys(requestBody).length !== 1 ||
            requestBody.payment_status !== 'paid'
        ) {
            return res.status(400).json({
                message: "Only an explicit payment_status: 'paid' confirmation is accepted."
            });
        }

        if (!/^[1-9]\d*$/.test(id)) {
            return res.status(400).json({
                message: 'Invalid payment ID'
            });
        }

        transaction = await Payment.sequelize.transaction();

        const payment = await Payment.findByPk(id, {
            transaction,
            lock: transaction.LOCK.UPDATE
        });

        if (!payment) {
            await transaction.rollback();
            transaction = null;

            return res.status(404).json({
                message: 'Payment not found'
            });
        }

        // COD payment is confirmed automatically when an admin marks
        // its delivery as delivered. Online payments require provider
        // confirmation and must never use this manual endpoint.
        await transaction.rollback();
        transaction = null;

        return res.status(409).json({
            message:
                payment.payment_method === 'cash'
                    ? 'COD payments are automatically confirmed when the delivery is marked as delivered.'
                    : 'Online payments require verified provider confirmation.',
            payment_method: payment.payment_method
        });

        if (!['unpaid', 'partially_paid'].includes(payment.payment_status)) {
            await transaction.rollback();
            transaction = null;

            return res.status(409).json({
                message: 'Only unpaid or partially paid transactions can be confirmed.',
                payment_status: payment.payment_status
            });
        }

        const order = await Order.findByPk(payment.order_id, {
            include: [{
                model: Customer,
                as: 'customer',
                attributes: ['id', 'first_name', 'last_name', 'email']
            }],
            transaction,
            lock: transaction.LOCK.UPDATE
        });

        if (!order) {
            await transaction.rollback();
            transaction = null;

            return res.status(404).json({
                message: 'The associated order could not be found.'
            });
        }

        if (['refunded', 'partially_refunded'].includes(order.payment_status)) {
            await transaction.rollback();
            transaction = null;

            return res.status(409).json({
                message: 'Payments cannot be confirmed while the order has a refund status.'
            });
        }

        const oldPaymentValues = {
            payment_status: payment.payment_status,
            payment_date: payment.payment_date,
            processed_by: payment.processed_by
        };

        const oldOrderValues = {
            payment_status: order.payment_status,
            status: order.status
        };

        payment.payment_status = 'paid';
        payment.payment_date = new Date();
        payment.processed_by = actorId;

        await payment.save({ transaction });

        const orderPayments = await Payment.findAll({
            where: { order_id: order.id },
            attributes: ['id', 'amount', 'payment_status'],
            transaction,
            lock: transaction.LOCK.UPDATE
        });

        const confirmedAmountCents = orderPayments.reduce(
            (total, record) => {
                if (record.payment_status !== 'paid') {
                    return total;
                }

                return total + Math.round(Number(record.amount || 0) * 100);
            },
            0
        );

        const orderTotalCents = Math.round(
            Number(order.total_amount || 0) * 100
        );

        if (confirmedAmountCents > orderTotalCents) {
            await transaction.rollback();
            transaction = null;

            return res.status(409).json({
                message: 'Confirming this payment would cause the order to be overpaid.',
                order_total: order.total_amount,
                confirmed_payments_total: (confirmedAmountCents / 100).toFixed(2)
            });
        }

        let nextPaymentStatus = 'unpaid';

        if (confirmedAmountCents > 0 && confirmedAmountCents < orderTotalCents) {
            nextPaymentStatus = 'partially_paid';
        } else if (
            orderTotalCents > 0 &&
            confirmedAmountCents === orderTotalCents
        ) {
            nextPaymentStatus = 'paid';
        }

        await order.update(
            { payment_status: nextPaymentStatus },
            { transaction, fields: ['payment_status'] }
        );

        await recordAuditLog({
            userId: actorId,
            action: 'PAYMENT_STATUS_CONFIRMED',
            module: 'payments',
            entityType: 'payment',
            entityId: payment.id,
            description: `Payment ${payment.payment_reference} confirmed as paid`,
            oldValues: oldPaymentValues,
            newValues: {
                payment_status: payment.payment_status,
                payment_date: payment.payment_date,
                processed_by: payment.processed_by,
                order_payment_status: nextPaymentStatus
            },
            ipAddress: req.ip || null,
            userAgent: req.get('user-agent') || null,
            requestId: req.id || req.requestId || null,
            transaction
        });

        let orderStatusUpdated = false;

        if (
            nextPaymentStatus === 'paid' &&
            ['shipped', 'partially_shipped'].includes(order.status)
        ) {
            const deliveries = await Delivery.findAll({
                where: { order_id: order.id },
                attributes: ['id', 'delivery_status'],
                transaction,
                lock: transaction.LOCK.UPDATE
            });

            const allDeliveriesCompleted =
                deliveries.length > 0 &&
                deliveries.every(
                    delivery => delivery.delivery_status === 'delivered'
                );

            if (allDeliveriesCompleted) {
                const previousOrderStatus = order.status;

                await order.update(
                    { status: 'delivered' },
                    { transaction, fields: ['status'] }
                );

                if (order.customer) {
                    await Notification.create({
                        customer_id: order.customer.id,
                        type: 'order_status',
                        title: 'Order Completed',
                        message: 'Your order has been completed and delivered.',
                        reference_type: 'order',
                        reference_id: order.id,
                        is_read: false,
                        read_at: null
                    }, { transaction });
                }

                await recordAuditLog({
                    userId: actorId,
                    action: 'ORDER_STATUS_AUTO_COMPLETED',
                    module: 'orders',
                    entityType: 'order',
                    entityId: order.id,
                    description:
                        `Order ${order.order_number} automatically completed ` +
                        'after full payment confirmation and delivery completion',
                    oldValues: { status: previousOrderStatus },
                    newValues: {
                        status: 'delivered',
                        payment_status: 'paid',
                        trigger: 'payment_confirmed_after_all_deliveries'
                    },
                    ipAddress: req.ip || null,
                    userAgent: req.get('user-agent') || null,
                    requestId: req.id || req.requestId || null,
                    transaction
                });

                orderStatusUpdated = true;
                completedOrderNumber = order.order_number;

                if (order.customer?.email) {
                    completionEmailPayload = {
                        email: order.customer.email,
                        customerName: [
                            order.customer.first_name,
                            order.customer.last_name
                        ].filter(Boolean).join(' '),
                        orderNumber: order.order_number,
                        statusLabel: 'Order Completed',
                        reason: null
                    };
                }
            }
        }

        await transaction.commit();
        transaction = null;

        let emailStatus = 'not_required';

        if (completionEmailPayload) {
            try {
                await sendOrderStatusEmail(completionEmailPayload);
                emailStatus = 'sent';
            } catch (emailError) {
                emailStatus = 'failed';
                console.error(
                    `Order completion email failed for ${completedOrderNumber}:`,
                    emailError
                );
            }
        }

        const updatedPayment = await Payment.findByPk(id, {
            include: [
                { model: Order, as: 'order' },
                {
                    model: User,
                    as: 'processor',
                    attributes: { exclude: ['password', 'password_hash'] }
                }
            ]
        });

        return res.status(200).json({
            message: 'Payment confirmed successfully',
            data: updatedPayment,
            order_payment_status: nextPaymentStatus,
            order_status_update: {
                updated: orderStatusUpdated,
                status: orderStatusUpdated ? 'delivered' : order.status
            },
            completion_email: emailStatus
        });
    } catch (error) {
        if (transaction && !transaction.finished) {
            try {
                await transaction.rollback();
            } catch (rollbackError) {
                console.error('Payment confirmation rollback error:', rollbackError);
            }
        }

        console.error('Confirm payment error:', error);

        return res.status(500).json({
            message: 'Failed to confirm payment'
        });
    }
};


const getPayments = async (req, res) => {
    try {
        const payments = await Payment.findAll({
            include: [
                {
                    model: Order,
                    as: 'order'
                },
                {
                    model: User,
                    as: 'processor',
                    attributes: {
                        exclude: ['password']
                    }
                }
            ],
            order: [['created_at', 'DESC']]
        });

        res.status(200).json({
            message: 'Payments retrieved successfully',
            data: payments
        });
    } catch (error) {
        console.error('Get payments error:', error);

        res.status(500).json({
            message: 'Failed to retrieve payments',
            error: error.message
        });
    }
};


const getPaymentById = async (req, res) => {
    try {
        const { id } = req.params;

        const payment = await Payment.findByPk(id, {
            include: [
                {
                    model: Order,
                    as: 'order'
                },
                {
                    model: User,
                    as: 'processor',
                    attributes: {
                        exclude: ['password']
                    }
                }
            ]
        });

        if (!payment) {
            return res.status(404).json({
                message: 'Payment not found'
            });
        }

        res.status(200).json({
            message: 'Payment retrieved successfully',
            data: payment
        });
    } catch (error) {
        console.error('Get payment error:', error);

        res.status(500).json({
            message: 'Failed to retrieve payment',
            error: error.message
        });
    }
};



const createPayment = async (req, res) => {
    let transaction;

    try {
        const {
            payment_reference,
            order_id,
            payment_method,
            payment_status,
            amount,
            transaction_reference,
            payment_date,
            notes
        } = req.body;

        if (
            !payment_reference ||
            !order_id ||
            !payment_method ||
            amount === undefined ||
            amount === null
        ) {
            return res.status(400).json({
                message:
                    'payment_reference, order_id, payment_method and amount are required'
            });
        }

        if (
            !/^[1-9]\d*$/.test(String(order_id)) ||
            !Number.isFinite(Number(amount)) ||
            Number(amount) <= 0
        ) {
            return res.status(400).json({
                message: 'Invalid order ID or payment amount'
            });
        }

        const allowedMethods = [
            'cash',
            'card',
            'bank_transfer',
            'online',
            'wallet',
            'cheque',
            'other'
        ];

        const allowedStatuses = [
            'unpaid',
            'partially_paid',
            'paid',
            'refunded',
            'partially_refunded'
        ];

        if (!allowedMethods.includes(payment_method)) {
            return res.status(400).json({
                message: 'Invalid payment method'
            });
        }

   // Payment status is server-controlled.
// Clients cannot create a payment as paid or refunded.
if (payment_status !== undefined) {
    return res.status(400).json({
        message: 'Payment status cannot be set when creating a payment'
    });
}

        transaction = await Payment.sequelize.transaction();

        const order = await Order.findByPk(order_id, {
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

        const existingPayment = await Payment.findOne({
            where: { payment_reference },
            transaction
        });

        if (existingPayment) {
            await transaction.rollback();
            transaction = null;

            return res.status(409).json({
                message: 'Payment reference already exists'
            });
        }

        const payment = await Payment.create({
            payment_reference,
            order_id: Number(order_id),
            payment_method,
            payment_status: payment_status || 'unpaid',
            amount: Number(amount),
            transaction_reference: transaction_reference || null,
            payment_date: payment_date || null,
            notes: notes || null,
            processed_by: req.user.id
        }, { transaction });

        await recordAuditLog({
            userId: req.user.id,
            action: 'PAYMENT_CREATED',
            module: 'payments',
            entityType: 'payment',
            entityId: payment.id,
            description: `Payment ${payment.payment_reference} created`,
            newValues: {
                payment_reference: payment.payment_reference,
                order_id: payment.order_id,
                payment_method: payment.payment_method,
                payment_status: payment.payment_status,
                amount: payment.amount,
                processed_by: payment.processed_by
            },
            ipAddress: req.ip || null,
            userAgent: req.get('user-agent') || null,
            requestId: null,
            transaction
        });

        await transaction.commit();
        transaction = null;

        const createdPayment = await Payment.findByPk(payment.id, {
            include: [
                {
                    model: Order,
                    as: 'order'
                },
                {
                    model: User,
                    as: 'processor',
                    attributes: {
                        exclude: ['password', 'password_hash']
                    }
                }
            ]
        });

        return res.status(201).json({
            message: 'Payment created successfully',
            data: createdPayment
        });
    } catch (error) {
        if (transaction && !transaction.finished) {
            try {
                await transaction.rollback();
            } catch (rollbackError) {
                console.error(
                    'Payment creation rollback error:',
                    rollbackError
                );
            }
        }

        console.error('Create payment error:', error);

        return res.status(500).json({
            message: 'Failed to create payment'
        });
    }
};




const updatePayment = async (req, res) => {
    let transaction;

    try {
        const { id } = req.params;

        if (!/^[1-9]\d*$/.test(id)) {
            return res.status(400).json({
                message: 'Invalid payment ID'
            });
        }

       // Payment status and amount must not be changed through
// the general payment-edit endpoint.
const allowedFields = [
    'payment_method',
    'transaction_reference',
    'payment_date',
    'notes'
];

        const receivedFields = Object.keys(req.body || {});
        const unsupportedFields = receivedFields.filter(
            field => !allowedFields.includes(field)
        );

        if (unsupportedFields.length > 0) {
            return res.status(400).json({
                message: 'Unsupported payment update fields',
                fields: unsupportedFields
            });
        }

        if (receivedFields.length === 0) {
            return res.status(400).json({
                message: 'No fields provided for update'
            });
        }

        const allowedMethods = [
            'cash',
            'card',
            'bank_transfer',
            'online',
            'wallet',
            'cheque',
            'other'
        ];

        const allowedStatuses = [
            'unpaid',
            'partially_paid',
            'paid',
            'refunded',
            'partially_refunded'
        ];

        const {
            payment_method,
            payment_status,
            amount,
            transaction_reference,
            payment_date,
            notes
        } = req.body;

        if (
            payment_method !== undefined &&
            !allowedMethods.includes(payment_method)
        ) {
            return res.status(400).json({
                message: 'Invalid payment method'
            });
        }

        if (
            payment_status !== undefined &&
            !allowedStatuses.includes(payment_status)
        ) {
            return res.status(400).json({
                message: 'Invalid payment status',
                allowed_statuses: allowedStatuses
            });
        }

        if (
            amount !== undefined &&
            (
                !Number.isFinite(Number(amount)) ||
                Number(amount) <= 0
            )
        ) {
            return res.status(400).json({
                message: 'Payment amount must be greater than zero'
            });
        }

        if (
            notes !== undefined &&
            notes !== null &&
            typeof notes !== 'string'
        ) {
            return res.status(400).json({
                message: 'Notes must be a string or null'
            });
        }

        if (
            transaction_reference !== undefined &&
            transaction_reference !== null &&
            typeof transaction_reference !== 'string'
        ) {
            return res.status(400).json({
                message: 'Transaction reference must be a string or null'
            });
        }

        transaction = await Payment.sequelize.transaction();

        const payment = await Payment.findByPk(id, {
            transaction,
            lock: transaction.LOCK.UPDATE
        });

        if (!payment) {
            await transaction.rollback();
            transaction = null;

            return res.status(404).json({
                message: 'Payment not found'
            });
        }

        const oldValues = {
            payment_method: payment.payment_method,
            payment_status: payment.payment_status,
            amount: payment.amount,
            payment_date: payment.payment_date
        };

        const changes = {};

        for (const field of allowedFields) {
            if (req.body[field] !== undefined) {
                changes[field] = req.body[field];
            }
        }

        if (Object.keys(changes).length === 0) {
            await transaction.rollback();
            transaction = null;

            return res.status(400).json({
                message: 'No valid fields provided for update'
            });
        }

        if (
            changes.payment_status === 'paid' &&
            !changes.payment_date &&
            !payment.payment_date
        ) {
            changes.payment_date = new Date();
        }

        await payment.update(changes, { transaction });

        const newValues = {
            payment_method: payment.payment_method,
            payment_status: payment.payment_status,
            amount: payment.amount,
            payment_date: payment.payment_date
        };

        await recordAuditLog({
            userId: req.user.id,
            action: 'PAYMENT_UPDATED',
            module: 'payments',
            entityType: 'payment',
            entityId: payment.id,
            description: `Payment ${payment.payment_reference} updated`,
            oldValues,
            newValues,
            ipAddress: req.ip || null,
            userAgent: req.get('user-agent') || null,
            requestId: null,
            transaction
        });

        await transaction.commit();
        transaction = null;

        const updatedPayment = await Payment.findByPk(id, {
            include: [
                {
                    model: Order,
                    as: 'order'
                },
                {
                    model: User,
                    as: 'processor',
                    attributes: {
                        exclude: ['password', 'password_hash']
                    }
                }
            ]
        });

        return res.status(200).json({
            message: 'Payment updated successfully',
            data: updatedPayment
        });
    } catch (error) {
        if (transaction && !transaction.finished) {
            try {
                await transaction.rollback();
            } catch (rollbackError) {
                console.error(
                    'Payment update rollback error:',
                    rollbackError
                );
            }
        }

        console.error('Update payment error:', error);

        return res.status(500).json({
            message: 'Failed to update payment'
        });
    }
};




const deletePayment = async (req, res) => {
    return res.status(405).json({
        message:
            'Payments cannot be permanently deleted. Use an authorized void or reversal workflow.'
    });
};



module.exports = {
    getPayments,
    getPaymentById,
    createPayment,
    updatePayment,
    deletePayment,
    updatePaymentStatus
};
