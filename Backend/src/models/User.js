'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class User extends Model {
        static associate(models) {
            User.hasMany(models.OAuthAccount, {
                foreignKey: 'user_id',
                as: 'oauthAccounts',
                onDelete: 'CASCADE',
                onUpdate: 'CASCADE'
            });

            User.hasMany(models.UserSession, {
                foreignKey: 'user_id',
                as: 'sessions',
                onDelete: 'CASCADE',
                onUpdate: 'CASCADE'
            });

            User.belongsToMany(models.Role, {
                through: models.UserRole,
                foreignKey: 'user_id',
                otherKey: 'role_id',
                as: 'roles'
            });

            User.hasMany(models.InventoryStockMovement, {
                foreignKey: 'created_by',
                as: 'stockMovementsCreated'
            });

            User.hasMany(models.GoodsReceipt, {
                foreignKey: 'received_by',
                as: 'goodsReceiptsReceived'
            });

            User.hasMany(models.Order, {
                foreignKey: 'created_by',
                as: 'ordersCreated'
            });

            User.hasMany(models.Payment, {
                foreignKey: 'processed_by',
                as: 'paymentsProcessed'
            });

            User.hasMany(models.DeliveryStatusHistory, {
                foreignKey: 'changed_by',
                as: 'deliveryStatusChanges'
            });

            User.hasMany(models.Invoice, {
                foreignKey: 'created_by',
                as: 'invoicesCreated'
            });

            User.hasMany(models.Promotion, {
                foreignKey: 'created_by',
                as: 'promotionsCreated'
            });
        }
    }

    User.init(
        {
            id: {
                type: DataTypes.BIGINT.UNSIGNED,
                allowNull: false,
                autoIncrement: true,
                primaryKey: true
            },

            email: {
                type: DataTypes.STRING(255),
                allowNull: false,
                unique: true
            },

            password_hash: {
                type: DataTypes.STRING(255),
                allowNull: true
            },

            email_verified_at: {
                type: DataTypes.DATE,
                allowNull: true
            },

            is_active: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: true
            },

            last_login_at: {
                type: DataTypes.DATE,
                allowNull: true
            }
        },
        {
            sequelize,
            modelName: 'User',
            tableName: 'users',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at'
        }
    );

    return User;
};
