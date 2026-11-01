'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('delivery_districts', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true
      },
      district_name: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      status: {
        type: Sequelize.TINYINT,
        allowNull: false,
        defaultValue: 1
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false
      }
    });

    await queryInterface.addIndex('delivery_districts', ['district_name'], {
      unique: true,
      name: 'uq_delivery_district_name'
    });

    await queryInterface.addIndex('delivery_districts', ['status'], {
      name: 'idx_delivery_district_status'
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('delivery_districts');
  }
};
