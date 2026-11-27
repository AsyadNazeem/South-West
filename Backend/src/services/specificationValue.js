'use strict';

const validateSpecificationValue = (value, dataType) => {
    if (value === null) {
        return { valid: true, value: null };
    }

    if (
        value === undefined ||
        !['string', 'number', 'boolean'].includes(typeof value)
    ) {
        return { valid: false };
    }

    const text = String(value);

    switch (dataType) {
        case 'text':
        case 'select':
            if (text.length > 65535) {
                return { valid: false };
            }

            return { valid: true, value: text };

        case 'number':
        case 'decimal': {
            if (text.trim() === '') {
                return { valid: false };
            }

            const number = Number(text);

            if (!Number.isFinite(number)) {
                return { valid: false };
            }

            if (
                dataType === 'number' &&
                !Number.isInteger(number)
            ) {
                return { valid: false };
            }

            return { valid: true, value: text };
        }

        case 'boolean': {
            const normalized = text.trim().toLowerCase();

            if (!['true', 'false', '1', '0'].includes(normalized)) {
                return { valid: false };
            }

            return {
                valid: true,
                value:
                    normalized === 'true' || normalized === '1'
                        ? 'true'
                        : 'false'
            };
        }

        case 'date': {
            if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
                return { valid: false };
            }

            const [year, month, day] = text.split('-').map(Number);
            const date = new Date(Date.UTC(year, month - 1, day));

            if (
                date.getUTCFullYear() !== year ||
                date.getUTCMonth() !== month - 1 ||
                date.getUTCDate() !== day
            ) {
                return { valid: false };
            }

            return { valid: true, value: text };
        }

        default:
            return { valid: false };
    }
};

module.exports = { validateSpecificationValue };
