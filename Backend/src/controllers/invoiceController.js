'use strict';

const { Op } = require('sequelize');
const {
    Invoice, Order, Customer, OrderItem, OrderAddress, Payment, Delivery,
    DeliveryArea, DeliveryDistrict, Item, ItemVariant
} = require('../models');
const {
    generateInvoiceDocument, getCompanyDetails
} = require('../services/invoicePdfService');
const {
    filterInvoiceSummaries, invoiceDetail, invoiceSummary
} = require('../services/invoicePresentationService');
const { buildOrderPhoneSearch } = require('../utils/orderPhoneSearch');

const PAYMENT_METHODS = [
    'cash', 'card', 'bank_transfer', 'online', 'wallet', 'cheque', 'other',
    'koko', 'mintpay'
];
const INVOICE_STATUSES = [
    'draft', 'issued', 'partially_paid', 'paid', 'overdue', 'cancelled',
    'refunded'
];

const validId = value => /^[1-9]\d*$/.test(String(value || ''));

function listIncludes() {
    return [
        {
            model: Order,
            as: 'order',
            attributes: [
                'id', 'order_number', 'status', 'fulfillment_status',
                'payment_status', 'total_amount'
            ],
            required: true,
            include: [
                {
                    model: Payment,
                    as: 'payments',
                    attributes: [
                        'payment_method', 'payment_status', 'amount',
                        'payment_reference', 'transaction_reference', 'payment_date'
                    ],
                    required: false,
                    separate: true
                },
                {
                    model: Delivery,
                    as: 'deliveries',
                    attributes: ['delivery_status'],
                    required: false,
                    separate: true
                },
                {
                    model: OrderAddress,
                    as: 'addresses',
                    attributes: ['address_type', 'recipient_name'],
                    required: false,
                    separate: true
                }
            ]
        },
        {
            model: Customer,
            as: 'customer',
            attributes: ['id', 'first_name', 'last_name'],
            required: false
        }
    ];
}

function detailIncludes() {
    return [
        {
            model: Order,
            as: 'order',
            required: true,
            include: [
                {
                    model: OrderItem,
                    as: 'items',
                    required: false,
                    include: [
                        {
                            model: Item,
                            as: 'item',
                            attributes: ['id', 'item_name', 'item_code'],
                            required: false
                        },
                        {
                            model: ItemVariant,
                            as: 'variant',
                            attributes: [
                                'id', 'variant_sku', 'variant_name', 'attributes'
                            ],
                            required: false
                        }
                    ]
                },
                {
                    model: OrderAddress,
                    as: 'addresses',
                    required: false,
                    include: [{
                        model: DeliveryArea,
                        as: 'area',
                        attributes: ['id', 'area_name'],
                        required: false
                    }, {
                        model: DeliveryDistrict,
                        as: 'district',
                        attributes: ['id', 'district_name'],
                        required: false
                    }]
                },
                { model: Payment, as: 'payments', required: false },
                { model: Delivery, as: 'deliveries', required: false }
            ]
        },
        {
            model: Customer,
            as: 'customer',
            attributes: ['id', 'first_name', 'last_name', 'email', 'phone'],
            required: false
        }
    ];
}

async function getInvoices(req, res) {
    try {
        const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
        const pageSize = Math.min(
            100,
            Math.max(1, Number.parseInt(req.query.pageSize ?? req.query.limit, 10) || 25)
        );
        const search = String(req.query.search || '').trim();
        const orderNumber = String(req.query.orderNumber || '').trim();
        const paymentMethod = String(req.query.paymentMethod || '').trim();
        const requestedStatus = String(req.query.status || '').trim();

        if (paymentMethod && !PAYMENT_METHODS.includes(paymentMethod)) {
            return res.status(400).json({ message: 'Invalid payment method filter.' });
        }

        const where = {};
        let replacements;
        if (search) {
            where[Op.or] = [
                { invoice_number: { [Op.like]: `%${search}%` } },
                { '$order.order_number$': { [Op.like]: `%${search}%` } },
                { '$customer.first_name$': { [Op.like]: `%${search}%` } },
                { '$customer.last_name$': { [Op.like]: `%${search}%` } }
            ];
            const phoneSearch = buildOrderPhoneSearch(search, {
                orderAlias: 'order',
                replacementPrefix: 'invoicePhone'
            });
            if (phoneSearch) where[Op.or].push(phoneSearch.condition);
            replacements = phoneSearch?.replacements;
        }
        if (orderNumber) {
            where['$order.order_number$'] = { [Op.like]: `%${orderNumber}%` };
        }
        if (
            requestedStatus &&
            !['final', 'draft', ...INVOICE_STATUSES].includes(requestedStatus)
        ) {
            return res.status(400).json({ message: 'Invalid invoice status filter.' });
        }

        const lifecycleFilterEnabled = Boolean(paymentMethod || requestedStatus);
        const result = await Invoice.findAndCountAll({
            where,
            include: listIncludes(),
            order: [['created_at', 'DESC'], ['id', 'DESC']],
            limit: lifecycleFilterEnabled ? undefined : pageSize,
            offset: lifecycleFilterEnabled ? undefined : (page - 1) * pageSize,
            distinct: true,
            subQuery: false,
            replacements
        });
        let summaries = result.rows.map(invoiceSummary);
        if (lifecycleFilterEnabled) {
            summaries = filterInvoiceSummaries(summaries, {
                paymentMethod,
                status: requestedStatus
            });
        }

        const total = lifecycleFilterEnabled ? summaries.length : result.count;
        if (lifecycleFilterEnabled) {
            const offset = (page - 1) * pageSize;
            summaries = summaries.slice(offset, offset + pageSize);
        }

        return res.status(200).json({
            message: 'Invoices retrieved successfully',
            data: summaries,
            pagination: {
                page,
                pageSize,
                total,
                totalPages: Math.ceil(total / pageSize)
            }
        });
    } catch (error) {
        console.error('Get invoices error:', error);
        return res.status(500).json({ message: 'Failed to retrieve invoices' });
    }
}

const findInvoice = id => Invoice.findByPk(id, { include: detailIncludes() });

async function getInvoiceById(req, res) {
    try {
        if (!validId(req.params.id)) {
            return res.status(404).json({ message: 'Invoice not found' });
        }
        const invoice = await findInvoice(req.params.id);
        if (!invoice) {
            return res.status(404).json({ message: 'Invoice not found' });
        }
        return res.status(200).json({
            message: 'Invoice retrieved successfully',
            data: invoiceDetail(invoice, getCompanyDetails())
        });
    } catch (error) {
        console.error('Get invoice error:', error);
        return res.status(500).json({ message: 'Failed to retrieve invoice' });
    }
}

async function downloadInvoicePdf(req, res) {
    try {
        if (!validId(req.params.id)) {
            return res.status(404).json({ message: 'Invoice not found' });
        }
        const invoice = await findInvoice(req.params.id);
        if (!invoice) {
            return res.status(404).json({ message: 'Invoice not found' });
        }

        const document = await generateInvoiceDocument(invoice);

        res.status(200).type('application/pdf');
        res.set(
            'Content-Disposition',
            `${req.query.download === '1' ? 'attachment' : 'inline'}; filename="${document.filename}"`
        );
        return res.send(document.content);
    } catch (error) {
        console.error('Generate admin invoice PDF error:', error);
        return res.status(500).json({ message: 'Unable to generate invoice PDF' });
    }
}

module.exports = { downloadInvoicePdf, getInvoiceById, getInvoices };
