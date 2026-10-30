'use strict';

const ExcelJS = require('exceljs');

const reports = require('../services/productReportService');

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
            sheet.addRow(columns.map(column => {
                const value = row[column.key];
                return value === null || value === undefined
                    ? ''
                    : typeof value === 'object'
                        ? JSON.stringify(value)
                        : value;
            }));
        }

        sheet.columns = columns.map(column => ({
            width: column.width || 22
        }));

        for (let index = 1; index <= columns.length; index++) {
            if (columns[index - 1].money) {
                sheet.getColumn(index).numFmt = '#,##0.00';
            }
            if (columns[index - 1].quantity) {
                sheet.getColumn(index).numFmt = '#,##0.000';
            }
        }

        sheet.views = [{ state: 'frozen', ySplit: 1 }];
        sheet.autoFilter = {
            from: 'A1',
            to: `${String.fromCharCode(64 + columns.length)}1`
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

const productColumns = [
    { header: 'Item Code', key: 'itemCode' },
    { header: 'Product', key: 'itemName', width: 32 },
    { header: 'Category', key: 'categoryName' },
    { header: 'Brand', key: 'brandName' },
    { header: 'Quantity Sold', key: 'quantitySold', quantity: true },
    { header: 'Gross Sales (LKR)', key: 'grossSales', money: true },
    { header: 'Discount (LKR)', key: 'discountAmount', money: true },
    { header: 'Tax (LKR)', key: 'taxAmount', money: true },
    { header: 'Net Sales (LKR)', key: 'netSales', money: true }
];

const categoryColumns = [
    { header: 'Category Code', key: 'categoryCode' },
    { header: 'Category', key: 'categoryName' },
    { header: 'Product Count', key: 'productCount' },
    { header: 'Quantity Sold', key: 'quantitySold', quantity: true },
    { header: 'Gross Sales (LKR)', key: 'grossSales', money: true },
    { header: 'Discount (LKR)', key: 'discountAmount', money: true },
    { header: 'Tax (LKR)', key: 'taxAmount', money: true },
    { header: 'Net Sales (LKR)', key: 'netSales', money: true }
];

const brandColumns = [
    { header: 'Brand Code', key: 'brandCode' },
    { header: 'Brand', key: 'brandName' },
    { header: 'Product Count', key: 'productCount' },
    { header: 'Quantity Sold', key: 'quantitySold', quantity: true },
    { header: 'Gross Sales (LKR)', key: 'grossSales', money: true },
    { header: 'Discount (LKR)', key: 'discountAmount', money: true },
    { header: 'Tax (LKR)', key: 'taxAmount', money: true },
    { header: 'Net Sales (LKR)', key: 'netSales', money: true }
];

const variantColumns = [
    { header: 'Item Code', key: 'itemCode' },
    { header: 'Product', key: 'itemName', width: 30 },
    { header: 'Variant SKU', key: 'variantSku' },
    { header: 'Variant', key: 'variantName', width: 30 },
    { header: 'Attributes', key: 'attributes', width: 35 },
    { header: 'Quantity Sold', key: 'quantitySold', quantity: true },
    { header: 'Gross Sales (LKR)', key: 'grossSales', money: true },
    { header: 'Discount (LKR)', key: 'discountAmount', money: true },
    { header: 'Tax (LKR)', key: 'taxAmount', money: true },
    { header: 'Net Sales (LKR)', key: 'netSales', money: true }
];

function handlers(service, name, columns) {
    return {
        get: (req, res) => sendReport(req, res, service, name),
        export: (req, res) => exportReport(req, res, service, name, columns)
    };
}

const summary = handlers(reports.getProductSalesSummary, 'Product Sales', productColumns);
const best = handlers(reports.getBestSellingProducts, 'Best Sellers', productColumns);
const least = handlers(reports.getLeastSellingProducts, 'Least Sellers', productColumns);
const categories = handlers(reports.getCategorySales, 'Category Sales', categoryColumns);
const brands = handlers(reports.getBrandSales, 'Brand Sales', brandColumns);
const variants = handlers(reports.getVariantSales, 'Variant Sales', variantColumns);

module.exports = {
    getSummary: summary.get,
    exportSummary: summary.export,
    getBestSellers: best.get,
    exportBestSellers: best.export,
    getLeastSellers: least.get,
    exportLeastSellers: least.export,
    getCategories: categories.get,
    exportCategories: categories.export,
    getBrands: brands.get,
    exportBrands: brands.export,
    getVariants: variants.get,
    exportVariants: variants.export
};
