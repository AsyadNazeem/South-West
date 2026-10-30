
'use strict';

const { randomUUID } = require('crypto');

function slugify(value) {
    const slug = String(value || '')
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 180)
        .replace(/-+$/g, '');

    return slug || 'product';
}

module.exports = {
    async up(queryInterface, Sequelize) {
        const table = await queryInterface.describeTable('items');

        if (!table.public_id) {
            await queryInterface.addColumn('items', 'public_id', {
                type: Sequelize.CHAR(36),
                allowNull: true,
            });
        }

        if (!table.slug) {
            await queryInterface.addColumn('items', 'slug', {
                type: Sequelize.STRING(191),
                allowNull: true,
            });
        }

   const [items] = await queryInterface.sequelize.query(
    `SELECT id, item_name, public_id, slug
     FROM items
     ORDER BY id ASC`
);

const usedSlugs = new Set(
    items
        .filter(item => item.slug)
        .map(item => item.slug)
);

for (const item of items) {
    const updates = {};

    if (!item.public_id) {
        updates.public_id = randomUUID();
    }

    if (!item.slug) {
        const baseSlug = slugify(item.item_name);
        let slug = baseSlug;
        let suffix = 2;

        while (usedSlugs.has(slug)) {
            slug = `${baseSlug}-${suffix++}`;
        }

        usedSlugs.add(slug);
        updates.slug = slug;
    }

    if (Object.keys(updates).length > 0) {
        await queryInterface.bulkUpdate(
            'items',
            updates,
            { id: item.id }
        );
    }
}

        const indexes = await queryInterface.showIndex('items');

        if (!indexes.some(index =>
            index.unique &&
            index.fields.length === 1 &&
            index.fields[0].attribute === 'public_id'
        )) {
            await queryInterface.addIndex('items', ['public_id'], {
                name: 'uq_items_public_id',
                unique: true,
            });
        }

        if (!indexes.some(index =>
            index.unique &&
            index.fields.length === 1 &&
            index.fields[0].attribute === 'slug'
        )) {
            await queryInterface.addIndex('items', ['slug'], {
                name: 'uq_items_slug',
                unique: true,
            });
        }

        await queryInterface.changeColumn('items', 'public_id', {
            type: Sequelize.CHAR(36),
            allowNull: false,
        });

        await queryInterface.changeColumn('items', 'slug', {
            type: Sequelize.STRING(191),
            allowNull: false,
        });
    },

    async down(queryInterface) {
        const table = await queryInterface.describeTable('items');

        if (table.slug) {
            const indexes = await queryInterface.showIndex('items');

            const slugIndex = indexes.find(index =>
                index.unique &&
                index.fields.length === 1 &&
                index.fields[0].attribute === 'slug'
            );

            if (slugIndex) {
                await queryInterface.removeIndex('items', slugIndex.name);
            }

            await queryInterface.removeColumn('items', 'slug');
        }

        if (table.public_id) {
            const indexes = await queryInterface.showIndex('items');

            const publicIdIndex = indexes.find(index =>
                index.unique &&
                index.fields.length === 1 &&
                index.fields[0].attribute === 'public_id'
            );

            if (publicIdIndex) {
                await queryInterface.removeIndex(
                    'items',
                    publicIdIndex.name
                );
            }

            await queryInterface.removeColumn('items', 'public_id');
        }
    },
};
