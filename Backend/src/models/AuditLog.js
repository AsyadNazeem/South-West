
'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class AuditLog extends Model {
        static associate(models) {
            AuditLog.belongsTo(models.User, {
                foreignKey: 'user_id',
                as: 'user',
                onDelete: 'SET NULL',
                onUpdate: 'CASCADE'
            });
        }
    }

    AuditLog.init(
        {
            id: {
                type: DataTypes.BIGINT.UNSIGNED,
                allowNull: false,
                autoIncrement: true,
                primaryKey: true
            },
            user_id: {
                type: DataTypes.BIGINT.UNSIGNED,
                allowNull: true
            },
            action: {
                type: DataTypes.STRING(100),
                allowNull: false
            },
            module: {
                type: DataTypes.STRING(100),
                allowNull: false
            },
            entity_type: {
                type: DataTypes.STRING(100),
                allowNull: true
            },
            entity_id: {
                type: DataTypes.STRING(100),
                allowNull: true
            },
            description: {
                type: DataTypes.STRING(500),
                allowNull: true
            },
            old_values: {
                type: DataTypes.JSON,
                allowNull: true
            },
            new_values: {
                type: DataTypes.JSON,
                allowNull: true
            },
            ip_address: {
                type: DataTypes.STRING(45),
                allowNull: true
            },
            user_agent: {
                type: DataTypes.STRING(500),
                allowNull: true
            },
            request_id: {
                type: DataTypes.STRING(100),
                allowNull: true
            },
            created_at: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: DataTypes.NOW
            }
        },
        {
            sequelize,
            modelName: 'AuditLog',
            tableName: 'audit_logs',
            timestamps: false
        }
    );

    return AuditLog;
};
