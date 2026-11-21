'use strict';

const { randomUUID } = require('node:crypto');
const { Op } = require('sequelize');
const db = require('../models');
const { WarrantyClaim: Claim, WarrantyEvidence: Evidence, WarrantyRequest: Request, WarrantyHistory: History } = db;
const { fields, string, id, check, transitions, eligibility } = require('./policy');
const { auditClaim } = require('./audit');
const { MB } = require('./media');

async function purchase(customer, number, transaction) {
    const reference = string(number, 'purchase number', 100);
    check(/^[\w./-]+$/.test(reference), 'Invalid order or invoice number.');
    const scope = { customer_id: customer.id, order_type: 'online' };
    let order = await db.Order.findOne({ where: { ...scope, order_number: reference }, transaction });
    const invoiceScope = { customer_id: { [Op.or]: [customer.id, null] }, status: { [Op.notIn]: ['cancelled','refunded','draft'] } };
    let invoice;
    if (!order) {
        invoice = await db.Invoice.findOne({ where: { ...invoiceScope, invoice_number: reference }, transaction });
        if (invoice) order = await db.Order.findOne({ where: { ...scope, id: invoice.order_id }, transaction });
        else {
            // Older orders can carry their invoice number directly. Never fall back past a conflicting invoice.
            const existing = await db.Invoice.count({ where: { invoice_number: reference }, transaction });
            if (!existing) order = await db.Order.findOne({ where: { ...scope, invoice_number: reference }, transaction });
        }
    }
    check(order && order.payment_status === 'paid' && !['cancelled','returned'].includes(order.status),
        'Eligible purchase not found.', 404);
    invoice ||= await db.Invoice.findOne({ where: { ...invoiceScope, order_id: order.id }, order: [['id','DESC']], transaction });
    const addresses = await db.OrderAddress.findAll({ where: { order_id: order.id }, transaction });
    const address = addresses.find(a => a.address_type === 'billing') || addresses.find(a => a.address_type === 'shipping');
    const items = await db.OrderItem.findAll({ where: { order_id: order.id }, transaction,
        include: [{ model: db.Item, as: 'item', required: true, include: [{ model: db.Warranty, as: 'warranty' }] }] });
    return { order_id: order.id, order_number: order.order_number, invoice_id: invoice?.id || null,
        invoice_number: invoice?.invoice_number || order.invoice_number,
        customer_name: address?.recipient_name || [customer.first_name, customer.last_name].filter(Boolean).join(' '),
        phone: address?.phone || customer.phone, products: items.map(line => ({
            order_item_id: line.id, product_id: line.item_id, product: line.item.item_name,
            variant_id: line.variant_id, ...eligibility(order.order_date, line.item.warranty)
        })) };
}
async function getClaim(req, transaction) {
    const where = { id: id(req.params.id) };
    if (req.customer) where.customer_id = req.customer.id;
    const claim = await Claim.findOne({ where, transaction, lock: transaction?.LOCK.UPDATE });
    check(claim, 'Claim not found.', 404);
    return claim;
}
async function event(claim, req, transaction, type, previous, message = null, internal = null, notify = false) {
    const h = await History.create({ claim_id: claim.id, customer_id: req.customer?.id, staff_id: req.user?.id,
        event: type, previous_status: previous, new_status: claim.status, message, internal_note: internal }, { transaction });
    if (notify) await db.WarrantyMail.create({ history_id: h.id, state: 'pending', attempts: 0, available_at: new Date() }, { transaction });
    return h;
}
async function notifyReviewers(claim, recipients, type, title, transaction) {
    await db.AdminNotification.bulkCreate(recipients.map(user => ({
        user_id: user.id, type, title, message: claim.product + ' · ' + claim.reference,
        reference_type: 'warranty_claim', reference_id: claim.id
    })), { transaction });
}
async function storeEvidence(claim, requestId, records, transaction) {
    const count = claim.evidence_count + records.length;
    const bytes = claim.evidence_bytes + records.reduce((total, file) => total + file.bytes, 0);
    check(count <= 80 && bytes <= 100 * MB, 'Claim evidence quota reached.', 413);
    const usage = await Claim.sum('evidence_bytes', { where: { customer_id: claim.customer_id }, transaction });
    check(Number(usage) + bytes - claim.evidence_bytes <= 512 * MB, 'Account evidence quota reached.', 413);
    await Evidence.bulkCreate(records.map(r => ({ ...r, claim_id: claim.id, uploaded_by: claim.customer_id,
        request_id: requestId })), { transaction });
    await claim.update({ evidence_count: count, evidence_bytes: bytes }, { transaction });
}
function submissionKey(req) {
    const key = req.get('Idempotency-Key');
    check(typeof key === 'string' && /^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i.test(key), 'A valid submission key is required.');
    return key;
}
async function submit(req, form, processFiles) {
    const answering = !!req.params.request;
    const key = answering ? null : submissionKey(req);
    const data = form.values;
    fields(data, answering ? ['explanation'] : ['number','order_item_id','phone','reason']);
    const message = string(answering ? data.explanation : data.reason, answering ? 'explanation' : 'reason', 2000);
    check(answering ? form.files.length : form.photos, 'Add evidence to this submission.');
    if (!answering) {
        id(data.order_item_id);
        check(/^\+?[\d ()-]{7,30}$/.test(data.phone || '') && /^\d{7,15}$/.test(data.phone.replace(/\D/g,'')), 'Enter a valid phone number.');
    }
    // Serialize a customer's claims and storage quota, including across Passenger processes.
    return db.sequelize.transaction(async transaction => {
        await db.Customer.findByPk(req.customer.id, { transaction, lock: transaction.LOCK.UPDATE });
        if (answering) {
            const claim = await getClaim(req, transaction);
            const request = await Request.findOne({ where: { id: id(req.params.request), claim_id: claim.id,
                active: true }, transaction, lock: transaction.LOCK.UPDATE });
            check(request && claim.status === 'More Evidence Required', 'This evidence request is no longer active.', 409);
            await storeEvidence(claim, request.id, await processFiles(), transaction);
            await request.update({ active: null, status: 'answered', response: message, answered_at: new Date() }, { transaction });
            const previous = claim.status;
            await claim.update({ status: 'Evidence Submitted' }, { transaction });
            await event(claim, req, transaction, 'Evidence received', previous, message, null, true);
            await auditClaim(claim, 'EVIDENCE_SUBMITTED', { req, transaction, before: {status: previous},
                after: {status: claim.status, evidence_request_id: request.id, file_count: form.files.length} });
            const reviewers = await staff(transaction);
            await notifyReviewers(claim, reviewers, 'warranty_evidence', 'Customer responded with additional evidence', transaction);
            return { id: claim.id, reference: claim.reference };
        }
        const replay = await Claim.findOne({ where: { customer_id: req.customer.id, submission_key: key }, transaction });
        if (replay) {
            check(String(replay.order_item_id) === data.order_item_id && replay.reason === message && replay.phone === data.phone &&
                [replay.order_number, replay.invoice_number].includes(data.number), 'Submission key already used.', 409);
            return { id: replay.id, reference: replay.reference };
        }
        const { products, ...order } = await purchase(req.customer, data.number, transaction);
        const product = products.find(p => String(p.order_item_id) === data.order_item_id);
        check(product?.allowed, 'Product is ineligible or does not belong to this purchase.');
        const active = await Claim.count({ where: { order_item_id: product.order_item_id,
            status: { [Op.notIn]: ['Resolved','Closed','Rejected'] } }, transaction });
        check(!active, 'An open claim already exists for this order item.', 409);
        const claim = await Claim.create({ ...order, customer_id: req.customer.id, order_item_id: product.order_item_id,
            product_id: product.product_id, product: product.product, eligibility: product.label, phone: data.phone,
            reason: message, reference: 'WC-' + randomUUID(), submission_key: key, status: 'Submitted',
            evidence_count: 0, evidence_bytes: 0 }, { transaction });
        await storeEvidence(claim, null, await processFiles(), transaction);
        const history = await event(claim, req, transaction, 'Submitted', null, null, null, true);
        await auditClaim(claim, 'SUBMITTED', { req, transaction, after: {status: claim.status,
            order_item_id: claim.order_item_id, file_count: claim.evidence_count} });
        const reviewers = await staff(transaction);
        await notifyReviewers(claim, reviewers, 'warranty_submitted', 'New warranty claim', transaction);
        await db.WarrantyMail.bulkCreate(reviewers.map(user => ({
            history_id: history.id, recipient: 'staff:' + user.id, state: 'pending', attempts: 0, available_at: new Date()
        })), { transaction });
        return { id: claim.id, reference: claim.reference };
    });
}
async function staff(transaction) {
    const users = await db.User.findAll({ where: { is_active: true }, attributes: ['id','email'], transaction,
        include: [{ model: db.Role, as: 'roles', through: { attributes: [] }, include: [
            { model: db.Permission, as: 'permissions', attributes: ['name'], through: { attributes: [] },
                where: { name: { [Op.in]: ['warranty_claims.view','warranty_claims.review'] } } }
        ] }] });
    return users.filter(u => {
        const perms = new Set(u.roles.flatMap(r => r.permissions.map(p => p.name)));
        return perms.size === 2;
    }).map(u => ({ id: u.id, email: u.email }));
}
async function change(req, action) {
    const data = req.body;
    const allowed = { status: ['status','message','internal_note'], request: ['reason','instructions'],
        note: ['internal_note'], assign: ['assigned_staff_id'] };
    fields(data, allowed[action]);
    return db.sequelize.transaction(async transaction => {
        const c = await getClaim(req, transaction), previous = c.status;
        let message, note, auditAction;
        const before = { status: previous };
        const after = {};
        if (action === 'request') {
            check(['Under Review','Evidence Submitted'].includes(previous), 'Review the claim before requesting evidence.', 409);
            message = string(data.reason, 'reason', 2000);
            const request = await Request.create({ claim_id: c.id, requested_by: req.user.id, reason: message,
                instructions: string(data.instructions, 'instructions', 2000, true), active: true, status: 'open' }, { transaction });
            c.status = 'More Evidence Required';
            auditAction = 'EVIDENCE_REQUESTED';
            after.evidence_request_id = request.id;
        } else if (action === 'status') {
            check(transitions[previous].includes(data.status), 'This status change is unavailable.', 409);
            c.status = data.status;
            auditAction = { Approved:'APPROVED', Rejected:'REJECTED', Closed:'CLOSED' }[c.status] || 'STATUS_CHANGED';
            if (c.status === 'Resolved') c.resolved_at = new Date();
            message = string(data.message, 'customer message', 2000, c.status !== 'Rejected');
            note = string(data.internal_note, 'internal note', 2000, true);
            after.internal_note_added = Boolean(note);
        } else if (action === 'note') {
            note = string(data.internal_note, 'internal note', 2000);
            auditAction = 'INTERNAL_NOTE_ADDED';
        } else {
            const target = data.assigned_staff_id === null ? null : id(data.assigned_staff_id);
            check(!target || (await staff(transaction)).some(s => String(s.id) === target), 'Select an active reviewer.');
            if (String(c.assigned_staff_id) === String(target)) return;
            before.assigned_staff_id = c.assigned_staff_id;
            after.assigned_staff_id = target;
            auditAction = 'REVIEWER_CHANGED';
            c.assigned_staff_id = target;
            if (target) await notifyReviewers(c, [{id:target}], 'warranty_assignment', 'Warranty claim assigned to you', transaction);
            note = target ? 'Assigned to staff ' + target : 'Assignment removed';
        }
        await c.save({ transaction });
        const history = await event(c, req, transaction, action, previous, message, note, previous !== c.status);
        await auditClaim(c, auditAction, { req, transaction, before,
            after: { ...after, status: c.status, history_id: history.id } });
    });
}
module.exports = { purchase, getClaim, event, submit, staff, change };
