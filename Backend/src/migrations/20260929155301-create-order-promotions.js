'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('order_promotions', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true
      },

      order_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        references: {
          model: 'orders',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },

      promotion_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        references: {
          model: 'promotions',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },

      promotion_code: {
        type: Sequelize.STRING(100),
        allowNull: false
      },

      discount_amount: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0
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
        'order_promotions',
        ['order_id']
    );

    await queryInterface.addIndex(
        'order_promotions',
        ['promotion_id']
    );

    await queryInterface.addIndex(
        'order_promotions',
        ['order_id', 'promotion_id'],
        {
          unique: true
        }
    );
  },

  async down(queryInterface) {
    await queryInterface.removeIndex(
        'order_promotions',
        ['order_id']
    );

    await queryInterface.removeIndex(
        'order_promotions',
        ['promotion_id']
    );

    await queryInterface.removeIndex(
        'order_promotions',
        ['order_id', 'promotion_id']
    );

    await queryInterface.dropTable('order_promotions');
  }
};
