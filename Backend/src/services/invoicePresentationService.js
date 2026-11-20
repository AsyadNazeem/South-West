'use strict';

const cents = value => Math.round(Number(value || 0) * 100);
const amount = value => cents(value) / 100;
const amountFromCents = value => Number(value || 0) / 100;

const PAYMENT_LABELS = {
    cash: 'Cash on Delivery',
    card: 'Card',
    koko: 'Koko',
    mintpay: 'Mintpay',
    bank_transfer: 'Bank Transfer',
    online: 'Online',
    wallet: 'Wallet',
    cheque: 'Cheque',
    other: 'Other'
};

function paymentMethodLabel(value) {
    const key = String(value || '').toLowerCase();
    return PAYMENT_LABELS[key] || (value ? String(value) : 'Not recorded');
}

function isOrderCompleted(order) {
    if (order?.status === 'delivered' || order?.fulfillment_status === 'fulfilled') {
        return true;
    }

    const deliveries = Array.isArray(order?.deliveries) ? order.deliveries : [];
    return deliveries.length > 0 && deliveries.every(
        delivery => delivery.delivery_status === 'delivered'
    );
}

function deriveInvoiceLifecycle(invoice) {
    const order = invoice?.order || {};
    const payments = Array.isArray(order.payments) ? order.payments : [];
    const paidPayments = payments.filter(payment => payment.payment_status === 'paid');
    const paidAmountCents = paidPayments.reduce(
        (total, payment) => total + cents(payment.amount),
        0
    );
    const totalCents = cents(invoice?.total_amount ?? order.total_amount);
    const payment = paidPayments[0] || payments[0] || null;
    const method = payment?.payment_method || null;
    const fullyPaid =
        order.payment_status === 'paid' &&
        paidPayments.length > 0 &&
        paidAmountCents >= totalCents;
    const final = method === 'cash'
        ? fullyPaid && isOrderCompleted(order)
        : fullyPaid;

    let documentStatus = final ? 'final' : 'draft';
    if (order.payment_status === 'refunded' || invoice?.status === 'refunded') {
        documentStatus = 'refunded';
    } else if (order.payment_status === 'partially_refunded') {
        documentStatus = 'partially_refunded';
    } else if (order.status === 'cancelled' || invoice?.status === 'cancelled') {
        documentStatus = 'cancelled';
    } else if (order.status === 'returned') {
        documentStatus = 'returned';
    }

    return {
        document_status: documentStatus,
        is_final: documentStatus === 'final',
        payment_method: method,
        payment_method_label: paymentMethodLabel(method),
        payment_status: payment?.payment_status || order.payment_status || 'unpaid',
        payment_reference: payment?.payment_reference || payment?.transaction_reference || null,
        payment_date: payment?.payment_date || null,
        amount_paid: amountFromCents(paidAmountCents),
        outstanding_balance: amountFromCents(Math.max(0, totalCents - paidAmountCents))
    };
}

function invoiceSummary(invoice) {
    const data = typeof invoice?.toJSON === 'function' ? invoice.toJSON() : invoice;
    const lifecycle = deriveInvoiceLifecycle(data);
    const order = data.order || {};
    const shipping = (order.addresses || []).find(
        address => address.address_type === 'shipping'
    );
    const customerName = shipping?.recipient_name || [
        data.customer?.first_name,
        data.customer?.last_name
    ].filter(Boolean).join(' ') || 'Guest Customer';

    return {
        id: data.id,
        invoice_number: data.invoice_number,
        invoice_date: data.invoice_date,
        record_status: data.status,
        document_status: lifecycle.document_status,
        order_number: order.order_number || null,
        customer_name: customerName,
        payment_method: lifecycle.payment_method,
        payment_method_label: lifecycle.payment_method_label,
        total_amount: amount(data.total_amount),
        can_download_pdf: true
    };
}

function filterInvoiceSummaries(invoices, { paymentMethod, status } = {}) {
    return invoices.filter(invoice => {
        if (paymentMethod && invoice.payment_method !== paymentMethod) return false;
        if (status === 'draft' || status === 'final') {
            return invoice.document_status === status;
        }
        if (status) {
            return invoice.record_status === status || invoice.document_status === status;
        }
        return true;
    });
}

function invoiceDetail(invoice, business) {
    const data = typeof invoice?.toJSON === 'function' ? invoice.toJSON() : invoice;
    const order = data.order || {};
    const lifecycle = deriveInvoiceLifecycle(data);
    const shipping = (order.addresses || []).find(
        address => address.address_type === 'shipping'
    ) || null;
    const discount = amount(data.discount_amount);

    return {
        id: data.id,
        invoice_number: data.invoice_number,
        invoice_date: data.invoice_date,
        due_date: data.due_date,
        record_status: data.status,
        document_status: lifecycle.document_status,
        is_final: lifecycle.is_final,
        business,
        order: {
            id: order.id,
            order_number: order.order_number,
            order_date: order.order_date,
            status: order.status,
            fulfillment_status: order.fulfillment_status,
            payment_status: order.payment_status
        },
        customer: {
            name: shipping?.recipient_name || [
                data.customer?.first_name,
                data.customer?.last_name
            ].filter(Boolean).join(' ') || 'Guest Customer',
            phone: shipping?.phone || data.customer?.phone || null,
            email: order.customer_email || data.customer?.email || null
        },
        delivery_address: shipping ? {
            address_line_1: shipping.address_line_1 || null,
            address_line_2: shipping.address_line_2 || null,
            district: shipping.district?.district_name || null,
            area: shipping.area?.area_name || null,
            postal_code: shipping.postal_code || null
        } : null,
        items: (order.items || []).map(entry => ({
            id: entry.id,
            name: entry.item?.item_name || 'Product',
            sku: entry.variant?.variant_sku || entry.item?.item_code || null,
            variant: entry.variant?.variant_name || null,
            variant_attributes: entry.variant?.attributes || null,
            quantity: Number(entry.quantity || 0),
            unit_price: amount(entry.unit_price),
            discount_amount: amount(entry.discount_amount),
            line_total: amount(entry.line_total)
        })),
        totals: {
            subtotal: amount(data.subtotal),
            discount,
            actual_product_value: amountFromCents(
                Math.max(0, cents(data.subtotal) - cents(data.discount_amount))
            ),
            tax: amount(data.tax_amount),
            delivery_charge: amount(data.shipping_amount),
            total: amount(data.total_amount),
            has_discount: cents(data.discount_amount) > 0
        },
        payment: lifecycle
    };
}

module.exports = {
    deriveInvoiceLifecycle,
    filterInvoiceSummaries,
    invoiceDetail,
    invoiceSummary,
    isOrderCompleted,
    paymentMethodLabel
};
