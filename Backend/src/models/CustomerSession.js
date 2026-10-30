
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const CustomerSession = sequelize.define(
        'CustomerSession',
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

            token_hash: {
                type: DataTypes.CHAR(64),
                allowNull: false,
                unique: true,
            },

            expires_at: {
                type: DataTypes.DATE,
                allowNull: false,
            },

            revoked_at: {
                type: DataTypes.DATE,
                allowNull: true,
            },

            ip_address: {
                type: DataTypes.STRING(45),
                allowNull: true,
            },

            user_agent: {
                type: DataTypes.STRING(500),
                allowNull: true,
            },

            session_uuid: {
                type: DataTypes.UUID,
                allowNull: false,
                unique: true,
            },
        },
        {
            tableName: 'customer_sessions',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at',
            indexes: [
                {
                    name: 'uq_customer_sessions_token_hash',
                    unique: true,
                    fields: ['token_hash'],
                },
                {
                    name: 'idx_customer_sessions_customer_id',
                    fields: ['customer_id'],
                },
                {
                    name: 'idx_customer_sessions_expiry',
                    fields: ['expires_at'],
                },
            ],
        }
    );

    CustomerSession.associate = (models) => {
        CustomerSession.belongsTo(models.Customer, {
            foreignKey: 'customer_id',
            as: 'customer',
            onDelete: 'RESTRICT',
            onUpdate: 'RESTRICT',
        });
    };

    return CustomerSession;
};
