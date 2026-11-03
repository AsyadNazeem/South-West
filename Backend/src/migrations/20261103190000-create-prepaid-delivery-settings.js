'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('prepaid_delivery_settings', {
            id: {
                type: Sequelize.TINYINT.UNSIGNED,
                primaryKey: true,
                allowNull: false
            },
            colombo_first_kg_charge: {
                type: Sequelize.DECIMAL(12, 2),
                allowNull: false,
                defaultValue: 450.00
            },
            outside_colombo_first_kg_charge: {
                type: Sequelize.DECIMAL(12, 2),
                allowNull: false,
                defaultValue: 550.00
            },
            additional_kg_charge: {
                type: Sequelize.DECIMAL(12, 2),
                allowNull: false,
                defaultValue: 100.00
            },
            created_at: {
                type: Sequelize.DATE,
                allowNull: false
            },
            updated_at: {
                type: Sequelize.DATE,
                allowNull: false
            }
        });

        await queryInterface.bulkInsert('prepaid_delivery_settings', [{
            id: 1,
            colombo_first_kg_charge: 450.00,
            outside_colombo_first_kg_charge: 550.00,
            additional_kg_charge: 100.00,
            created_at: new Date(),
            updated_at: new Date()
        }]);
    },

    async down(queryInterface) {
        await queryInterface.dropTable('prepaid_delivery_settings');
    }
};
