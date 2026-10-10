
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const CustomerEmailVerification = sequelize.define(
        'CustomerEmailVerification',
        {
            id: {
                type: DataTypes.BIGINT.UNSIGNED,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false,
            },

            customer_id: {
                type: DataTypes.BIGINT.UNSIGNED,
                allowNull: false,
            },

            email: {
                type: DataTypes.STRING(255),
                allowNull: false,
            },

            code_hash: {
                type: DataTypes.CHAR(64),
                allowNull: false,
                unique: true,
            },

            purpose: {
                type: DataTypes.ENUM('registration', 'activation'),
                allowNull: false,
            },

            expires_at: {
                type: DataTypes.DATE,
                allowNull: false,
            },

            attempts: {
                type: DataTypes.TINYINT.UNSIGNED,
                allowNull: false,
                defaultValue: 0,
            },

            consumed_at: {
                type: DataTypes.DATE,
                allowNull: true,
            },
        },
        {
            tableName: 'customer_email_verifications',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at',
        }
    );

    CustomerEmailVerification.associate = (models) => {
        CustomerEmailVerification.belongsTo(models.Customer, {
            foreignKey: 'customer_id',
            as: 'customer',
        });
    };

    return CustomerEmailVerification;
};
