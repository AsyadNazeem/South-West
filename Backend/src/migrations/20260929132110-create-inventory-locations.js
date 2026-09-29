'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('inventory_locations', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true
      },

      code: {
        type: Sequelize.STRING(50),
        allowNull: false,
        unique: true
      },

      name: {
        type: Sequelize.STRING(150),
        allowNull: false
      },

      location_type: {
        type: Sequelize.ENUM(
            'store',
            'warehouse',
            'online',
            'service'
        ),
        allowNull: false,
        defaultValue: 'store'
      },

      address: {
        type: Sequelize.TEXT,
        allowNull: true
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
    await queryInterface.dropTable('inventory_locations');
  }
};
