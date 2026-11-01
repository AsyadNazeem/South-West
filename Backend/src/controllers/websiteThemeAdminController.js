'use strict';

const { Op } = require('sequelize');
const { WebsiteTheme, sequelize } = require('../models');

const isPositiveId = value =>
    /^\d+$/.test(String(value)) && Number(value) > 0;

function validatePayload(body, partial = false) {
    const errors = [];

    if (!partial || body.name !== undefined) {
        if (
            typeof body.name !== 'string' ||
            !body.name.trim() ||
            body.name.trim().length > 120
        ) {
            errors.push('Name is required and must not exceed 120 characters.');
        }
    }

    if (!partial || body.slug !== undefined) {
        if (
            typeof body.slug !== 'string' ||
            !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(body.slug.trim()) ||
            body.slug.trim().length > 120
        ) {
            errors.push('Slug must contain lowercase letters, numbers and hyphens only.');
        }
    }

    if (body.description !== undefined && body.description !== null) {
        if (
            typeof body.description !== 'string' ||
            body.description.length > 500
        ) {
            errors.push('Description must not exceed 500 characters.');
        }
    }

    if (!partial || body.config !== undefined) {
        if (
            !body.config ||
            typeof body.config !== 'object' ||
            Array.isArray(body.config)
        ) {
            errors.push('Theme configuration must be a JSON object.');
        }
    }

    for (const field of ['starts_at', 'ends_at']) {
        if (body[field] !== undefined && body[field] !== null && body[field] !== '') {
            if (
                typeof body[field] !== 'string' ||
                Number.isNaN(Date.parse(body[field]))
            ) {
                errors.push(`${field} must be a valid date.`);
            }
        }
    }

    if (
        body.is_active !== undefined &&
        typeof body.is_active !== 'boolean'
    ) {
        errors.push('is_active must be a boolean.');
    }

    const start = body.starts_at ? new Date(body.starts_at) : null;
    const end = body.ends_at ? new Date(body.ends_at) : null;

    if (start && end && start >= end) {
        errors.push('The end date must be later than the start date.');
    }

    return errors;
}

function scheduleOverlaps(first, second) {
    const firstStart = first.starts_at ? new Date(first.starts_at).getTime() : -Infinity;
    const firstEnd = first.ends_at ? new Date(first.ends_at).getTime() : Infinity;
    const secondStart = second.starts_at ? new Date(second.starts_at).getTime() : -Infinity;
    const secondEnd = second.ends_at ? new Date(second.ends_at).getTime() : Infinity;

    return firstStart < secondEnd && secondStart < firstEnd;
}

async function ensureNoScheduleConflict(values, excludedId, transaction) {
    if (!values.is_active) return null;

    const existing = await WebsiteTheme.findAll({
        where: {
            is_active: true,
            ...(excludedId ? { id: { [Op.ne]: excludedId } } : {}),
        },
        transaction,
        lock: transaction.LOCK.UPDATE,
    });

    const conflict = existing.find(theme =>
        scheduleOverlaps(values, theme)
    );

    return conflict || null;
}

exports.getAllThemes = async (req, res) => {
    try {
        const themes = await WebsiteTheme.findAll({
            order: [
                ['is_active', 'DESC'],
                ['starts_at', 'ASC'],
                ['name', 'ASC'],
                ['id', 'DESC'],
            ],
        });

        return res.status(200).json({
            message: 'Website themes retrieved successfully',
            data: themes,
        });
    } catch (error) {
        console.error('Get website themes error:', error);
        return res.status(500).json({
            message: 'Failed to retrieve website themes',
        });
    }
};

exports.createTheme = async (req, res) => {
    const errors = validatePayload(req.body);

    if (errors.length) {
        return res.status(400).json({ message: errors[0], errors });
    }

    const transaction = await sequelize.transaction();

    try {
        const values = {
            name: req.body.name.trim(),
            slug: req.body.slug.trim(),
            description: req.body.description?.trim() || null,
            config: req.body.config,
            is_active: req.body.is_active ?? false,
            starts_at: req.body.starts_at || null,
            ends_at: req.body.ends_at || null,
        };

        const conflict = await ensureNoScheduleConflict(values, null, transaction);

        if (conflict) {
            await transaction.rollback();
            return res.status(409).json({
                message: `This schedule overlaps with the enabled theme "${conflict.name}".`,
            });
        }

        const theme = await WebsiteTheme.create(values, { transaction });
        await transaction.commit();

        return res.status(201).json({
            message: 'Website theme created successfully',
            data: theme,
        });
    } catch (error) {
        await transaction.rollback();

        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(409).json({
                message: 'A theme with this slug already exists.',
            });
        }

        console.error('Create website theme error:', error);
        return res.status(500).json({
            message: 'Failed to create website theme',
        });
    }
};

exports.updateTheme = async (req, res) => {
    if (!isPositiveId(req.params.id)) {
        return res.status(400).json({ message: 'Invalid website theme ID.' });
    }

    const errors = validatePayload(req.body, true);

    if (errors.length) {
        return res.status(400).json({ message: errors[0], errors });
    }

    const transaction = await sequelize.transaction();

    try {
        const theme = await WebsiteTheme.findByPk(req.params.id, {
            transaction,
            lock: transaction.LOCK.UPDATE,
        });

        if (!theme) {
            await transaction.rollback();
            return res.status(404).json({ message: 'Website theme not found.' });
        }

        const values = {
            name: req.body.name !== undefined ? req.body.name.trim() : theme.name,
            slug: req.body.slug !== undefined ? req.body.slug.trim() : theme.slug,
            description: req.body.description !== undefined
                ? (req.body.description?.trim() || null)
                : theme.description,
            config: req.body.config !== undefined ? req.body.config : theme.config,
            is_active: req.body.is_active !== undefined
                ? req.body.is_active
                : theme.is_active,
            starts_at: req.body.starts_at !== undefined
                ? (req.body.starts_at || null)
                : theme.starts_at,
            ends_at: req.body.ends_at !== undefined
                ? (req.body.ends_at || null)
                : theme.ends_at,
        };

        if (
            values.starts_at &&
            values.ends_at &&
            new Date(values.starts_at) >= new Date(values.ends_at)
        ) {
            await transaction.rollback();
            return res.status(400).json({
                message: 'The end date must be later than the start date.',
            });
        }

        const conflict = await ensureNoScheduleConflict(
            values,
            theme.id,
            transaction
        );

        if (conflict) {
            await transaction.rollback();
            return res.status(409).json({
                message: `This schedule overlaps with the enabled theme "${conflict.name}".`,
            });
        }

        await theme.update(values, { transaction });
        await transaction.commit();

        return res.status(200).json({
            message: 'Website theme updated successfully',
            data: theme,
        });
    } catch (error) {
        await transaction.rollback();

        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(409).json({
                message: 'A theme with this slug already exists.',
            });
        }

        console.error('Update website theme error:', error);
        return res.status(500).json({
            message: 'Failed to update website theme',
        });
    }
};

exports.updateThemeStatus = async (req, res) => {
    if (!isPositiveId(req.params.id)) {
        return res.status(400).json({ message: 'Invalid website theme ID.' });
    }

    if (typeof req.body.is_active !== 'boolean') {
        return res.status(400).json({
            message: 'is_active must be a boolean.',
        });
    }

    const transaction = await sequelize.transaction();

    try {
        const theme = await WebsiteTheme.findByPk(req.params.id, {
            transaction,
            lock: transaction.LOCK.UPDATE,
        });

        if (!theme) {
            await transaction.rollback();
            return res.status(404).json({ message: 'Website theme not found.' });
        }

        const values = {
            ...theme.toJSON(),
            is_active: req.body.is_active,
        };

        const conflict = await ensureNoScheduleConflict(
            values,
            theme.id,
            transaction
        );

        if (conflict) {
            await transaction.rollback();
            return res.status(409).json({
                message: `This schedule overlaps with the enabled theme "${conflict.name}".`,
            });
        }

        await theme.update(
            { is_active: req.body.is_active },
            { transaction }
        );

        await transaction.commit();

        return res.status(200).json({
            message: `Website theme ${theme.is_active ? 'enabled' : 'disabled'} successfully`,
            data: theme,
        });
    } catch (error) {
        await transaction.rollback();
        console.error('Update website theme status error:', error);
        return res.status(500).json({
            message: 'Failed to update website theme status',
        });
    }
};

exports.deleteTheme = async (req, res) => {
    if (!isPositiveId(req.params.id)) {
        return res.status(400).json({ message: 'Invalid website theme ID.' });
    }

    try {
        const theme = await WebsiteTheme.findByPk(req.params.id);

        if (!theme) {
            return res.status(404).json({ message: 'Website theme not found.' });
        }

        await theme.destroy();

        return res.status(200).json({
            message: 'Website theme deleted successfully',
        });
    } catch (error) {
        console.error('Delete website theme error:', error);
        return res.status(500).json({
            message: 'Failed to delete website theme',
        });
    }
};
