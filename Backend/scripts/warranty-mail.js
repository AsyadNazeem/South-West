'use strict';

const db = require('../src/models');
const { Op } = require('sequelize');
const email = require('../src/services/emailService');
const { staff } = require('../src/warranty/claims');
const { auditClaim } = require('../src/warranty/audit');

async function recordOutcome(job, claim, values) {
    await db.sequelize.transaction(async transaction => {
        const [changed] = await db.WarrantyMail.update(values, {
            where: {id: job.id, state: 'sending', attempts: job.attempts}, transaction
        });
        if (changed) await auditClaim(claim, values.state === 'sent' ? 'EMAIL_SENT' : 'EMAIL_FAILED', {
            transaction, after: { mail_job_id: job.id, attempt: job.attempts, queue_state: values.state,
                recipient_type: job.recipient === 'customer' ? 'customer' : 'staff' }
        });
    });
}

async function drain() {
    for (let i = 0; i < 50; i++) {
        const job = await db.sequelize.transaction(async transaction => {
            const j = await db.WarrantyMail.findOne({ where: { state: { [Op.in]: ['pending','sending'] },
                available_at: { [Op.lte]: new Date() } }, order: [['id','ASC']], lock: transaction.LOCK.UPDATE, transaction });
            if (!j) return;
            return j.update({ state: 'sending', attempts: j.attempts + 1, available_at: new Date(Date.now() + 900000) }, { transaction });
        });
        if (!job) break;
        const history = await db.WarrantyHistory.findByPk(job.history_id);
        const claim = await db.WarrantyClaim.findByPk(history.claim_id);
        try {
            console.info('Warranty mail attempt', { job: job.id, attempt: job.attempts });
            if (job.recipient === 'customer') {
                const customer = await db.Customer.findByPk(claim.customer_id);
                if (!customer?.email_verified_at || !customer.email) throw Object.assign(new Error(), {code:'NO_VERIFIED_EMAIL'});
                await email.sendWarrantyUpdate(customer.email, claim, history);
            } else {
                const reviewer = (await staff()).find(u => 'staff:' + u.id === job.recipient);
                if (!reviewer) throw Object.assign(new Error(), {code:'REVIEWER_UNAUTHORIZED'});
                const evidence = await db.WarrantyEvidence.findAll({ where: {claim_id:claim.id, request_id:null}, attributes:['mime'] });
                const photos = evidence.filter(e => e.mime === 'image/webp').length;
                await email.sendAdminWarrantyClaim(reviewer,claim,history,photos,evidence.length - photos);
            }
        } catch (error) {
            const terminal = job.attempts >= 6 || error.code === 'REVIEWER_UNAUTHORIZED';
            console.warn('Warranty mail attempt failed', {job:job.id, attempt:job.attempts, code:error.code || 'DELIVERY_FAILED'});
            await recordOutcome(job, claim, { state: terminal ? 'failed' : 'pending',
                last_error: String(error.code || 'DELIVERY_FAILED').slice(0,100),
                available_at: new Date(Date.now() + 60000 * 2 ** Math.min(job.attempts,6)) });
            continue;
        }
        await recordOutcome(job, claim, { state: 'sent', last_error: null });
    }
}
function startWorker() {
    let running = false;
    async function poll() {
        if (running) return;
        running = true;
        try { await drain(); }
        catch { console.error('Warranty mail queue unavailable. Verify database migrations and connection.'); }
        finally { running = false; }
    }
    poll();
    setInterval(poll, 60000).unref();
}

async function inspect() {
    const rows = await db.WarrantyMail.findAll({ where: {state:{[Op.ne]:'sent'}},
        attributes:['id','history_id','state','available_at','attempts','last_error'], order:[['id','ASC']], limit:100 });
    console.table(rows.map(row => row.toJSON()));
}

if (require.main === module) (process.argv.includes('--inspect') ? inspect() : drain()).catch(() => { console.error('Warranty mail worker failed'); process.exitCode = 1; })
    .finally(() => db.sequelize.close());
module.exports = { drain, startWorker };
