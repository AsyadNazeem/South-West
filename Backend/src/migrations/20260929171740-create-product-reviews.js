'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('product_reviews', {
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

      order_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: true,
        references: {
          model: 'orders',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },

      rating: {
        type: Sequelize.TINYINT.UNSIGNED,
        allowNull: false
      },

      review_title: {
        type: Sequelize.STRING(200),
        allowNull: true
      },

      review_text: {
        type: Sequelize.TEXT,
        allowNull: true
      },

      status: {
        type: Sequelize.ENUM(
            'pending',
            'approved',
            'rejected'
        ),
        allowNull: false,
        defaultValue: 'pending'
      },

      is_verified_purchase: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
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
        'product_reviews',
        ['item_id']
    );

    await queryInterface.addIndex(
        'product_reviews',
        ['customer_id']
    );

    await queryInterface.addIndex(
        'product_reviews',
        ['order_id']
    );

    await queryInterface.addIndex(
        'product_reviews',
        ['status']
    );

    await queryInterface.addIndex(
        'product_reviews',
        ['item_id', 'customer_id'],
        {
          unique: true
        }
    );
  },

  async down(queryInterface) {
    await queryInterface.removeIndex(
        'product_reviews',
        ['item_id']
    );

    await queryInterface.removeIndex(
        'product_reviews',
        ['customer_id']
    );

    await queryInterface.removeIndex(
        'product_reviews',
        ['order_id']
    );

    await queryInterface.removeIndex(
        'product_reviews',
        ['status']
    );

    await queryInterface.removeIndex(
        'product_reviews',
        ['item_id', 'customer_id']
    );

    await queryInterface.dropTable('product_reviews');
  }
};
