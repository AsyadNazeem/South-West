
'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        const transaction = await queryInterface.sequelize.transaction();

        try {
            await queryInterface.addColumn(
                'customers',
                'google_id',
                {
                    type: Sequelize.STRING(255),
                    allowNull: true,
                    unique: true,
                },
                { transaction }
            );

            await queryInterface.changeColumn(
                'customers',
                'phone',
                {
                    type: Sequelize.STRING(30),
                    allowNull: true,
                },
                { transaction }
            );

            await queryInterface.createTable(
                'customer_oauth_codes',
                {
                    id: {
                        type: Sequelize.BIGINT.UNSIGNED,
                        primaryKey: true,
                        autoIncrement: true,
                        allowNull: false,
                    },
                    code_hash: {
                        type: Sequelize.CHAR(64),
                        allowNull: false,
                        unique: true,
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
                    expires_at: {
                        type: Sequelize.DATE,
                        allowNull: false,
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
                        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
                    },
                },
                { transaction }
            );

            await queryInterface.addIndex(
                'customer_oauth_codes',
                ['customer_id'],
                { name: 'idx_customer_oauth_codes_customer', transaction }
            );

            await queryInterface.addIndex(
                'customer_oauth_codes',
                ['expires_at'],
                { name: 'idx_customer_oauth_codes_expiry', transaction }
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
            await queryInterface.dropTable(
                'customer_oauth_codes',
                { transaction }
            );

            await queryInterface.removeColumn(
                'customers',
                'google_id',
                { transaction }
            );

            // Restore the existing required phone field.
            // This rollback will fail if any customer has a NULL phone.
            await queryInterface.changeColumn(
                'customers',
                'phone',
                {
                    type: Sequelize.STRING(30),
                    allowNull: false,
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
