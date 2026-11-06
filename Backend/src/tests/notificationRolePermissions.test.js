'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { permissionCatalog, defaultRolePermissions } = require('../config/permissions');

const priorRolePermissions = {
    Manager: [
        'dashboard.view', 'users.view', 'users.create', 'users.update', 'users.delete',
        'roles.view', 'roles.manage', 'products.view', 'products.create', 'products.update', 'products.delete',
        'orders.view', 'orders.create', 'orders.update', 'orders.cancel',
        'customers.view', 'customers.create', 'customers.update', 'reports.view',
        'discount_campaigns.view', 'discount_campaigns.create', 'discount_campaigns.update'
    ],
    Staff: [
        'dashboard.view', 'users.view', 'products.view', 'orders.view', 'customers.view',
        'discount_campaigns.view', 'reports.view'
    ],
    Sales: [
        'dashboard.view', 'products.view', 'orders.view', 'orders.create', 'orders.update', 'orders.cancel',
        'customers.view', 'customers.create', 'discount_campaigns.view', 'customers.update'
    ]
};

test('Manager, Staff and Sales receive notifications.view and no other default permissions change', () => {
    for (const roleName of Object.keys(priorRolePermissions)) {
        const configured = defaultRolePermissions[roleName];
        assert.ok(configured.includes('notifications.view'), `${roleName} should receive notifications.view`);
        assert.deepEqual(configured.filter(name => name !== 'notifications.view'), priorRolePermissions[roleName]);
    }
});

test('Admin still receives every catalog permission and Super Admin defaults are untouched', () => {
    assert.deepEqual(defaultRolePermissions.Admin, permissionCatalog.map(permission => permission.name));
    assert.equal(Object.hasOwn(defaultRolePermissions, 'Super Admin'), false);
    assert.equal(permissionCatalog.filter(permission => permission.name === 'notifications.view').length, 1);
});
