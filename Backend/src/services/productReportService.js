'use strict';

const { QueryTypes } = require('sequelize');
const { Item } = require('../models');

const TIMEZONE = 'Asia/Colombo';

function parseDateRange(query = {}) {
    const { startDate, endDate } = query;
    const pattern = /^\d{4}-\d{2}-\d{2}$/;

    function valid(value) {
        if (typeof value !== 'string' || !pattern.test(value)) return false;

        const [year, month, day] = value.split('-').map(Number);
        const date = new Date(Date.UTC(year, month - 1, day));

        return date.getUTCFullYear() === year &&
            date.getUTCMonth() === month - 1 &&
            date.getUTCDate() === day;
    }

    if (!valid(startDate) || !valid(endDate) || startDate > endDate) {
        const error = new Error(
            'Valid startDate and endDate are required (YYYY-MM-DD)'
        );
        error.status = 400;
        throw error;
    }

    const next = new Date(`${endDate}T00:00:00.000Z`);
    next.setUTCDate(next.getUTCDate() + 1);

    const nextDate = [
        next.getUTCFullYear(),
        String(next.getUTCMonth() + 1).padStart(2, '0'),
        String(next.getUTCDate()).padStart(2, '0')
    ].join('-');

    return {
        startDate,
        endDate,
        start: `${startDate} 00:00:00`,
        endExclusive: `${nextDate} 00:00:00`
    };
}

function money(value) {
    return Number(Number(value || 0).toFixed(2));
}

function quantity(value) {
    return Number(Number(value || 0).toFixed(3));
}

async function runQuery(sql, range) {
    return Item.sequelize.query(sql, {
        replacements: {
            start: range.start,
            endExclusive: range.endExclusive
        },
        type: QueryTypes.SELECT
    });
}

function metadata(range, report) {
    return {
        report,
        timezone: TIMEZONE,
        currency: 'LKR',
        filters: {
            startDate: range.startDate,
            endDate: range.endDate
        }
    };
}

function formatProductRows(rows) {
    return rows.map(row => ({
        itemId: String(row.itemId),
        itemCode: row.itemCode,
        itemName: row.itemName,
        categoryName: row.categoryName || 'Uncategorized',
        brandName: row.brandName || 'Unbranded',
        quantitySold: quantity(row.quantitySold),
        grossSales: money(row.grossSales),
        discountAmount: money(row.discountAmount),
        taxAmount: money(row.taxAmount),
        netSales: money(row.netSales)
    }));
}

function productTotals(rows) {
    return {
        productCount: rows.length,
        quantitySold: quantity(rows.reduce(
            (sum, row) => sum + row.quantitySold, 0
        )),
        grossSales: money(rows.reduce(
            (sum, row) => sum + row.grossSales, 0
        )),
        discountAmount: money(rows.reduce(
            (sum, row) => sum + row.discountAmount, 0
        )),
        taxAmount: money(rows.reduce(
            (sum, row) => sum + row.taxAmount, 0
        )),
        netSales: money(rows.reduce(
            (sum, row) => sum + row.netSales, 0
        ))
    };
}

const PRODUCT_SELECT = `
    i.id AS itemId,
    i.item_code AS itemCode,
    i.item_name AS itemName,
    c.name AS categoryName,
    b.name AS brandName,
    COALESCE(SUM(CASE WHEN o.id IS NOT NULL THEN oi.quantity ELSE 0 END), 0) AS quantitySold,
    COALESCE(SUM(CASE WHEN o.id IS NOT NULL THEN oi.quantity * oi.unit_price ELSE 0 END), 0) AS grossSales,
    COALESCE(SUM(CASE WHEN o.id IS NOT NULL THEN oi.discount_amount ELSE 0 END), 0) AS discountAmount,
    COALESCE(SUM(CASE WHEN o.id IS NOT NULL THEN oi.tax_amount ELSE 0 END), 0) AS taxAmount,
    COALESCE(SUM(CASE WHEN o.id IS NOT NULL THEN oi.line_total ELSE 0 END), 0) AS netSales
`;

const PRODUCT_JOINS = `
    FROM items i
    LEFT JOIN categories c ON c.id = i.category_id
    LEFT JOIN brands b ON b.id = i.brand_id
    LEFT JOIN order_items oi ON oi.item_id = i.id
    LEFT JOIN orders o
        ON o.id = oi.order_id
        AND o.order_type = 'online'
        AND o.status NOT IN ('cancelled', 'returned')
        AND o.order_date >= :start
        AND o.order_date < :endExclusive
`;

async function getProductSalesSummary(query = {}) {
    const range = parseDateRange(query);

    const sql = `
        SELECT ${PRODUCT_SELECT}
        ${PRODUCT_JOINS}
        GROUP BY i.id, i.item_code, i.item_name, c.name, b.name
        HAVING SUM(CASE WHEN o.id IS NOT NULL THEN oi.quantity ELSE 0 END) > 0
        ORDER BY netSales DESC, quantitySold DESC
    `;

    const results = await runQuery(sql, range);
    const rows = formatProductRows(results);

    return {
        ...metadata(range, 'product-sales-summary'),
        totals: productTotals(rows),
        rows
    };
}

async function getBestSellingProducts(query = {}) {
    const report = await getProductSalesSummary(query);

    return {
        ...report,
        report: 'best-selling-products',
        rows: [...report.rows].sort(
            (a, b) => b.quantitySold - a.quantitySold ||
                b.netSales - a.netSales
        )
    };
}

async function getLeastSellingProducts(query = {}) {
    const range = parseDateRange(query);

    const sql = `
        SELECT ${PRODUCT_SELECT}
        ${PRODUCT_JOINS}
        GROUP BY i.id, i.item_code, i.item_name, c.name, b.name
        ORDER BY quantitySold ASC, netSales ASC, i.item_name ASC
    `;

    const results = await runQuery(sql, range);
    const rows = formatProductRows(results);

    return {
        ...metadata(range, 'least-selling-products'),
        totals: productTotals(rows),
        rows
    };
}

async function getCategorySales(query = {}) {
    const range = parseDateRange(query);

    const sql = `
        SELECT
            c.id AS categoryId,
            c.code AS categoryCode,
            c.name AS categoryName,
            COUNT(DISTINCT CASE WHEN o.id IS NOT NULL THEN i.id END) AS productCount,
            COALESCE(SUM(CASE WHEN o.id IS NOT NULL THEN oi.quantity ELSE 0 END), 0) AS quantitySold,
            COALESCE(SUM(CASE WHEN o.id IS NOT NULL THEN oi.quantity * oi.unit_price ELSE 0 END), 0) AS grossSales,
            COALESCE(SUM(CASE WHEN o.id IS NOT NULL THEN oi.discount_amount ELSE 0 END), 0) AS discountAmount,
            COALESCE(SUM(CASE WHEN o.id IS NOT NULL THEN oi.tax_amount ELSE 0 END), 0) AS taxAmount,
            COALESCE(SUM(CASE WHEN o.id IS NOT NULL THEN oi.line_total ELSE 0 END), 0) AS netSales
        FROM categories c
        LEFT JOIN items i ON i.category_id = c.id
        LEFT JOIN order_items oi ON oi.item_id = i.id
        LEFT JOIN orders o
            ON o.id = oi.order_id
            AND o.order_type = 'online'
            AND o.status NOT IN ('cancelled', 'returned')
            AND o.order_date >= :start
            AND o.order_date < :endExclusive
        GROUP BY c.id, c.code, c.name
        ORDER BY netSales DESC, c.name ASC
    `;

    const results = await runQuery(sql, range);

    const rows = results.map(row => ({
        categoryId: String(row.categoryId),
        categoryCode: row.categoryCode,
        categoryName: row.categoryName,
        productCount: Number(row.productCount || 0),
        quantitySold: quantity(row.quantitySold),
        grossSales: money(row.grossSales),
        discountAmount: money(row.discountAmount),
        taxAmount: money(row.taxAmount),
        netSales: money(row.netSales)
    }));

    return {
        ...metadata(range, 'category-sales-performance'),
        totals: {
            categoryCount: rows.length,
            quantitySold: quantity(rows.reduce((s, r) => s + r.quantitySold, 0)),
            netSales: money(rows.reduce((s, r) => s + r.netSales, 0))
        },
        rows
    };
}

async function getBrandSales(query = {}) {
    const range = parseDateRange(query);

    const sql = `
        SELECT
            b.id AS brandId,
            b.code AS brandCode,
            b.name AS brandName,
            COUNT(DISTINCT CASE WHEN o.id IS NOT NULL THEN i.id END) AS productCount,
            COALESCE(SUM(CASE WHEN o.id IS NOT NULL THEN oi.quantity ELSE 0 END), 0) AS quantitySold,
            COALESCE(SUM(CASE WHEN o.id IS NOT NULL THEN oi.quantity * oi.unit_price ELSE 0 END), 0) AS grossSales,
            COALESCE(SUM(CASE WHEN o.id IS NOT NULL THEN oi.discount_amount ELSE 0 END), 0) AS discountAmount,
            COALESCE(SUM(CASE WHEN o.id IS NOT NULL THEN oi.tax_amount ELSE 0 END), 0) AS taxAmount,
            COALESCE(SUM(CASE WHEN o.id IS NOT NULL THEN oi.line_total ELSE 0 END), 0) AS netSales
        FROM brands b
        LEFT JOIN items i ON i.brand_id = b.id
        LEFT JOIN order_items oi ON oi.item_id = i.id
        LEFT JOIN orders o
            ON o.id = oi.order_id
            AND o.order_type = 'online'
            AND o.status NOT IN ('cancelled', 'returned')
            AND o.order_date >= :start
            AND o.order_date < :endExclusive
        GROUP BY b.id, b.code, b.name
        ORDER BY netSales DESC, b.name ASC
    `;

    const results = await runQuery(sql, range);

    const rows = results.map(row => ({
        brandId: String(row.brandId),
        brandCode: row.brandCode,
        brandName: row.brandName,
        productCount: Number(row.productCount || 0),
        quantitySold: quantity(row.quantitySold),
        grossSales: money(row.grossSales),
        discountAmount: money(row.discountAmount),
        taxAmount: money(row.taxAmount),
        netSales: money(row.netSales)
    }));

    return {
        ...metadata(range, 'brand-sales-performance'),
        totals: {
            brandCount: rows.length,
            quantitySold: quantity(rows.reduce((s, r) => s + r.quantitySold, 0)),
            netSales: money(rows.reduce((s, r) => s + r.netSales, 0))
        },
        rows
    };
}

async function getVariantSales(query = {}) {
    const range = parseDateRange(query);

    const sql = `
        SELECT
            i.id AS itemId,
            i.item_code AS itemCode,
            i.item_name AS itemName,
            v.id AS variantId,
            v.variant_sku AS variantSku,
            v.variant_name AS variantName,
            v.attributes AS attributes,
            COALESCE(SUM(oi.quantity), 0) AS quantitySold,
            COALESCE(SUM(oi.quantity * oi.unit_price), 0) AS grossSales,
            COALESCE(SUM(oi.discount_amount), 0) AS discountAmount,
            COALESCE(SUM(oi.tax_amount), 0) AS taxAmount,
            COALESCE(SUM(oi.line_total), 0) AS netSales
        FROM order_items oi
        INNER JOIN orders o ON o.id = oi.order_id
        INNER JOIN items i ON i.id = oi.item_id
        LEFT JOIN item_variants v ON v.id = oi.variant_id
        WHERE o.order_type = 'online'
          AND o.status NOT IN ('cancelled', 'returned')
          AND o.order_date >= :start
          AND o.order_date < :endExclusive
        GROUP BY
            i.id, i.item_code, i.item_name,
            v.id, v.variant_sku, v.variant_name, v.attributes
        ORDER BY netSales DESC, quantitySold DESC
    `;

    const results = await runQuery(sql, range);

    const rows = results.map(row => ({
        itemId: String(row.itemId),
        itemCode: row.itemCode,
        itemName: row.itemName,
        variantId: row.variantId ? String(row.variantId) : null,
        variantSku: row.variantSku,
        variantName: row.variantName || 'No variant',
        attributes: row.attributes,
        quantitySold: quantity(row.quantitySold),
        grossSales: money(row.grossSales),
        discountAmount: money(row.discountAmount),
        taxAmount: money(row.taxAmount),
        netSales: money(row.netSales)
    }));

    return {
        ...metadata(range, 'variant-sales-performance'),
        totals: {
            variantCount: rows.length,
            quantitySold: quantity(rows.reduce((s, r) => s + r.quantitySold, 0)),
            netSales: money(rows.reduce((s, r) => s + r.netSales, 0))
        },
        rows
    };
}

module.exports = {
    getProductSalesSummary,
    getBestSellingProducts,
    getLeastSellingProducts,
    getCategorySales,
    getBrandSales,
    getVariantSales
};
