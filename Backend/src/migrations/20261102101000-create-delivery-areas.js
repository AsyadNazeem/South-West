'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('delivery_areas', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true
      },
      district_id: {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false,
        references: {
          model: 'delivery_districts',
          key: 'id'
        },
        onDelete: 'RESTRICT',
        onUpdate: 'CASCADE'
      },
      area_name: {
        type: Sequelize.STRING(150),
        allowNull: false
      },
      first_kg_charge: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: false
      },
      additional_kg_charge: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 100.00
      },
      status: {
        type: Sequelize.TINYINT,
        allowNull: false,
        defaultValue: 1
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false
      }
    });

    await queryInterface.addIndex(
      'delivery_areas',
      ['district_id', 'area_name'],
      {
        unique: true,
        name: 'uq_delivery_area_district_area'
      }
    );

    await queryInterface.addIndex('delivery_areas', ['district_id'], {
      name: 'idx_delivery_area_district'
    });

    await queryInterface.addIndex('delivery_areas', ['status'], {
      name: 'idx_delivery_area_status'
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('delivery_areas');
  }
};
