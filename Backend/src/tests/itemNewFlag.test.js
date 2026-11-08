'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const proxyquire = require('proxyquire').noCallThru();

function response() {
    return {
        statusCode: 200,
        body: null,
        status(code) { this.statusCode = code; return this; },
        json(body) { this.body = body; return this; },
    };
}

function createController(item) {
    const calls = { create: null, update: null, committed: false, rolledBack: false };
    const transaction = {
        finished: false,
        async commit() { this.finished = 'commit'; calls.committed = true; },
        async rollback() { this.finished = 'rollback'; calls.rolledBack = true; },
    };
    const Item = {
        async findOne() { return null; },
        async create(values) {
            calls.create = values;
            return { id: 5, item_code: 'SW-000005', ...values };
        },
        async findByPk() { return item || { id: 5, item_code: 'SW-000005', is_new: false, async update(values) { calls.update = values; Object.assign(this, values); } }; },
    };
    if (item) item.update = async values => { calls.update = values; Object.assign(item, values); };
    const controller = proxyquire('../controllers/itemController', {
        '../models': {
            sequelize: { async transaction() { return transaction; } },
            Item,
            Brand: {}, Category: {}, Unit: {}, ItemType: {}, Warranty: {},
            ItemSpecificationValue: {}, ItemSpecification: {}, ItemImage: {}, ItemVideo: {},
        },
        '../services/auditLogService': { recordAuditLog: async () => {} },
        '../services/itemCodeService': { generateItemCode: async () => 'SW-000005' },
    });
    return { controller, calls };
}

test('item creation saves an explicit NEW flag and defaults an omitted value to false', async () => {
    const yes = createController();
    const yesResponse = response();
    await yes.controller.createItem({ body: { item_name: 'New item', is_new: true }, user: {}, get: () => '' }, yesResponse);
    assert.equal(yesResponse.statusCode, 201);
    assert.equal(yes.calls.create.is_new, true);

    const no = createController();
    const noResponse = response();
    await no.controller.createItem({ body: { item_name: 'Regular item' }, user: {}, get: () => '' }, noResponse);
    assert.equal(noResponse.statusCode, 201);
    assert.equal(no.calls.create.is_new, false);
});

test('item update allows admins to change the NEW flag to false', async () => {
    const item = { id: 5, item_code: 'SW-000005', item_name: 'Product', is_new: true };
    const { controller, calls } = createController(item);
    const res = response();
    await controller.updateItem({ params: { id: '5' }, body: { is_new: false }, user: {}, get: () => '' }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(calls.update.is_new, false);
    assert.equal(res.body.data.is_new, false);
});

test('item create and update reject non-boolean NEW values', async () => {
    const create = createController();
    const createRes = response();
    await create.controller.createItem({ body: { item_name: 'Product', is_new: 'Yes' } }, createRes);
    assert.equal(createRes.statusCode, 400);
    assert.equal(create.calls.rolledBack, true);

    const update = createController({ id: 5, is_new: false });
    const updateRes = response();
    await update.controller.updateItem({ params: { id: '5' }, body: { is_new: 1 } }, updateRes);
    assert.equal(updateRes.statusCode, 400);
    assert.equal(update.calls.rolledBack, true);
});
