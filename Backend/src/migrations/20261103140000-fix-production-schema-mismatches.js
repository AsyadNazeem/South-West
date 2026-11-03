'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const describe = async (table) => {
      try {
        return await queryInterface.describeTable(table);
      } catch (error) {
        throw new Error(`Cannot inspect table "${table}": ${error.message}`);
      }
    };

    const addColumnIfMissing = async (table, column, definition) => {
      const columns = await describe(table);

      if (!columns[column]) {
        await queryInterface.addColumn(table, column, definition);
      }
    };

    // Orders
    await addColumnIfMissing('orders', 'discount_percentage_mode', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });

    await addColumnIfMissing('orders', 'discount_percentage', {
      type: Sequelize.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 0
    });

    // Order items
    await addColumnIfMissing('order_items', 'discount_percentage_mode', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });

    await addColumnIfMissing('order_items', 'discount_percentage', {
      type: Sequelize.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 0
    });

    // Item images
    await addColumnIfMissing('item_images', 'file_name', {
      type: Sequelize.STRING(255),
      allowNull: true
    });

    await addColumnIfMissing('item_images', 'file_path', {
      type: Sequelize.STRING(500),
      allowNull: true
    });

    await addColumnIfMissing('item_images', 'mime_type', {
      type: Sequelize.STRING(100),
      allowNull: true
    });

    await addColumnIfMissing('item_images', 'file_size', {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: true
    });

    const imageColumns = await describe('item_images');

    if (imageColumns.image_url && imageColumns.image_url.allowNull === false) {
      await queryInterface.changeColumn('item_images', 'image_url', {
        type: Sequelize.STRING(500),
        allowNull: true
      });
    }

    // Customer addresses
    await addColumnIfMissing('customer_addresses', 'district_id', {
      type: Sequelize.BIGINT.UNSIGNED,
      allowNull: true
    });

    await addColumnIfMissing('customer_addresses', 'area_id', {
      type: Sequelize.BIGINT.UNSIGNED,
      allowNull: true
    });

    const [addresses] = await queryInterface.sequelize.query(`
      SELECT id, district_id, area_id
      FROM customer_addresses
      WHERE district_id IS NULL OR area_id IS NULL
      LIMIT 1
    `);

    if (addresses.length > 0) {
      throw new Error(
        'Customer addresses contain missing district_id or area_id. ' +
        'Resolve these records before enforcing NOT NULL.'
      );
    }

    const [invalidAreas] = await queryInterface.sequelize.query(`
      SELECT ca.id
      FROM customer_addresses ca
      INNER JOIN delivery_areas da ON da.id = ca.area_id
      WHERE da.district_id <> ca.district_id
      LIMIT 1
    `);

    if (invalidAreas.length > 0) {
      throw new Error(
        'A customer address has an area belonging to a different district.'
      );
    }

    const addressColumns = await describe('customer_addresses');

    if (addressColumns.district_id.allowNull) {
      await queryInterface.changeColumn('customer_addresses', 'district_id', {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false
      });
    }

    if (addressColumns.area_id.allowNull) {
      await queryInterface.changeColumn('customer_addresses', 'area_id', {
        type: Sequelize.BIGINT.UNSIGNED,
        allowNull: false
      });
    }

    // Add foreign keys only when they do not already exist.
    const [foreignKeys] = await queryInterface.sequelize.query(`
      SELECT CONSTRAINT_NAME
      FROM information_schema.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'customer_addresses'
        AND REFERENCED_TABLE_NAME IS NOT NULL
    `);

    const existingConstraints = new Set(
      foreignKeys.map(row => row.CONSTRAINT_NAME)
    );

    if (!existingConstraints.has('fk_customer_addresses_district')) {
      await queryInterface.addConstraint('customer_addresses', {
        fields: ['district_id'],
        type: 'foreign key',
        name: 'fk_customer_addresses_district',
        references: {
          table: 'delivery_districts',
          field: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      });
    }

    if (!existingConstraints.has('fk_customer_addresses_area')) {
      await queryInterface.addConstraint('customer_addresses', {
        fields: ['area_id'],
        type: 'foreign key',
        name: 'fk_customer_addresses_area',
        references: {
          table: 'delivery_areas',
          field: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      });
    }

    // Item videos
    const [tables] = await queryInterface.sequelize.query(`
      SHOW TABLES LIKE 'item_videos'
    `);

    if (tables.length === 0) {
      await queryInterface.createTable('item_videos', {
        id: {
          type: Sequelize.BIGINT.UNSIGNED,
          allowNull: false,
          autoIncrement: true,
          primaryKey: true
        },
        item_id: {
          type: Sequelize.BIGINT.UNSIGNED,
          allowNull: false,
          unique: true,
          references: {
            model: 'items',
            key: 'id'
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE'
        },
        file_name: {
          type: Sequelize.STRING(255),
          allowNull: false
        },
        file_path: {
          type: Sequelize.STRING(500),
          allowNull: false
        },
        mime_type: {
          type: Sequelize.STRING(100),
          allowNull: false
        },
        file_size: {
          type: Sequelize.INTEGER.UNSIGNED,
          allowNull: false
        },
        is_active: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: true
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal(
            'CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'
          )
        }
      });
    }
  },

  async down(queryInterface) {
    throw new Error(
      'This production schema reconciliation migration must not be rolled back automatically.'
    );
  }
};
