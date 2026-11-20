'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const proxyquire = require('proxyquire').noCallThru();
const sequelizeLibrary = require('sequelize');
const { buildOrderPhoneSearch } = require('../utils/orderPhoneSearch');

function createHarness({ count = 0, rows = [], listError = null } = {}) {
    const calls = { list: null };
    const models = {
        sequelize: {},
        Delivery: {
            findAndCountAll: async options => {
                calls.list = options;
                if (listError) throw listError;
                return { count, rows };
            }
        },
        Order: { name: 'Order' },
        Invoice: {},
        Payment: {},
        Customer: {},
        DeliveryStatusHistory: { name: 'DeliveryStatusHistory' },
        Notification: {}
    };
    const controller = proxyquire('../controllers/deliveryController', {
        '../models': models,
        '../services/auditLogService': { recordAuditLog: async () => {} },
        '../services/emailService': {
            sendDeliveryTrackingEmail: async () => {},
            sendOrderStatusEmail: async () => {}
        },
        '../services/invoicePdfService': {
            loadOrderInvoiceData: async () => null,
            generateInvoicePdf: async () => Buffer.alloc(0),
            invoiceFilename: () => 'invoice.pdf'
        },
        '../utils/orderPhoneSearch': require('../utils/orderPhoneSearch')
    });
    const response = {
        statusCode: null,
        body: null,
        status(code) { this.statusCode = code; return this; },
        json(body) { this.body = body; return this; }
    };
    return { controller, calls, response };
}

test('delivery phone search keeps the order alias in the paginated query scope', async () => {
    const { controller, calls, response } = createHarness();
    await controller.getAllDeliveries({
        query: { search: '+94 76-809 4431', page: '2', pageSize: '10' },
        user: { id: 1 },
        get: () => null
    }, response);

    assert.equal(response.statusCode, 200);
    assert.equal(calls.list.subQuery, false);
    assert.equal(calls.list.limit, 10);
    assert.equal(calls.list.offset, 10);
    assert.equal(calls.list.include[1].as, 'statusHistory');
    assert.equal(calls.list.include[1].separate, true);
    assert.deepEqual(calls.list.replacements, {
        deliveryPhone0: '%94768094431%',
        deliveryPhone1: '%0768094431%'
    });
    assert.equal(calls.list.where[sequelizeLibrary.Op.or].length, 7);
    assert.deepEqual(response.body.data, []);
    assert.deepEqual(response.body.pagination, {
        page: 2,
        pageSize: 10,
        total: 0,
        totalPages: 0
    });
});

test('normal delivery listing remains paginated without phone replacements', async () => {
    const { controller, calls, response } = createHarness({ count: 3 });
    await controller.getAllDeliveries({
        query: { page: '1', pageSize: '25' },
        user: { id: 1 },
        get: () => null
    }, response);

    assert.equal(response.statusCode, 200);
    assert.equal(calls.list.replacements, undefined);
    assert.equal(calls.list.subQuery, false);
    assert.deepEqual(response.body.pagination, {
        page: 1,
        pageSize: 25,
        total: 3,
        totalPages: 1
    });
});

test('delivery identifiers and tracking searches keep their existing predicates', async () => {
    for (const search of ['SWD-2026-100', 'TRACK-ABC-9']) {
        const { controller, calls, response } = createHarness();
        await controller.getAllDeliveries({
            query: { search, page: '1', pageSize: '25' },
            user: { id: 1 },
            get: () => null
        }, response);

        assert.equal(response.statusCode, 200);
        assert.equal(calls.list.replacements, undefined);
        assert.equal(
            calls.list.where[sequelizeLibrary.Op.or][0]
                .delivery_reference[sequelizeLibrary.Op.like],
            `%${search}%`
        );
        assert.equal(
            calls.list.where[sequelizeLibrary.Op.or][1]
                .tracking_number[sequelizeLibrary.Op.like],
            `%${search}%`
        );
    }
});

test('generated paginated SQL joins the order before evaluating phone predicates', () => {
    const {
        Delivery, Order, DeliveryStatusHistory, sequelize
    } = require('../models');
    const phoneSearch = buildOrderPhoneSearch('+94 76-809 4431', {
        orderAlias: 'order',
        directPhoneColumns: ['Delivery.recipient_phone'],
        replacementPrefix: 'deliveryPhone'
    });
    const options = {
        where: { [sequelizeLibrary.Op.or]: [phoneSearch.condition] },
        include: [
            { model: Order, as: 'order' },
            {
                model: DeliveryStatusHistory,
                as: 'statusHistory',
                separate: true
            }
        ],
        order: [['id', 'DESC']],
        limit: 25,
        offset: 0,
        distinct: true,
        subQuery: false
    };
    Delivery._validateIncludedElements(options);
    const sql = sequelize.dialect.queryGenerator.selectQuery(
        Delivery.getTableName(), options, Delivery
    );

    assert.equal(sql.includes('FROM (SELECT'), false);
    assert.ok(sql.indexOf('JOIN `orders` AS `order`') < sql.indexOf(' WHERE '));
    assert.match(sql, /`deliveryPhoneAddress`\.`order_id` = `order`\.`id`/);
});

test('delivery list failures do not log searched customer phone values', async () => {
    const searchedPhone = '0768094431';
    const error = new Error(`failed SQL containing ${searchedPhone}`);
    error.parent = { code: 'ER_BAD_FIELD_ERROR' };
    const { controller, response } = createHarness({ listError: error });
    const logged = [];
    const originalError = console.error;
    console.error = (...values) => logged.push(values);
    try {
        await controller.getAllDeliveries({
            query: { search: searchedPhone },
            user: { id: 1 },
            id: 'request-1',
            get: () => null
        }, response);
    } finally {
        console.error = originalError;
    }

    assert.equal(response.statusCode, 500);
    assert.equal(JSON.stringify(logged).includes(searchedPhone), false);
    assert.match(JSON.stringify(logged), /ER_BAD_FIELD_ERROR/);
});
