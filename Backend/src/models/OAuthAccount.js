'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class OAuthAccount extends Model {
        static associate(models) {
            OAuthAccount.belongsTo(models.User, {
                foreignKey: 'user_id',
                as: 'user',
                onDelete: 'CASCADE',
                onUpdate: 'CASCADE'
            });
        }
    }

    OAuthAccount.init(
        {
            id: {
                type: DataTypes.BIGINT.UNSIGNED,
                allowNull: false,
                autoIncrement: true,
                primaryKey: true
            },

            user_id: {
                type: DataTypes.BIGINT.UNSIGNED,
                allowNull: false
            },

            provider: {
                type: DataTypes.STRING(50),
                allowNull: false
            },

            provider_user_id: {
                type: DataTypes.STRING(255),
                allowNull: false
            },

            access_token: {
                type: DataTypes.TEXT,
                allowNull: true
            },

            refresh_token: {
                type: DataTypes.TEXT,
                allowNull: true
            },

            expires_at: {
                type: DataTypes.DATE,
                allowNull: true
            },

            created_at: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: DataTypes.NOW
            },

            updated_at: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: DataTypes.NOW
            }
        },
        {
            sequelize,
            modelName: 'OAuthAccount',
            tableName: 'oauth_accounts',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at'
        }
    );

    return OAuthAccount;
};
