
'use strict';

module.exports = {
  async up(queryInterface) {
    // Stop if any variant currently has multiple colour assignments.
    const [duplicates] = await queryInterface.sequelize.query(`
      SELECT variant_id, COUNT(*) AS colour_count
      FROM item_variant_colors
      GROUP BY variant_id
      HAVING COUNT(*) > 1
    `);

    if (duplicates.length > 0) {
      throw new Error(
        'Migration stopped: some variants have multiple colour assignments. ' +
        'Clean up duplicate assignments in item_variant_colors before migrating.'
      );
    }

    // Enforce a maximum of one colour assignment per variant.
    await queryInterface.addConstraint('item_variant_colors', {
      fields: ['variant_id'],
      type: 'unique',
      name: 'uq_item_variant_colors_variant_id'
    });
  },

  async down(queryInterface) {
    await queryInterface.removeConstraint(
      'item_variant_colors',
      'uq_item_variant_colors_variant_id'
    );
  }
};
