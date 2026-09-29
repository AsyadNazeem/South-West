'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class Permission extends Model {
        static associate(models) {
            Permission.belongsToMany(models.Role, {
                through: models.RolePermission,
                foreignKey: 'permission_id',
                otherKey: 'role_id',
                as: 'roles'
            });
        }
    }

    Permission.init(
        {
            id: {
                type: DataTypes.INTEGER.UNSIGNED,
                allowNull: false,
                autoIncrement: true,
                primaryKey: true
            },

            name: {
                type: DataTypes.STRING(100),
                allowNull: false,
                unique: true
            },

            module: {
                type: DataTypes.STRING(100),
                allowNull: false
            },

            description: {
                type: DataTypes.STRING(255),
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
            modelName: 'Permission',
            tableName: 'permissions',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at'
        }
    );

    return Permission;
};
