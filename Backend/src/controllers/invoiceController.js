'use strict';
const { Op } = require('sequelize');
const { Invoice, Order, Customer, User } = require('../models');

// GET /api/invoices
const getInvoices = async (req, res) => {
    try {
        const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
        const pageSize = Math.min(100, Math.max(1, Number.parseInt(req.query.pageSize ?? req.query.limit, 10) || 25));
        const paginationEnabled = req.query.page !== undefined || req.query.pageSize !== undefined || req.query.limit !== undefined;
        const search = String(req.query.search || '').trim();
        const where = {};
        if (search) where[Op.or] = [
            { invoice_number: { [Op.like]: `%${search}%` } },
            { '$order.order_number$': { [Op.like]: `%${search}%` } },
            { '$customer.first_name$': { [Op.like]: `%${search}%` } },
            { '$customer.last_name$': { [Op.like]: `%${search}%` } },
        ];
        if (req.query.status) where.status = req.query.status;
        const result = await Invoice.findAndCountAll({
            where,
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
            order: [['created_at', 'DESC']],
            limit: paginationEnabled ? pageSize : undefined,
            offset: paginationEnabled ? (page - 1) * pageSize : undefined,
            distinct: true
        });
        const invoices = result.rows;

        return res.status(200).json({
            message: 'Invoices retrieved successfully',
            data: invoices,
            pagination: { page, pageSize, total: result.count, totalPages: Math.ceil(result.count / pageSize) }
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
