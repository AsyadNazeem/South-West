'use strict';

const { Op, QueryTypes, literal } = require('sequelize');
const { Order } = require('../models');

const REPORT_TIMEZONE = 'Asia/Colombo';

// Checkout stores product prices before order discounts, with delivery and tax separate.
const PRODUCT_SALES_SQL = 'subtotal - discount_amount';

async function getDashboardSales() {
    const result = await Order.findOne({
        attributes: [[literal(`SUM(${PRODUCT_SALES_SQL})`), 'totalSales']],
        where: { status: { [Op.notIn]: ['cancelled', 'returned'] } },
        raw: true
    });
    return money(result?.totalSales);
}

function parseDateRange(query = {}) {
    const { startDate, endDate } = query;
    const pattern = /^\d{4}-\d{2}-\d{2}$/;

    function validDate(value) {
        if (typeof value !== 'string' || !pattern.test(value)) return false;

        const [year, month, day] = value.split('-').map(Number);
        const date = new Date(Date.UTC(year, month - 1, day));

        return date.getUTCFullYear() === year &&
            date.getUTCMonth() === month - 1 &&
            date.getUTCDate() === day;
    }

    if (!startDate || !endDate) {
        const error = new Error('startDate and endDate are required (YYYY-MM-DD)');
        error.status = 400;
        throw error;
    }

    if (!validDate(startDate) || !validDate(endDate) || startDate > endDate) {
        const error = new Error('Invalid date range');
        error.status = 400;
        throw error;
    }

    const next = new Date(`${endDate}T00:00:00.000Z`);
    next.setUTCDate(next.getUTCDate() + 1);

    const endExclusive = [
        next.getUTCFullYear(),
        String(next.getUTCMonth() + 1).padStart(2, '0'),
        String(next.getUTCDate()).padStart(2, '0')
    ].join('-');

    return {
        startDate,
        endDate,
        start: `${startDate} 00:00:00`,
        endExclusive: `${endExclusive} 00:00:00`
    };
}

function money(value) {
    return Number(Number(value || 0).toFixed(2));
}

function buildTotals(rows) {
    const totals = { orderCount: 0 };
    const amounts = ['subtotal', 'discountAmount', 'taxAmount', 'shippingAmount', 'totalSales'];
    for (const key of amounts) totals[key] = 0;

    for (const row of rows) {
        totals.orderCount += row.orderCount ?? 1;
        for (const key of amounts) totals[key] += Math.round(row[key] * 100);
    }

    for (const key of amounts) totals[key] /= 100;
    return totals;
}

async function getGroupedOnlineSales(query = {}, grouping = 'day') {
    const range = parseDateRange(query);

    const periodExpression = grouping === 'month'
        ? "DATE_FORMAT(order_date, '%Y-%m')"
        : "DATE_FORMAT(order_date, '%Y-%m-%d')";

    const sql = `
        SELECT
            ${periodExpression} AS period,
            COUNT(*) AS orderCount,
            COALESCE(SUM(subtotal), 0) AS subtotal,
            COALESCE(SUM(discount_amount), 0) AS discountAmount,
            COALESCE(SUM(tax_amount), 0) AS taxAmount,
            COALESCE(SUM(shipping_amount), 0) AS shippingAmount,
            COALESCE(SUM(${PRODUCT_SALES_SQL}), 0) AS totalSales
        FROM orders
        WHERE order_type = 'online'
          AND status NOT IN ('cancelled', 'returned')
          AND order_date >= :start
          AND order_date < :endExclusive
        GROUP BY period
        ORDER BY period ASC
    `;

    const results = await Order.sequelize.query(sql, {
        replacements: {
            start: range.start,
            endExclusive: range.endExclusive
        },
        type: QueryTypes.SELECT
    });

    const rows = results.map(row => ({
        period: row.period,
        orderCount: Number(row.orderCount || 0),
        subtotal: money(row.subtotal),
        discountAmount: money(row.discountAmount),
        taxAmount: money(row.taxAmount),
        shippingAmount: money(row.shippingAmount),
        totalSales: money(row.totalSales)
    }));

    return {
        report: grouping === 'month'
            ? 'monthly-online-sales'
            : 'daily-online-sales',
        timezone: REPORT_TIMEZONE,
        currency: 'LKR',
        filters: {
            startDate: range.startDate,
            endDate: range.endDate
        },
        totals: buildTotals(rows),
        rows
    };
}

async function getOnlineSalesSummary(query = {}) {
    const range = parseDateRange(query);

    const orders = await Order.findAll({
        where: {
            order_type: 'online',
            status: {
                [Op.notIn]: ['cancelled', 'returned']
            },
            order_date: {
                [Op.gte]: range.start,
                [Op.lt]: range.endExclusive
            }
        },
        attributes: [
            'id',
            'order_number',
            'order_date',
            'status',
            'payment_status',
            'subtotal',
            'discount_amount',
            'tax_amount',
            'shipping_amount',
            'total_amount',
            [literal(PRODUCT_SALES_SQL), 'totalSales']
        ],
        order: [['order_date', 'ASC'], ['id', 'ASC']],
        raw: true
    });

    const rows = orders.map(order => ({
        orderId: String(order.id),
        orderNumber: order.order_number,
        orderDate: order.order_date,
        status: order.status,
        paymentStatus: order.payment_status,
        subtotal: money(order.subtotal),
        discountAmount: money(order.discount_amount),
        taxAmount: money(order.tax_amount),
        shippingAmount: money(order.shipping_amount),
        totalAmount: money(order.total_amount),
        totalSales: money(order.totalSales)
    }));

    return {
        report: 'online-sales-summary',
        timezone: REPORT_TIMEZONE,
        currency: 'LKR',
        filters: {
            startDate: range.startDate,
            endDate: range.endDate
        },
        totals: buildTotals(rows),
        rows
    };
}

async function getDailyOnlineSales(query = {}) {
    return getGroupedOnlineSales(query, 'day');
}

async function getMonthlyOnlineSales(query = {}) {
    return getGroupedOnlineSales(query, 'month');
}

module.exports = {
    getDashboardSales,
    getOnlineSalesSummary,
    getDailyOnlineSales,
    getMonthlyOnlineSales
};
