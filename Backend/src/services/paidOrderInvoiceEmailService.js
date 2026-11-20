'use strict';

const { Op, literal } = require('sequelize');
const { Invoice } = require('../models');
const { sendOrderConfirmationEmail } = require('./emailService');
const {
    generateInvoiceDocument,
    loadOrderInvoiceData
} = require('./invoicePdfService');
const { deriveInvoiceLifecycle } = require('./invoicePresentationService');

const ONLINE_METHODS = new Set(['card', 'koko', 'mintpay']);

const plain = record => typeof record?.toJSON === 'function'
    ? record.toJSON()
    : record;

function emailDetails(order, invoice, payment, attachment) {
    const shipping = (order.addresses || []).find(
        address => address.address_type === 'shipping'
    ) || order.addresses?.[0] || {};
    const customerName = shipping.recipient_name || [
        order.customer?.first_name,
        order.customer?.last_name
    ].filter(Boolean).join(' ') || 'Customer';

    return {
        orderNumber: order.order_number,
        customerName,
        customerEmail: order.customer_email || order.customer?.email || null,
        phone: shipping.phone || null,
        address: shipping,
        items: (order.items || []).map(entry => ({
            name: entry.item?.item_name || entry.name || 'Product',
            variantName: entry.variant?.variant_name || entry.variant_name || '',
            quantity: entry.quantity,
            unitPrice: entry.unit_price,
            lineTotal: entry.line_total
        })),
        subtotal: invoice.subtotal,
        discountAmount: invoice.discount_amount,
        shippingAmount: invoice.shipping_amount,
        totalAmount: invoice.total_amount,
        paymentMethod: payment.payment_method,
        paymentStatus: payment.payment_status,
        invoiceAttachment: attachment
    };
}

async function sendPaidOrderConfirmationWithInvoice(orderId) {
    const orderRecord = await loadOrderInvoiceData(orderId);
    if (!orderRecord) return { status: 'skipped', reason: 'order_not_found' };

    const order = plain(orderRecord);
    const invoice = [...(order.invoices || [])].sort(
        (left, right) => Number(left.id || 0) - Number(right.id || 0)
    )[0];
    if (!invoice) return { status: 'skipped', reason: 'invoice_not_found' };

    const paidPayments = (order.payments || []).filter(
        payment => payment.payment_status === 'paid'
    );
    const payment = paidPayments.find(record =>
        ONLINE_METHODS.has(String(record.payment_method || '').toLowerCase())
    );
    if (!payment) {
        return { status: 'skipped', reason: 'verified_online_payment_not_found' };
    }

    const lifecycle = deriveInvoiceLifecycle({ ...invoice, order });
    if (order.payment_status !== 'paid' || !lifecycle.is_final) {
        return { status: 'skipped', reason: 'invoice_not_final' };
    }

    const recipient = order.customer_email || order.customer?.email;
    if (!recipient) return { status: 'skipped', reason: 'customer_email_missing' };
    if (invoice.final_email_status === 'sent') {
        return { status: 'skipped', reason: 'already_sent' };
    }

    const document = await generateInvoiceDocument(invoice, order);
    if (document.documentStatus !== 'final') {
        return { status: 'skipped', reason: 'invoice_not_final' };
    }

    const now = new Date();
    const [claimed] = await Invoice.update({
        final_email_status: 'sending',
        final_email_claimed_at: now,
        final_email_attempts: literal('final_email_attempts + 1'),
        final_email_last_error: null
    }, {
        where: {
            id: invoice.id,
            [Op.or]: [
                { final_email_status: null },
                { final_email_status: 'failed' }
            ]
        }
    });

    if (claimed !== 1) {
        return { status: 'skipped', reason: 'already_claimed' };
    }

    try {
        await sendOrderConfirmationEmail(emailDetails(order, invoice, payment, {
            filename: document.filename,
            content: document.content,
            contentType: document.contentType
        }));
        await Invoice.update({
            final_email_status: 'sent',
            final_email_sent_at: new Date(),
            final_email_last_error: null
        }, { where: { id: invoice.id, final_email_status: 'sending' } });
        return {
            status: 'sent',
            invoiceId: invoice.id,
            invoiceNumber: invoice.invoice_number
        };
    } catch (error) {
        const safeMessage = [error?.name || 'Error', error?.code]
            .filter(Boolean)
            .join(': ')
            .slice(0, 500);
        await Invoice.update({
            final_email_status: 'failed',
            final_email_last_error: safeMessage
        }, { where: { id: invoice.id, final_email_status: 'sending' } });
        console.error('Paid order invoice email failed:', {
            orderId: String(orderId),
            invoiceId: String(invoice.id),
            name: error?.name || 'Error'
        });
        return { status: 'failed', reason: 'email_delivery_failed' };
    }
}

// Future verified Card/Koko/Mintpay callbacks should invoke this only after
// their payment and order status transaction has committed successfully.
module.exports = { sendPaidOrderConfirmationWithInvoice };
