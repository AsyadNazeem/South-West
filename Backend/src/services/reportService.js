'use strict';

const { QueryTypes } = require('sequelize');
const { Order } = require('../models');

const REPORT_TIMEZONE = 'Asia/Colombo';

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
    return rows.reduce((totals, row) => {
        totals.orderCount += Number(row.orderCount || 0);
        totals.subtotal += Number(row.subtotal || 0);
        totals.discountAmount += Number(row.discountAmount || 0);
        totals.taxAmount += Number(row.taxAmount || 0);
        totals.shippingAmount += Number(row.shippingAmount || 0);
        totals.totalSales += Number(row.totalSales || 0);
        return totals;
    }, {
        orderCount: 0,
        subtotal: 0,
        discountAmount: 0,
        taxAmount: 0,
        shippingAmount: 0,
        totalSales: 0
    });
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
            COALESCE(SUM(total_amount), 0) AS totalSales
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

    const totals = buildTotals(rows);

    for (const key of [
        'subtotal',
        'discountAmount',
        'taxAmount',
        'shippingAmount',
        'totalSales'
    ]) {
        totals[key] = money(totals[key]);
    }

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
        totals,
        rows
    };
}

async function getOnlineSalesSummary(query = {}) {
    const range = parseDateRange(query);

    const orders = await Order.findAll({
        where: {
            order_type: 'online',
            status: {
                [require('sequelize').Op.notIn]: ['cancelled', 'returned']
            },
            order_date: {
                [require('sequelize').Op.gte]: range.start,
                [require('sequelize').Op.lt]: range.endExclusive
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
            'total_amount'
        ],
        order: [['order_date', 'ASC'], ['id', 'ASC']],
        raw: true
    });

    const totals = {
        orderCount: orders.length,
        subtotal: 0,
        discountAmount: 0,
        taxAmount: 0,
        shippingAmount: 0,
        totalSales: 0
    };

    const rows = orders.map(order => {
        const row = {
            orderId: String(order.id),
            orderNumber: order.order_number,
            orderDate: order.order_date,
            status: order.status,
            paymentStatus: order.payment_status,
            subtotal: money(order.subtotal),
            discountAmount: money(order.discount_amount),
            taxAmount: money(order.tax_amount),
            shippingAmount: money(order.shipping_amount),
            totalAmount: money(order.total_amount)
        };

        totals.subtotal += row.subtotal;
        totals.discountAmount += row.discountAmount;
        totals.taxAmount += row.taxAmount;
        totals.shippingAmount += row.shippingAmount;
        totals.totalSales += row.totalAmount;

        return row;
    });

    for (const key of [
        'subtotal',
        'discountAmount',
        'taxAmount',
        'shippingAmount',
        'totalSales'
    ]) {
        totals[key] = money(totals[key]);
    }

    return {
        report: 'online-sales-summary',
        timezone: REPORT_TIMEZONE,
        currency: 'LKR',
        filters: {
            startDate: range.startDate,
            endDate: range.endDate
        },
        totals,
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
    getOnlineSalesSummary,
    getDailyOnlineSales,
    getMonthlyOnlineSales
};
