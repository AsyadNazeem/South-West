'use strict';

const DEFAULT_DURATION = '1_month';
const DURATIONS = ['14_days', DEFAULT_DURATION, '2_months'];
// The Sequelize session uses +05:30 (Asia/Colombo). Work in local calendar
// coordinates, then convert the result back to a UTC Unix timestamp.
const COLOMBO_OFFSET_MS = 330 * 60_000;

function expirationFor(duration, now = Date.now()) {
    if (!DURATIONS.includes(duration)) throw new RangeError('Unsupported NEW label duration');
    if (duration === '14_days') return now + 14 * 86_400_000;
    const local = new Date(now + COLOMBO_OFFSET_MS);
    const day = local.getUTCDate();
    local.setUTCDate(1);
    local.setUTCMonth(local.getUTCMonth() + (duration === '2_months' ? 2 : 1));
    const lastDay = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth() + 1, 0)).getUTCDate();
    local.setUTCDate(Math.min(day, lastDay));
    return local.getTime() - COLOMBO_OFFSET_MS;
}

function validateLabel(input) {
    if (input.is_new !== undefined && typeof input.is_new !== 'boolean') return 'is_new must be a boolean';
    if (input.new_label_duration !== undefined && !DURATIONS.includes(input.new_label_duration)) {
        return 'NEW label duration must be 14_days, 1_month, or 2_months';
    }
    if (input.reactivate_new_label !== undefined && typeof input.reactivate_new_label !== 'boolean') {
        return 'reactivate_new_label must be a boolean';
    }
    if (input.reactivate_new_label && input.is_new !== true) return 'Reactivation requires is_new to be true';
    return null;
}

function isNewLabelActive(item, now = Date.now()) {
    return Boolean(item.is_new) && Number(item.new_label_expires_at_ms) > now;
}

// Return only fields that need to be written. Older clients may send is_new
// on every edit, even after a marked item's period has expired.
function labelChanges(item, input, now = Date.now()) {
    if (input.is_new === false || (!item && !input.is_new)) {
        return { is_new: false, new_label_duration: null, new_label_expires_at_ms: null };
    }
    if (!(input.is_new ?? item?.is_new)) return {};
    const duration = input.new_label_duration ?? item?.new_label_duration ?? DEFAULT_DURATION;
    if (!item?.is_new || duration !== item.new_label_duration ||
        (input.reactivate_new_label && !isNewLabelActive(item, now))) {
        return { is_new: true, new_label_duration: duration, new_label_expires_at_ms: expirationFor(duration, now) };
    }
    return {};
}

module.exports = { validateLabel, labelChanges, isNewLabelActive, expirationFor };
