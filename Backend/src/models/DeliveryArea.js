const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const DeliveryArea = sequelize.define(
        'DeliveryArea',
        {
            id: {
                type: DataTypes.BIGINT.UNSIGNED,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false
            },

            district_id: {
                type: DataTypes.BIGINT.UNSIGNED,
                allowNull: false
            },

            area_name: {
                type: DataTypes.STRING(150),
                allowNull: false
            },

            first_kg_charge: {
                type: DataTypes.DECIMAL(10, 2),
                allowNull: false
            },

            additional_kg_charge: {
                type: DataTypes.DECIMAL(10, 2),
                allowNull: false
            },

            status: {
                type: DataTypes.TINYINT,
                allowNull: false,
                defaultValue: 1
            }
        },
        {
            tableName: 'delivery_areas',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at'
        }
    );

    DeliveryArea.associate = (models) => {
        DeliveryArea.belongsTo(models.DeliveryDistrict, {
            foreignKey: 'district_id',
            as: 'district'
        });
    };

    return DeliveryArea;
};
