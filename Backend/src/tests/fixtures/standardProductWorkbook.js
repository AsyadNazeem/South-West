'use strict';

const ExcelJS = require('exceljs');
const proxyquire = require('proxyquire').noCallThru();

// Synthetic V1 contract transcribed from the Phase A baseline. Deliberately
// independent of the service's headers, template generator and sample data.
const productHeaders = ['Product Name', 'Category', 'Brand', 'Item Type', 'Unit of Measure',
    'Warranty', 'Condition', 'Shipping Weight (kg)', 'Description', 'Active Status', 'Mark as New'];
const variantHeaders = ['Product Name', 'Variant Name', 'Cost Price', 'Selling Price', 'Cash Price',
    'Card Price', 'Koko Price', 'Mintpay Price', 'Stock Quantity', 'Reorder Quantity',
    'Stock Location', 'Default Variant', 'QuickBooks Item Code'];
const sheetNames = ['Products', 'Variants', '_Validation', 'Instructions', 'Reference Lists'];

function workbook() {
    const book = new ExcelJS.Workbook();
    const [products, variants, validation] = sheetNames.map(name => book.addWorksheet(name));
    validation.state = 'veryHidden';
    products.addRow(productHeaders);
    variants.addRow(variantHeaders);
    products.addRow(['Cable', 'Accessories', 'Example', 'Cable type', 'Each', '', 'New', 0.2, '', 'Active', 'Yes']);
    products.addRow(['Adapter', 'Accessories', 'Example', 'Cable type', '', '', 'New', 1, '', 'Inactive', 'No']);
    variants.addRow(['Cable', 'Short', 1.01, 2.22, 2.23, 2.24, 2.25, 2.26, 3.125, 1.5, 'Online', '', '0001']);
    variants.addRow(['Adapter', 'Single', null, 0, 0, 0, 0, 0, 0, 2, 'Online', '', '']);
    variants.addRow(['  CABLE ', 'Long', null, 4, 4, 4, 4, 4, 0, 0, '', 'Yes', '']);
    return book;
}

// Capture persistence calls only. These doubles do not simulate SQL rollback.
function harness() {
    const writes = {};
    const models = { ItemTypeSpecification: { findAll: async () => [] }, ItemSpecification: {} };
    const refs = { Category: 'Accessories', Brand: 'Example', ItemType: 'Cable type', Unit: 'Each',
        Warranty: 'One year', InventoryLocation: 'Online' };
    for (const [name, label] of Object.entries(refs)) {
        models[name] = { findAll: async () => [{ id: 1, name: label, is_active: true }] };
    }
    for (const name of ['Item', 'ItemVariant', 'ItemPrice', 'ItemPaymentPrice', 'InventoryStock', 'InventoryStockMovement']) {
        writes[name] = [];
        models[name] = {
            findOne: async () => null,
            create: async values => {
                const record = { ...values, id: writes[name].length + 1 };
                writes[name].push(record);
                return record;
            }
        };
    }
    models.sequelize = { transaction: async () => ({
        LOCK: { UPDATE: 'UPDATE' }, async commit() { this.finished = 'commit'; },
        async rollback() { this.finished = 'rollback'; }
    }) };
    const audit = { recordAuditLog: async () => {} };
    const sku = proxyquire('../../controllers/itemVariantController', { '../models': models, '../services/auditLogService': audit });
    let sequence = 0;
    const service = proxyquire('../../services/bulkProductImportService', {
        '../models': models, './auditLogService': audit, '../controllers/itemVariantController': sku,
        './itemCodeService': { generateItemCode: async () => 'SW-' + String(++sequence).padStart(6, '0') },
        '../controllers/itemPriceController': require('../../services/priceAmount')
    });
    return { service, writes, models };
}

module.exports = { workbook, harness, sheetNames, productHeaders, variantHeaders };
