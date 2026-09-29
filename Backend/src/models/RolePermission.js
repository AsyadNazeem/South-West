'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class RolePermission extends Model {
        static associate(models) {
            RolePermission.belongsTo(models.Role, {
                foreignKey: 'role_id',
                as: 'role',
                onDelete: 'CASCADE',
                onUpdate: 'CASCADE'
            });

            RolePermission.belongsTo(models.Permission, {
                foreignKey: 'permission_id',
                as: 'permission',
                onDelete: 'CASCADE',
                onUpdate: 'CASCADE'
            });
        }
    }

    RolePermission.init(
        {
            id: {
                type: DataTypes.BIGINT.UNSIGNED,
                allowNull: false,
                autoIncrement: true,
                primaryKey: true
            },

            role_id: {
                type: DataTypes.INTEGER,
                allowNull: false
            },

            permission_id: {
                type: DataTypes.INTEGER.UNSIGNED,
                allowNull: false
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
            modelName: 'RolePermission',
            tableName: 'role_permissions',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at'
        }
    );

    return RolePermission;
};
