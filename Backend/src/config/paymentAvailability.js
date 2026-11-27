'use strict';

// Server-side payment availability.
// Never trust frontend payment availability alone.
// Enable providers only after integration verification.

const PAYMENT_AVAILABILITY = Object.freeze({
    cash: true,
    card: true,
    koko: false,
    mintpay: false
});

function isPaymentMethodEnabled(method) {
    const normalized = method === 'cod' ? 'cash' : method;

    return typeof normalized === 'string' &&
        Object.prototype.hasOwnProperty.call(
            PAYMENT_AVAILABILITY,
            normalized
        ) &&
        PAYMENT_AVAILABILITY[normalized] === true;
}

module.exports = {
    PAYMENT_AVAILABILITY,
    isPaymentMethodEnabled
};
