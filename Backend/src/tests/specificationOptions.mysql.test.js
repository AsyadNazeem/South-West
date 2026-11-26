'use strict';

// Opt in with a socket belonging to a disposable local mysqld. Each run creates
// its own database. Application credentials and the configured catalog are unused.
const test = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const mysql = require('mysql2/promise');
const { Sequelize, DataTypes } = require('sequelize');
const express = require('express');
const proxyquire = require('proxyquire').noCallThru();

const socketPath = process.env.SPEC_OPTIONS_FIXTURE_SOCKET;

for (const storage of ['JSON', 'LONGTEXT']) {
    test('specification HTTP and assignment integrity on ' + storage, { skip: !socketPath }, async t => {
        const dbName = 'spec_options_test_' + randomBytes(8).toString('hex');
        const admin = await mysql.createConnection({ socketPath, user: 'root' });
        await admin.query('CREATE DATABASE ' + dbName);
        t.after(async () => {
            await admin.query('DROP DATABASE ' + dbName);
            await admin.end();
        });
        const sequelize = new Sequelize(dbName, 'root', '', {
            dialect: 'mysql', dialectOptions: { socketPath }, logging: false
        });
        t.after(() => sequelize.close());
        const models = { sequelize };
        for (const name of ['ItemSpecification', 'ItemType', 'ItemTypeSpecification', 'ItemSpecificationValue', 'ItemVariant', 'AuditLog']) {
            models[name] = require('../models/' + name)(sequelize, DataTypes);
        }
        models.ItemSpecification.associate(models);
        await sequelize.sync();
        if (storage === 'LONGTEXT') {
            await sequelize.query('ALTER TABLE item_specifications MODIFY options LONGTEXT NOT NULL');
        }
        await sequelize.query('CREATE TABLE item_specification_code_sequences (id INT PRIMARY KEY, next_value INT)');
        await sequelize.query('INSERT INTO item_specification_code_sequences VALUES (1, 1)');
        const audit = proxyquire('../services/auditLogService', { '../models': models });
        const ctl = proxyquire('../controllers/itemSpecificationController', {
            '../models': models, '../services/auditLogService': audit
        });
        const app = express();
        app.use(express.json());
        app.get('/specs', ctl.getItemSpecifications);
        app.get('/specs/:id', ctl.getItemSpecificationById);
        app.post('/specs', ctl.createItemSpecification);
        app.put('/specs/:id', ctl.updateItemSpecification);
        const server = await new Promise(resolve => {
            const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
        });
        t.after(() => new Promise(resolve => server.close(resolve)));
        async function request(method, path, body, status = 200) {
            const response = await fetch('http://127.0.0.1:' + server.address().port + path, {
                method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body)
            });
            const result = await response.json();
            assert.equal(response.status, status, JSON.stringify(result));
            return result.data;
        }
        const list = ['1 PSC', '2 PSC'];
        const pack = await request('POST', '/specs', { name: 'Pack Quantity', data_type: 'select', options: list }, 201);
        const path = '/specs/' + pack.id;
        assert.deepEqual(pack.options, list);
        assert.deepEqual((await request('GET', '/specs'))[0].options, list);
        assert.deepEqual((await request('PUT', path, { description: 'new description' })).options, list);
        const replace = (options, expected_options, status) => request('PUT', path, { options, expected_options }, status);
        assert.deepEqual((await replace([...list, 'bulk'], list)).options, [...list, 'bulk']);
        assert.deepEqual((await replace(['case', ...list], [...list, 'bulk'])).options, ['case', ...list]);
        await replace(list, ['case', ...list]);
        await replace(['2 PSC'], ['case', ...list], 409);
        await replace([], list, 409);
        const { ItemVariant, ItemSpecificationValue } = models;
        const variant = { item_id: 99, variant_name: 'fixture', variant_sku: 'fixture', is_active: false };
        async function assignVariant(attributes) {
            return sequelize.transaction(transaction => ItemVariant.create({ ...variant, attributes }, { transaction }));
        }
        await assignVariant({ 'pack quantity': '2 PSC' });
        await sequelize.transaction(transaction => ItemSpecificationValue.create({
            specification_id: pack.id, item_id: 99, value: '1 PSC'
        }, { transaction }));
        await replace(['1 PSC'], list, 409);
        await replace(['2 PSC'], list, 409);
        await request('PUT', path, { name: 'new name' }, 409);
        await request('PUT', path, { data_type: 'text', options: [], expected_options: list }, 409);
        assert.deepEqual((await request('GET', path)).options, list);
        assert.deepEqual((await ItemVariant.findOne()).attributes, { 'pack quantity': '2 PSC' });
        assert.equal((await ItemSpecificationValue.findOne()).value, '1 PSC');
        const text = await request('POST', '/specs', { name: 'Interface', data_type: 'text' }, 201);
        const emptyPath = '/specs/' + text.id;
        await request('PUT', emptyPath, { description: 'edited' });
        await sequelize.query("UPDATE item_specifications SET options='null', data_type='select' WHERE id=?", { replacements: [text.id] });
        assert.deepEqual((await request('PUT', emptyPath, { description: 'legacy' })).options, []);
        await request('POST', '/specs', { name: 'empty', data_type: 'select', options: [] }, 400);

        // Hold the definition lock until a waiting writer has started. The
        // writer must read the committed list before assigning an option.
        await replace([...list, 'unused'], list);
        const writer = await sequelize.transaction();
        const locked = await models.ItemSpecification.findByPk(pack.id, { transaction: writer, lock: writer.LOCK.UPDATE });
        await locked.update({ options: list }, { transaction: writer });
        const pending = assert.rejects(sequelize.transaction(transaction => ItemVariant.create({
            ...variant, variant_sku: 'second', attributes: { 'Pack Quantity': 'unused' }
        }, { transaction })), /current predefined/);
        await writer.commit();
        await pending;
        assert.equal(await ItemVariant.count(), 1);

        // The opposite ordering: an assignment holding a shared definition
        // lock commits first. The remove request must see its new usage.
        await replace([...list, 'new size'], list);
        const assignment = await sequelize.transaction();
        await ItemVariant.create({
            ...variant, variant_sku: 'concurrent', attributes: { 'Pack Quantity': 'new size' }
        }, { transaction: assignment });
        const removal = replace(list, [...list, 'new size'], 409);
        await assignment.commit();
        await removal;
        assert.deepEqual((await request('GET', path)).options, [...list, 'new size']);
        const legacy = await ItemVariant.findOne({ where: { variant_sku: 'fixture' } });
        await sequelize.query('UPDATE item_variants SET attributes=? WHERE id=?', {
            replacements: [JSON.stringify({ 'Pack Quantity': 'retired literal' }), legacy.id]
        });
        await legacy.reload();
        await sequelize.transaction(transaction => legacy.update({
            attributes: { 'Pack Quantity': 'retired literal', Model: 'updated' }
        }, { transaction }));
        assert.equal(legacy.attributes['Pack Quantity'], 'retired literal');
        await request('PUT', emptyPath, { data_type: 'text', options: [], expected_options: [] });
        assert.equal((await request('GET', emptyPath)).data_type, 'text');
    });
}
