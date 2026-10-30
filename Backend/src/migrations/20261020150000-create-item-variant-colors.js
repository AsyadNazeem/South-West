
'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('item_variant_colors', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },

      variant_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        references: {
          model: 'item_variants',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },

      color_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        references: {
          model: 'item_colors',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },

      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },

      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    await queryInterface.addConstraint('item_variant_colors', {
      fields: ['variant_id', 'color_id'],
      type: 'unique',
      name: 'uq_item_variant_colors_variant_color',
    });

    await queryInterface.addIndex('item_variant_colors', ['color_id'], {
      name: 'idx_item_variant_colors_color_id',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('item_variant_colors');
  },
};
