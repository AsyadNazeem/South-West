'use strict';

const { createHash } = require('node:crypto');
const { sequelize, Item, ItemVariant, ItemPrice, ItemPaymentPrice } = require('../models');
const { isValidPrice } = require('../services/priceAmount');
const { recordAuditLog } = require('../services/auditLogService');

const methods = ['cash', 'card', 'koko', 'mintpay'];
const commonFields = ['price', 'currency', 'is_active'];
const scheduleFields = [...commonFields, 'effective_from', 'effective_to'];

function fail(status, message, variantId) {
    throw Object.assign(new Error(message), { status, variantId });
}

async function snapshot(itemId, transaction, locking) {
    if (!/^[1-9]\d*$/.test(itemId)) fail(400, 'Invalid item ID.');
    const options = { transaction, ...(locking && { lock: transaction.LOCK.UPDATE }) };
    const item = await Item.findByPk(itemId, { ...options, attributes: ['id', 'item_code', 'item_name'] });
    if (!item) fail(404, 'Item not found.');
    const scoped = { ...options, where: { item_id: itemId }, order: [['id', 'ASC']] };
    const variants = await ItemVariant.findAll({ ...scoped, attributes: ['id', 'variant_name', 'variant_sku', 'is_default', 'is_active'] });
    const prices = await ItemPrice.findAll(scoped);
    const payments = await ItemPaymentPrice.findAll(scoped);
    const revision = createHash('sha256').update(JSON.stringify([variants, prices, payments])).digest('hex');
    return { item, variants, prices, payments, revision };
}

function validateValues(change, payment) {
    const fields = payment ? commonFields : scheduleFields;
    const values = Object.fromEntries(fields.map(key => [key, change[key]]));
    const invalid = message => fail(400, message, change.variant_id);
    if (!['number', 'string'].includes(typeof values.price) || !isValidPrice(values.price) ||
        (payment && Number(values.price) <= 0)) invalid('Enter a valid amount with up to two decimal places. Checkout prices must be positive.');
    if (typeof values.currency !== 'string' || !/^[a-z]{3}$/i.test(values.currency)) invalid('Enter a three-letter currency.');
    values.currency = values.currency.toUpperCase();
    if (typeof values.is_active !== 'boolean') invalid('Select an active status.');
    if (!payment) {
        for (const key of ['effective_from', 'effective_to']) {
            if (values[key] === null) continue;
            if (typeof values[key] !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.000)?Z$/.test(values[key]) ||
                Number(values[key].slice(0, 4)) < 1000 || !Number.isFinite(Date.parse(values[key])) ||
                new Date(values[key]).toISOString().slice(0,19) !== values[key].slice(0,19)) invalid('Enter a valid UTC date and time.');
            values[key] = new Date(values[key]);
        }
        if (values.effective_from && values.effective_to && values.effective_from > values.effective_to) invalid('The end must follow the start.');
    }
    return values;
}

function validId(value) {
    return ['number', 'string'].includes(typeof value) && /^[1-9]\d*$/.test(String(value));
}

function overlaps(left, right) {
    return left.currency.toUpperCase() === right.currency.toUpperCase() &&
        (!left.effective_from || !right.effective_to || left.effective_from <= right.effective_to) &&
        (!left.effective_to || !right.effective_from || left.effective_to >= right.effective_from);
}

async function apply(state, change, req, transaction, seen, touchedSchedules) {
    if (!change || typeof change !== 'object') fail(400, 'Invalid price change.');
    const { variant_id, id, kind, type } = change;
    const reject = (status, message) => fail(status, message, variant_id);
    if (variant_id !== null && !validId(variant_id)) reject(400, 'Invalid variant ID.');
    if (id !== null && !validId(id)) reject(400, 'Invalid price record ID.');
    const variant = state.variants.find(row => String(row.id) === String(variant_id));
    if (variant_id !== null && !variant) reject(400, 'Variant does not belong to this item.');
    if (variant && !variant.is_active) reject(409, 'Inactive variant is read-only.');
    const payment = kind === 'payment';
    if (!payment && kind !== 'schedule') reject(400, 'Invalid price record kind.');
    if (typeof type !== 'string' || !type.trim()) reject(400, 'Invalid price type.');
    const field = payment ? 'payment_method' : 'price_type';
    const rows = payment ? state.payments : state.prices;
    const siblings = rows.filter(row => String(row.variant_id) === String(variant_id) && row[field].toLowerCase() === type.toLowerCase());
    const existing = siblings.find(row => String(row.id) === String(id));
    if (id !== null && !existing) reject(400, 'Price record does not belong to this variant and type.');
    if (payment && !methods.includes(type)) reject(400, 'Invalid checkout method.');
    if (!existing && !payment) {
        if (!req.permissions.has('products.create')) reject(403, 'Creating a price requires products.create.');
        if (!variant || !['selling', 'cost'].includes(type)) reject(400, 'Select a variant and a missing selling or cost price.');
    }
    if (!existing && siblings.length) reject(409, 'Price type already exists. Reload prices.');
    if (payment && !existing && !state.prices.some(row => String(row.variant_id) === String(variant_id) && row.price_type.toLowerCase() === 'selling')) reject(400, 'Configure a selling price first.');
    if (existing?.effective_to && existing.effective_to.getTime() < Date.now()) reject(409, 'Expired price schedules are read-only.');
    const key = JSON.stringify([kind, variant_id === null ? null : String(variant_id), type.toLowerCase(), String(id)]);
    if (seen.has(key)) reject(400, 'Duplicate change.');
    seen.add(key);
    const values = validateValues(change, payment);
    const previous = existing?.toJSON();
    const model = payment ? ItemPaymentPrice : ItemPrice;
    const saved = existing || await model.create({ item_id: state.item.id, variant_id, [field]: type, ...values }, { transaction });
    if (existing) {
        const unchanged = Object.entries(values).every(([key, value]) => {
            if (key === 'price') return Number(existing.price) === Number(value);
            if (value instanceof Date) return existing[key]?.getTime() === value.getTime();
            return existing[key] === value;
        });
        if (unchanged) return;
        await existing.update(values, { transaction });
    } else {
        rows.push(saved);
    }
    if (!payment && saved.is_active) touchedSchedules.push(saved);
    await recordAuditLog({
        userId: req.user.id, action: payment ? 'ITEM_PAYMENT_PRICES_SAVED' : existing ? 'ITEM_PRICE_UPDATED' : 'ITEM_PRICE_CREATED',
        module: payment ? 'products' : 'inventory', entityType: payment ? 'item_payment_price' : 'item_price',
        entityId: saved.id, oldValues: previous && JSON.parse(JSON.stringify(previous)), newValues: JSON.parse(JSON.stringify(saved)),
        description: 'Admin variant price management', ipAddress: req.ip, userAgent: req.get('user-agent'), requestId: req.id, transaction
    });
}

function respondError(error, res) {
    if (error.status) return res.status(error.status).json({ message: error.message, variant_id: error.variantId });
    if (['ER_LOCK_DEADLOCK', 'ER_LOCK_WAIT_TIMEOUT', 'ER_DUP_ENTRY'].includes(error.original?.code))
        return res.status(409).json({ message: 'Concurrent pricing change. Reload and retry.' });
    console.error('Variant price management:', error.message);
    return res.status(500).json({ message: 'Unable to process item prices.' });
}

exports.read = async (req, res) => {
    try {
        const data = await sequelize.transaction(tx => snapshot(req.params.id, tx, false));
        return res.json({ data });
    } catch (error) { return respondError(error, res); }
};

exports.save = async (req, res) => {
    try {
        const { changes, revision } = req.body || {};
        if (!Array.isArray(changes) || !changes.length) fail(400, 'Provide price changes.');
        const data = await sequelize.transaction(async tx => {
            const state = await snapshot(req.params.id, tx, true);
            if (revision !== state.revision) fail(409, 'Pricing changed since this page opened. Reload and review your edits.');
            const seen = new Set();
            const touchedSchedules = [];
            // Selling rows must exist before new method prices can reference their scope.
            const ordered = [...changes.filter(c => c?.kind !== 'payment'), ...changes.filter(c => c?.kind === 'payment')];
            for (const change of ordered) {
                await apply(state, change, req, tx, seen, touchedSchedules);
            }
            // Validate the final schedule, allowing adjacent windows to move together.
            for (const row of touchedSchedules) {
                const conflict = state.prices.some(other => other !== row && other.is_active &&
                    String(other.variant_id) === String(row.variant_id) && other.price_type.toLowerCase() === row.price_type.toLowerCase() && overlaps(row, other));
                if (conflict) fail(409, 'Active price schedules overlap.', row.variant_id);
            }
            return snapshot(req.params.id, tx, true);
        });
        return res.json({ data });
    } catch (error) { return respondError(error, res); }
};


// Change existing price statuses without creating or deleting records.
exports.setStatus = async (req, res) => {
    try {
        const {
            scope,
            variant_id,
            is_active,
            revision
        } = req.body || {};

        if (!['product', 'variant'].includes(scope)) {
            fail(400, 'Select a valid price scope.');
        }

        if (typeof is_active !== 'boolean') {
            fail(400, 'Select a valid active status.');
        }

        if (scope === 'variant' && !validId(variant_id)) {
            fail(400, 'Invalid variant ID.');
        }

        if (scope === 'product' && variant_id != null) {
            fail(400, 'Product scope must not specify a variant.');
        }

        const data = await sequelize.transaction(async tx => {
            const state = await snapshot(req.params.id, tx, true);

            if (revision !== state.revision) {
                fail(409, 'Pricing changed. Reload and retry.');
            }

            const variants = new Map(
                state.variants.map(row => [String(row.id), row])
            );

            if (scope === 'variant') {
                const variant = variants.get(String(variant_id));

                if (!variant) {
                    fail(400, 'Variant does not belong to this item.');
                }

                if (is_active && !variant.is_active) {
                    fail(409, 'Inactive variant is read-only.');
                }
            }

            const matchesScope = row =>
                scope === 'product' ||
                String(row.variant_id) === String(variant_id);

            const now = Date.now();
            const touchedSchedules = [];
            const seen = new Set();

            let changed = 0;
            let skipped = 0;

            for (const [kind, rows] of [
                ['schedule', state.prices],
                ['payment', state.payments]
            ]) {
                for (const row of rows) {
                    if (!matchesScope(row)) continue;

                    const owner = row.variant_id === null
                        ? null
                        : variants.get(String(row.variant_id));

                    const readOnlyVariant =
                        row.variant_id !== null &&
                        (!owner || !owner.is_active);

                    const expired =
                        kind === 'schedule' &&
                        row.effective_to &&
                        row.effective_to.getTime() < now;

                    if (is_active && (readOnlyVariant || expired)) {
                        skipped++;
                        continue;
                    }

                    if (Boolean(row.is_active) === is_active) {
                        continue;
                    }

                    // Deactivation changes status only.
                    // Existing amounts and dates remain untouched.
                    if (!is_active) {
                        const previous = row.toJSON();

                        await row.update(
                            { is_active: false },
                            { transaction: tx }
                        );

                        await recordAuditLog({
                            userId: req.user.id,
                            action: kind === 'payment'
                                ? 'ITEM_PAYMENT_PRICES_SAVED'
                                : 'ITEM_PRICE_UPDATED',
                            module: kind === 'payment'
                                ? 'products'
                                : 'inventory',
                            entityType: kind === 'payment'
                                ? 'item_payment_price'
                                : 'item_price',
                            entityId: row.id,
                            oldValues: previous,
                            newValues: row.toJSON(),
                            description: 'Admin price deactivation',
                            ipAddress: req.ip,
                            userAgent: req.get('user-agent'),
                            requestId: req.id,
                            transaction: tx
                        });

                        changed++;
                        continue;
                    }

                    const change = {
                        kind,
                        id: row.id,
                        variant_id: row.variant_id,
                        type: kind === 'payment'
                            ? row.payment_method
                            : row.price_type,
                        price: row.price,
                        currency: row.currency,
                        is_active
                    };

                    if (kind === 'schedule') {
                        change.effective_from =
                            row.effective_from?.toISOString() ?? null;

                        change.effective_to =
                            row.effective_to?.toISOString() ?? null;
                    }

                    await apply(
                        state,
                        change,
                        req,
                        tx,
                        seen,
                        touchedSchedules
                    );

                    changed++;
                }
            }

            // Reject overlapping schedules before committing.
            for (const row of touchedSchedules) {
                const conflict = state.prices.some(other =>
                    other !== row &&
                    other.is_active &&
                    String(other.variant_id) ===
                        String(row.variant_id) &&
                    other.price_type.toLowerCase() ===
                        row.price_type.toLowerCase() &&
                    overlaps(row, other)
                );

                if (conflict) {
                    fail(
                        409,
                        'Active price schedules overlap.',
                        row.variant_id
                    );
                }
            }

            return {
                ...(await snapshot(req.params.id, tx, true)),
                changed,
                skipped
            };
        });

        return res.json({
            message: data.changed
                ? `${data.changed} price record(s) ${
                    is_active ? 'activated' : 'deactivated'
                }.`
                : 'No eligible price statuses needed changing.',
            data
        });
    } catch (error) {
        return respondError(error, res);
    }
};
