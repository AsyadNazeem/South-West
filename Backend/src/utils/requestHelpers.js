'use strict';

class HttpError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

// Multipart fields arrive as strings ("true" / "false")
const toBool = (value, fallback) => {
    if (value === undefined || value === null || value === '') return fallback;

    if (typeof value === 'boolean') return value;

    return ['true', '1', 'yes', 'on'].includes(String(value).toLowerCase());
};

const toInt = (value, fallback) => {
    const parsed = parseInt(value, 10);

    return Number.isNaN(parsed) ? fallback : parsed;
};

module.exports = {
    HttpError,
    toBool,
    toInt
};
