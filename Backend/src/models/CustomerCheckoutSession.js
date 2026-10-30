
'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const CustomerCheckoutSession = sequelize.define(
    'CustomerCheckoutSession',
    {
      id: {
        type: DataTypes.BIGINT.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      customer_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
      },
      token_hash: {
        type: DataTypes.CHAR(64),
        allowNull: false,
        unique: true,
      },
      item_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
      },
variant_id: {
  type: DataTypes.BIGINT.UNSIGNED,
  allowNull: true,
  defaultValue: null,
},
      quantity: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
      },
      expires_at: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      consumed_at: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: null,
      },
    },
    {
      tableName: 'customer_checkout_sessions',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      indexes: [
        {
          name: 'idx_checkout_sessions_customer',
          fields: ['customer_id'],
        },
        {
          name: 'idx_checkout_sessions_expiry',
          fields: ['expires_at'],
        },
      ],
    }
  );

  CustomerCheckoutSession.associate = (models) => {
    CustomerCheckoutSession.belongsTo(models.Customer, {
      foreignKey: 'customer_id',
      as: 'customer',
      onDelete: 'RESTRICT',
      onUpdate: 'RESTRICT',
    });
  };

  return CustomerCheckoutSession;
};
