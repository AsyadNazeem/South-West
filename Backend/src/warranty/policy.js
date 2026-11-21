'use strict';

class ClaimError extends Error {
    constructor(status, message) { super(message); this.status = status; }
}
function check(ok, message, status = 400) {
    if (!ok) throw new ClaimError(status, message);
}
function string(value, name, max, optional = false) {
    if (optional && (value == null || value === '')) return null;
    check(typeof value === 'string', 'Enter a valid ' + name + '.');
    const result = value.normalize('NFC').trim();
    check(result.length && result.length <= max && !/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(result),
        'Enter a valid ' + name + ' (maximum ' + max + ' characters).');
    return result;
}
function fields(input, allowed) {
    check(input && typeof input === 'object' && !Array.isArray(input) &&
        Object.keys(input).every(k => allowed.includes(k)), 'Unexpected fields.');
}
function id(value) {
    check(/^[1-9]\d{0,18}$/.test(String(value)), 'Invalid identifier.');
    return String(value);
}
const transitions = {
    Submitted: ['Under Review'], 'Under Review': ['Approved', 'Rejected'],
    'More Evidence Required': [], 'Evidence Submitted': ['Under Review', 'Approved', 'Rejected'],
    Approved: ['Processing', 'Resolved'], Processing: ['Resolved'], Rejected: ['Closed'],
    Resolved: ['Closed'], Closed: []
};
function eligibility(orderDate, warranty, now = new Date()) {
    if (!warranty?.duration_value || warranty.duration_value < 0) {
        return { allowed: process.env.WARRANTY_UNKNOWN_POLICY !== 'deny', label: 'Warranty terms require staff review' };
    }
    const end = new Date(orderDate);
    const n = warranty.duration_value;
    if (warranty.duration_unit === 'Days') end.setUTCDate(end.getUTCDate() + n);
    else {
        const day = end.getUTCDate();
        end.setUTCDate(1);
        end.setUTCMonth(end.getUTCMonth() + (warranty.duration_unit === 'Years' ? 12 * n : n));
        const last = new Date(end);
        last.setUTCMonth(last.getUTCMonth() + 1, 0);
        end.setUTCDate(Math.min(day, last.getUTCDate()));
    }
    return { allowed: now <= end, label: warranty.name + ' · expires ' + end.toISOString().slice(0, 10) };
}
module.exports = { ClaimError, check, string, fields, id, transitions, eligibility };
