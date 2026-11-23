'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('contact_information', {
            id: {
                type: Sequelize.TINYINT.UNSIGNED,
                primaryKey: true,
                allowNull: false
            },
            support_phone: {
                type: Sequelize.STRING(50),
                allowNull: true
            },
            whatsapp_number: {
                type: Sequelize.STRING(50),
                allowNull: true
            },
            support_email: {
                type: Sequelize.STRING(255),
                allowNull: true
            },
            business_address: {
                type: Sequelize.TEXT,
                allowNull: true
            },
            support_hours: {
                type: Sequelize.TEXT,
                allowNull: true
            },
            google_maps_url: {
                type: Sequelize.STRING(1000),
                allowNull: true
            },
            facebook_url: {
                type: Sequelize.STRING(1000),
                allowNull: true
            },
            instagram_url: {
                type: Sequelize.STRING(1000),
                allowNull: true
            },
            tiktok_url: {
                type: Sequelize.STRING(1000),
                allowNull: true
            },
            response_time: {
                type: Sequelize.STRING(255),
                allowNull: true
            },
            allow_customer_visits: {
                type: Sequelize.BOOLEAN,
                allowNull: false,
                defaultValue: false
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

        await queryInterface.bulkInsert('contact_information', [{
            id: 1,
            allow_customer_visits: false,
            created_at: new Date(),
            updated_at: new Date()
        }]);
    },

    async down(queryInterface) {
        await queryInterface.dropTable('contact_information');
    }
};
