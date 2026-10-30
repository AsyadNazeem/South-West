
'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        // 1. Create the parent product's sellable variants.
        await queryInterface.createTable('item_variants', {
            id: {
                type: Sequelize.BIGINT.UNSIGNED,
                allowNull: false,
                autoIncrement: true,
                primaryKey: true
            },

            item_id: {
                type: Sequelize.BIGINT.UNSIGNED,
                allowNull: false,
                references: {
                    model: 'items',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE'
            },

            variant_sku: {
                type: Sequelize.STRING(100),
                allowNull: false
            },

            variant_name: {
                type: Sequelize.STRING(255),
                allowNull: false
            },

            attributes: {
                type: Sequelize.JSON,
                allowNull: true
            },

            qb_item_code: {
                type: Sequelize.STRING(100),
                allowNull: true
            },

            is_default: {
                type: Sequelize.BOOLEAN,
                allowNull: false,
                defaultValue: false
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

        await queryInterface.addIndex(
            'item_variants',
            ['variant_sku'],
            {
                unique: true,
                name: 'item_variants_sku_unique_idx'
            }
        );

        await queryInterface.addIndex(
            'item_variants',
            ['item_id', 'is_active'],
            {
                name: 'item_variants_item_active_idx'
            }
        );

        // 2. Add nullable variant references. Existing records remain valid.
        const variantTables = [
            'item_prices',
            'inventory_stock',
            'inventory_stock_movements',
            'cart_items',
            'order_items',
            'purchase_order_items',
            'goods_receipt_items'
        ];

        for (const table of variantTables) {
            await queryInterface.addColumn(table, 'variant_id', {
                type: Sequelize.BIGINT.UNSIGNED,
                allowNull: true,
                references: {
                    model: 'item_variants',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'RESTRICT'
            });

            await queryInterface.addIndex(
                table,
                ['variant_id'],
                {
                    name: `${table}_variant_id_idx`
                }
            );
        }

        // 3. Create one default variant for every existing product.
        // These SKUs are migration-generated identifiers, not new item codes.
        await queryInterface.sequelize.query(`
            INSERT INTO item_variants (
                item_id,
                variant_sku,
                variant_name,
                attributes,
                is_default,
                is_active,
                created_at,
                updated_at
            )
            SELECT
                id,
                CONCAT('SWV-', LPAD(id, 6, '0')),
                'Default',
                JSON_OBJECT(),
                TRUE,
                is_active,
                CURRENT_TIMESTAMP,
                CURRENT_TIMESTAMP
            FROM items
        `);

        // 4. Backfill all existing records to their product's default variant.
        for (const table of variantTables) {
            await queryInterface.sequelize.query(`
                UPDATE \`${table}\` AS existing_record
                INNER JOIN item_variants AS variant
                    ON variant.item_id = existing_record.item_id
                   AND variant.is_default = TRUE
                SET existing_record.variant_id = variant.id
                WHERE existing_record.variant_id IS NULL
            `);
        }

        // Intentionally retain all existing item_id columns and unique indexes.
        // Those indexes will be adjusted after variant-aware controllers are ready.
    },

    async down(queryInterface) {
        const variantTables = [
            'item_prices',
            'inventory_stock',
            'inventory_stock_movements',
            'cart_items',
            'order_items',
            'purchase_order_items',
            'goods_receipt_items'
        ];

        // Remove the foreign keys and indexes added by this migration.
        for (const table of [...variantTables].reverse()) {
            await queryInterface.removeIndex(
                table,
                `${table}_variant_id_idx`
            );

            await queryInterface.removeColumn(table, 'variant_id');
        }

        await queryInterface.removeIndex(
            'item_variants',
            'item_variants_item_active_idx'
        );

        await queryInterface.removeIndex(
            'item_variants',
            'item_variants_sku_unique_idx'
        );

        await queryInterface.dropTable('item_variants');
    }
};
