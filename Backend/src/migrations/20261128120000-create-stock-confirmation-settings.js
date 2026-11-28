'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable(
            'stock_confirmation_settings',
            {
                id: {
                    type: Sequelize.TINYINT.UNSIGNED,
                    primaryKey: true,
                    allowNull: false
                },
                enabled: {
                    type: Sequelize.BOOLEAN,
                    allowNull: false,
                    defaultValue: true
                },
                threshold: {
                    type: Sequelize.DECIMAL(12, 2),
                    allowNull: false,
                    defaultValue: 50000.00
                },
                primary_phone: {
                    type: Sequelize.STRING(20),
                    allowNull: false,
                    defaultValue: '0773029614'
                },
                primary_whatsapp: {
                    type: Sequelize.BOOLEAN,
                    allowNull: false,
                    defaultValue: true
                },
                secondary_phone: {
                    type: Sequelize.STRING(20),
                    allowNull: true
                },
                secondary_whatsapp: {
                    type: Sequelize.BOOLEAN,
                    allowNull: false,
                    defaultValue: true
                },
                created_at: {
                    type: Sequelize.DATE,
                    allowNull: false
                },
                updated_at: {
                    type: Sequelize.DATE,
                    allowNull: false
                }
            }
        );

        await queryInterface.bulkInsert(
            'stock_confirmation_settings',
            [{
                id: 1,
                enabled: true,
                threshold: 50000.00,
                primary_phone: '0773029614',
                primary_whatsapp: true,
                secondary_phone: null,
                secondary_whatsapp: true,
                created_at: new Date(),
                updated_at: new Date()
            }]
        );
    },

    async down(queryInterface) {
        await queryInterface.dropTable(
            'stock_confirmation_settings'
        );
    }
};
