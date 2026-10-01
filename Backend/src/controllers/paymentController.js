'use strict';

const { Payment, Order, User } = require('../models');

const updatePaymentStatus = async (req, res) => {
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

        if (!allowedStatuses.includes(payment_status)) {
            return res.status(400).json({
                message: 'Invalid payment status',
                allowed_statuses: allowedStatuses
            });
        }

        const payment = await Payment.findByPk(id);

        if (!payment) {
            return res.status(404).json({
                message: 'Payment not found'
            });
        }

        payment.payment_status = payment_status;

        if (payment_status === 'paid' && !payment.payment_date) {
            payment.payment_date = new Date();
        }

        await payment.save();

        res.status(200).json({
            message: 'Payment status updated successfully',
            data: payment
        });

    } catch (error) {
        console.error('Update payment status error:', error);

        res.status(500).json({
            message: 'Failed to update payment status',
            error: error.message
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
            amount === undefined
        ) {
            return res.status(400).json({
                message: 'payment_reference, order_id, payment_method and amount are required'
            });
        }

        const order = await Order.findByPk(order_id);

        if (!order) {
            return res.status(404).json({
                message: 'Order not found'
            });
        }

        const existingPayment = await Payment.findOne({
            where: {
                payment_reference
            }
        });

        if (existingPayment) {
            return res.status(409).json({
                message: 'Payment reference already exists'
            });
        }

        const payment = await Payment.create({
            payment_reference,
            order_id,
            payment_method,
            payment_status: payment_status || 'pending',
            amount,
            transaction_reference: transaction_reference || null,
            payment_date: payment_date || null,
            notes: notes || null,
            processed_by: req.user.userId
        });

        await updateOrderPaymentStatus(payment.order_id);

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
                        exclude: ['password']
                    }
                }
            ]
        });

        res.status(201).json({
            message: 'Payment created successfully',
            data: createdPayment
        });
    } catch (error) {
        console.error('Create payment error:', error);

        res.status(500).json({
            message: 'Failed to create payment',
            error: error.message
        });
    }
};


const updatePayment = async (req, res) => {
    try {
        const { id } = req.params;

        const payment = await Payment.findByPk(id);

        if (!payment) {
            return res.status(404).json({
                message: 'Payment not found'
            });
        }

        const {
            payment_method,
            payment_status,
            amount,
            transaction_reference,
            payment_date,
            notes
        } = req.body;

        await payment.update({
            payment_method: payment_method ?? payment.payment_method,
            payment_status: payment_status ?? payment.payment_status,
            amount: amount ?? payment.amount,
            transaction_reference:
                transaction_reference ?? payment.transaction_reference,
            payment_date:
                payment_date ?? payment.payment_date,
            notes: notes ?? payment.notes,
            processed_by: req.user.userId
        });

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
                        exclude: ['password']
                    }
                }
            ]
        });

        res.status(200).json({
            message: 'Payment updated successfully',
            data: updatedPayment
        });
    } catch (error) {
        console.error('Update payment error:', error);

        res.status(500).json({
            message: 'Failed to update payment',
            error: error.message
        });
    }
};


const deletePayment = async (req, res) => {
    try {
        const { id } = req.params;

        const payment = await Payment.findByPk(id);

        if (!payment) {
            return res.status(404).json({
                message: 'Payment not found'
            });
        }

        await payment.destroy();

        res.status(200).json({
            message: 'Payment deleted successfully'
        });
    } catch (error) {
        console.error('Delete payment error:', error);

        res.status(500).json({
            message: 'Failed to delete payment',
            error: error.message
        });
    }
};


module.exports = {
    getPayments,
    getPaymentById,
    createPayment,
    updatePayment,
    deletePayment,
    updatePaymentStatus
};
