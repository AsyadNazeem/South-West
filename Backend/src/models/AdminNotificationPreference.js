'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class AdminNotificationPreference extends Model {
        static associate(models) {
            AdminNotificationPreference.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
        }
    }

    AdminNotificationPreference.init({
        id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true, allowNull: false },
        user_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
        new_orders: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
        payments: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
        deliveries: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
        reviews: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
        customer_requests: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true }
    }, {
        sequelize, modelName: 'AdminNotificationPreference', tableName: 'admin_notification_preferences',
        timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at',
        indexes: [{ unique: true, fields: ['user_id'] }]
    });

    return AdminNotificationPreference;
};
