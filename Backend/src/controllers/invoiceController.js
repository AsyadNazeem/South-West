'use strict';
const { recordAuditLog } = require('../services/auditLogService');
const { Invoice, Order, Customer, User, sequelize } = require('../models');

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
            notes
        } = req.body || {};

        const allowedFields = [
            'invoice_number',
            'order_id',
            'customer_id',
            'invoice_date',
            'due_date',
            'notes'
        ];

        const unsupportedFields = Object.keys(req.body || {}).filter(
            field => !allowedFields.includes(field)
        );

        if (unsupportedFields.length > 0) {
            return res.status(400).json({
                message: 'Unsupported invoice creation fields',
                fields: unsupportedFields
            });
        }

        if (!invoice_number || !String(invoice_number).trim()) {
            return res.status(400).json({
                message: 'Invoice number is required'
            });
        }

        if (!/^[1-9]\d*$/.test(String(order_id))) {
            return res.status(400).json({
                message: 'A valid order ID is required'
            });
        }

        if (
            invoice_date !== undefined &&
            Number.isNaN(Date.parse(invoice_date))
        ) {
            return res.status(400).json({
                message: 'Invalid invoice date'
            });
        }

        if (
            due_date !== undefined &&
            due_date !== null &&
            Number.isNaN(Date.parse(due_date))
        ) {
            return res.status(400).json({
                message: 'Invalid due date'
            });
        }

        const existingInvoice = await Invoice.findOne({
            where: { invoice_number: String(invoice_number).trim() }
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

        if (
            customer_id !== undefined &&
            customer_id !== null &&
            !/^[1-9]\d*$/.test(String(customer_id))
        ) {
            return res.status(400).json({
                message: 'Invalid customer ID'
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

        // Only one invoice per order is allowed by this workflow.
        const orderInvoice = await Invoice.findOne({
            where: { order_id }
        });

        if (orderInvoice) {
            return res.status(409).json({
                message: 'An invoice already exists for this order'
            });
        }

        const total = Number(order.total_amount);

        if (!Number.isFinite(total) || total < 0) {
            return res.status(409).json({
                message: 'Order has an invalid total amount'
            });
        }

        const invoice = await sequelize.transaction(async (transaction) => {
            const createdInvoice = await Invoice.create(
                {
                    invoice_number: String(invoice_number).trim(),
                    order_id: order.id,
                    customer_id: customer_id || order.customer_id || null,
                    invoice_date: invoice_date || new Date(),
                    due_date: due_date || null,
                    status: 'issued',
                    subtotal: order.subtotal,
                    discount_amount: order.discount_amount,
                    tax_amount: order.tax_amount,
                    shipping_amount: order.shipping_amount,
                    total_amount: order.total_amount,
                    paid_amount: 0,
                    balance_amount: total,
                    notes: notes || null,
                    created_by: req.user.id
                },
                { transaction }
            );

            await recordAuditLog({
                userId: req.user.id,
                action: 'INVOICE_CREATED',
                module: 'invoices',
                entityType: 'invoice',
                entityId: createdInvoice.id,
                description: `Invoice ${createdInvoice.invoice_number} created`,
                newValues: {
                    invoice_number: createdInvoice.invoice_number,
                    order_id: createdInvoice.order_id,
                    customer_id: createdInvoice.customer_id,
                    status: createdInvoice.status,
                    total_amount: createdInvoice.total_amount
                },
                ipAddress: req.ip || null,
                userAgent: req.get('user-agent') || null,
                requestId: req.id || null,
                transaction
            });

            return createdInvoice;
        });

        return res.status(201).json({
            message: 'Invoice created successfully',
            data: invoice
        });


    } catch (error) {
        console.error('Create invoice error:', error);

        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(409).json({
                message: 'Invoice number already exists'
            });
        }

        return res.status(500).json({
            message: 'Failed to create invoice'
        });
    }
};


// PUT /api/invoices/:id
const updateInvoice = async (req, res) => {
    try {
        const { id } = req.params;

        const allowedFields = [
            'invoice_number',
            'customer_id',
            'invoice_date',
            'due_date',
            'notes'
        ];

        const receivedFields = Object.keys(req.body || {});
        const unsupportedFields = receivedFields.filter(
            field => !allowedFields.includes(field)
        );

        if (unsupportedFields.length > 0) {
            return res.status(400).json({
                message: 'Unsupported invoice update fields',
                fields: unsupportedFields
            });
        }

        if (receivedFields.length === 0) {
            return res.status(400).json({
                message: 'No fields provided for update'
            });
        }

        const invoice = await sequelize.transaction(async (transaction) => {
            const currentInvoice = await Invoice.findByPk(id, {
                transaction,
                lock: transaction.LOCK.UPDATE
            });

            if (!currentInvoice) {
                const error = new Error('Invoice not found');
                error.code = 'INVOICE_NOT_FOUND';
                throw error;
            }

            const updates = {};

            for (const field of allowedFields) {
                if (req.body[field] !== undefined) {
                    updates[field] = req.body[field];
                }
            }

            if (
                updates.invoice_number !== undefined &&
                String(updates.invoice_number) !== currentInvoice.invoice_number
            ) {
                const existingInvoice = await Invoice.findOne({
                    where: {
                        invoice_number: updates.invoice_number
                    },
                    transaction
                });

                if (existingInvoice) {
                    const error = new Error('Invoice number already exists');
                    error.code = 'INVOICE_NUMBER_EXISTS';
                    throw error;
                }
            }

            if (
                updates.customer_id !== undefined &&
                updates.customer_id !== null &&
                updates.customer_id !== ''
            ) {
                if (!/^[1-9]\d*$/.test(String(updates.customer_id))) {
                    const error = new Error('Invalid customer ID');
                    error.code = 'INVALID_CUSTOMER_ID';
                    throw error;
                }

                const customer = await Customer.findByPk(
                    updates.customer_id,
                    { transaction }
                );

                if (!customer) {
                    const error = new Error('Customer not found');
                    error.code = 'CUSTOMER_NOT_FOUND';
                    throw error;
                }
            }

            if (
                updates.invoice_date !== undefined &&
                Number.isNaN(Date.parse(updates.invoice_date))
            ) {
                const error = new Error('Invalid invoice date');
                error.code = 'INVALID_INVOICE_DATE';
                throw error;
            }

            if (
                updates.due_date !== undefined &&
                updates.due_date !== null &&
                Number.isNaN(Date.parse(updates.due_date))
            ) {
                const error = new Error('Invalid due date');
                error.code = 'INVALID_DUE_DATE';
                throw error;
            }

            const oldValues = {
                invoice_number: currentInvoice.invoice_number,
                customer_id: currentInvoice.customer_id,
                invoice_date: currentInvoice.invoice_date,
                due_date: currentInvoice.due_date,
                notes: currentInvoice.notes
            };

            await currentInvoice.update(updates, { transaction });

            await recordAuditLog({
                userId: req.user.id,
                action: 'INVOICE_UPDATED',
                module: 'invoices',
                entityType: 'invoice',
                entityId: currentInvoice.id,
                description: `Invoice ${currentInvoice.invoice_number} updated`,
                oldValues,
                newValues: {
                    invoice_number: currentInvoice.invoice_number,
                    customer_id: currentInvoice.customer_id,
                    invoice_date: currentInvoice.invoice_date,
                    due_date: currentInvoice.due_date,
                    notes: currentInvoice.notes
                },
                ipAddress: req.ip || null,
                userAgent: req.get('user-agent') || null,
                requestId: req.id || null,
                transaction
            });

            return currentInvoice;
        });

        return res.status(200).json({
            message: 'Invoice updated successfully',
            data: invoice
        });
    } catch (error) {
        console.error('Update invoice error:', error);

        if (error.code === 'INVOICE_NOT_FOUND') {
            return res.status(404).json({
                message: 'Invoice not found'
            });
        }

        if (error.code === 'INVOICE_NUMBER_EXISTS') {
            return res.status(409).json({
                message: 'Invoice number already exists'
            });
        }

        if (error.code === 'CUSTOMER_NOT_FOUND') {
            return res.status(404).json({
                message: 'Customer not found'
            });
        }

        if (error.code === 'INVALID_CUSTOMER_ID') {
            return res.status(400).json({
                message: 'Invalid customer ID'
            });
        }

        if (error.code === 'INVALID_INVOICE_DATE') {
            return res.status(400).json({
                message: 'Invalid invoice date'
            });
        }

        if (error.code === 'INVALID_DUE_DATE') {
            return res.status(400).json({
                message: 'Invalid due date'
            });
        }

        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(409).json({
                message: 'Invoice number already exists'
            });
        }

        return res.status(500).json({
            message: 'Failed to update invoice'
        });
    }
};


// DELETE /api/invoices/:id

const deleteInvoice = async (req, res) => {
    return res.status(405).json({
        message:
            'Invoices cannot be permanently deleted. Use an authorized cancellation workflow.'
    });
};



module.exports = {
    getInvoices,
    getInvoiceById,
    createInvoice,
    updateInvoice,
    deleteInvoice
};
