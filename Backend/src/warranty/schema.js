'use strict';

// Frozen migration v1 definitions. Subsequent schema changes require a new migration.
module.exports = D => {
    const required = type => ({ type, allowNull: false });
    const optional = type => ({ type, allowNull: true });
    const fk = (model, nullable = false) => ({
        type: D.BIGINT.UNSIGNED, allowNull: nullable,
        references: { model, key: 'id' }, onDelete: 'RESTRICT', onUpdate: 'CASCADE'
    });
    const base = () => ({
        id: { ...required(D.BIGINT.UNSIGNED), primaryKey: true, autoIncrement: true },
        created_at: required(D.DATE)
    });
    const status = D.ENUM('Submitted', 'Under Review', 'More Evidence Required', 'Evidence Submitted',
        'Approved', 'Rejected', 'Processing', 'Resolved', 'Closed');
    return {
        WarrantyClaim: { table: 'warranty_claims', indexes: [
            { unique: true, fields: ['customer_id', 'submission_key'] },
            { fields: ['status', 'created_at'] }, { fields: ['order_item_id', 'status'] }
        ], fields: {
            ...base(), reference: { ...required(D.STRING(40)), unique: true },
            submission_key: required(D.STRING(36)), customer_id: fk('customers'), order_id: fk('orders'),
            invoice_id: fk('invoices', true), order_item_id: fk('order_items'), product_id: fk('items'),
            order_number: required(D.STRING(50)), invoice_number: optional(D.STRING(100)),
            customer_name: required(D.STRING(255)), product: required(D.STRING(255)), phone: required(D.STRING(30)),
            eligibility: required(D.STRING(255)), reason: required(D.TEXT), status: required(status),
            assigned_staff_id: fk('users', true), evidence_count: required(D.INTEGER.UNSIGNED),
            evidence_bytes: required(D.INTEGER.UNSIGNED), updated_at: required(D.DATE), resolved_at: optional(D.DATE)
        } },
        WarrantyRequest: { table: 'warranty_claim_requests', indexes: [
            { unique: true, fields: ['claim_id', 'active'] }
        ], fields: {
            ...base(), claim_id: fk('warranty_claims'), requested_by: fk('users'), reason: required(D.TEXT),
            instructions: optional(D.TEXT), active: optional(D.BOOLEAN), response: optional(D.TEXT),
            status: required(D.ENUM('open', 'answered')), answered_at: optional(D.DATE)
        } },
        WarrantyEvidence: { table: 'warranty_claim_evidence', fields: {
            ...base(), claim_id: fk('warranty_claims'), request_id: fk('warranty_claim_requests', true),
            uploaded_by: fk('customers'), filename: { ...required(D.STRING(50)), unique: true },
            original_name: required(D.STRING(180)), mime: required(D.STRING(20)),
            bytes: required(D.INTEGER.UNSIGNED), duration: optional(D.FLOAT)
        } },
        WarrantyHistory: { table: 'warranty_claim_history', indexes: [{ fields: ['claim_id', 'id'] }], fields: {
            ...base(), claim_id: fk('warranty_claims'), customer_id: fk('customers', true), staff_id: fk('users', true),
            event: required(D.STRING(60)), previous_status: optional(status), new_status: required(status),
            message: optional(D.TEXT), internal_note: optional(D.TEXT)
        } },
        WarrantyMail: { table: 'warranty_claim_mail', indexes: [{ fields: ['state', 'available_at'] }], fields: {
            ...base(), history_id: { ...fk('warranty_claim_history'), unique: true },
            state: required(D.ENUM('pending', 'sending', 'sent', 'failed')), attempts: required(D.INTEGER.UNSIGNED),
            available_at: required(D.DATE), last_error: optional(D.STRING(100))
        } }
    };
};
