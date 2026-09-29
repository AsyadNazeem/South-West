'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('items', 'category_id', {
      type: Sequelize.BIGINT.UNSIGNED,
      allowNull: true,
      references: {
        model: 'categories',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });

    await queryInterface.addIndex('items', ['category_id'], {
      name: 'items_category_id_idx'
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex(
        'items',
        'items_category_id_idx'
    );

    await queryInterface.removeColumn('items', 'category_id');
  }
};
