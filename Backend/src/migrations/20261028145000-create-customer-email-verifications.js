'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('customer_email_verifications', {
            id: {
                type: Sequelize.BIGINT.UNSIGNED,
                allowNull: false,
                autoIncrement: true,
                primaryKey: true,
            },
            customer_id: {
                type: Sequelize.BIGINT.UNSIGNED,
                allowNull: false,
                references: {
                    model: 'customers',
                    key: 'id',
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE',
            },
            email: {
                type: Sequelize.STRING(255),
                allowNull: false,
            },
            code_hash: {
                type: Sequelize.CHAR(64),
                allowNull: false,
                unique: true,
            },
            purpose: {
                type: Sequelize.ENUM('registration', 'activation'),
                allowNull: false,
            },
            expires_at: {
                type: Sequelize.DATE,
                allowNull: false,
            },
            attempts: {
                type: Sequelize.TINYINT.UNSIGNED,
                allowNull: false,
                defaultValue: 0,
            },
            consumed_at: {
                type: Sequelize.DATE,
                allowNull: true,
            },
            created_at: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
            },
            updated_at: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.literal(
                    'CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'
                ),
            },
        });

        await queryInterface.addIndex(
            'customer_email_verifications',
            ['customer_id', 'purpose'],
            { name: 'idx_customer_email_verifications_customer_purpose' }
        );

        await queryInterface.addIndex(
            'customer_email_verifications',
            ['expires_at'],
            { name: 'idx_customer_email_verifications_expires_at' }
        );
    },

    async down(queryInterface) {
        await queryInterface.dropTable('customer_email_verifications');
    },
};
