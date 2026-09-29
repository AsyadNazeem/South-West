'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('suppliers', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true
      },

      supplier_code: {
        type: Sequelize.STRING(50),
        allowNull: false,
        unique: true
      },

      company_name: {
        type: Sequelize.STRING(150),
        allowNull: false
      },

      contact_person: {
        type: Sequelize.STRING(150),
        allowNull: true
      },

      email: {
        type: Sequelize.STRING(150),
        allowNull: true
      },

      phone: {
        type: Sequelize.STRING(50),
        allowNull: true
      },

      address_line_1: {
        type: Sequelize.STRING(255),
        allowNull: true
      },

      address_line_2: {
        type: Sequelize.STRING(255),
        allowNull: true
      },

      city: {
        type: Sequelize.STRING(100),
        allowNull: true
      },

      state: {
        type: Sequelize.STRING(100),
        allowNull: true
      },

      postal_code: {
        type: Sequelize.STRING(20),
        allowNull: true
      },

      country: {
        type: Sequelize.STRING(100),
        allowNull: true,
        defaultValue: 'Sri Lanka'
      },

      tax_number: {
        type: Sequelize.STRING(100),
        allowNull: true
      },

      payment_terms: {
        type: Sequelize.STRING(100),
        allowNull: true
      },

      notes: {
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
    await queryInterface.dropTable('suppliers');
  }
};
