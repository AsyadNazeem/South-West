'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('admin_notifications', 'is_dismissed', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });
    await queryInterface.addIndex('admin_notifications', ['user_id', 'is_dismissed', 'created_at']);
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('admin_notifications', ['user_id', 'is_dismissed', 'created_at']);
    await queryInterface.removeColumn('admin_notifications', 'is_dismissed');
  }
};
