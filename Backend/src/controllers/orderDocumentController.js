'use strict';

const crypto = require('crypto');
const {
    Order,
    Invoice,
    OrderItem,
    OrderAddress,
    Payment,
    Customer,
    GuestCheckoutSession,
    GuestCheckoutIdempotency
} = require('../models');
const { generateInvoicePdf, invoiceFilename } = require('../services/invoicePdfService');

function hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

function orderIncludes() {
    return [
        { model: OrderItem, as: 'items', include: [
            { model: require('../models').Item, as: 'item', attributes: ['item_name'] },
            { model: require('../models').ItemVariant, as: 'variant', attributes: ['variant_name'] }
        ] },
        { model: OrderAddress, as: 'addresses' },
        { model: Payment, as: 'payments' },
        { model: Customer, as: 'customer', attributes: ['id', 'first_name', 'last_name', 'email'] },
        { model: Invoice, as: 'invoices' }
    ];
}

async function sendOrderDocument(req, res, order, requestedId) {
    if (!order) return res.status(404).json({ message: 'Order not found.' });
    const payment = (order.payments || []).find(item => item.payment_status === 'paid') || order.payments?.[0];
    const paid = order.payment_status === 'paid' && payment?.payment_status === 'paid';
    const cash = payment?.payment_method === 'cash';
    if (!paid && !cash) {
        return res.status(409).json({ message: 'A downloadable invoice is not available until payment is confirmed.' });
    }
    const invoice = (order.invoices || []).find(item => item.status === 'paid') || order.invoices?.[0];
    if (!invoice) return res.status(404).json({ message: 'Order document is unavailable.' });
    try {
        const buffer = await generateInvoicePdf({
            ...order.toJSON(),
            invoice_number: invoice.invoice_number,
            payment_status: paid ? 'paid' : 'unpaid'
        }, { draft: !paid });
        res.status(200)
            .type('application/pdf')
            .attachment(invoiceFilename(order.order_number, !paid))
            .send(buffer);
    } catch (error) {
        console.error('Order document generation failed:', error.message);
        return res.status(500).json({ message: 'Unable to generate the order document.' });
    }
}

async function getCustomerOrderDocument(req, res) {
    try {
        if (!/^[1-9]\d*$/.test(String(req.params.orderId || ''))) {
            return res.status(404).json({ message: 'Order not found.' });
        }
        const order = await Order.findOne({
            where: { id: req.params.orderId, customer_id: req.customer.id, order_type: 'online' },
            include: orderIncludes()
        });
        return await sendOrderDocument(req, res, order, req.params.orderId);
    } catch (error) {
        console.error('Customer order document lookup failed:', error.message);
        return res.status(500).json({ message: 'Unable to retrieve the order document.' });
    }
}

async function getGuestOrderDocument(req, res) {
    try {
        const token = req.get('x-guest-checkout-token');
        if (typeof token !== 'string' || !/^[a-f0-9]{64}$/i.test(token) || !/^[1-9]\d*$/.test(String(req.params.orderId || ''))) {
            return res.status(404).json({ message: 'Order not found.' });
        }
        const session = await GuestCheckoutSession.findOne({
            where: { token_hash: hashToken(token) }
        });
        if (!session) return res.status(404).json({ message: 'Order not found.' });
        const link = await GuestCheckoutIdempotency.findOne({
            where: {
                guest_checkout_session_id: session.id,
                order_id: req.params.orderId
            }
        });
        if (!link) return res.status(404).json({ message: 'Order not found.' });
        const order = await Order.findOne({
            where: { id: req.params.orderId, customer_id: null, order_type: 'online' },
            include: orderIncludes()
        });
        return await sendOrderDocument(req, res, order, req.params.orderId);
    } catch (error) {
        console.error('Guest order document lookup failed:', error.message);
        return res.status(500).json({ message: 'Unable to retrieve the order document.' });
    }
}

module.exports = { getCustomerOrderDocument, getGuestOrderDocument };
