'use strict';

const { ContactInformation } = require('../models');

const TEXT_FIELDS = {
    support_phone: 50,
    whatsapp_number: 50,
    support_email: 255,
    business_address: 5000,
    support_hours: 2000,
    google_maps_url: 1000,
    facebook_url: 1000,
    instagram_url: 1000,
    tiktok_url: 1000,
    response_time: 255,
};

const URL_FIELDS = [
    'google_maps_url',
    'facebook_url',
    'instagram_url',
    'tiktok_url',
];

const getSettings = () =>
    ContactInformation.findByPk(1);

const getPublicContactInformation = async (req, res) => {
    try {
        const settings = await getSettings();

        if (!settings) {
            return res.json({ data: {} });
        }

        const data = {};

        for (const field of Object.keys(TEXT_FIELDS)) {
            if (settings[field]) {
                data[field] = settings[field];
            }
        }

        data.allow_customer_visits =
            Boolean(settings.allow_customer_visits);

        return res.json({ data });
    } catch (error) {
        console.error('Failed to fetch public contact information:', error);

        return res.status(500).json({
            message: 'Unable to load contact information.',
        });
    }
};

const getAdminContactInformation = async (req, res) => {
    try {
        const settings = await getSettings();

        if (!settings) {
            return res.status(404).json({
                message: 'Contact information settings not found.',
            });
        }

        return res.json({ data: settings });
    } catch (error) {
        console.error('Failed to fetch Admin contact information:', error);

        return res.status(500).json({
            message: 'Unable to load contact information.',
        });
    }
};

const updateContactInformation = async (req, res) => {
    const body = req.body;

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return res.status(400).json({
            message: 'A valid contact information object is required.',
        });
    }

    const allowedFields = [
        ...Object.keys(TEXT_FIELDS),
        'allow_customer_visits',
    ];

    const data = {};

    for (const [field, value] of Object.entries(body)) {
        if (!allowedFields.includes(field)) {
            return res.status(400).json({
                message: `Unknown field: ${field}`,
            });
        }

        if (field === 'allow_customer_visits') {
            if (typeof value !== 'boolean') {
                return res.status(400).json({
                    message: 'allow_customer_visits must be a boolean.',
                });
            }

            data[field] = value;
            continue;
        }

        if (value !== null && typeof value !== 'string') {
            return res.status(400).json({
                message: `${field} must be text or null.`,
            });
        }

        const cleaned = typeof value === 'string'
            ? value.trim()
            : null;

        if (cleaned && cleaned.length > TEXT_FIELDS[field]) {
            return res.status(400).json({
                message: `${field} exceeds its maximum length.`,
            });
        }

        if (field === 'support_email' && cleaned) {
            const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

            if (!emailPattern.test(cleaned)) {
                return res.status(400).json({
                    message: 'Enter a valid support email address.',
                });
            }
        }

        if (URL_FIELDS.includes(field) && cleaned) {
            try {
                const url = new URL(cleaned);

                if (!['http:', 'https:'].includes(url.protocol)) {
                    throw new Error('Invalid protocol');
                }
            } catch (_) {
                return res.status(400).json({
                    message: `${field} must be a valid HTTP(S) URL.`,
                });
            }
        }

        if (['support_phone', 'whatsapp_number'].includes(field) && cleaned) {
            if (!/^\+?[0-9()\s-]{7,50}$/.test(cleaned)) {
                return res.status(400).json({
                    message: `${field} must be a valid phone number.`,
                });
            }
        }

        data[field] = cleaned || null;
    }

    if (!Object.keys(data).length) {
        return res.status(400).json({
            message: 'No contact information fields supplied.',
        });
    }

    try {
        const settings = await getSettings();

        if (!settings) {
            return res.status(404).json({
                message: 'Contact information settings not found.',
            });
        }

        await settings.update(data);

        return res.json({
            message: 'Contact information updated successfully.',
            data: settings,
        });
    } catch (error) {
        console.error('Failed to update contact information:', error);

        return res.status(500).json({
            message: 'Unable to update contact information.',
        });
    }
};

module.exports = {
    getPublicContactInformation,
    getAdminContactInformation,
    updateContactInformation,
};
