'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('items', 'item_type_id', {
      type: Sequelize.BIGINT.UNSIGNED,
      allowNull: true,
      references: {
        model: 'item_types',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });

    await queryInterface.addIndex('items', ['item_type_id'], {
      name: 'items_item_type_id_idx'
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex(
        'items',
        'items_item_type_id_idx'
    );

    await queryInterface.removeColumn('items', 'item_type_id');
  }
};
