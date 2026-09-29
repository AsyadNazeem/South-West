'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('promotion_items', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true
      },

      promotion_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        references: {
          model: 'promotions',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },

      item_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        references: {
          model: 'items',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
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
        'promotion_items',
        ['promotion_id', 'item_id'],
        {
          unique: true
        }
    );

    await queryInterface.addIndex(
        'promotion_items',
        ['item_id']
    );
  },

  async down(queryInterface) {
    await queryInterface.removeIndex(
        'promotion_items',
        ['promotion_id', 'item_id']
    );

    await queryInterface.removeIndex(
        'promotion_items',
        ['item_id']
    );

    await queryInterface.dropTable('promotion_items');
  }
};
