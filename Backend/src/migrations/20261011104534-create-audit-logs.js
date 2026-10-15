
'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('audit_logs', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true
      },

      user_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },

      action: {
        type: Sequelize.STRING(100),
        allowNull: false
      },

      module: {
        type: Sequelize.STRING(100),
        allowNull: false
      },

      entity_type: {
        type: Sequelize.STRING(100),
        allowNull: true
      },

      entity_id: {
        type: Sequelize.STRING(100),
        allowNull: true
      },

      description: {
        type: Sequelize.STRING(500),
        allowNull: true
      },

      old_values: {
        type: Sequelize.JSON,
        allowNull: true
      },

      new_values: {
        type: Sequelize.JSON,
        allowNull: true
      },

      ip_address: {
        type: Sequelize.STRING(45),
        allowNull: true
      },

      user_agent: {
        type: Sequelize.STRING(500),
        allowNull: true
      },

      request_id: {
        type: Sequelize.STRING(100),
        allowNull: true
      },

      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    await queryInterface.addIndex('audit_logs', ['user_id', 'created_at'], {
      name: 'idx_audit_logs_user_created'
    });

    await queryInterface.addIndex('audit_logs', ['module', 'created_at'], {
      name: 'idx_audit_logs_module_created'
    });

    await queryInterface.addIndex('audit_logs', ['action', 'created_at'], {
      name: 'idx_audit_logs_action_created'
    });

    await queryInterface.addIndex('audit_logs', ['entity_type', 'entity_id'], {
      name: 'idx_audit_logs_entity'
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('audit_logs');
  }
};
