'use strict';

const { Payment, Order, User } = require('../models');
const { recordAuditLog } = require('../services/auditLogService');


const updatePaymentStatus = async (req, res) => {
    let transaction;

    try {
        const { id } = req.params;
        const { payment_status } = req.body;

        const allowedStatuses = [
            'unpaid',
            'partially_paid',
            'paid',
            'refunded',
            'partially_refunded'
        ];

        if (!/^[1-9]\d*$/.test(id)) {
            return res.status(400).json({
                message: 'Invalid payment ID'
            });
        }

        if (!allowedStatuses.includes(payment_status)) {
            return res.status(400).json({
                message: 'Invalid payment status',
                allowed_statuses: allowedStatuses
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

        const oldStatus = payment.payment_status;

        if (oldStatus === payment_status) {
            await transaction.commit();
            transaction = null;

            return res.status(200).json({
                message: 'Payment status unchanged',
                data: payment
            });
        }

        const oldPaymentDate = payment.payment_date;

        payment.payment_status = payment_status;

        if (payment_status === 'paid' && !payment.payment_date) {
            payment.payment_date = new Date();
        }

        await payment.save({ transaction });

        await recordAuditLog({
            userId: req.user ? req.user.id : null,
            action: 'PAYMENT_STATUS_UPDATED',
            module: 'payments',
            entityType: 'payment',
            entityId: payment.id,
            description: `Payment status changed from ${oldStatus} to ${payment_status}`,
            oldValues: {
                payment_status: oldStatus,
                payment_date: oldPaymentDate
            },
            newValues: {
                payment_status: payment.payment_status,
                payment_date: payment.payment_date
            },
            ipAddress: req.ip || null,
            userAgent: req.get('user-agent') || null,
            requestId: null,
            transaction
        });

        await transaction.commit();
        transaction = null;

        return res.status(200).json({
            message: 'Payment status updated successfully',
            data: payment
        });
    } catch (error) {
        if (transaction && !transaction.finished) {
            try {
                await transaction.rollback();
            } catch (rollbackError) {
                console.error(
                    'Payment status rollback error:',
                    rollbackError
                );
            }
        }

        console.error('Update payment status error:', error);

        return res.status(500).json({
            message: 'Failed to update payment status'
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

        if (
            payment_status !== undefined &&
            !allowedStatuses.includes(payment_status)
        ) {
            return res.status(400).json({
                message: 'Invalid payment status',
                allowed_statuses: allowedStatuses
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

        const allowedFields = [
            'payment_method',
            'payment_status',
            'amount',
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
