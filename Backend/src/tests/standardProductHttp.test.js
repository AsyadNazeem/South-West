'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const express = require('express');
const ExcelJS = require('exceljs');
const proxyquire = require('proxyquire').noCallThru();
const { workbook, harness, sheetNames } = require('./fixtures/standardProductWorkbook');

const mime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

// Use the registered router, multer, controller, workbook service and permission
// middleware. Replace the session lookup and model writes with local fixtures.
async function serverFor(t) {
    const { service, models, writes } = harness();
    const controller = proxyquire('../controllers/bulkProductImportController', {
        '../services/bulkProductImportService': service, '../services/auditLogService': { recordAuditLog: async () => {} }
    });
    const permission = proxyquire('../middleware/requirePermission', { '../models': {} });
    const authenticate = proxyquire('../middleware/authMiddleware', {
        '../models': {}, '../utils/jwt': {}, '../services/authService': {}
    });
    const sessions = { owner: [1, 'products.create'], colleague: [2, 'products.create'], viewer: [3, 'products.view'] };
    const router = proxyquire('../routes/bulkProductImportRoutes', {
        '../controllers/bulkProductImportController': controller,
        '../middleware/requirePermission': permission,
        '../middleware/authMiddleware': (req, res, next) => {
            const session = sessions[req.get('X-Fixture-Session')];
            if (!session) return authenticate(req, res, next);
            req.user = { id: session[0] };
            req.authorizationPermissionsPromise = Promise.resolve(new Set([session[1]]));
            return next();
        }
    });
    const app = express();
    app.use(express.json());
    app.use('/api/product-import', router);
    // Expose multer error codes for boundary assertions without importing the
    // application startup or assuming a particular global error response body.
    app.use((err, req, res, next) => res.status(400).json({ code: err.code }));
    const server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    t.after(() => new Promise(resolve => server.close(resolve)));
    const base = 'http://127.0.0.1:' + server.address().port + '/api/product-import';
    function request(path, user, options = {}) {
        return fetch(base + path, { ...options, headers: { 'X-Fixture-Session': user, ...options.headers } });
    }
    function upload(bytes, user = 'owner', field = 'file') {
        const form = new FormData();
        form.append(field, new Blob([bytes], { type: mime }), 'fixture.xlsx');
        return request('/validate', user, { method: 'POST', body: form });
    }
    function confirm(id, body, user = 'owner') {
        return request('/' + id + '/confirm', user, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
        });
    }
    return { request, upload, confirm, models, writes };
}

test('registered Standard endpoints retain authentication and view/create permissions', async t => {
    const { request } = await serverFor(t);
    for (const [path, method] of [['/template', 'GET'], ['/validate', 'POST'], ['/token/errors', 'GET'], ['/token/confirm', 'POST']]) {
        assert.equal((await request(path, 'anonymous', { method })).status, 401);
        assert.equal((await request(path, path === '/template' ? 'owner' : 'viewer', { method })).status, 403);
    }
    const response = await request('/template', 'viewer');
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-disposition'), /south-west-product-import-template.xlsx/);
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(await response.arrayBuffer());
    assert.deepEqual(book.worksheets.map(s => s.name), [...sheetNames.slice(0, 2), 'Specifications', ...sheetNames.slice(2)]);
});

test('registered validation and error download preserve original cells and identify the shipping weight error', async t => {
    const { request, upload, confirm } = await serverFor(t);
    const book = workbook();
    const description = '=SUM(1,2)'; // Literal text entered by the user.
    book.getWorksheet('Products').getCell('H2').value = -1;
    book.getWorksheet('Products').getCell('I2').value = description;
    const response = await upload(await book.xlsx.writeBuffer());
    assert.equal(response.status, 200);
    const preview = await response.json();
    assert.equal(preview.counts.invalid, 1);
    assert.equal(preview.rows[0].status, 'Invalid');
    assert.ok(preview.workbookErrors.some(issue => issue.column === 'Shipping Weight (kg)'));
    assert.equal((await confirm(preview.importId, { confirm: true })).status, 422);
    const url = '/' + preview.importId + '/errors';
    assert.equal((await request(url, 'colleague')).status, 404);
    const errors = await request(url, 'owner');
    assert.equal(errors.status, 200);
    assert.match(errors.headers.get('content-disposition'), /product-import-errors.xlsx/);
    const result = new ExcelJS.Workbook();
    await result.xlsx.load(await errors.arrayBuffer());
    assert.deepEqual(result.worksheets.map(s => s.name), [...sheetNames, 'Import Error Report']);
    assert.equal(result.getWorksheet('Products').getCell('H2').value, -1);
    assert.equal(result.getWorksheet('Products').getCell('I2').value, description);
    const report = result.getWorksheet('Import Error Report');
    assert.deepEqual(report.getRow(1).values.slice(1), ['Worksheet', 'Excel Row', 'Column', 'Problem', 'Suggested correction']);
    assert.deepEqual(report.getRow(2).values.slice(1, 4), ['Products', 2, 'Shipping Weight (kg)']);
    assert.match(report.getCell('D2').value, /positive number/);
    assert.ok(report.getCell('E2').value);
});

test('registered confirm locks a token, replays completed results and retries only failed products', async t => {
    const { upload, confirm, models, writes } = await serverFor(t);
    const response = await upload(await workbook().xlsx.writeBuffer());
    const preview = await response.json();
    assert.equal(response.status, 200);
    assert.equal(preview.counts.valid, 2);
    assert.deepEqual(preview.rows[0].variants.map(v => v.name), ['Short', 'Long']);
    const id = preview.importId;
    assert.equal((await confirm(id, {})).status, 400);
    assert.equal((await confirm(id, { confirm: true }, 'colleague')).status, 404);
    const create = models.Item.create;
    const entered = Promise.withResolvers();
    const resume = Promise.withResolvers();
    models.Item.create = async (values, options) => {
        if (values.item_name === 'Adapter') throw new Error('Simulated persistence failure');
        entered.resolve();
        await resume.promise;
        return create(values, options);
    };
    const first = confirm(id, { confirm: true });
    try {
        await Promise.race([entered.promise, first.then(() => assert.fail('Confirmation ended before catalog write'))]);
        assert.equal((await confirm(id, { confirm: true })).status, 409);
    } finally {
        resume.resolve();
    }
    const partial = await (await first).json();
    assert.deepEqual([partial.imported, partial.failed], [1, 1]);
    assert.deepEqual(await (await confirm(id, { confirm: true })).json(), partial);
    models.Item.create = create;
    const complete = await (await confirm(id, { confirm: true, retry: true })).json();
    assert.deepEqual([complete.imported, complete.failed], [2, 0]);
    assert.deepEqual(await (await confirm(id, { confirm: true })).json(), complete);
    assert.deepEqual(writes.Item.map(item => item.item_name), ['Cable', 'Adapter']);
    assert.equal(writes.InventoryStockMovement.length, 1);
});

test('Standard upload retains its file field and 10 MiB cap', async t => {
    const { upload } = await serverFor(t);
    const book = workbook();
    const bytes = await book.xlsx.writeBuffer();
    assert.equal((await (await upload(bytes, 'owner', 'workbook')).json()).code, 'LIMIT_UNEXPECTED_FILE');
    const limit = 10 * 1024 * 1024;
    const below = await upload(Buffer.alloc(limit - 1));
    assert.match((await below.json()).message, /not a valid .xlsx/);
    const oversized = await upload(Buffer.alloc(limit + 1));
    assert.equal((await oversized.json()).code, 'LIMIT_FILE_SIZE');
});
