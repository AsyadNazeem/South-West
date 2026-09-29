'use strict';

module.exports = {
  async up(queryInterface) {
    const now = new Date();

    await queryInterface.bulkInsert('permissions', [
      {
        name: 'dashboard.view',
        module: 'dashboard',
        description: 'View dashboard',
        created_at: now,
        updated_at: now
      },
      {
        name: 'users.view',
        module: 'users',
        description: 'View users',
        created_at: now,
        updated_at: now
      },
      {
        name: 'users.create',
        module: 'users',
        description: 'Create users',
        created_at: now,
        updated_at: now
      },
      {
        name: 'users.update',
        module: 'users',
        description: 'Update users',
        created_at: now,
        updated_at: now
      },
      {
        name: 'users.delete',
        module: 'users',
        description: 'Delete users',
        created_at: now,
        updated_at: now
      },
      {
        name: 'roles.view',
        module: 'roles',
        description: 'View roles',
        created_at: now,
        updated_at: now
      },
      {
        name: 'roles.manage',
        module: 'roles',
        description: 'Create, update and delete roles',
        created_at: now,
        updated_at: now
      },
      {
        name: 'permissions.view',
        module: 'permissions',
        description: 'View permissions',
        created_at: now,
        updated_at: now
      },
      {
        name: 'permissions.manage',
        module: 'permissions',
        description: 'Manage permissions',
        created_at: now,
        updated_at: now
      },
      {
        name: 'products.view',
        module: 'products',
        description: 'View products',
        created_at: now,
        updated_at: now
      },
      {
        name: 'products.create',
        module: 'products',
        description: 'Create products',
        created_at: now,
        updated_at: now
      },
      {
        name: 'products.update',
        module: 'products',
        description: 'Update products',
        created_at: now,
        updated_at: now
      },
      {
        name: 'products.delete',
        module: 'products',
        description: 'Delete products',
        created_at: now,
        updated_at: now
      },
      {
        name: 'orders.view',
        module: 'orders',
        description: 'View orders',
        created_at: now,
        updated_at: now
      },
      {
        name: 'orders.create',
        module: 'orders',
        description: 'Create orders',
        created_at: now,
        updated_at: now
      },
      {
        name: 'orders.update',
        module: 'orders',
        description: 'Update orders',
        created_at: now,
        updated_at: now
      },
      {
        name: 'orders.cancel',
        module: 'orders',
        description: 'Cancel orders',
        created_at: now,
        updated_at: now
      },
      {
        name: 'customers.view',
        module: 'customers',
        description: 'View customers',
        created_at: now,
        updated_at: now
      },
      {
        name: 'customers.create',
        module: 'customers',
        description: 'Create customers',
        created_at: now,
        updated_at: now
      },
      {
        name: 'customers.update',
        module: 'customers',
        description: 'Update customers',
        created_at: now,
        updated_at: now
      },
      {
        name: 'reports.view',
        module: 'reports',
        description: 'View reports',
        created_at: now,
        updated_at: now
      }
    ]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('permissions', {
      name: [
        'dashboard.view',
        'users.view',
        'users.create',
        'users.update',
        'users.delete',
        'roles.view',
        'roles.manage',
        'permissions.view',
        'permissions.manage',
        'products.view',
        'products.create',
        'products.update',
        'products.delete',
        'orders.view',
        'orders.create',
        'orders.update',
        'orders.cancel',
        'customers.view',
        'customers.create',
        'customers.update',
        'reports.view'
      ]
    });
  }
};
