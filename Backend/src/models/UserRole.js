'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class UserRole extends Model {
        static associate(models) {
            UserRole.belongsTo(models.User, {
                foreignKey: 'user_id',
                as: 'user',
                onDelete: 'CASCADE',
                onUpdate: 'CASCADE'
            });

            UserRole.belongsTo(models.Role, {
                foreignKey: 'role_id',
                as: 'role',
                onDelete: 'CASCADE',
                onUpdate: 'CASCADE'
            });
        }
    }

    UserRole.init(
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

            role_id: {
                type: DataTypes.INTEGER,
                allowNull: false
            },

            created_at: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: DataTypes.NOW
            }
        },
        {
            sequelize,
            modelName: 'UserRole',
            tableName: 'user_roles',
            timestamps: false
        }
    );

    return UserRole;
};
