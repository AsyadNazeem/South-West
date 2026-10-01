'use strict';

const { Invoice, Order, Customer, User } = require('../models');

// GET /api/invoices
const getInvoices = async (req, res) => {
    try {
        const invoices = await Invoice.findAll({
            include: [
                {
                    model: Order,
                    as: 'order'
                },
                {
                    model: Customer,
                    as: 'customer'
                },
                {
                    model: User,
                    as: 'creator',
                    attributes: {
                        exclude: ['password_hash']
                    }
                }
            ],
            order: [['created_at', 'DESC']]
        });

        return res.status(200).json({
            message: 'Invoices retrieved successfully',
            data: invoices
        });
    } catch (error) {
        console.error('Get invoices error:', error);

        return res.status(500).json({
            message: 'Failed to retrieve invoices'
        });
    }
};


// GET /api/invoices/:id
const getInvoiceById = async (req, res) => {
    try {
        const { id } = req.params;

        const invoice = await Invoice.findByPk(id, {
            include: [
                {
                    model: Order,
                    as: 'order'
                },
                {
                    model: Customer,
                    as: 'customer'
                },
                {
                    model: User,
                    as: 'creator',
                    attributes: {
                        exclude: ['password_hash']
                    }
                }
            ]
        });

        if (!invoice) {
            return res.status(404).json({
                message: 'Invoice not found'
            });
        }

        return res.status(200).json({
            message: 'Invoice retrieved successfully',
            data: invoice
        });
    } catch (error) {
        console.error('Get invoice error:', error);

        return res.status(500).json({
            message: 'Failed to retrieve invoice'
        });
    }
};


// POST /api/invoices
const createInvoice = async (req, res) => {
    try {
        const {
            invoice_number,
            order_id,
            customer_id,
            invoice_date,
            due_date,
            status,
            subtotal,
            discount_amount,
            tax_amount,
            shipping_amount,
            total_amount,
            paid_amount,
            balance_amount,
            notes
        } = req.body;

        if (!invoice_number) {
            return res.status(400).json({
                message: 'Invoice number is required'
            });
        }

        if (!order_id) {
            return res.status(400).json({
                message: 'Order ID is required'
            });
        }

        if (!invoice_date) {
            return res.status(400).json({
                message: 'Invoice date is required'
            });
        }

        const existingInvoice = await Invoice.findOne({
            where: {
                invoice_number
            }
        });

        if (existingInvoice) {
            return res.status(409).json({
                message: 'Invoice number already exists'
            });
        }

        const order = await Order.findByPk(order_id);

        if (!order) {
            return res.status(404).json({
                message: 'Order not found'
            });
        }

        if (customer_id) {
            const customer = await Customer.findByPk(customer_id);

            if (!customer) {
                return res.status(404).json({
                    message: 'Customer not found'
                });
            }
        }

        const invoice = await Invoice.create({
            invoice_number,
            order_id,
            customer_id: customer_id || null,
            invoice_date,
            due_date: due_date || null,
            status: status || 'draft',
            subtotal: subtotal || 0,
            discount_amount: discount_amount || 0,
            tax_amount: tax_amount || 0,
            shipping_amount: shipping_amount || 0,
            total_amount: total_amount || 0,
            paid_amount: paid_amount || 0,
            balance_amount: balance_amount || 0,
            notes: notes || null,
            created_by: req.user.id
        });

        return res.status(201).json({
            message: 'Invoice created successfully',
            data: invoice
        });
    } catch (error) {
        console.error('Create invoice error:', error);

        return res.status(500).json({
            message: 'Failed to create invoice'
        });
    }
};


// PUT /api/invoices/:id
const updateInvoice = async (req, res) => {
    try {
        const { id } = req.params;

        const invoice = await Invoice.findByPk(id);

        if (!invoice) {
            return res.status(404).json({
                message: 'Invoice not found'
            });
        }

        const allowedFields = [
            'invoice_number',
            'customer_id',
            'invoice_date',
            'due_date',
            'status',
            'subtotal',
            'discount_amount',
            'tax_amount',
            'shipping_amount',
            'total_amount',
            'paid_amount',
            'balance_amount',
            'notes'
        ];

        const updates = {};

        for (const field of allowedFields) {
            if (req.body[field] !== undefined) {
                updates[field] = req.body[field];
            }
        }

        if (
            updates.invoice_number &&
            updates.invoice_number !== invoice.invoice_number
        ) {
            const existingInvoice = await Invoice.findOne({
                where: {
                    invoice_number: updates.invoice_number
                }
            });

            if (existingInvoice) {
                return res.status(409).json({
                    message: 'Invoice number already exists'
                });
            }
        }

        if (updates.customer_id) {
            const customer = await Customer.findByPk(updates.customer_id);

            if (!customer) {
                return res.status(404).json({
                    message: 'Customer not found'
                });
            }
        }

        await invoice.update(updates);

        return res.status(200).json({
            message: 'Invoice updated successfully',
            data: invoice
        });
    } catch (error) {
        console.error('Update invoice error:', error);

        return res.status(500).json({
            message: 'Failed to update invoice'
        });
    }
};


// DELETE /api/invoices/:id
const deleteInvoice = async (req, res) => {
    try {
        const { id } = req.params;

        const invoice = await Invoice.findByPk(id);

        if (!invoice) {
            return res.status(404).json({
                message: 'Invoice not found'
            });
        }

        await invoice.destroy();

        return res.status(200).json({
            message: 'Invoice deleted successfully'
        });
    } catch (error) {
        console.error('Delete invoice error:', error);

        return res.status(500).json({
            message: 'Failed to delete invoice'
        });
    }
};


module.exports = {
    getInvoices,
    getInvoiceById,
    createInvoice,
    updateInvoice,
    deleteInvoice
};
