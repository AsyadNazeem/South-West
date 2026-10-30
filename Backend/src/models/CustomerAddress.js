const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const CustomerAddress = sequelize.define(
        'CustomerAddress',
        {
            id: {
                type: DataTypes.BIGINT.UNSIGNED,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false
            },

            customer_id: {
                type: DataTypes.BIGINT.UNSIGNED,
                allowNull: false
            },

            district_id: {
                type: DataTypes.BIGINT.UNSIGNED,
                allowNull: false
            },

            area_id: {
                type: DataTypes.BIGINT.UNSIGNED,
                allowNull: false
            },

            address_type: {
                type: DataTypes.STRING(30),
                allowNull: false,
                defaultValue: 'shipping'
            },

            recipient_name: {
                type: DataTypes.STRING(200),
                allowNull: false
            },

            phone: {
                type: DataTypes.STRING(30),
                allowNull: false
            },

            address_line_1: {
                type: DataTypes.STRING(255),
                allowNull: false
            },

            address_line_2: {
                type: DataTypes.STRING(255),
                allowNull: true
            },

            city: {
                type: DataTypes.STRING(100),
                allowNull: false
            },

            state: {
                type: DataTypes.STRING(100),
                allowNull: true
            },

            postal_code: {
                type: DataTypes.STRING(20),
                allowNull: true
            },

            country: {
                type: DataTypes.STRING(100),
                allowNull: false,
                defaultValue: 'Sri Lanka'
            },

            is_default: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false
            }
        },
        {
            tableName: 'customer_addresses',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at'
        }
    );

    CustomerAddress.associate = (models) => {

        CustomerAddress.belongsTo(models.Customer, {
            foreignKey: 'customer_id',
            as: 'customer'
        });

        CustomerAddress.belongsTo(models.DeliveryDistrict, {
            foreignKey: 'district_id',
            as: 'district'
        });

        CustomerAddress.belongsTo(models.DeliveryArea, {
            foreignKey: 'area_id',
            as: 'area'
        });
    };

    return CustomerAddress;
};
