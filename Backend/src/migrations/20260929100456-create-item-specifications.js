'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('item_specifications', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true
      },

      name: {
        type: Sequelize.STRING(100),
        allowNull: false,
        unique: true
      },

      code: {
        type: Sequelize.STRING(50),
        allowNull: false,
        unique: true
      },

      data_type: {
        type: Sequelize.ENUM(
            'text',
            'number',
            'decimal',
            'boolean',
            'date',
            'select'
        ),
        allowNull: false,
        defaultValue: 'text'
      },

      unit: {
        type: Sequelize.STRING(30),
        allowNull: true
      },

      description: {
        type: Sequelize.STRING(255),
        allowNull: true
      },

      is_required: {
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
    await queryInterface.dropTable('item_specifications');
  }
};
