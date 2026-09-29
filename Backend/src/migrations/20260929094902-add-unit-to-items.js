'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('items', 'unit_id', {
      type: Sequelize.BIGINT.UNSIGNED,
      allowNull: true,
      references: {
        model: 'units',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });

    await queryInterface.addIndex('items', ['unit_id'], {
      name: 'items_unit_id_idx'
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex(
        'items',
        'items_unit_id_idx'
    );

    await queryInterface.removeColumn('items', 'unit_id');
  }
};
