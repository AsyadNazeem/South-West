'use strict';

const isValidPrice = value => {
    if (
        value === undefined ||
        value === null ||
        value === '' ||
        typeof value === 'boolean'
    ) {
        return false;
    }

    const stringValue = String(value);

    if (!/^\d{1,13}(?:\.\d{1,2})?$/.test(stringValue)) {
        return false;
    }

    const amount = Number(value);

    return Number.isFinite(amount) && amount >= 0 && amount < 1e13;
};

module.exports = { isValidPrice };
