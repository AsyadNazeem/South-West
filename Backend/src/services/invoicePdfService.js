'use strict';

const fs = require('fs/promises');
const path = require('path');
const sharp = require('sharp');
const { deriveInvoiceLifecycle } = require('./invoicePresentationService');

const COMPANY = {
    name: 'South West',
    website: 'southwest.lk',
    email: 'support@southwest.lk',
    phone: process.env.SOUTH_WEST_PHONE || ''
};

function getCompanyDetails() {
    return { ...COMPANY };
}

function ascii(value) {
    return String(value ?? '')
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\x20-\x7e]/g, '?');
}

function pdfText(value) {
    return ascii(value).replace(/[\\()]/g, '\\$&');
}

function money(value) {
    return `Rs. ${Number(value || 0).toLocaleString('en-LK', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    })}`;
}

function streamObject(content) {
    const buffer = Buffer.from(content, 'binary');
    return Buffer.concat([
        Buffer.from(`<< /Length ${buffer.length} >>\nstream\n`, 'ascii'),
        buffer,
        Buffer.from('\nendstream', 'ascii')
    ]);
}

function buildPdf(objects, rootId) {
    const chunks = [Buffer.from('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n', 'binary')];
    const offsets = [0];
    let length = chunks[0].length;

    objects.forEach((object, index) => {
        offsets.push(length);
        const objectBuffer = Buffer.isBuffer(object)
            ? object
            : Buffer.from(object, 'binary');
        const wrapped = Buffer.concat([
            Buffer.from(`${index + 1} 0 obj\n`, 'ascii'),
            objectBuffer,
            Buffer.from('\nendobj\n', 'ascii')
        ]);
        chunks.push(wrapped);
        length += wrapped.length;
    });

    const xrefOffset = length;
    const xref = [`xref\n0 ${objects.length + 1}\n`, '0000000000 65535 f \n'];
    for (let i = 1; i < offsets.length; i += 1) {
        xref.push(`${String(offsets[i]).padStart(10, '0')} 00000 n \n`);
    }
    xref.push(
        `trailer\n<< /Size ${objects.length + 1} /Root ${rootId} 0 R >>\n` +
        `startxref\n${xrefOffset}\n%%EOF`
    );
    chunks.push(Buffer.from(xref.join(''), 'ascii'));
    return Buffer.concat(chunks);
}

function formatDate(value) {
    const date = value ? new Date(value) : new Date();
    return Number.isNaN(date.getTime())
        ? 'Date unavailable'
        : date.toLocaleDateString('en-GB', {
            day: '2-digit', month: 'short', year: 'numeric'
        });
}

function getItemName(entry) {
    return entry.item?.item_name || entry.item?.name || entry.name || 'Product';
}

function getVariantText(entry) {
    const variant = entry.variant?.variant_name || entry.variant?.name || entry.variant_name;
    const attributes = entry.variant?.attributes;
    const attributeText = attributes && typeof attributes === 'object'
        ? Object.entries(attributes)
            .filter(([, value]) => value !== null && value !== undefined && value !== '')
            .map(([key, value]) => `${key}: ${Array.isArray(value)
                ? value.join(', ')
                : typeof value === 'object' ? JSON.stringify(value) : value}`)
            .join(' / ')
        : '';
    const variantText = [variant, attributeText].filter(Boolean).join(' / ');
    return variantText || '-';
}

function paymentMethodLabel(value) {
    const labels = {
        cash: 'Cash on Delivery',
        card: 'Card',
        koko: 'Koko',
        mintpay: 'Mintpay'
    };
    return labels[String(value || '').toLowerCase()] || ascii(value || 'Not provided');
}

function cellLines(value, width, maximumLines = 2) {
    const source = ascii(value || '-');
    const lines = [];
    let remaining = source;
    while (remaining && lines.length < maximumLines) {
        if (remaining.length <= width) {
            lines.push(remaining);
            remaining = '';
            break;
        }
        let splitAt = remaining.lastIndexOf(' ', width);
        if (splitAt < Math.floor(width / 2)) splitAt = width;
        lines.push(remaining.slice(0, splitAt).trim());
        remaining = remaining.slice(splitAt).trim();
    }
    if (remaining && lines.length) {
        lines[lines.length - 1] = `${lines.at(-1).slice(0, Math.max(0, width - 3))}...`;
    }
    return lines.length ? lines : ['-'];
}

async function getLogoImage() {
    const logoPath = process.env.SOUTH_WEST_LOGO_PATH || path.resolve(
        __dirname, '../assets/SWLogoBlack.png'
    );
    try {
        const jpeg = await sharp(await fs.readFile(logoPath))
            .flatten({ background: '#ffffff' })
            .jpeg({ quality: 85 })
            .toBuffer();
        const metadata = await sharp(jpeg).metadata();
        return { data: jpeg, width: metadata.width, height: metadata.height };
    } catch {
        return null;
    }
}

async function generateInvoicePdf(order, { draft = false } = {}) {
    if (!order || !order.order_number) throw new Error('Trusted order data is required.');
    if (!draft && order.payment_status !== 'paid') {
        throw new Error('A full invoice requires a paid order.');
    }

    const logo = await getLogoImage();
    const items = order.items || [];
    const perPage = 14;
    const groups = [];
    for (let index = 0; index < Math.max(items.length, 1); index += perPage) {
        groups.push(items.slice(index, index + perPage));
    }

    const pages = groups.map((group, pageIndex) => {
        const commands = [];
        const text = (x, y, size, value, color = '0.13 0.25 0.21') => {
            commands.push(`BT /F1 ${size} Tf ${color} rg ${x} ${y} Td (${pdfText(value)}) Tj ET`);
        };
        const line = (x1, y1, x2, y2) => commands.push(`0.82 0.86 0.83 RG 0.7 w ${x1} ${y1} m ${x2} ${y2} l S`);

        commands.push('1 1 1 rg 0 0 595 842 re f');
        if (draft) {
            commands.push(
                'q 0.93 g BT /F1 72 Tf 0.707 0.707 -0.707 0.707 165 350 Tm (DRAFT) Tj ET Q'
            );
        }
        if (logo) {
            const scale = Math.min(120 / logo.width, 52 / logo.height);
            const width = logo.width * scale;
            const height = logo.height * scale;
            commands.push(`q ${width} 0 0 ${height} 34 ${770} cm /Logo Do Q`);
        } else {
            text(34, 800, 20, COMPANY.name);
        }
        text(34, 756, 9, COMPANY.website, '0.35 0.40 0.37');
        text(34, 742, 9, COMPANY.email, '0.35 0.40 0.37');
        if (COMPANY.phone) text(34, 728, 9, COMPANY.phone, '0.35 0.40 0.37');
        text(405, 803, 22, draft ? 'DRAFT INVOICE' : 'INVOICE');
        text(493, 782, 10, draft ? 'Status: Draft' : 'Status: Final');
        text(345, 765, 8, 'Invoice Number', '0.42 0.48 0.45');
        text(345, 753, 8, order.invoice_number || order.order_number);
        text(345, 740, 8, 'Invoice Date', '0.42 0.48 0.45');
        text(460, 740, 8, formatDate(order.invoice_date || order.order_date));
        text(345, 728, 8, 'Order Number', '0.42 0.48 0.45');
        text(345, 716, 8, order.order_number);
        text(345, 703, 8, 'Order Date', '0.42 0.48 0.45');
        text(460, 703, 8, formatDate(order.order_date || order.created_at));
        commands.push('0.10 0.24 0.19 RG 2 w 34 690 m 560 690 l S');

        text(34, 667, 10, 'CUSTOMER');
        text(310, 667, 10, 'DELIVERY ADDRESS');
        const customer = order.customer;
        const address = order.addresses?.find(value => value.address_type === 'shipping') || order.addresses?.[0];
        text(34, 648, 10, address?.recipient_name || (customer
            ? `${customer.first_name || ''} ${customer.last_name || ''}`.trim()
            : order.customer_email || 'Customer'));
        text(34, 632, 9, address?.phone || customer?.phone || '-');
        text(34, 616, 9, order.customer_email || customer?.email || '-');
        if (address) {
            text(310, 648, 9, String(address.address_line_1 || '-').slice(0, 44));
            if (address.address_line_2) text(310, 632, 9, String(address.address_line_2).slice(0, 44));
            text(310, 616, 9, `District: ${address.district?.district_name || '-'}`);
            text(310, 600, 9, `Delivery Area: ${address.area?.area_name || '-'}`);
            if (address.postal_code) text(310, 584, 9, `Postal Code: ${address.postal_code}`);
        } else {
            text(310, 648, 9, '-');
        }
        commands.push('0.95 0.97 0.96 rg 34 546 526 25 re f');
        text(40, 555, 8, 'PRODUCT', '0.34 0.40 0.37');
        text(172, 555, 8, 'SKU', '0.34 0.40 0.37');
        text(245, 555, 8, 'VARIANT', '0.34 0.40 0.37');
        text(352, 555, 8, 'QTY', '0.34 0.40 0.37');
        text(385, 555, 8, 'UNIT PRICE', '0.34 0.40 0.37');
        text(455, 555, 8, 'DISCOUNT', '0.34 0.40 0.37');
        text(520, 555, 8, 'TOTAL', '0.34 0.40 0.37');
        let y = 529;
        group.forEach(entry => {
            const unitPrice = Number(entry.unit_price || 0);
            const qty = Number(entry.quantity || 0);
            const lineTotal = Number(entry.line_total ?? unitPrice * qty);
            const sku = entry.variant?.variant_sku || entry.item?.item_code || '-';
            cellLines(getItemName(entry), 28).forEach((value, index) => {
                text(40, y - (index * 9), 7, value);
            });
            text(172, y, 6, String(sku).slice(0, 18));
            cellLines(getVariantText(entry), 22).forEach((value, index) => {
                text(245, y - (index * 9), 6, value);
            });
            text(355, y, 8, String(qty));
            text(385, y, 7, money(unitPrice));
            text(455, y, 7, money(entry.discount_amount));
            text(520, y, 7, money(lineTotal));
            line(34, y - 13, 560, y - 13);
            y -= 26;
        });

        if (pageIndex === groups.length - 1) {
            const payment = order.payments?.find(record => record.payment_status === 'paid') || order.payments?.[0];
            const paidAmount = (order.payments || [])
                .filter(record => record.payment_status === 'paid')
                .reduce((total, record) => total + Number(record.amount || 0), 0);
            const outstanding = Math.max(0, Number(order.total_amount || 0) - paidAmount);
            y = Math.max(y - 22, 190);
            const cardTop = y + 17;
            commands.push(`0.88 0.91 0.89 RG 0.8 w 34 ${y - 92} 260 112 re S`);
            text(48, y, 10, 'PAYMENT INFORMATION');
            text(48, y - 20, 8, `Payment Method: ${paymentMethodLabel(payment?.payment_method || 'cash')}`);
            text(48, y - 36, 8, `Payment Status: ${payment?.payment_status || order.payment_status || 'unpaid'}`);
            text(48, y - 52, 8, `Payment Reference: ${payment?.payment_reference || payment?.transaction_reference || '-'}`);
            text(48, y - 68, 8, `Payment Date: ${payment?.payment_date ? formatDate(payment.payment_date) : '-'}`);
            text(48, y - 84, 8, `Amount Paid: ${money(paidAmount)}  |  Outstanding: ${money(outstanding)}`);

            let totalsY = cardTop;
            line(330, totalsY + 4, 560, totalsY + 4);
            text(350, totalsY - 12, 9, `Subtotal: ${money(order.subtotal)}`);
            totalsY -= 29;
            if (Number(order.discount_amount || 0) > 0) {
                text(350, totalsY, 9, `Discount: - ${money(order.discount_amount)}`);
                totalsY -= 17;
                text(350, totalsY, 9, `Actual Product Value: ${money(Number(order.subtotal || 0) - Number(order.discount_amount || 0))}`);
                totalsY -= 17;
            }
            text(350, totalsY, 9, `Tax: ${money(order.tax_amount)}`);
            totalsY -= 17;
            text(350, totalsY, 9, `Delivery Charge: ${money(order.shipping_amount)}`);
            totalsY -= 22;
            line(330, totalsY + 12, 560, totalsY + 12);
            text(350, totalsY - 4, 12, `FINAL TOTAL: ${money(order.total_amount)}`);
        }
        // Footer appears on every invoice page.
        line(34, 70, 560, 70);
        text(34, 53, 9, 'Thank you for shopping with South West!');
        text(34, 37, 8, `${COMPANY.website} | ${COMPANY.email}`, '0.35 0.40 0.37');
        text(480, 24, 8, `Page ${pageIndex + 1} of ${groups.length}`, '0.35 0.40 0.37');
        return commands.join('\n');
    });

    const objects = [];
    const reserve = () => { objects.push(''); return objects.length; };
    const catalogId = reserve();
    const pagesId = reserve();
    const fontId = reserve();
    objects[fontId - 1] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
    let logoId = null;
    if (logo) {
        logoId = reserve();
        objects[logoId - 1] = Buffer.concat([
            Buffer.from(`<< /Type /XObject /Subtype /Image /Width ${logo.width} /Height ${logo.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${logo.data.length} >>\nstream\n`, 'ascii'),
            logo.data,
            Buffer.from('\nendstream', 'ascii')
        ]);
    }
    const pageIds = [];
    for (const pageContent of pages) {
        const contentId = reserve();
        objects[contentId - 1] = streamObject(pageContent);
        const pageId = reserve();
        pageIds.push(pageId);
        objects[pageId - 1] = `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fontId} 0 R >>${logoId ? ` /XObject << /Logo ${logoId} 0 R >>` : ''} >> /Contents ${contentId} 0 R >>`;
    }
    objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;
    objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
    return buildPdf(objects, catalogId);
}

async function loadOrderInvoiceData(orderId, transaction) {
    const models = require('../models');
    return models.Order.findByPk(orderId, {
        transaction,
        include: [
            { model: models.OrderItem, as: 'items', include: [
                { model: models.Item, as: 'item', attributes: ['item_name', 'item_code'] },
                { model: models.ItemVariant, as: 'variant', attributes: ['variant_name', 'variant_sku', 'attributes'] }
            ] },
            { model: models.OrderAddress, as: 'addresses', include: [
                { model: models.DeliveryDistrict, as: 'district', attributes: ['district_name'], required: false },
                { model: models.DeliveryArea, as: 'area', attributes: ['area_name'], required: false }
            ] },
            { model: models.Payment, as: 'payments' },
            { model: models.Delivery, as: 'deliveries' },
            { model: models.Customer, as: 'customer', attributes: ['id', 'first_name', 'last_name', 'email'] },
            { model: models.Invoice, as: 'invoices' }
        ]
    });
}

function invoiceFilename(invoiceNumber, draft = false) {
    const safeNumber = ascii(invoiceNumber).replace(/[^A-Za-z0-9_-]/g, '-');
    return `SouthWest-Invoice-${safeNumber}-${draft ? 'Draft' : 'Final'}.pdf`;
}

function plain(record) {
    return typeof record?.toJSON === 'function' ? record.toJSON() : record;
}

async function generateInvoiceDocument(invoiceRecord, orderRecord) {
    const invoice = plain(invoiceRecord);
    const order = plain(orderRecord || invoice?.order);

    if (!invoice || !order) {
        throw new Error('Saved invoice and order data are required.');
    }

    const lifecycle = deriveInvoiceLifecycle({ ...invoice, order });
    const draft = !lifecycle.is_final;
    const content = await generateInvoicePdf({
        ...order,
        invoice_number: invoice.invoice_number,
        invoice_date: invoice.invoice_date,
        payment_status: lifecycle.is_final ? 'paid' : order.payment_status,
        subtotal: invoice.subtotal,
        discount_amount: invoice.discount_amount,
        tax_amount: invoice.tax_amount,
        shipping_amount: invoice.shipping_amount,
        total_amount: invoice.total_amount
    }, { draft });

    return {
        content,
        contentType: 'application/pdf',
        documentStatus: draft ? 'draft' : 'final',
        filename: invoiceFilename(invoice.invoice_number, draft),
        invoiceNumber: invoice.invoice_number
    };
}

async function getOrderInvoiceAttachment(orderId, { finalOnly = false } = {}) {
    const orderRecord = await loadOrderInvoiceData(orderId);
    if (!orderRecord) return null;

    const order = plain(orderRecord);
    const invoices = [...(order.invoices || [])].sort(
        (left, right) => Number(left.id || 0) - Number(right.id || 0)
    );
    const invoice = invoices[0];
    if (!invoice) return null;

    const document = await generateInvoiceDocument(invoice, order);
    if (finalOnly && document.documentStatus !== 'final') return null;

    return {
        filename: document.filename,
        content: document.content,
        contentType: document.contentType,
        documentStatus: document.documentStatus,
        invoiceNumber: document.invoiceNumber
    };
}

module.exports = {
    generateInvoicePdf,
    generateInvoiceDocument,
    getOrderInvoiceAttachment,
    getCompanyDetails,
    invoiceFilename,
    loadOrderInvoiceData
};
