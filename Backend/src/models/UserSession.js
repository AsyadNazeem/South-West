'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class UserSession extends Model {
        static associate(models) {
            UserSession.belongsTo(models.User, {
                foreignKey: 'user_id',
                as: 'user',
                onDelete: 'CASCADE',
                onUpdate: 'CASCADE'
            });
        }
    }

    UserSession.init(
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

            refresh_token_hash: {
                type: DataTypes.STRING(255),
                allowNull: false
            },

            expires_at: {
                type: DataTypes.DATE,
                allowNull: false
            },

            revoked_at: {
                type: DataTypes.DATE,
                allowNull: true
            },

            ip_address: {
                type: DataTypes.STRING(45),
                allowNull: true
            },

            user_agent: {
                type: DataTypes.TEXT,
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
            modelName: 'UserSession',
            tableName: 'user_sessions',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at'
        }
    );

    return UserSession;
};
