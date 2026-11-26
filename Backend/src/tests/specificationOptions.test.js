'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readOptions, guardDefinitionChange } = require('../services/specificationOptions');

test('preserves stored order and literals across native, encoded and legacy lists', () => {
    const list = ['2 PSC', '1 PSC'];
    assert.deepEqual(readOptions(list), list);
    assert.deepEqual(readOptions(JSON.stringify(list)), list);
    assert.deepEqual(readOptions('2 PSC\r\n1 PSC'), list);
    assert.deepEqual(readOptions('null'), []);
    assert.deepEqual(readOptions(null), []);
    for (const raw of ['[broken', '[\n"partial"', '{"x":1}', '[1]', 'broken']) {
        assert.equal(readOptions(raw), null);
    }
});

test('metadata-only updates allow legacy empty or unreadable lists without replacing them', async () => {
    for (const options of [[], null]) {
        await guardDefinitionChange({ data_type: 'select', options }, { description: 'updated' });
    }
});

test('option replacements require a fresh ordered baseline and a nonempty Select list', async () => {
    const definition = { data_type: 'select', options: ['a', 'b'] };
    for (const expected of [undefined, ['b', 'a']]) {
        await assert.rejects(guardDefinitionChange(definition, { options: ['a'] }, expected), /Reopen/);
    }
    await assert.rejects(guardDefinitionChange(definition, { options: [] }, definition.options), /at least one/);
    await assert.rejects(guardDefinitionChange({ ...definition, options: null }, { options: ['a'] }, []), /could not be read/);
});
