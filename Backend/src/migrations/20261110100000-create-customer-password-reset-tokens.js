'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('customer_password_reset_tokens', {
            id: { type: Sequelize.BIGINT.UNSIGNED, allowNull: false, autoIncrement: true, primaryKey: true },
            customer_id: {
                type: Sequelize.BIGINT.UNSIGNED,
                allowNull: false,
                references: { model: 'customers', key: 'id' },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE',
            },
            token_hash: { type: Sequelize.CHAR(64), allowNull: false, unique: true },
            expires_at: { type: Sequelize.DATE, allowNull: false },
            used_at: { type: Sequelize.DATE, allowNull: true },
            created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
            updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP') },
        });

        await queryInterface.addIndex('customer_password_reset_tokens', ['customer_id'], { name: 'idx_password_reset_customer' });
        await queryInterface.addIndex('customer_password_reset_tokens', ['expires_at'], { name: 'idx_password_reset_expiry' });
    },

    async down(queryInterface) {
        await queryInterface.dropTable('customer_password_reset_tokens');
    },
};
