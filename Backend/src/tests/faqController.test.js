'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const proxyquire = require('proxyquire').noCallThru();

function createHarness() {
    const records = new Map();
    let nextId = 1;

    const wrap = record => {
        const instance = {
            ...record,
            async update(changes) {
                Object.assign(record, changes);
                Object.assign(instance, changes);
                return instance;
            },
            async destroy() {
                records.delete(record.id);
            },
        };

        return instance;
    };

    const Faq = {
        findAll: async options => {
            let rows = [...records.values()];

            if (options.where?.is_active === true) {
                rows = rows.filter(row => row.is_active);
            }

            rows.sort((a, b) =>
                a.sort_order - b.sort_order || a.id - b.id
            );

            return rows.map(wrap);
        },
        findByPk: async id => {
            const record = records.get(id);
            return record ? wrap(record) : null;
        },
        create: async data => {
            const record = {
                id: nextId++,
                category: null,
                link_url: null,
                link_text: null,
                sort_order: 0,
                is_active: true,
                ...data,
            };

            records.set(record.id, record);
            return wrap(record);
        },
    };

    const controller = proxyquire('../controllers/faqController', {
        '../models': { Faq },
    });

    const call = async (method, { id, body } = {}) => {
        const response = {
            statusCode: 200,
            body: null,
            status(code) {
                this.statusCode = code;
                return this;
            },
            json(payload) {
                this.body = payload;
                return this;
            },
        };

        await controller[method]({
            params: id === undefined ? {} : { id: String(id) },
            body,
        }, response);

        return response;
    };

    return { call, records };
}

test('Admin can create and retrieve an FAQ', async () => {
    const { call } = createHarness();

    const created = await call('createFaq', {
        body: {
            question: '  How does delivery work?  ',
            answer: '  Delivery information.  ',
            category: 'Shipping',
            sort_order: 2,
        },
    });

    assert.equal(created.statusCode, 201);
    assert.equal(created.body.data.question, 'How does delivery work?');
    assert.equal(created.body.data.answer, 'Delivery information.');

    const retrieved = await call('getAdminFaqById', { id: 1 });

    assert.equal(retrieved.statusCode, 200);
    assert.equal(retrieved.body.data.category, 'Shipping');
});

test('Admin can update an FAQ', async () => {
    const { call } = createHarness();

    await call('createFaq', {
        body: { question: 'Original?', answer: 'Original answer.' },
    });

    const updated = await call('updateFaq', {
        id: 1,
        body: {
            question: 'Updated?',
            sort_order: 5,
        },
    });

    assert.equal(updated.statusCode, 200);
    assert.equal(updated.body.data.question, 'Updated?');
    assert.equal(updated.body.data.sort_order, 5);
    assert.equal(updated.body.data.answer, 'Original answer.');
});

test('Inactive FAQs are excluded from the public API', async () => {
    const { call } = createHarness();

    await call('createFaq', {
        body: { question: 'Visible?', answer: 'Yes.' },
    });

    await call('createFaq', {
        body: { question: 'Hidden?', answer: 'No.' },
    });

    const status = await call('updateFaqStatus', {
        id: 2,
        body: { is_active: false },
    });

    assert.equal(status.statusCode, 200);

    const publicResult = await call('getPublicFaqs');
    const adminResult = await call('getAdminFaqs');

    assert.equal(publicResult.body.data.length, 1);
    assert.equal(adminResult.body.data.length, 2);
    assert.equal(publicResult.body.data[0].question, 'Visible?');
});

test('Public FAQs are sorted by sort_order then ID', async () => {
    const { call } = createHarness();

    for (const [question, sort_order] of [
        ['Third', 10],
        ['First', 1],
        ['Second', 1],
    ]) {
        await call('createFaq', {
            body: { question, answer: 'Answer', sort_order },
        });
    }

    const response = await call('getPublicFaqs');

    assert.deepEqual(
        response.body.data.map(faq => faq.question),
        ['First', 'Second', 'Third']
    );
});

test('Admin can delete an FAQ', async () => {
    const { call } = createHarness();

    await call('createFaq', {
        body: { question: 'Temporary?', answer: 'Temporary.' },
    });

    const deleted = await call('deleteFaq', { id: 1 });
    const listing = await call('getAdminFaqs');

    assert.equal(deleted.statusCode, 200);
    assert.equal(listing.body.data.length, 0);
});

test('FAQ creation rejects invalid data', async () => {
    const { call } = createHarness();

    const invalidPayloads = [
        { question: '', answer: 'Answer' },
        { question: 'Question?', answer: '' },
        { question: 'Question?', answer: 'Answer', sort_order: -1 },
        { question: 'Question?', answer: 'Answer', is_active: 'yes' },
        { question: 'Question?', answer: 'Answer', link_url: 'javascript:alert(1)' },
        { question: 'Question?', answer: 'Answer', unknown_field: true },
        { question: 'x'.repeat(501), answer: 'Answer' },
    ];

    for (const body of invalidPayloads) {
        const result = await call('createFaq', { body });
        assert.equal(result.statusCode, 400, JSON.stringify(body));
    }
});

test('Invalid and nonexistent FAQ IDs are rejected', async () => {
    const { call } = createHarness();

    const invalid = await call('getAdminFaqById', { id: 'invalid' });
    const missing = await call('getAdminFaqById', { id: 999 });
    const missingDelete = await call('deleteFaq', { id: 999 });

    assert.equal(invalid.statusCode, 400);
    assert.equal(missing.statusCode, 404);
    assert.equal(missingDelete.statusCode, 404);
});

test('FAQ status requires a boolean', async () => {
    const { call } = createHarness();

    const result = await call('updateFaqStatus', {
        id: 1,
        body: { is_active: 'false' },
    });

    assert.equal(result.statusCode, 400);
});

test('FAQ updates reject empty payloads', async () => {
    const { call } = createHarness();

    const result = await call('updateFaq', {
        id: 1,
        body: {},
    });

    assert.equal(result.statusCode, 400);
});
