'use strict';

const ExcelJS = require('exceljs');

const reports = require('../services/paymentReportService');

async function sendReport(req, res, service, name) {
    try {
        const data = await service(req.query);
        return res.status(200).json({ success: true, data });
    } catch (error) {
        console.error(`${name} report error:`, error);

        return res.status(error.status || 500).json({
            success: false,
            message: error.status === 400
                ? error.message
                : `Failed to generate ${name} report`
        });
    }
}

async function exportReport(req, res, service, name, columns) {
    try {
        const report = await service(req.query);
        const workbook = new ExcelJS.Workbook();

        workbook.creator = 'South West';
        workbook.created = new Date();

        const sheet = workbook.addWorksheet(name);

        sheet.addRow(columns.map(column => column.header));

        sheet.getRow(1).font = {
            bold: true,
            color: { argb: 'FFFFFFFF' }
        };

        sheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF17365D' }
        };

        for (const row of report.rows || []) {
            sheet.addRow(columns.map(column => row[column.key] ?? ''));
        }

        sheet.columns = columns.map(column => ({
            width: column.width || 22
        }));

        sheet.views = [{ state: 'frozen', ySplit: 1 }];
        sheet.addRow([]);
        sheet.addRow(['Reporting timezone', report.timezone]);
        sheet.addRow(['Currency', report.currency]);
        sheet.addRow(['Start date', report.filters.startDate]);
        sheet.addRow(['End date', report.filters.endDate]);

        if (report.note) {
            sheet.addRow(['Note', report.note]);
        }

        res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );

        res.setHeader(
            'Content-Disposition',
            `attachment; filename="${name.toLowerCase().replace(/\s+/g, '-')}-${report.filters.startDate}-to-${report.filters.endDate}.xlsx"`
        );

        await workbook.xlsx.write(res);
        return res.end();
    } catch (error) {
        console.error(`${name} export error:`, error);

        if (res.headersSent) return res.destroy(error);

        return res.status(error.status || 500).json({
            success: false,
            message: error.status === 400
                ? error.message
                : `Failed to export ${name}`
        });
    }
}

const collectionColumns = [
    { header: 'Payment Count', key: 'paymentCount' },
    { header: 'Collected Amount (LKR)', key: 'collectedAmount', width: 26 }
];

const methodColumns = [
    { header: 'Payment Method', key: 'paymentMethod' },
    { header: 'Payment Count', key: 'paymentCount' },
    { header: 'Collected Amount (LKR)', key: 'collectedAmount', width: 26 }
];

const transactionColumns = [
    { header: 'Payment Number', key: 'paymentNumber' },
    { header: 'Payment Reference', key: 'paymentReference' },
    { header: 'Transaction Reference', key: 'transactionReference' },
    { header: 'Order Number', key: 'orderNumber' },
    { header: 'Payment Method', key: 'paymentMethod' },
    { header: 'Payment Status', key: 'paymentStatus' },
    { header: 'Amount (LKR)', key: 'amount' },
    { header: 'Payment Date', key: 'paymentDate', width: 25 }
];

const refundColumns = [
    { header: 'Payment Status', key: 'paymentStatus' },
    { header: 'Payment Count', key: 'paymentCount' },
    { header: 'Recorded Amount (LKR)', key: 'recordedAmount', width: 28 }
];

module.exports = {
    getCollectionSummary: (req, res) =>
        sendReport(req, res, reports.getPaymentCollectionSummary, 'payment collection'),

    exportCollectionSummary: (req, res) =>
        exportReport(req, res, reports.getPaymentCollectionSummary, 'Payment Collection', collectionColumns),

    getMethodBreakdown: (req, res) =>
        sendReport(req, res, reports.getPaymentMethodBreakdown, 'payment method'),

    exportMethodBreakdown: (req, res) =>
        exportReport(req, res, reports.getPaymentMethodBreakdown, 'Payment Methods', methodColumns),

    getTransactionHistory: (req, res) =>
        sendReport(req, res, reports.getPaymentTransactionHistory, 'payment transaction'),

    exportTransactionHistory: (req, res) =>
        exportReport(req, res, reports.getPaymentTransactionHistory, 'Payment Transactions', transactionColumns),

    getRefundStatus: (req, res) =>
        sendReport(req, res, reports.getRefundStatusSummary, 'refund status'),

    exportRefundStatus: (req, res) =>
        exportReport(req, res, reports.getRefundStatusSummary, 'Refund Status', refundColumns)
};
