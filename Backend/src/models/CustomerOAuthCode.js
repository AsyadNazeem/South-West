const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    return sequelize.define(
        'CustomerOAuthCode',
        {
            id: {
                type: DataTypes.BIGINT.UNSIGNED,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false,
            },
            code_hash: {
                type: DataTypes.CHAR(64),
                allowNull: false,
                unique: true,
            },
            customer_id: {
                type: DataTypes.BIGINT.UNSIGNED,
                allowNull: false,
            },
            expires_at: {
                type: DataTypes.DATE,
                allowNull: false,
            },
            consumed_at: {
                type: DataTypes.DATE,
                allowNull: true,
            },
        },
        {
            tableName: 'customer_oauth_codes',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at',
            indexes: [
                { fields: ['customer_id'] },
                { fields: ['expires_at'] },
            ],
        }
    );
};