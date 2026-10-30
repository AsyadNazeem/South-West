
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
    updateOrderItem,
    deleteOrderItem
} = require('../controllers/orderItemController');

test('blocks all order-item updates until reconciliation is implemented', async () => {
    const requests = [
        { body: { unit_price: 1 } },
        { body: { discount_amount: 10, tax_amount: 5 } },
        { body: { order_id: 1, item_id: 2, variant_id: 3 } },
        { body: { payment_status: 'paid', line_total: 10 } },
        { body: {} },
        { body: { quantity: 0 } },
        { body: { quantity: 1 }, id: 'invalid' },
        { body: null }
    ];

    for (const request of requests) {
        const req = {
            params: { id: request.id || '1' },
            body: request.body,
             get() {
        return undefined;
    }
            
        };

        const res = {
            statusCode: 200,
            payload: null,

            status(code) {
                this.statusCode = code;
                return this;
            },

            json(payload) {
                this.payload = payload;
                return this;
            }
        };

        await updateOrderItem(req, res);

        assert.equal(res.statusCode, 409);
        assert.match(
            res.payload.message,
            /temporarily disabled/i
        );
    }
});


test('blocks order-item deletion until reconciliation is implemented', async () => {
    const req = {
        params: { id: '1' },
        body: {},
        get() {
            return undefined;
        }
    };

    const res = {
        statusCode: 200,
        payload: null,

        status(code) {
            this.statusCode = code;
            return this;
        },

        json(payload) {
            this.payload = payload;
            return this;
        }
    };

    await deleteOrderItem(req, res);

    assert.equal(res.statusCode, 409);
    assert.match(
        res.payload.message,
        /temporarily disabled/i
    );
});

