'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('notifications', {
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

      type: {
        type: Sequelize.STRING(100),
        allowNull: false
      },

      title: {
        type: Sequelize.STRING(200),
        allowNull: false
      },

      message: {
        type: Sequelize.TEXT,
        allowNull: false
      },

      reference_type: {
        type: Sequelize.STRING(100),
        allowNull: true
      },

      reference_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: true
      },

      is_read: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },

      read_at: {
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
        'notifications',
        ['customer_id']
    );

    await queryInterface.addIndex(
        'notifications',
        ['customer_id', 'is_read']
    );

    await queryInterface.addIndex(
        'notifications',
        ['reference_type', 'reference_id']
    );
  },

  async down(queryInterface) {
    await queryInterface.removeIndex(
        'notifications',
        ['customer_id']
    );

    await queryInterface.removeIndex(
        'notifications',
        ['customer_id', 'is_read']
    );

    await queryInterface.removeIndex(
        'notifications',
        ['reference_type', 'reference_id']
    );

    await queryInterface.dropTable('notifications');
  }
};
