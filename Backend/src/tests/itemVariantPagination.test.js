'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const proxyquire = require('proxyquire').noCallThru();

function response() {
    return {
        statusCode: 200,
        body: null,
        status(code) { this.statusCode = code; return this; },
        json(body) { this.body = body; return this; }
    };
}

function loadController() {
    const calls = [];
    const variants = [
        { id: 11, item_id: 4, variant_sku: 'SWV-4-A', item: { id: 4, item_code: 'ITEM-4', item_name: 'Desk' }, toJSON() { return { id: this.id, item_id: this.item_id, variant_sku: this.variant_sku, item: this.item }; } },
        { id: 12, item_id: 4, variant_sku: 'SWV-4-B', item: { id: 4, item_code: 'ITEM-4', item_name: 'Desk' }, toJSON() { return { id: this.id, item_id: this.item_id, variant_sku: this.variant_sku, item: this.item }; } }
    ];
    const controller = proxyquire('../controllers/itemVariantController', {
        '../models': {
            sequelize: {},
            Item: {},
            ItemVariant: {
                async findAndCountAll(options) {
                    calls.push(options);
                    return { rows: variants, count: 5 };
                }
            },
            ItemColor: {},
            ItemVariantColor: {},
            ItemPaymentPrice: {}
        },
        '../services/auditLogService': { recordAuditLog: async () => {} }
    });
    return { controller, calls };
}

test('admin item variants paginate individual variant records and retain filters/search', async () => {
    const { controller, calls } = loadController();
    const req = {
        query: { page: '2', pageSize: '2', search: 'desk', status: 'active', default: 'default' }
    };
    const res = response();

    await controller.getAdminItemVariants(req, res);

    assert.equal(calls.length, 1);
    assert.equal(calls[0].limit, 2);
    assert.equal(calls[0].offset, 2);
    assert.equal(calls[0].where.is_active, true);
    assert.equal(calls[0].where.is_default, true);
    assert.ok(calls[0].where[require('sequelize').Op.or]);
    assert.equal(calls[0].include[0].as, 'item');
    assert.equal(res.body.data.length, 2);
    assert.equal(res.body.data[0].item.item_name, 'Desk');
    assert.deepEqual(res.body.pagination, { page: 2, pageSize: 2, total: 5, totalPages: 3 });
});
