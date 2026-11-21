'use strict';

const express = require('express');
const { Op } = require('sequelize');
const { rateLimit } = require('express-rate-limit');
const db = require('../models');
const auth = require('../middleware/authMiddleware');
const customerAuth = require('../middleware/customerAuthMiddleware');
const { requirePermission } = require('../middleware/requirePermission');
const { ClaimError, fields, check, string, transitions } = require('../warranty/policy');
const { withUpload } = require('../warranty/media');
const { auditClaim } = require('../warranty/audit');
const { getClaim, purchase, submit, change, staff } = require('../warranty/claims');
const { file, zip } = require('../warranty/files');
const customer = express.Router(), admin = express.Router();
const perm = name => requirePermission('warranty_claims.' + name);
const limiter = max => rateLimit({ windowMs: 15 * 60 * 1000, limit: max,
    keyGenerator: req => String(req.customer?.id || req.user.id), standardHeaders: 'draft-7', legacyHeaders: false,
    message: { message: 'Too many requests. Please try again later.' } });
const uploads = limiter(15);
customer.use(customerAuth);
admin.use(auth, perm('view'));

async function list(req, res) {
    fields(req.query, ['page','q','status','from','to','sort','direction']);
    const { page = '1', q, status, from, to, sort = 'created_at', direction = 'desc' } = req.query;
    check(/^[1-9]\d{0,5}$/.test(page) && ['created_at','reference','status','customer_name'].includes(sort) &&
        ['asc','desc'].includes(direction), 'Invalid page or sort.');
    const where = req.customer ? { customer_id: req.customer.id } : {};
    if (status) { check(Object.hasOwn(transitions, status), 'Unknown status.'); where.status = status; }
    if (q) {
        const search = string(q,'search',100);
        where[Op.or] = ['reference','customer_name','order_number','invoice_number','product','phone'].map(
            key => ({ [key]: { [Op.like]: '%' + search + '%' } }));
    }
    for (const [date, op] of [[from,Op.gte],[to,Op.lt]]) {
        if (!date) continue;
        check(typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date), 'Invalid date.');
        const time = new Date(date + 'T00:00:00+05:30').getTime();
        check(Number.isFinite(time), 'Invalid date.');
        (where.created_at ||= {})[op] = new Date(time + (op === Op.lt ? 86400000 : 0));
    }
    const { rows, count } = await db.WarrantyClaim.findAndCountAll({ where, limit: 20, offset: (page - 1) * 20,
        attributes: { exclude: ['submission_key','evidence_bytes', ...(req.customer ? ['assigned_staff_id'] : [])] },
        include: req.customer ? [] : [{ model: db.User, as: 'reviewer', attributes: ['id','email'] }],
        order: [[sort,direction.toUpperCase()],['id','DESC']] });
    res.json({ rows, count, pageSize: 20, statuses: Object.keys(transitions) });
}
async function detail(req,res) {
    const c = await getClaim(req), where = { claim_id: c.id };
    const customer = Boolean(req.customer);
    const [history, requests, evidence] = await Promise.all([
        db.WarrantyHistory.findAll({ where: customer ? { ...where, event: { [Op.in]:
            ['Submitted','status','request','Evidence received'] } } : where,
            attributes: customer ? ['created_at','event','new_status','previous_status','message'] : undefined,
            order: [['id','ASC']] }),
        db.WarrantyRequest.findAll({ where, attributes: customer ? { exclude: ['requested_by'] } : undefined, order: [['id','ASC']] }),
        db.WarrantyEvidence.findAll({ where, attributes: ['id','mime','bytes','duration','request_id','created_at'], order: [['id','ASC']] })
    ]);
    const { submission_key, evidence_bytes, ...claim } = c.toJSON();
    if (customer) delete claim.assigned_staff_id;
    else {
        claim.customer = await db.Customer.findByPk(claim.customer_id, { attributes: ['id','first_name','last_name','email'] });
        if (claim.assigned_staff_id) claim.reviewer = await c.getReviewer({ attributes: ['id','email'] });
    }
    const customerMail = customer ? [] : await db.WarrantyMail.findAll({
        where: { history_id: {[Op.in]:history.map(h => h.id)}, recipient:'customer' },
        attributes:['history_id','state','attempts','last_error'], order:[['id','DESC']]
    });
    if (!customer) await auditClaim(c, 'VIEWED', { req, after: { status: c.status } });
    res.json({ claim, history, requests, evidence, ...(customer ? {} : {customerMail}), transitions: customer ? [] : transitions[c.status] });
}
customer.get('/purchase', async (req,res) => {
    fields(req.query,['number']);
    res.json(await purchase(req.customer, req.query.number));
});
admin.get('/staff', perm('assign'), async (req,res) => res.json(await staff()));
for (const router of [customer, admin]) {
    router.get('/', list);
    router.get('/:id', detail);
}
async function receive(req,res) {
    const controller = new AbortController();
    const abort = () => controller.abort();
    res.once('close', abort);
    req.warrantySignal = controller.signal;
    try {
        const result = await withUpload(req, (form,processFiles) => submit(req,form,processFiles));
        res.status(201).json(result);
    } finally { res.off('close',abort); }
}
customer.post('/', uploads, receive);
customer.post('/:id/requests/:request', uploads, receive);
customer.get('/:id/files/:file', limiter(100), file);
const downloads = limiter(80);
admin.get('/:id/files/:file', perm('download_evidence'), downloads, file);
admin.get('/:id/archive', perm('download_evidence'), downloads, zip);
for (const [action, permission] of Object.entries({ status: 'update_status', request: 'request_evidence', note: 'review', assign: 'assign' })) {
    admin.post('/:id/' + action, perm(permission), async (req,res) => {
        await change(req, action); res.sendStatus(204);
    });
}
for (const router of [customer, admin]) router.use((err,req,res,next) => {
    const status = err instanceof ClaimError ? err.status : 500;
    console.warn('Warranty request failed', { status, actor: req.customer?.id || req.user?.id, method: req.method });
    if (res.headersSent) return res.destroy();
    res.status(status).json({ message: status === 500 ? 'Unable to complete warranty request.' : err.message });
});
module.exports = { customer, admin };
