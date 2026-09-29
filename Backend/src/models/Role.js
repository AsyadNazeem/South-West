'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class Role extends Model {
        static associate(models) {
            Role.belongsToMany(models.User, {
                through: models.UserRole,
                foreignKey: 'role_id',
                otherKey: 'user_id',
                as: 'users'
            });

            Role.belongsToMany(models.Permission, {
                through: models.RolePermission,
                foreignKey: 'role_id',
                otherKey: 'permission_id',
                as: 'permissions'
            });
        }
    }

    Role.init(
        {
            id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                autoIncrement: true,
                primaryKey: true
            },

            name: {
                type: DataTypes.STRING(100),
                allowNull: false,
                unique: true
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
            modelName: 'Role',
            tableName: 'roles',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at'
        }
    );

    return Role;
};
