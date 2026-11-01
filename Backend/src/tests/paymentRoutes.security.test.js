'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

const paymentRoutes = require('../routes/paymentRoutes');

test('payment routes expose read endpoints and a dedicated confirmation endpoint', () => {
    const router = paymentRoutes;

    const registeredRoutes = router.stack
        .filter(layer => layer.route)
        .map(layer => ({
            path: layer.route.path,
            methods: Object.keys(layer.route.methods)
        }));

    assert.deepEqual(registeredRoutes, [
        { path: '/', methods: ['get'] },
        { path: '/:id', methods: ['get'] },
        { path: '/:id/status', methods: ['patch'] }
    ]);
});
