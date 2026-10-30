'use strict';

const { QueryTypes } = require('sequelize');
const { Payment } = require('../models');

const TIMEZONE = 'Asia/Colombo';

function parseDateRange(query = {}) {
    const { startDate, endDate } = query;
    const pattern = /^\d{4}-\d{2}-\d{2}$/;

    function valid(value) {
        if (typeof value !== 'string' || !pattern.test(value)) return false;

        const [y, m, d] = value.split('-').map(Number);
        const date = new Date(Date.UTC(y, m - 1, d));

        return date.getUTCFullYear() === y &&
            date.getUTCMonth() === m - 1 &&
            date.getUTCDate() === d;
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

const money = value => Number(Number(value || 0).toFixed(2));

async function queryPayments(sql, range) {
    return Payment.sequelize.query(sql, {
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

async function getPaymentCollectionSummary(query = {}) {
    const range = parseDateRange(query);

    const rows = await queryPayments(`
        SELECT
            COUNT(*) AS paymentCount,
            COALESCE(SUM(p.amount), 0) AS collectedAmount
        FROM payments p
        INNER JOIN orders o ON o.id = p.order_id
        WHERE o.order_type = 'online'
          AND p.payment_status = 'paid'
          AND p.payment_date IS NOT NULL
          AND p.payment_date >= :start
          AND p.payment_date < :endExclusive
    `, range);

    return {
        ...metadata(range, 'payment-collection-summary'),
        totals: {
            paymentCount: Number(rows[0].paymentCount || 0),
            collectedAmount: money(rows[0].collectedAmount)
        }
    };
}

async function getPaymentMethodBreakdown(query = {}) {
    const range = parseDateRange(query);

    const rows = await queryPayments(`
        SELECT
            p.payment_method AS paymentMethod,
            COUNT(*) AS paymentCount,
            COALESCE(SUM(p.amount), 0) AS collectedAmount
        FROM payments p
        INNER JOIN orders o ON o.id = p.order_id
        WHERE o.order_type = 'online'
          AND p.payment_status = 'paid'
          AND p.payment_date IS NOT NULL
          AND p.payment_date >= :start
          AND p.payment_date < :endExclusive
        GROUP BY p.payment_method
        ORDER BY collectedAmount DESC, p.payment_method ASC
    `, range);

    const formattedRows = rows.map(row => ({
        paymentMethod: row.paymentMethod,
        paymentCount: Number(row.paymentCount || 0),
        collectedAmount: money(row.collectedAmount)
    }));

    return {
        ...metadata(range, 'payment-method-breakdown'),
        totals: {
            paymentCount: formattedRows.reduce(
                (sum, row) => sum + row.paymentCount, 0
            ),
            collectedAmount: money(formattedRows.reduce(
                (sum, row) => sum + row.collectedAmount, 0
            ))
        },
        rows: formattedRows
    };
}

async function getPaymentTransactionHistory(query = {}) {
    const range = parseDateRange(query);

    const rows = await queryPayments(`
        SELECT
            p.id AS paymentId,
            p.payment_number AS paymentNumber,
            p.payment_reference AS paymentReference,
            p.transaction_reference AS transactionReference,
            p.order_id AS orderId,
            o.order_number AS orderNumber,
            p.payment_method AS paymentMethod,
            p.payment_status AS paymentStatus,
            p.amount AS amount,
            p.payment_date AS paymentDate
        FROM payments p
        INNER JOIN orders o ON o.id = p.order_id
        WHERE o.order_type = 'online'
          AND p.payment_date IS NOT NULL
          AND p.payment_date >= :start
          AND p.payment_date < :endExclusive
        ORDER BY p.payment_date ASC, p.id ASC
    `, range);

    return {
        ...metadata(range, 'payment-transaction-history'),
        totals: {
            transactionCount: rows.length,
            recordedAmount: money(rows.reduce(
                (sum, row) => sum + Number(row.amount || 0), 0
            ))
        },
        rows: rows.map(row => ({
            ...row,
            paymentId: String(row.paymentId),
            orderId: String(row.orderId),
            amount: money(row.amount)
        }))
    };
}

async function getRefundStatusSummary(query = {}) {
    const range = parseDateRange(query);

    const rows = await queryPayments(`
        SELECT
            p.payment_status AS paymentStatus,
            COUNT(*) AS paymentCount,
            COALESCE(SUM(p.amount), 0) AS recordedAmount
        FROM payments p
        INNER JOIN orders o ON o.id = p.order_id
        WHERE o.order_type = 'online'
          AND p.payment_status IN ('refunded', 'partially_refunded')
          AND p.payment_date IS NOT NULL
          AND p.payment_date >= :start
          AND p.payment_date < :endExclusive
        GROUP BY p.payment_status
        ORDER BY p.payment_status ASC
    `, range);

    return {
        ...metadata(range, 'refund-status-summary'),
        note: 'Recorded payment amounts only. These are not verified refund amounts.',
        totals: {
            paymentCount: rows.reduce(
                (sum, row) => sum + Number(row.paymentCount || 0), 0
            ),
            recordedAmount: money(rows.reduce(
                (sum, row) => sum + Number(row.recordedAmount || 0), 0
            ))
        },
        rows: rows.map(row => ({
            paymentStatus: row.paymentStatus,
            paymentCount: Number(row.paymentCount || 0),
            recordedAmount: money(row.recordedAmount)
        }))
    };
}

module.exports = {
    getPaymentCollectionSummary,
    getPaymentMethodBreakdown,
    getPaymentTransactionHistory,
    getRefundStatusSummary
};
