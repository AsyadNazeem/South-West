'use strict';

const { permissionCatalog } = require('../config/permissions');

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('admin_notification_preferences', {
      id: { type: Sequelize.BIGINT.UNSIGNED, allowNull: false, autoIncrement: true, primaryKey: true },
      user_id: { type: Sequelize.BIGINT.UNSIGNED, allowNull: false, unique: true, references: { model: 'users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      new_orders: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      payments: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      deliveries: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      reviews: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      customer_requests: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP') }
    });
    await queryInterface.createTable('admin_notifications', {
      id: { type: Sequelize.BIGINT.UNSIGNED, allowNull: false, autoIncrement: true, primaryKey: true },
      user_id: { type: Sequelize.BIGINT.UNSIGNED, allowNull: false, references: { model: 'users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      type: { type: Sequelize.STRING(100), allowNull: false }, title: { type: Sequelize.STRING(200), allowNull: false },
      message: { type: Sequelize.TEXT, allowNull: false }, reference_type: { type: Sequelize.STRING(100), allowNull: true },
      reference_id: { type: Sequelize.BIGINT.UNSIGNED, allowNull: true }, is_read: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      read_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP') }
    });
    await queryInterface.addIndex('admin_notifications', ['user_id', 'is_read']);
    await queryInterface.addIndex('admin_notifications', ['reference_type', 'reference_id']);
    const permission = permissionCatalog.find((item) => item.name === 'notifications.view');
    const [existing] = await queryInterface.sequelize.query("SELECT id FROM permissions WHERE name = 'notifications.view' LIMIT 1");
    let permissionId = existing[0]?.id;
    if (!permissionId && permission) {
      await queryInterface.bulkInsert('permissions', [{ ...permission, created_at: new Date(), updated_at: new Date() }]);
      const [created] = await queryInterface.sequelize.query("SELECT id FROM permissions WHERE name = 'notifications.view' LIMIT 1");
      permissionId = created[0]?.id;
    }
    if (permissionId) {
      const [roles] = await queryInterface.sequelize.query("SELECT id, name FROM roles WHERE name IN ('Admin', 'Super Admin')");
      for (const role of roles) {
        const [link] = await queryInterface.sequelize.query('SELECT id FROM role_permissions WHERE role_id = :roleId AND permission_id = :permissionId LIMIT 1', { replacements: { roleId: role.id, permissionId } });
        if (!link.length) await queryInterface.bulkInsert('role_permissions', [{ role_id: role.id, permission_id: permissionId, created_at: new Date(), updated_at: new Date() }]);
      }
    }
  },
  async down(queryInterface) {
    const [permissionRows] = await queryInterface.sequelize.query("SELECT id FROM permissions WHERE name = 'notifications.view'");
    if (permissionRows.length) {
      const [roles] = await queryInterface.sequelize.query("SELECT id FROM roles WHERE name IN ('Admin', 'Super Admin')");
      if (roles.length) await queryInterface.bulkDelete('role_permissions', { role_id: roles.map((role) => role.id), permission_id: permissionRows.map((row) => row.id) });
      await queryInterface.bulkDelete('permissions', { id: permissionRows.map((row) => row.id) });
    }
    await queryInterface.dropTable('admin_notifications');
    await queryInterface.dropTable('admin_notification_preferences');
  }
};
