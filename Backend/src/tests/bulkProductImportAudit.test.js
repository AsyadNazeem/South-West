'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const ExcelJS = require('exceljs');
const proxyquire = require('proxyquire').noCallThru();

function response() { return { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } }; }
async function workbook() { const book = new ExcelJS.Workbook(); book.addWorksheet('Import'); return book.xlsx.writeBuffer(); }
function parsed({ invalid = false } = {}) {
    const products = [
        { rowNumber: 2, errors: invalid ? ['invalid row'] : [], variants: [{}, {}] },
        { rowNumber: 3, errors: [], variants: [{}] }
    ];
    return { products, problems: [], counts: { products: 2, variants: 3, valid: invalid ? 1 : 2, invalid: invalid ? 1 : 0 } };
}
function setup({ outcomes = [], auditError = null, validationError = null, invalid = false } = {}) {
    const events = [];
    let calls = 0;
    const service = {
        parseAndValidate: async () => { if (validationError) throw validationError; return parsed({ invalid }); },
        summary: () => ({}),
        importProducts: async () => outcomes[calls++]
    };
    const controller = proxyquire('../controllers/bulkProductImportController', {
        '../services/bulkProductImportService': service,
        '../services/auditLogService': { recordAuditLog: async event => { if (auditError) throw auditError; events.push(event); } }
    });
    return { controller, events, getCalls: () => calls };
}
const request = (extras = {}) => ({ user: { id: 17, email: 'admin@example.test' }, ip: '127.0.0.1', get: () => 'test-agent', ...extras });
const imported = { rowNumber: 2, name: 'secret product name', status: 'Imported', itemCode: 'SW-1' };
const failed = { rowNumber: 3, name: 'private customer data', status: 'Failed', error: 'secret details' };

async function upload(controller) {
    const res = response();
    await controller.upload(request({ file: { buffer: await workbook(), size: 100, originalname: '../products.xlsx', mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' } }), res);
    assert.ok(res.body.importId);
    return res.body.importId;
}
async function confirm(controller, id, extra = {}) {
    const res = response();
    await controller.confirm(request({ params: { id }, body: { confirm: true, ...extra } }), res);
    return res;
}

test('successful import writes one safe aggregate event and keeps business result', async () => {
    const setupData = setup({ outcomes: [{ imported: 2, failed: 0, results: [imported, { ...imported, rowNumber: 3 }] }] });
    const id = await upload(setupData.controller);
    const result = await confirm(setupData.controller, id);
    assert.equal(result.body.imported, 2);
    const event = setupData.events.find(item => item.action === 'BULK_PRODUCT_IMPORT');
    assert.ok(event);
    assert.equal(event.newValues.filename, 'products.xlsx');
    assert.deepEqual({ total: event.newValues.total_rows, successful: event.newValues.successful_rows, failed: event.newValues.failed_rows, skipped: event.newValues.skipped_rows }, { total: 5, successful: 5, failed: 0, skipped: 0 });
    assert.equal(event.newValues.records_created, 2);
    assert.equal(JSON.stringify(event).includes('secret product name'), false);
});

test('validation parse failure writes a safe failure event', async () => {
    const setupData = setup({ validationError: new Error('sensitive cell contents: SECRET') });
    const res = response();
    await setupData.controller.upload(request({ file: { buffer: await workbook(), size: 100, originalname: 'data.xlsx', mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' } }), res);
    assert.equal(res.statusCode, 400);
    assert.equal(setupData.events[0].action, 'BULK_PRODUCT_IMPORT_VALIDATION_FAILED');
    assert.equal(setupData.events[0].newValues.error_summary, 'Workbook validation failed');
    assert.equal(JSON.stringify(setupData.events[0]).includes('SECRET'), false);
});

test('validation issues report failed and skipped workbook row counts', async () => {
    const setupData = setup({ invalid: true });
    const id = await upload(setupData.controller);
    const event = setupData.events[0];
    assert.equal(event.newValues.total_rows, 5);
    assert.equal(event.newValues.failed_rows, 3);
    assert.equal(event.newValues.skipped_rows, 2);
    assert.equal(event.newValues.result, 'VALIDATION_FAILED');
    await confirm(setupData.controller, id);
    assert.equal(setupData.events.at(-1).action, 'BULK_PRODUCT_IMPORT_FAILED');
});

test('partial import reports accurate row counts without spreadsheet values', async () => {
    const setupData = setup({ outcomes: [{ imported: 1, failed: 1, results: [imported, failed] }] });
    const id = await upload(setupData.controller);
    await confirm(setupData.controller, id);
    const event = setupData.events.find(item => item.action === 'BULK_PRODUCT_IMPORT');
    assert.equal(event.newValues.result, 'PARTIAL_SUCCESS');
    assert.deepEqual([event.newValues.total_rows, event.newValues.successful_rows, event.newValues.failed_rows, event.newValues.skipped_rows], [5, 3, 2, 0]);
    assert.equal(JSON.stringify(event).includes('private customer data'), false);
    assert.equal(JSON.stringify(event).includes('secret details'), false);
});

test('retry merges prior successes with retried failures without double-counting', async () => {
    const setupData = setup({ outcomes: [
        { imported: 1, failed: 1, results: [imported, failed] },
        { imported: 1, failed: 0, results: [{ ...failed, status: 'Imported', itemCode: 'SW-2' }] }
    ] });
    const id = await upload(setupData.controller);
    await confirm(setupData.controller, id);
    const result = await confirm(setupData.controller, id, { retry: true });
    assert.equal(setupData.getCalls(), 2);
    assert.equal(result.body.imported, 2);
    assert.equal(result.body.failed, 0);
    const event = setupData.events.filter(item => item.action === 'BULK_PRODUCT_IMPORT').at(-1);
    assert.deepEqual([event.newValues.total_rows, event.newValues.successful_rows, event.newValues.failed_rows, event.newValues.skipped_rows], [5, 5, 0, 0]);
    assert.equal(event.newValues.records_created, 2);
});

test('audit storage failures never interrupt import or retry', async () => {
    const setupData = setup({ auditError: new Error('audit offline'), outcomes: [{ imported: 2, failed: 0, results: [imported, { ...imported, rowNumber: 3 }] }] });
    const id = await upload(setupData.controller);
    const result = await confirm(setupData.controller, id);
    assert.equal(result.statusCode, 200);
    assert.equal(result.body.imported, 2);
});
