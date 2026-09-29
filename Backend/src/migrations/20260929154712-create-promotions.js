'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('promotions', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true
      },

      promotion_code: {
        type: Sequelize.STRING(100),
        allowNull: false,
        unique: true
      },

      promotion_name: {
        type: Sequelize.STRING(150),
        allowNull: false
      },

      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },

      promotion_type: {
        type: Sequelize.ENUM(
            'percentage',
            'fixed_amount',
            'buy_x_get_y',
            'free_shipping'
        ),
        allowNull: false
      },

      discount_value: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true
      },

      minimum_order_amount: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true
      },

      maximum_discount_amount: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true
      },

      usage_limit: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true
      },

      usage_limit_per_customer: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true
      },

      used_count: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0
      },

      start_date: {
        type: Sequelize.DATE,
        allowNull: false
      },

      end_date: {
        type: Sequelize.DATE,
        allowNull: false
      },

      status: {
        type: Sequelize.ENUM(
            'draft',
            'scheduled',
            'active',
            'paused',
            'expired',
            'cancelled'
        ),
        allowNull: false,
        defaultValue: 'draft'
      },

      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },

      created_by: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
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
        'promotions',
        ['promotion_code']
    );

    await queryInterface.addIndex(
        'promotions',
        ['status']
    );

    await queryInterface.addIndex(
        'promotions',
        ['start_date', 'end_date']
    );

    await queryInterface.addIndex(
        'promotions',
        ['created_by']
    );
  },

  async down(queryInterface) {
    await queryInterface.removeIndex(
        'promotions',
        ['promotion_code']
    );

    await queryInterface.removeIndex(
        'promotions',
        ['status']
    );

    await queryInterface.removeIndex(
        'promotions',
        ['start_date', 'end_date']
    );

    await queryInterface.removeIndex(
        'promotions',
        ['created_by']
    );

    await queryInterface.dropTable('promotions');
  }
};
