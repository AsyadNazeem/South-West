'use strict';

const { Faq } = require('../models');

const getPublicFaqs = async (req, res) => {
    try {
        const faqs = await Faq.findAll({
            where: {
                is_active: true,
            },
            attributes: [
                'id',
                'question',
                'answer',
                'category',
                'link_url',
                'link_text',
                'sort_order',
            ],
            order: [
                ['sort_order', 'ASC'],
                ['id', 'ASC'],
            ],
        });

        return res.status(200).json({
            data: faqs,
        });
    } catch (error) {
        console.error('Failed to fetch public FAQs:', error);

        return res.status(500).json({
            message: 'Unable to load FAQs at the moment.',
        });
    }
};


const parseFaqId = (value) => {
    const id = Number(value);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
};

const validateFaqPayload = (body, partial = false) => {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return { error: 'A valid FAQ object is required.' };
    }

    const allowedFields = [
        'question',
        'answer',
        'category',
        'link_url',
        'link_text',
        'sort_order',
        'is_active',
    ];

    const data = {};

    for (const key of Object.keys(body)) {
        if (!allowedFields.includes(key)) {
            return { error: `Unknown field: ${key}` };
        }
    }

    for (const field of ['question', 'answer']) {
        if (!partial || Object.prototype.hasOwnProperty.call(body, field)) {
            const value = body[field];

            if (typeof value !== 'string' || !value.trim()) {
                return { error: `${field} is required.` };
            }

            if (field === 'question' && value.trim().length > 500) {
                return { error: 'Question cannot exceed 500 characters.' };
            }

            data[field] = value.trim();
        }
    }

    const optionalTextFields = {
        category: 100,
        link_url: 1000,
        link_text: 150,
    };

    for (const [field, maxLength] of Object.entries(optionalTextFields)) {
        if (Object.prototype.hasOwnProperty.call(body, field)) {
            const value = body[field];

            if (value !== null && typeof value !== 'string') {
                return { error: `${field} must be a string or null.` };
            }

            const cleaned = typeof value === 'string' ? value.trim() : null;

            if (cleaned && cleaned.length > maxLength) {
                return { error: `${field} cannot exceed ${maxLength} characters.` };
            }

            if (field === 'link_url' && cleaned) {
                const internalPath = cleaned.startsWith('/') && !cleaned.startsWith('//');

                let validExternalUrl = false;

                try {
                    const parsed = new URL(cleaned);
                    validExternalUrl = ['http:', 'https:'].includes(parsed.protocol);
                } catch (_) {
                    validExternalUrl = false;
                }

                if (!internalPath && !validExternalUrl) {
                    return { error: 'Link URL must be an internal path or HTTP(S) URL.' };
                }
            }

            data[field] = cleaned || null;
        }
    }

    if (Object.prototype.hasOwnProperty.call(body, 'sort_order')) {
        const value = body.sort_order;

        if (!Number.isSafeInteger(value) || value < 0) {
            return { error: 'sort_order must be a non-negative integer.' };
        }

        data.sort_order = value;
    }

    if (Object.prototype.hasOwnProperty.call(body, 'is_active')) {
        if (typeof body.is_active !== 'boolean') {
            return { error: 'is_active must be true or false.' };
        }

        data.is_active = body.is_active;
    }

    return { data };
};

const getAdminFaqs = async (req, res) => {
    try {
        const faqs = await Faq.findAll({
            order: [['sort_order', 'ASC'], ['id', 'ASC']],
        });

        return res.json({ data: faqs });
    } catch (error) {
        console.error('Failed to list Admin FAQs:', error);
        return res.status(500).json({ message: 'Unable to load FAQs.' });
    }
};

const getAdminFaqById = async (req, res) => {
    const id = parseFaqId(req.params.id);

    if (!id) {
        return res.status(400).json({ message: 'Invalid FAQ ID.' });
    }

    try {
        const faq = await Faq.findByPk(id);

        if (!faq) {
            return res.status(404).json({ message: 'FAQ not found.' });
        }

        return res.json({ data: faq });
    } catch (error) {
        console.error('Failed to load Admin FAQ:', error);
        return res.status(500).json({ message: 'Unable to load FAQ.' });
    }
};

const createFaq = async (req, res) => {
    const result = validateFaqPayload(req.body);

    if (result.error) {
        return res.status(400).json({ message: result.error });
    }

    try {
        const faq = await Faq.create(result.data);
        return res.status(201).json({ data: faq });
    } catch (error) {
        console.error('Failed to create FAQ:', error);
        return res.status(500).json({ message: 'Unable to create FAQ.' });
    }
};

const updateFaq = async (req, res) => {
    const id = parseFaqId(req.params.id);

    if (!id) {
        return res.status(400).json({ message: 'Invalid FAQ ID.' });
    }

    const result = validateFaqPayload(req.body, true);

    if (result.error) {
        return res.status(400).json({ message: result.error });
    }

    if (!Object.keys(result.data).length) {
        return res.status(400).json({ message: 'No FAQ fields supplied.' });
    }

    try {
        const faq = await Faq.findByPk(id);

        if (!faq) {
            return res.status(404).json({ message: 'FAQ not found.' });
        }

        await faq.update(result.data);
        return res.json({ data: faq });
    } catch (error) {
        console.error('Failed to update FAQ:', error);
        return res.status(500).json({ message: 'Unable to update FAQ.' });
    }
};

const updateFaqStatus = async (req, res) => {
    const id = parseFaqId(req.params.id);

    if (!id) {
        return res.status(400).json({ message: 'Invalid FAQ ID.' });
    }

    if (!req.body || typeof req.body.is_active !== 'boolean') {
        return res.status(400).json({
            message: 'is_active must be true or false.',
        });
    }

    try {
        const faq = await Faq.findByPk(id);

        if (!faq) {
            return res.status(404).json({ message: 'FAQ not found.' });
        }

        await faq.update({ is_active: req.body.is_active });
        return res.json({ data: faq });
    } catch (error) {
        console.error('Failed to update FAQ status:', error);
        return res.status(500).json({ message: 'Unable to update FAQ status.' });
    }
};

const deleteFaq = async (req, res) => {
    const id = parseFaqId(req.params.id);

    if (!id) {
        return res.status(400).json({ message: 'Invalid FAQ ID.' });
    }

    try {
        const faq = await Faq.findByPk(id);

        if (!faq) {
            return res.status(404).json({ message: 'FAQ not found.' });
        }

        await faq.destroy();
        return res.json({ message: 'FAQ deleted successfully.' });
    } catch (error) {
        console.error('Failed to delete FAQ:', error);
        return res.status(500).json({ message: 'Unable to delete FAQ.' });
    }
};

module.exports = {
    getPublicFaqs,
    getAdminFaqs,
    getAdminFaqById,
    createFaq,
    updateFaq,
    updateFaqStatus,
    deleteFaq,
};
