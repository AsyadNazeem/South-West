'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.removeConstraint(
      'item_variant_colors',
      'uq_item_variant_colors_variant_id'
    );
  },

  async down(queryInterface) {
    const [duplicates] = await queryInterface.sequelize.query(`
      SELECT variant_id
      FROM item_variant_colors
      GROUP BY variant_id
      HAVING COUNT(*) > 1
      LIMIT 1
    `);

    if (duplicates.length) {
      throw new Error(
        'Cannot restore the single-colour constraint while variants have multiple colours.'
      );
    }

    await queryInterface.addConstraint('item_variant_colors', {
      fields: ['variant_id'],
      type: 'unique',
      name: 'uq_item_variant_colors_variant_id'
    });
  }
};
