'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('item_prices', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true
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

      price_type: {
        type: Sequelize.STRING(30),
        allowNull: false
      },

      price: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false
      },

      currency: {
        type: Sequelize.STRING(3),
        allowNull: false,
        defaultValue: 'LKR'
      },

      effective_from: {
        type: Sequelize.DATE,
        allowNull: true
      },

      effective_to: {
        type: Sequelize.DATE,
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

    await queryInterface.addIndex('item_prices', ['item_id'], {
      name: 'item_prices_item_id_idx'
    });

    await queryInterface.addIndex(
        'item_prices',
        ['item_id', 'price_type'],
        {
          name: 'item_prices_item_type_idx'
        }
    );
  },

  async down(queryInterface) {
    await queryInterface.removeIndex(
        'item_prices',
        'item_prices_item_type_idx'
    );

    await queryInterface.removeIndex(
        'item_prices',
        'item_prices_item_id_idx'
    );

    await queryInterface.dropTable('item_prices');
  }
};
