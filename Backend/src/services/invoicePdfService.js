'use strict';

const fs = require('fs/promises');
const path = require('path');
const sharp = require('sharp');

const COMPANY = {
    name: 'South West',
    website: 'southwest.lk',
    email: 'support@southwest.lk',
    phone: process.env.SOUTH_WEST_PHONE || ''
};

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
    const name = entry.item?.item_name || entry.item?.name || entry.name || 'Product';
    const variant = entry.variant?.variant_name || entry.variant?.name || entry.variant_name;
    return variant ? `${name} - ${variant}` : name;
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
    const perPage = 22;
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
        if (logo) {
            const scale = Math.min(150 / logo.width, 48 / logo.height);
            const width = logo.width * scale;
            const height = logo.height * scale;
            commands.push(`q ${width} 0 0 ${height} 34 ${782 - height / 2} cm /Logo Do Q`);
        } else {
            text(34, 803, 20, COMPANY.name, '1 1 1');
        }
        commands.push('0.10 0.24 0.19 RG 0.8 w 34 770 m 560 770 l S');
        text(400, 810, 10, COMPANY.website);
        text(34, 738, 22, draft ? 'DRAFT INVOICE' : 'INVOICE');
        text(34, 715, 10, `Invoice: ${order.invoice_number || order.order_number}`);
        text(34, 699, 10, `Order: ${order.order_number}`);
        text(34, 683, 10, `Date: ${formatDate(order.order_date || order.created_at)}`);
        text(34, 660, 11, 'BILL TO');
        const customer = order.customer;
        text(34, 644, 10, customer
            ? `${customer.first_name || ''} ${customer.last_name || ''}`.trim()
            : order.addresses?.[0]?.recipient_name || order.customer_email || 'Customer');
        text(34, 628, 9, customer?.email || order.customer_email || '');
        const address = order.addresses?.find(value => value.address_type === 'shipping') || order.addresses?.[0];
        if (address) text(34, 612, 9, [address.address_line_1, address.address_line_2, address.city].filter(Boolean).join(', ').slice(0, 90));
        text(34, 580, 9, 'PRODUCT / VARIANT');
        text(350, 580, 9, 'QTY');
        text(402, 580, 9, 'UNIT PRICE');
        text(500, 580, 9, 'LINE TOTAL');
        line(34, 572, 560, 572);
        let y = 553;
        group.forEach(entry => {
            const unitPrice = Number(entry.unit_price || 0);
            const qty = Number(entry.quantity || 0);
            const lineTotal = Number(entry.line_total ?? unitPrice * qty);
            text(34, y, 9, getItemName(entry).slice(0, 52));
            text(350, y, 9, String(qty));
            text(402, y, 9, money(unitPrice));
            text(500, y, 9, money(lineTotal));
            y -= 16;
        });

        if (pageIndex === groups.length - 1) {
            const payment = order.payments?.find(record => record.payment_status === 'paid') || order.payments?.[0];
            y = Math.max(y - 25, 170);
            line(330, y + 15, 560, y + 15);
            text(350, y, 9, `Subtotal: ${money(order.subtotal)}`);
            y -= 17;
            text(350, y, 9, `Discount: - ${money(order.discount_amount)}`);
            y -= 17;
            text(350, y, 9, `Delivery: ${money(order.normal_delivery_amount ?? order.shipping_amount)}`);
            if (Number(order.additional_shipping_amount || 0) > 0) {
                y -= 17;
                text(350, y, 9, `Additional shipping: ${money(order.additional_shipping_amount)}`);
            }
            y -= 19;
            text(350, y, 12, `TOTAL: ${money(order.total_amount)}`);
            y -= 22;
            text(34, y, 9, `Payment method: ${paymentMethodLabel(payment?.payment_method || 'cash')}`);
            text(34, y - 15, 9, `Payment status: ${draft ? 'Unpaid - payment not collected' : 'Paid'}${payment?.payment_date ? ` - ${formatDate(payment.payment_date)}` : ''}`);
        }
        text(34, 24, 8, `${COMPANY.name} | ${COMPANY.email}${COMPANY.phone ? ` | ${COMPANY.phone}` : ''}`, '0.35 0.40 0.37');
        if (groups.length > 1) text(520, 24, 8, `Page ${pageIndex + 1} of ${groups.length}`, '0.35 0.40 0.37');
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
                { model: models.Item, as: 'item', attributes: ['item_name'] },
                { model: models.ItemVariant, as: 'variant', attributes: ['variant_name'] }
            ] },
            { model: models.OrderAddress, as: 'addresses' },
            { model: models.Payment, as: 'payments' },
            { model: models.Customer, as: 'customer', attributes: ['id', 'first_name', 'last_name', 'email'] },
            { model: models.Invoice, as: 'invoices' }
        ]
    });
}

function invoiceFilename(orderNumber, draft = false) {
    const safeNumber = ascii(orderNumber).replace(/[^A-Za-z0-9_-]/g, '-');
    return `South-West-Order-${safeNumber}-${draft ? 'Draft-' : ''}Invoice.pdf`;
}

module.exports = { generateInvoicePdf, invoiceFilename, loadOrderInvoiceData };
