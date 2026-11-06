'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const proxyquire = require('proxyquire').noCallThru();

const DataTypes = {
    BIGINT: { UNSIGNED: 'BIGINT UNSIGNED' },
    INTEGER: { UNSIGNED: 'INTEGER UNSIGNED' },
    STRING: () => 'STRING',
    DATE: 'DATE',
    NOW: 'NOW'
};

function loadDefinition(modelPath) {
    class ModelStub {
        static init(attributes, options) {
            this.definition = attributes;
            this.modelOptions = options;
        }
    }

    const modelFactory = proxyquire(modelPath, { sequelize: { Model: ModelStub } });
    const sequelizeStub = { define() {} };
    const ModelClass = modelFactory(sequelizeStub, DataTypes);
    return ModelClass.definition;
}

test('permission model primary key matches the signed INTEGER table migration', () => {
    const definition = loadDefinition('../models/Permission');

    assert.equal(definition.id.type, DataTypes.INTEGER);
    assert.notEqual(definition.id.type, DataTypes.INTEGER.UNSIGNED);
});

test('role permission foreign key matches the signed INTEGER join table migration', () => {
    const definition = loadDefinition('../models/RolePermission');

    assert.equal(definition.role_id.type, DataTypes.INTEGER);
    assert.equal(definition.permission_id.type, DataTypes.INTEGER);
    assert.notEqual(definition.permission_id.type, DataTypes.INTEGER.UNSIGNED);
});
