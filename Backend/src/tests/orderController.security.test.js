
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const routesPath = path.join(
    __dirname,
    '../routes/orderRoutes.js'
);

const controllerPath = path.join(
    __dirname,
    '../controllers/orderController.js'
);

const routesSource = fs.readFileSync(routesPath, 'utf8');
const controllerSource = fs.readFileSync(controllerPath, 'utf8');

test('manual order creation route is not exposed', () => {
    assert.doesNotMatch(
        routesSource,
        /router\.post\s*\(\s*['"]\/['"]/
    );
});

test('manual order update route is not exposed', () => {
    assert.doesNotMatch(
        routesSource,
        /router\.(?:put|patch)\s*\(\s*['"]\/:id['"]/
    );
});

test('order controller does not export manual creation', () => {
    assert.doesNotMatch(
        controllerSource,
        /exports\.createOrder\s*=/
    );
});

test('order controller does not export manual updates', () => {
    assert.doesNotMatch(
        controllerSource,
        /exports\.updateOrder\s*=/
    );
});

test('order listing remains available', () => {
    assert.match(
        routesSource,
        /router\.get\s*\(\s*['"]\/['"]/
    );
});

test('order detail retrieval remains available', () => {
    assert.match(
        routesSource,
        /router\.get\s*\(\s*['"]\/:id['"]/
    );
});

test('dedicated order status endpoint remains available', () => {
    assert.match(
        routesSource,
        /router\.patch\s*\(\s*['"]\/:id\/status['"]/
    );
});

test('existing cancellation endpoint remains available', () => {
    assert.match(
        routesSource,
        /router\.delete\s*\(\s*['"]\/:id['"]/
    );
});
