'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('items', 'brand_id', {
      type: Sequelize.BIGINT.UNSIGNED,
      allowNull: true,
      references: {
        model: 'brands',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });

    await queryInterface.addIndex('items', ['brand_id'], {
      name: 'items_brand_id_idx'
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex(
        'items',
        'items_brand_id_idx'
    );

    await queryInterface.removeColumn('items', 'brand_id');
  }
};
