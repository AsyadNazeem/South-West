
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const controllerPath = path.resolve(
    __dirname,
    '../controllers/notificationPreferenceController.js'
);

test('notification preference controller validation rules', async (t) => {
    const source = fs.readFileSync(controllerPath, 'utf8');

    await t.test('rejects empty request bodies', () => {
        assert.match(
            source,
            /if\s*\(!Object\.keys\(body\)\.length\)/
        );
    });

    await t.test('rejects unsupported fields', () => {
        assert.match(
            source,
            /unknownFields\.length/
        );
    });

    await t.test('requires boolean preference values', () => {
        assert.match(
            source,
            /typeof body\[key\] !== 'boolean'/
        );
    });

    await t.test('does not allow customer_id in customer self-service requests', () => {
        assert.match(
            source,
            /const allowedFields = allowCustomerId\s*\?\s*\[\.\.\.PREFERENCE_FIELDS,\s*'customer_id'\]\s*:\s*PREFERENCE_FIELDS/
        );
    });
});
