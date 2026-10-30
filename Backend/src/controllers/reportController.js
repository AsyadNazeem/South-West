'use strict';

const ExcelJS = require('exceljs');

const {
    getOnlineSalesSummary,
    getDailyOnlineSales,
    getMonthlyOnlineSales
} = require('../services/reportService');

async function sendReport(req, res, service, reportName) {
    try {
        const report = await service(req.query);

        return res.status(200).json({
            success: true,
            data: report
        });
    } catch (error) {
        console.error(`${reportName} report error:`, error);

        return res.status(error.status || 500).json({
            success: false,
            message: error.status === 400
                ? error.message
                : `Failed to generate ${reportName} report`
        });
    }
}

async function exportReport(req, res, service, sheetName, filename) {
    try {
        const report = await service(req.query);

        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'South West';
        workbook.created = new Date();

        const sheet = workbook.addWorksheet(sheetName);

        sheet.addRow([
            'Period',
            'Orders',
            'Subtotal (LKR)',
            'Discount (LKR)',
            'Tax (LKR)',
            'Shipping (LKR)',
            'Total Sales (LKR)'
        ]);

        sheet.getRow(1).font = {
            bold: true,
            color: { argb: 'FFFFFFFF' }
        };

        sheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF17365D' }
        };

        for (const row of report.rows) {
            sheet.addRow([
                row.period,
                row.orderCount,
                row.subtotal,
                row.discountAmount,
                row.taxAmount,
                row.shippingAmount,
                row.totalSales
            ]);
        }

        const total = report.totals;

        const totalRow = sheet.addRow([
            'TOTAL',
            total.orderCount,
            total.subtotal,
            total.discountAmount,
            total.taxAmount,
            total.shippingAmount,
            total.totalSales
        ]);

        totalRow.font = { bold: true };

        sheet.columns = [
            { width: 18 },
            { width: 14 },
            { width: 20 },
            { width: 20 },
            { width: 18 },
            { width: 20 },
            { width: 22 }
        ];

        for (let column = 3; column <= 7; column++) {
            sheet.getColumn(column).numFmt = '#,##0.00';
        }

        sheet.views = [{ state: 'frozen', ySplit: 1 }];
        sheet.autoFilter = {
            from: 'A1',
            to: 'G1'
        };

        sheet.addRow([]);
        sheet.addRow(['Reporting timezone', report.timezone]);
        sheet.addRow(['Currency', report.currency]);
        sheet.addRow(['Start date', report.filters.startDate]);
        sheet.addRow(['End date', report.filters.endDate]);

        res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );

        res.setHeader(
            'Content-Disposition',
            `attachment; filename="${filename}-${report.filters.startDate}-to-${report.filters.endDate}.xlsx"`
        );

        await workbook.xlsx.write(res);
        return res.end();
    } catch (error) {
        console.error(`${filename} Excel export error:`, error);

        if (res.headersSent) {
            return res.destroy(error);
        }

        return res.status(error.status || 500).json({
            success: false,
            message: error.status === 400
                ? error.message
                : `Failed to export ${filename}`
        });
    }
}

const getSalesSummary = (req, res) =>
    sendReport(req, res, getOnlineSalesSummary, 'sales summary');

const exportSalesSummary = (req, res) =>
    exportReport(
        req,
        res,
        getOnlineSalesSummary,
        'Online Sales',
        'online-sales-summary'
    );

const getDailySales = (req, res) =>
    sendReport(req, res, getDailyOnlineSales, 'daily sales');

const exportDailySales = (req, res) =>
    exportReport(
        req,
        res,
        getDailyOnlineSales,
        'Daily Sales',
        'daily-online-sales'
    );

const getMonthlySales = (req, res) =>
    sendReport(req, res, getMonthlyOnlineSales, 'monthly sales');

const exportMonthlySales = (req, res) =>
    exportReport(
        req,
        res,
        getMonthlyOnlineSales,
        'Monthly Sales',
        'monthly-online-sales'
    );

module.exports = {
    getSalesSummary,
    exportSalesSummary,
    getDailySales,
    exportDailySales,
    getMonthlySales,
    exportMonthlySales
};
