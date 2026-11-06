'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class AdminNotification extends Model {
        static associate(models) {
            AdminNotification.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
        }
    }

    AdminNotification.init({
        id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true, allowNull: false },
        user_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        type: { type: DataTypes.STRING(100), allowNull: false },
        title: { type: DataTypes.STRING(200), allowNull: false },
        message: { type: DataTypes.TEXT, allowNull: false },
        reference_type: { type: DataTypes.STRING(100), allowNull: true },
        reference_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
        is_read: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
        is_dismissed: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
        read_at: { type: DataTypes.DATE, allowNull: true }
    }, {
        sequelize, modelName: 'AdminNotification', tableName: 'admin_notifications',
        timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at'
    });

    return AdminNotification;
};
