'use strict';

const { AuditLog } = require('../models');

const SENSITIVE_KEYS = new Set([
    'password',
    'passwd',
    'pwd',
    'passwordhash',
    'passwordconfirmation',
    'passwordresettoken',
    'token',
    'accesstoken',
    'refreshtoken',
    'refreshtokenhash',
    'authorization',
    'cookie',
    'setcookie',
    'secret',
    'clientsecret',
    'apikey',
    'privatekey',
    'sessionid',
    'cardnumber',
    'cvv',
    'cvc',
    'pin',
    'otp'
]);

function normalizeKey(key) {
    return key.toLowerCase().replace(/[^a-z0-9]/g, '');
}


function isSensitiveKey(key) {
    const normalized = normalizeKey(key);

    if (SENSITIVE_KEYS.has(normalized)) {
        return true;
    }

    return /password|passwd|pwd|token|secret|apikey|privatekey|authorization|cookie|sessionid|cardnumber|cvv|cvc|otp|pin/i
        .test(normalized);
}


function redactSensitiveValues(value) {
    if (Array.isArray(value)) {
        return value.map(redactSensitiveValues);
    }

    if (!value || typeof value !== 'object') {
        return value;
    }

    const result = {};

    for (const [key, child] of Object.entries(value)) {
        result[key] = isSensitiveKey(key)
            ? '[REDACTED]'
            : redactSensitiveValues(child);
    }

    return result;
}

async function recordAuditLog({
    userId = null,
    action,
    module,
    entityType = null,
    entityId = null,
    description = null,
    oldValues = null,
    newValues = null,
    ipAddress = null,
    userAgent = null,
    requestId = null,
    transaction = undefined
}) {
    if (!action || !module) {
        throw new Error('Audit log requires an action and module');
    }

    return AuditLog.create({
        user_id: userId,
        action,
        module,
        entity_type: entityType,
        entity_id: entityId === null ? null : String(entityId),
        description,
        old_values: oldValues === null
            ? null
            : redactSensitiveValues(oldValues),
        new_values: newValues === null
            ? null
            : redactSensitiveValues(newValues),
        ip_address: ipAddress,
        user_agent: userAgent
            ? String(userAgent).slice(0, 500)
            : null,
        request_id: requestId
            ? String(requestId).slice(0, 100)
            : null
    }, transaction ? { transaction } : {});
}

module.exports = {
    recordAuditLog,
    redactSensitiveValues
};
