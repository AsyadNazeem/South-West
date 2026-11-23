'use strict';

const { sequelize, HomepageSection } = require('../models');

const ALLOWED_KEYS = [
    'hero_banner',
    'shopping_benefits',
    'shop_categories',
    'shop_brands',
    'discount_products',
    'top_rated_products',
    'promo_banner_1',
    'category_product_rows',
    'promo_banner_2',
    'just_for_you',
];

const ALLOWED_KEY_SET = new Set(ALLOWED_KEYS);

const order = [
    ['sort_order', 'ASC'],
    ['id', 'ASC'],
];

const serialize = section => {
    const value = section.get({ plain: true });

    return {
        section_key: value.section_key,
        title: value.title,
        is_active: Boolean(value.is_active),
        sort_order: value.sort_order,
        settings: value.settings || {},
    };
};

const getPublicSections = async (req, res) => {
    try {
        const sections = await HomepageSection.findAll({
            where: { is_active: true },
            order,
        });

        return res.status(200).json({
            data: sections.map(serialize),
        });
    } catch (error) {
        console.error('Failed to load public homepage sections:', error);

        return res.status(500).json({
            message: 'Unable to load homepage sections',
        });
    }
};

const getAdminSections = async (req, res) => {
    try {
        const sections = await HomepageSection.findAll({ order });

        return res.status(200).json({
            data: sections.map(serialize),
        });
    } catch (error) {
        console.error('Failed to load admin homepage sections:', error);

        return res.status(500).json({
            message: 'Unable to load homepage sections',
        });
    }
};

const updateSections = async (req, res) => {
    const submitted = req.body?.sections;

    if (!Array.isArray(submitted) ||
        submitted.length !== ALLOWED_KEYS.length) {
        return res.status(400).json({
            message: 'All ten homepage sections are required',
        });
    }

    const seenKeys = new Set();
    const seenOrders = new Set();

    for (const section of submitted) {
        if (!section ||
            typeof section !== 'object' ||
            Array.isArray(section)) {
            return res.status(400).json({
                message: 'Invalid homepage section',
            });
        }

        const {
            section_key,
            title,
            is_active,
            sort_order,
            settings,
        } = section;

        if (!ALLOWED_KEY_SET.has(section_key) ||
            seenKeys.has(section_key)) {
            return res.status(400).json({
                message: 'Invalid or duplicate section key',
            });
        }

        seenKeys.add(section_key);

        if (typeof title !== 'string' ||
            !title.trim() ||
            title.length > 200) {
            return res.status(400).json({
                message: `Invalid title for ${section_key}`,
            });
        }

        if (typeof is_active !== 'boolean') {
            return res.status(400).json({
                message: `Invalid visibility for ${section_key}`,
            });
        }

        if (!Number.isInteger(sort_order) ||
            sort_order < 0 ||
            sort_order >= ALLOWED_KEYS.length ||
            seenOrders.has(sort_order)) {
            return res.status(400).json({
                message: `Invalid display order for ${section_key}`,
            });
        }

        seenOrders.add(sort_order);

        if (settings !== undefined &&
            (settings === null ||
             typeof settings !== 'object' ||
             Array.isArray(settings))) {
            return res.status(400).json({
                message: `Invalid settings for ${section_key}`,
            });
        }

        // Settings are reserved until individual options are implemented.
        if (settings !== undefined &&
            Object.keys(settings).length > 0) {
            return res.status(400).json({
                message: `Custom settings are not yet supported for ${section_key}`,
            });
        }
    }

    try {
        await sequelize.transaction(async transaction => {
            const existing = await HomepageSection.findAll({
                transaction,
                lock: transaction.LOCK.UPDATE,
            });

            const existingKeys = new Set(
                existing.map(section => section.section_key)
            );

            if (existing.length !== ALLOWED_KEYS.length ||
                ALLOWED_KEYS.some(key => !existingKeys.has(key))) {
                const error = new Error(
                    'Homepage section configuration is incomplete'
                );
                error.status = 409;
                throw error;
            }

            for (const section of submitted) {
                await HomepageSection.update(
                    {
                        title: section.title.trim(),
                        is_active: section.is_active,
                        sort_order: section.sort_order,
                        settings: {},
                    },
                    {
                        where: { section_key: section.section_key },
                        transaction,
                    }
                );
            }
        });

        const sections = await HomepageSection.findAll({ order });

        return res.status(200).json({
            message: 'Homepage sections updated successfully',
            data: sections.map(serialize),
        });
    } catch (error) {
        console.error('Failed to update homepage sections:', error);

        return res.status(error.status === 409 ? 409 : 500).json({
            message: error.status === 409
                ? error.message
                : 'Unable to update homepage sections',
        });
    }
};

module.exports = {
    getPublicSections,
    getAdminSections,
    updateSections,
};
