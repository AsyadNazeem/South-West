'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('promotion_categories', {
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

      category_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        references: {
          model: 'categories',
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
        'promotion_categories',
        ['promotion_id', 'category_id'],
        {
          unique: true
        }
    );

    await queryInterface.addIndex(
        'promotion_categories',
        ['category_id']
    );
  },

  async down(queryInterface) {
    await queryInterface.removeIndex(
        'promotion_categories',
        ['promotion_id', 'category_id']
    );

    await queryInterface.removeIndex(
        'promotion_categories',
        ['category_id']
    );

    await queryInterface.dropTable('promotion_categories');
  }
};
