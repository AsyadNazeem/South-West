
'use strict';

module.exports = {
    async up(queryInterface) {
        const transaction = await queryInterface.sequelize.transaction();

        try {
            await queryInterface.removeConstraint(
                'discount_campaign_brands',
                'discount_campaign_brands_ibfk_2',
                { transaction }
            );

            await queryInterface.addConstraint(
                'discount_campaign_brands',
                {
                    fields: ['brand_id'],
                    type: 'foreign key',
                    name: 'fk_discount_campaign_brands_brand',
                    references: {
                        table: 'brands',
                        field: 'id',
                    },
                    onUpdate: 'CASCADE',
                    onDelete: 'CASCADE',
                },
                { transaction }
            );

            await transaction.commit();
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    },

    async down(queryInterface) {
        const transaction = await queryInterface.sequelize.transaction();

        try {
            await queryInterface.removeConstraint(
                'discount_campaign_brands',
                'fk_discount_campaign_brands_brand',
                { transaction }
            );

            await queryInterface.addConstraint(
                'discount_campaign_brands',
                {
                    fields: ['brand_id'],
                    type: 'foreign key',
                    name: 'discount_campaign_brands_ibfk_2',
                    references: {
                        table: 'discount_campaigns',
                        field: 'id',
                    },
                    onUpdate: 'CASCADE',
                    onDelete: 'CASCADE',
                },
                { transaction }
            );

            await transaction.commit();
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    },
};
