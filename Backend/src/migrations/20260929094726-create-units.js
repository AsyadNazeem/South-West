'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('units', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true
      },

      name: {
        type: Sequelize.STRING(50),
        allowNull: false,
        unique: true
      },

      code: {
        type: Sequelize.STRING(20),
        allowNull: false,
        unique: true
      },

      description: {
        type: Sequelize.STRING(255),
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
    await queryInterface.dropTable('units');
  }
};
