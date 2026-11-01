
'use strict';

const TABLES = {
    inventory: 'inventory_stock',
    cart: 'cart_items',
    purchaseOrder: 'purchase_order_items',
    goodsReceipt: 'goods_receipt_items'
};

async function getIndexes(queryInterface, tableName) {
    const indexes = await queryInterface.showIndex(tableName);
    return new Set(indexes.map(index => index.name));
}

async function addIndexIfMissing(
    queryInterface,
    tableName,
    indexName,
    fields,
    options = {}
) {
    const indexes = await getIndexes(queryInterface, tableName);

    if (!indexes.has(indexName)) {
        await queryInterface.addIndex(tableName, fields, {
            ...options,
            name: indexName
        });
    }
}

async function removeIndexIfPresent(
    queryInterface,
    tableName,
    indexName
) {
    const indexes = await getIndexes(queryInterface, tableName);

    if (indexes.has(indexName)) {
        await queryInterface.removeIndex(tableName, indexName);
    }
}

module.exports = {
    async up(queryInterface) {
        const sequelize = queryInterface.sequelize;

        // Validate variant links before changing constraints.
        for (const tableName of Object.values(TABLES)) {
            const [rows] = await sequelize.query(
                `SELECT COUNT(*) AS invalid_count
                 FROM \`${tableName}\` AS record
                 LEFT JOIN item_variants AS variant
                   ON variant.id = record.variant_id
                  AND variant.item_id = record.item_id
                 WHERE record.variant_id IS NULL
                    OR variant.id IS NULL`
            );

            if (Number(rows[0].invalid_count) > 0) {
                throw new Error(
                    `Cannot migrate ${tableName}: missing or mismatched variants exist.`
                );
            }
        }

        // Check the new uniqueness rules before changing indexes.
        const duplicateChecks = [
            {
                table: TABLES.inventory,
                columns: 'variant_id, location_id',
                label: 'inventory variant/location'
            },
            {
                table: TABLES.cart,
                columns: 'cart_id, variant_id',
                label: 'cart/variant'
            },
            {
                table: TABLES.purchaseOrder,
                columns: 'purchase_order_id, variant_id',
                label: 'purchase order/variant'
            }
        ];

        for (const check of duplicateChecks) {
            const [rows] = await sequelize.query(
                `SELECT COUNT(*) AS duplicate_groups
                 FROM (
                     SELECT ${check.columns}
                     FROM \`${check.table}\`
                     GROUP BY ${check.columns}
                     HAVING COUNT(*) > 1
                 ) AS duplicates`
            );

            if (Number(rows[0].duplicate_groups) > 0) {
                throw new Error(
                    `Cannot migrate: duplicate ${check.label} combinations exist.`
                );
            }
        }

        // INVENTORY
        // Keep item_id indexed for its foreign key.
        await addIndexIfMissing(
            queryInterface,
            TABLES.inventory,
            'inventory_stock_item_id_idx',
            ['item_id']
        );

        await removeIndexIfPresent(
            queryInterface,
            TABLES.inventory,
            'inventory_stock_item_location_unique_idx'
        );

        await addIndexIfMissing(
            queryInterface,
            TABLES.inventory,
            'inventory_stock_variant_location_unique_idx',
            ['variant_id', 'location_id'],
            { unique: true }
        );

        // CART
        // Ensure foreign-key columns have standalone indexes.
        await addIndexIfMissing(
            queryInterface,
            TABLES.cart,
            'cart_items_cart_id_idx',
            ['cart_id']
        );

        await addIndexIfMissing(
            queryInterface,
            TABLES.cart,
            'cart_items_item_id',
            ['item_id']
        );

        await removeIndexIfPresent(
            queryInterface,
            TABLES.cart,
            'cart_items_cart_id_item_id'
        );

        await removeIndexIfPresent(
            queryInterface,
            TABLES.cart,
            'uq_cart_items_cart_item'
        );

        await addIndexIfMissing(
            queryInterface,
            TABLES.cart,
            'cart_items_cart_variant_unique_idx',
            ['cart_id', 'variant_id'],
            { unique: true }
        );

        // PURCHASE ORDERS
        await addIndexIfMissing(
            queryInterface,
            TABLES.purchaseOrder,
            'purchase_order_items_purchase_order_id',
            ['purchase_order_id']
        );

        await addIndexIfMissing(
            queryInterface,
            TABLES.purchaseOrder,
            'purchase_order_items_item_id',
            ['item_id']
        );

        await removeIndexIfPresent(
            queryInterface,
            TABLES.purchaseOrder,
            'purchase_order_items_order_item_unique'
        );

        await addIndexIfMissing(
            queryInterface,
            TABLES.purchaseOrder,
            'purchase_order_items_order_variant_unique_idx',
            ['purchase_order_id', 'variant_id'],
            { unique: true }
        );

        // GOODS RECEIPTS
        // Keep the existing receipt/purchase-order-line uniqueness rule.
    },

    async down(queryInterface) {
        // Rollback can fail if multiple variants of one parent item
        // have been added to the same cart, location, or purchase order.

        await removeIndexIfPresent(
            queryInterface,
            TABLES.purchaseOrder,
            'purchase_order_items_order_variant_unique_idx'
        );

        await addIndexIfMissing(
            queryInterface,
            TABLES.purchaseOrder,
            'purchase_order_items_order_item_unique',
            ['purchase_order_id', 'item_id'],
            { unique: true }
        );

        await removeIndexIfPresent(
            queryInterface,
            TABLES.cart,
            'cart_items_cart_variant_unique_idx'
        );

        await addIndexIfMissing(
            queryInterface,
            TABLES.cart,
            'cart_items_cart_id_item_id',
            ['cart_id', 'item_id'],
            { unique: true }
        );

        await addIndexIfMissing(
            queryInterface,
            TABLES.cart,
            'uq_cart_items_cart_item',
            ['cart_id', 'item_id'],
            { unique: true }
        );

        await removeIndexIfPresent(
            queryInterface,
            TABLES.inventory,
            'inventory_stock_variant_location_unique_idx'
        );

        await addIndexIfMissing(
            queryInterface,
            TABLES.inventory,
            'inventory_stock_item_location_unique_idx',
            ['item_id', 'location_id'],
            { unique: true }
        );

        // Remove the extra item_id index only after the old composite
        // index has been restored.
        await removeIndexIfPresent(
            queryInterface,
            TABLES.inventory,
            'inventory_stock_item_id_idx'
        );

        await removeIndexIfPresent(
            queryInterface,
            TABLES.cart,
            'cart_items_cart_id_idx'
        );
    }
};
