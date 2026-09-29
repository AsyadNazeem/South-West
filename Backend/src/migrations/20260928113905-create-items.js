'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('items', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true
      },

      item_code: {
        type: Sequelize.STRING(50),
        allowNull: false,
        unique: true
      },

      item_name: {
        type: Sequelize.STRING(255),
        allowNull: false
      },

      item_type: {
        type: Sequelize.STRING(50),
        allowNull: false
      },

      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },

      unit: {
        type: Sequelize.STRING(30),
        allowNull: false,
        defaultValue: 'pcs'
      },

      condition: {
        type: Sequelize.STRING(30),
        allowNull: false,
        defaultValue: 'new'
      },

      is_serialized: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },

      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },

      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },

      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal(
            'CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'
        )
      }
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('items');
  }
};
