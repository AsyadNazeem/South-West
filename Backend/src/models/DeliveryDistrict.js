const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const DeliveryDistrict = sequelize.define(
        'DeliveryDistrict',
        {
            id: {
                type: DataTypes.BIGINT.UNSIGNED,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false
            },

            district_name: {
                type: DataTypes.STRING(100),
                allowNull: false
            },

            status: {
                type: DataTypes.TINYINT,
                allowNull: false,
                defaultValue: 1
            }
        },
        {
            tableName: 'delivery_districts',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at'
        }
    );

    DeliveryDistrict.associate = (models) => {
        DeliveryDistrict.hasMany(models.DeliveryArea, {
            foreignKey: 'district_id',
            as: 'areas'
        });
    };

    return DeliveryDistrict;
};
