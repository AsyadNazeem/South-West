'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('item_images', {
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

      image_url: {
        type: Sequelize.STRING(500),
        allowNull: false
      },

      alt_text: {
        type: Sequelize.STRING(255),
        allowNull: true
      },

      sort_order: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },

      is_primary: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
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

    await queryInterface.addIndex('item_images', ['item_id'], {
      name: 'item_images_item_id_idx'
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex(
        'item_images',
        'item_images_item_id_idx'
    );

    await queryInterface.dropTable('item_images');
  }
};
