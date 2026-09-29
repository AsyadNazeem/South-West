'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('item_specification_values', {
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

      specification_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        references: {
          model: 'item_specifications',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },

      value: {
        type: Sequelize.TEXT,
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
        'item_specification_values',
        ['item_id', 'specification_id'],
        {
          unique: true,
          name: 'item_specification_values_unique_idx'
        }
    );
  },

  async down(queryInterface) {
    await queryInterface.removeIndex(
        'item_specification_values',
        'item_specification_values_unique_idx'
    );

    await queryInterface.dropTable('item_specification_values');
  }
};
