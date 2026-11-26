'use strict';

// A null variantId explicitly requests an item-level row. Callers own their
// existing fallback policies. This lookup never substitutes a sibling SKU.
function findPaymentPrice(model, itemId, variantId, method, transaction) {
    return model.findOne({
        where: {
            item_id: itemId,
            variant_id: variantId,
            payment_method: method,
            currency: 'LKR',
            is_active: true
        },
        order: [['id', 'DESC']],
        transaction
    });
}

module.exports = { findPaymentPrice };
