'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('carts', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true
      },

      customer_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        references: {
          model: 'customers',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },

      status: {
        type: Sequelize.ENUM(
            'active',
            'converted',
            'abandoned',
            'expired'
        ),
        allowNull: false,
        defaultValue: 'active'
      },

      expires_at: {
        type: Sequelize.DATE,
        allowNull: true
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

    await queryInterface.addIndex(
        'carts',
        ['customer_id']
    );

    await queryInterface.addIndex(
        'carts',
        ['status']
    );
  },

  async down(queryInterface) {
    await queryInterface.removeIndex(
        'carts',
        ['customer_id']
    );

    await queryInterface.removeIndex(
        'carts',
        ['status']
    );

    await queryInterface.dropTable('carts');
  }
};
