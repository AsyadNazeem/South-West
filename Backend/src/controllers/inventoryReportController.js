'use strict';

const ExcelJS = require('exceljs');
const reports = require('../services/inventoryReportService');

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

        columns.forEach((column, index) => {
            if (column.quantity) {
                sheet.getColumn(index + 1).numFmt = '#,##0.000';
            }
        });

        sheet.views = [{ state: 'frozen', ySplit: 1 }];

        sheet.autoFilter = {
            from: 'A1',
            to: `${String.fromCharCode(64 + columns.length)}1`
        };

        sheet.addRow([]);
        sheet.addRow(['Reporting timezone', report.timezone]);

        if (report.filters.startDate) {
            sheet.addRow(['Start date', report.filters.startDate]);
            sheet.addRow(['End date', report.filters.endDate]);
        }

        if (report.filters.locationId) {
            sheet.addRow(['Location ID', report.filters.locationId]);
        }

        if (report.filters.itemId) {
            sheet.addRow(['Item ID', report.filters.itemId]);
        }

        res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );

        const datePart = report.filters.startDate
            ? `-${report.filters.startDate}-to-${report.filters.endDate}`
            : '';

        res.setHeader(
            'Content-Disposition',
            `attachment; filename="${name.toLowerCase().replace(/\s+/g, '-')}${datePart}.xlsx"`
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

const stockColumns = [
    { header: 'Item Code', key: 'itemCode' },
    { header: 'Product', key: 'itemName', width: 32 },
    { header: 'Variant SKU', key: 'variantSku' },
    { header: 'Variant', key: 'variantName', width: 28 },
    { header: 'Attributes', key: 'attributes', width: 32 },
    { header: 'Location Code', key: 'locationCode' },
    { header: 'Location', key: 'locationName' },
    { header: 'On Hand', key: 'quantityOnHand', quantity: true },
    { header: 'Reserved', key: 'quantityReserved', quantity: true },
    { header: 'Available', key: 'availableQuantity', quantity: true },
    { header: 'Reorder Level', key: 'reorderLevel', quantity: true },
    { header: 'Reorder Quantity', key: 'reorderQuantity', quantity: true }
];

const locationColumns = [
    { header: 'Location Code', key: 'locationCode' },
    { header: 'Location', key: 'locationName' },
    { header: 'Location Type', key: 'locationType' },
    { header: 'Stock Records', key: 'stockRecordCount' },
    { header: 'On Hand', key: 'quantityOnHand', quantity: true },
    { header: 'Reserved', key: 'quantityReserved', quantity: true },
    { header: 'Available', key: 'availableQuantity', quantity: true }
];

const movementColumns = [
    { header: 'Movement ID', key: 'movementId' },
    { header: 'Date', key: 'createdAt', width: 24 },
    { header: 'Item Code', key: 'itemCode' },
    { header: 'Product', key: 'itemName', width: 30 },
    { header: 'Variant SKU', key: 'variantSku' },
    { header: 'Variant', key: 'variantName' },
    { header: 'Location', key: 'locationName' },
    { header: 'Movement Type', key: 'movementType' },
    { header: 'Direction', key: 'direction' },
    { header: 'Recorded Quantity', key: 'quantity', quantity: true },
    { header: 'Signed Quantity', key: 'signedQuantity', quantity: true },
    { header: 'Reference Type', key: 'referenceType' },
    { header: 'Reference ID', key: 'referenceId' },
    { header: 'Created By', key: 'createdByEmail' },
    { header: 'Notes', key: 'notes', width: 45 }
];

function handlers(service, name, columns) {
    return {
        get: (req, res) => sendReport(req, res, service, name),
        export: (req, res) => exportReport(req, res, service, name, columns)
    };
}

const summary = handlers(
    reports.getStockSummary,
    'Stock Summary',
    stockColumns
);

const low = handlers(
    reports.getLowStock,
    'Low Stock',
    stockColumns
);

const out = handlers(
    reports.getOutOfStock,
    'Out of Stock',
    stockColumns
);

const locations = handlers(
    reports.getStockByLocation,
    'Stock By Location',
    locationColumns
);

const movements = handlers(
    reports.getStockMovements,
    'Stock Movements',
    movementColumns
);

const adjustments = handlers(
    reports.getStockAdjustments,
    'Stock Adjustments',
    movementColumns
);

module.exports = {
    getSummary: summary.get,
    exportSummary: summary.export,
    getLowStock: low.get,
    exportLowStock: low.export,
    getOutOfStock: out.get,
    exportOutOfStock: out.export,
    getByLocation: locations.get,
    exportByLocation: locations.export,
    getMovements: movements.get,
    exportMovements: movements.export,
    getAdjustments: adjustments.get,
    exportAdjustments: adjustments.export
};
