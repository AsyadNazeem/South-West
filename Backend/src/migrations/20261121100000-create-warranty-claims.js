'use strict';

const schema = require('../warranty/schema');
module.exports = {
    async up(q, D) {
        // MariaDB commits DDL implicitly. Resume a partially completed migration safely.
        const tables = await q.showAllTables();
        for (const { table, fields, indexes = [] } of Object.values(schema(D))) {
            if (!tables.includes(table)) await q.createTable(table, fields, { engine: 'InnoDB' });
            const existing = await q.showIndex(table);
            for (const [i, index] of indexes.entries()) {
                const name = table + '_idx_' + i;
                if (!existing.some(row => row.name === name)) await q.addIndex(table, { ...index, name });
            }
        }
    },
    async down(q, D) {
        for (const { table } of Object.values(schema(D)).reverse()) await q.dropTable(table);
    }
};
