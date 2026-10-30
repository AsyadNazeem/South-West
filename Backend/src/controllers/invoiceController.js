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


module.exports = {
    getInvoices,
    getInvoiceById
};
