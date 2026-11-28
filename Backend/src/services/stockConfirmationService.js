'use strict';

const { createHash } = require('node:crypto');

const { StockConfirmationSetting } = require('../models');

const SETTING_ID = 1;

function normalizePhone(value) {
    if (typeof value !== 'string') return null;

    let phone = value.trim().replace(/[\s()-]/g, '');

    if (phone.startsWith('+94')) {
        phone = '0' + phone.slice(3);
    } else if (phone.startsWith('94')) {
        phone = '0' + phone.slice(2);
    }

    return /^0[1-9]\d{8}$/.test(phone) ? phone : null;
}

function serializeSettings(settings) {
    return {
        enabled: Boolean(settings.enabled),
        threshold: Number(settings.threshold),
        primary_phone: settings.primary_phone,
        primary_whatsapp: Boolean(settings.primary_whatsapp),
        secondary_phone: settings.secondary_phone || null,
        secondary_whatsapp: Boolean(
            settings.secondary_phone && settings.secondary_whatsapp
        )
    };
}

function validateSettings(body = {}) {
    const booleanFields = [
        'enabled',
        'primary_whatsapp',
        'secondary_whatsapp'
    ];

    for (const field of booleanFields) {
        if (typeof body[field] !== 'boolean') {
            throw new Error(`${field} must be true or false.`);
        }
    }

    const rawThreshold = String(body.threshold ?? '').trim();

    if (!/^\d{1,10}(\.\d{1,2})?$/.test(rawThreshold)) {
        throw new Error('Enter a valid price threshold.');
    }

    const threshold = Number(rawThreshold);

    if (
        !Number.isFinite(threshold) ||
        threshold <= 0 ||
        threshold > 9999999999.99
    ) {
        throw new Error('Price threshold must be greater than zero.');
    }

    const primaryPhone = normalizePhone(body.primary_phone);

    if (!primaryPhone) {
        throw new Error('Enter a valid primary Sri Lankan phone number.');
    }

    let secondaryPhone = null;

    if (
        body.secondary_phone !== null &&
        body.secondary_phone !== undefined &&
        body.secondary_phone !== ''
    ) {
        secondaryPhone = normalizePhone(body.secondary_phone);

        if (!secondaryPhone) {
            throw new Error('Enter a valid secondary phone number.');
        }

        if (secondaryPhone === primaryPhone) {
            throw new Error('Contact numbers must be different.');
        }
    }

    return {
        enabled: body.enabled,
        threshold,
        primary_phone: primaryPhone,
        primary_whatsapp: body.primary_whatsapp,
        secondary_phone: secondaryPhone,
        secondary_whatsapp: Boolean(
            secondaryPhone && body.secondary_whatsapp
        )
    };
}

async function getStockConfirmationSettings(options = {}) {
    const settings = await StockConfirmationSetting.findByPk(
        SETTING_ID,
        options
    );

    if (!settings) {
        throw new Error('Stock confirmation settings are missing.');
    }

    return serializeSettings(settings);
}


async function buildStockConfirmation(items, options = {}) {
    const settings = await getStockConfirmationSettings(options);

    const qualifyingItems = settings.enabled
        ? items.map(entry => ({
            item_id: String(entry.item_id ?? entry.item?.id),
            variant_id: String(entry.variant_id ?? entry.variantId),
            name: entry.item_name ?? entry.item?.item_name ?? 'Product',
            variant: entry.variant_name ?? entry.variantName ??
                entry.variant?.variant_name ?? '',
            quantity: Number(entry.quantity),
            unit_price: Number(entry.unit_price ?? entry.unitPrice)
        })).filter(entry =>
            Number.isFinite(entry.unit_price) &&
            entry.unit_price > settings.threshold
        ).sort((a, b) =>
            a.item_id.localeCompare(b.item_id) ||
            a.variant_id.localeCompare(b.variant_id)
        )
        : [];

    const required = qualifyingItems.length > 0;

    const confirmationKey = required
        ? createHash('sha256')
            .update(JSON.stringify({
                settings,
                items: qualifyingItems
            }))
            .digest('hex')
        : null;

    return {
        ...settings,
        required,
        items: qualifyingItems,
        confirmation_key: confirmationKey
    };
}

async function requireStockConfirmation(
    items,
    confirmation,
    options = {}
) {
    const policy = await buildStockConfirmation(items, options);

    if (!policy.required) return policy;

    if (
        confirmation?.acknowledged !== true ||
        confirmation?.confirmation_key !== policy.confirmation_key
    ) {
        const error = new Error(
            'Please contact South West and confirm stock availability before placing your order.'
        );

        error.statusCode = 409;
        error.code = 'STOCK_CONFIRMATION_REQUIRED';
        error.stock_confirmation = policy;

        throw error;
    }

    return policy;
}

module.exports = {
    SETTING_ID,
    normalizePhone,
    serializeSettings,
    validateSettings,
    getStockConfirmationSettings,
    buildStockConfirmation,
    requireStockConfirmation
};
