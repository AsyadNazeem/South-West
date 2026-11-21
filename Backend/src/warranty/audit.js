'use strict';

const { recordAuditLog } = require('../services/auditLogService');

// Callers pass only structured event metadata. Keep notes, messages, filenames and mail content private.
function auditClaim(claim, action, { req, transaction, before, after } = {}) {
    const actorType = req?.customer ? 'customer' : req?.user ? 'staff' : 'system';
    return recordAuditLog({
        module: 'warranty_claims', entityType: 'warranty_claim', entityId: claim.id,
        action: 'WARRANTY_CLAIM_' + action,
        description: claim.reference + ' · ' + action.toLowerCase().replaceAll('_', ' '),
        userId: req?.user?.id ?? null,
        ipAddress: req?.ip,
        oldValues: before,
        newValues: {
            claim_reference: claim.reference,
            actor_type: actorType,
            actor_id: req?.customer?.id ?? req?.user?.id ?? null,
            ...after
        },
        transaction
    });
}
module.exports = { auditClaim };
