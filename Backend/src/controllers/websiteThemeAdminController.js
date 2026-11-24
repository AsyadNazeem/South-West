'use strict';

const { Op } = require('sequelize');
const { WebsiteTheme, sequelize } = require('../models');
const { recordAuditLog } = require('../services/auditLogService');

const auditTheme = (req, action, theme, oldValues = null, transaction = undefined) => recordAuditLog({
    userId: req.user?.id ?? null,
    action,
    module: 'website_themes',
    entityType: 'WebsiteTheme',
    entityId: theme.id,
    description: `${action.replaceAll('_', ' ').toLowerCase()} website theme ${theme.name}`,
    oldValues,
    newValues: action === 'WEBSITE_THEME_DELETED' ? null : theme.toJSON(),
    ipAddress: req.ip || null,
    userAgent: req.get('user-agent') || null,
    requestId: req.id || null,
    transaction
});

const isPositiveId = value =>
    /^\d+$/.test(String(value)) && Number(value) > 0;

exports.getAllThemes = async (req, res) => {
    try {
        const registeredThemes = require('../config/websiteThemes');
        const registeredSlugs = registeredThemes.map(theme => theme.slug);

        const page = Math.max(
            1, Number.parseInt(req.query.page, 10) || 1
        );

        const pageSize = Math.min(
            100,
            Math.max(1, Number.parseInt(req.query.pageSize, 10) || 25)
        );

        const paginationEnabled =
            req.query.page !== undefined ||
            req.query.pageSize !== undefined;

        const registryFilter = {
            slug: { [Op.in]: registeredSlugs }
        };

        const where = { ...registryFilter };
        const search = String(req.query.search || '').trim();

        if (search) {
            where[Op.or] = ['name', 'slug', 'description'].map(
                field => ({
                    [field]: { [Op.like]: `%${search}%` }
                })
            );
        }

        if (req.query.status === 'active') {
            where.is_active = true;
        }

        if (req.query.status === 'inactive') {
            where.is_active = false;
        }

        const result = await WebsiteTheme.findAndCountAll({
            where,
            order: [
                ['is_active', 'DESC'],
                ['name', 'ASC'],
                ['id', 'ASC']
            ],
            limit: paginationEnabled ? pageSize : undefined,
            offset: paginationEnabled
                ? (page - 1) * pageSize
                : undefined
        });

        const [total, active] = await Promise.all([
            WebsiteTheme.count({
                where: registryFilter
            }),
            WebsiteTheme.count({
                where: {
                    ...registryFilter,
                    is_active: true
                }
            })
        ]);

        return res.status(200).json({
            message: 'Website themes retrieved successfully',
            data: result.rows,
            summary: {
                total,
                active,
                inactive: total - active,
                scheduled: 0
            },
            pagination: {
                page,
                pageSize,
                total: result.count,
                totalPages: Math.max(
                    1, Math.ceil(result.count / pageSize)
                )
            }
        });

    } catch (error) {
        console.error('Get website themes error:', error);

        return res.status(500).json({
            message: 'Failed to retrieve website themes'
        });
    }
};

exports.updateThemeStatus = async (req, res) => {
    if (!isPositiveId(req.params.id)) {
        return res.status(400).json({
            message: 'Invalid website theme ID.'
        });
    }

    if (
        !req.body ||
        typeof req.body.is_active !== 'boolean' ||
        Object.keys(req.body).some(key => key !== 'is_active')
    ) {
        return res.status(400).json({
            message: 'Only the boolean is_active field is allowed.'
        });
    }

    const registeredThemes = require('../config/websiteThemes');
    const registeredSlugs = registeredThemes.map(theme => theme.slug);

    try {
        const theme = await sequelize.transaction(async transaction => {
            // Lock theme records in a consistent order.
            const themes = await WebsiteTheme.findAll({
                order: [['id', 'ASC']],
                transaction,
                lock: transaction.LOCK.UPDATE
            });

            const selected = themes.find(
                item => String(item.id) === String(req.params.id)
                && registeredSlugs.includes(item.slug)
            );

            if (!selected) return null;

            const enable = req.body.is_active;

            // Enabling a theme automatically disables all others.
            if (enable) {
                for (const other of themes) {
                    if (
                        String(other.id) !== String(selected.id)
                        && other.is_active
                    ) {
                        const oldValues = other.toJSON();

                        await other.update(
                            { is_active: false },
                            { transaction }
                        );

                        await auditTheme(
                            req,
                            'WEBSITE_THEME_DISABLED',
                            other,
                            oldValues,
                            transaction
                        );
                    }
                }
            }

            const oldValues = selected.toJSON();

            await selected.update(
                { is_active: enable },
                { transaction }
            );

            await auditTheme(
                req,
                enable
                    ? 'WEBSITE_THEME_ENABLED'
                    : 'WEBSITE_THEME_DISABLED',
                selected,
                oldValues,
                transaction
            );

            return selected;
        });

        if (!theme) {
            return res.status(404).json({
                message: 'Registered website theme not found.'
            });
        }

        return res.status(200).json({
            message: theme.is_active
                ? `${theme.name} theme enabled successfully.`
                : `${theme.name} theme disabled successfully.`,
            data: theme
        });

    } catch (error) {
        console.error('Update website theme status error:', error);

        return res.status(500).json({
            message: 'Failed to update website theme status.'
        });
    }
};
