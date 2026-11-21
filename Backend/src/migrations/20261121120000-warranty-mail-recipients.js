'use strict';

const table = 'warranty_claim_mail';
const index = 'warranty_mail_history_recipient';
module.exports = {
    async up(q, D) {
        const columns = await q.describeTable(table);
        if (!columns.recipient) await q.addColumn(table, 'recipient', {
            type: D.STRING(32), allowNull: false, defaultValue: 'customer'
        });
        const indexes = await q.showIndex(table);
        if (!indexes.some(i => i.name === index)) await q.addIndex(table, ['history_id','recipient'], { name: index, unique: true });
        for (const i of indexes) {
            if (i.unique && i.fields.length === 1 && i.fields[0].attribute === 'history_id') await q.removeIndex(table,i.name);
        }
    },
    async down(q) {
        // An older worker would send admin jobs to customers. Refuse a lossy rollback.
        const [rows] = await q.sequelize.query("SELECT id FROM warranty_claim_mail WHERE recipient <> 'customer' LIMIT 1");
        if (rows.length) throw new Error('Recipient-specific mail exists. Keep the expanded queue schema.');
        await q.addIndex(table,['history_id'],{unique:true,name:'warranty_mail_history_unique'});
        await q.removeIndex(table,index);
        await q.removeColumn(table,'recipient');
    }
};
