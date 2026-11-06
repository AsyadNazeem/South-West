'use strict';

const { Op } = require('sequelize');
const {
    CampaignFrame,
    DiscountCampaign,
} = require('../models');

const { recordAuditLog } = require('../services/auditLogService');
const {
    buildFileUrl,
    removeStoredFile,
} = require('../utils/fileStorage');

const isPositiveId = (value) =>
    (typeof value === 'number' || typeof value === 'string') &&
    /^\d+$/.test(String(value)) &&
    Number(value) > 0;

const getActorId = (req) =>
    req.user?.id ?? req.user?.user_id ?? req.user?.userId ?? null;

async function writeAudit(req, action, frame, description) {
    try {
        await recordAuditLog({
            userId: getActorId(req),
            action,
            module: 'CAMPAIGN_FRAME',
            entityType: 'CampaignFrame',
            entityId: frame?.id != null ? String(frame.id) : null,
            description,
            ipAddress: req.ip ?? null,
            userAgent: req.get('user-agent') ?? null,
            requestId: req.id ?? req.requestId ?? null,
        });
    } catch (error) {
        console.error('Campaign frame audit logging failed:', error.message);
    }
}

function serializeFrame(frame, usageCount = 0) {
    const data = frame.toJSON();

    return {
        ...data,
        image_url: buildFileUrl(data.image_path),
        usage_count: Number(usageCount),
    };
}

// GET /api/campaign-frames
exports.getAllFrames = async (req, res) => {
    try {
        const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
        const pageSize = Math.min(100, Math.max(1, Number.parseInt(req.query.pageSize, 10) || 25));
        const paginationEnabled = req.query.page !== undefined || req.query.pageSize !== undefined;
        const where = {};
        const search = String(req.query.search || '').trim();
        if (search) where.name = { [Op.like]: `%${search}%` };
        if (req.query.status === 'active') where.is_active = true;
        if (req.query.status === 'inactive') where.is_active = false;
        const result = await CampaignFrame.findAndCountAll({
            where,
            order: [
                ['is_active', 'DESC'],
                ['name', 'ASC'],
                ['id', 'DESC'],
            ],
            limit: paginationEnabled ? pageSize : undefined,
            offset: paginationEnabled ? (page - 1) * pageSize : undefined,
        });
        const [allCount, activeCount] = await Promise.all([
            CampaignFrame.count(),
            CampaignFrame.count({ where: { is_active: true } })
        ]);
        const frames = result.rows;

        const data = await Promise.all(
            frames.map(async (frame) => {
                const usageCount = await DiscountCampaign.count({
                    where: { visual_frame_id: frame.id },
                });

                return serializeFrame(frame, usageCount);
            })
        );

        return res.status(200).json({
            message: 'Campaign frames retrieved successfully',
            data,
            summary: { total: allCount, active: activeCount, inactive: allCount - activeCount },
            pagination: { page, pageSize, total: result.count, totalPages: Math.ceil(result.count / pageSize) },
        });
    } catch (error) {
        console.error('Get campaign frames error:', error);

        return res.status(500).json({
            message: 'Failed to retrieve campaign frames',
        });
    }
};

// POST /api/campaign-frames
exports.createFrame = async (req, res) => {
    let uploadSucceeded = false;

    try {
        const name = typeof req.body.name === 'string'
            ? req.body.name.trim()
            : '';

        if (!name || name.length > 120) {
            return res.status(400).json({
                message: 'Frame name is required and must not exceed 120 characters',
            });
        }

        if (!req.file?.relativePath) {
            return res.status(400).json({
                message: 'A transparent PNG or WebP frame image is required',
            });
        }

        const frame = await CampaignFrame.create({
            name,
            image_path: req.file.relativePath,
            is_active: true,
        });

        uploadSucceeded = true;

        await writeAudit(
            req,
            'CAMPAIGN_FRAME_CREATED',
            frame,
            `Created campaign frame: ${frame.name}`
        );

        return res.status(201).json({
            message: 'Campaign frame created successfully',
            data: serializeFrame(frame),
        });
    } catch (error) {
        console.error('Create campaign frame error:', error);

        return res.status(500).json({
            message: 'Failed to create campaign frame',
        });
    } finally {
        if (!uploadSucceeded && req.file?.relativePath) {
            await removeStoredFile(req.file.relativePath);
        }
    }
};

// PUT /api/campaign-frames/:id
// Updates the name and optionally replaces the image.
exports.updateFrame = async (req, res) => {
    let uploadSucceeded = false;

    try {
        if (!isPositiveId(req.params.id)) {
            return res.status(400).json({
                message: 'Invalid campaign frame ID',
            });
        }

        const hasName = req.body.name !== undefined;

        if (hasName) {
            if (
                typeof req.body.name !== 'string' ||
                !req.body.name.trim() ||
                req.body.name.trim().length > 120
            ) {
                return res.status(400).json({
                    message: 'Frame name must be between 1 and 120 characters',
                });
            }
        }

        if (!hasName && !req.file) {
            return res.status(400).json({
                message: 'Provide a new frame name or replacement image',
            });
        }

        const frame = await CampaignFrame.findByPk(req.params.id);

        if (!frame) {
            return res.status(404).json({
                message: 'Campaign frame not found',
            });
        }

        const oldPath = frame.image_path;
        const updateValues = {};

        if (hasName) {
            updateValues.name = req.body.name.trim();
        }

        if (req.file?.relativePath) {
            updateValues.image_path = req.file.relativePath;
        }

        await frame.update(updateValues);

        uploadSucceeded = true;

        if (
            req.file &&
            oldPath &&
            oldPath !== frame.image_path &&
            !/^https?:\/\//i.test(oldPath)
        ) {
            await removeStoredFile(oldPath);
        }

        await writeAudit(
            req,
            req.file ? 'CAMPAIGN_FRAME_IMAGE_REPLACED' : 'CAMPAIGN_FRAME_RENAMED',
            frame,
            `Updated campaign frame: ${frame.name}`
        );

        return res.status(200).json({
            message: 'Campaign frame updated successfully',
            data: serializeFrame(frame),
        });
    } catch (error) {
        console.error('Update campaign frame error:', error);

        return res.status(500).json({
            message: 'Failed to update campaign frame',
        });
    } finally {
        if (!uploadSucceeded && req.file?.relativePath) {
            await removeStoredFile(req.file.relativePath);
        }
    }
};

// PATCH /api/campaign-frames/:id/status
exports.updateFrameStatus = async (req, res) => {
    try {
        if (!isPositiveId(req.params.id)) {
            return res.status(400).json({
                message: 'Invalid campaign frame ID',
            });
        }

        if (typeof req.body.is_active !== 'boolean') {
            return res.status(400).json({
                message: 'is_active must be a boolean',
            });
        }

        const frame = await CampaignFrame.findByPk(req.params.id);

        if (!frame) {
            return res.status(404).json({
                message: 'Campaign frame not found',
            });
        }

        await frame.update({
            is_active: req.body.is_active,
        });

        await writeAudit(
            req,
            'CAMPAIGN_FRAME_STATUS_UPDATED',
            frame,
            `${frame.is_active ? 'Activated' : 'Deactivated'} campaign frame: ${frame.name}`
        );

        return res.status(200).json({
            message: `Campaign frame ${frame.is_active ? 'activated' : 'deactivated'} successfully`,
            data: serializeFrame(frame),
        });
    } catch (error) {
        console.error('Update campaign frame status error:', error);

        return res.status(500).json({
            message: 'Failed to update campaign frame status',
        });
    }
};

// DELETE /api/campaign-frames/:id
exports.deleteFrame = async (req, res) => {
    try {
        if (!isPositiveId(req.params.id)) {
            return res.status(400).json({
                message: 'Invalid campaign frame ID',
            });
        }

        const frame = await CampaignFrame.findByPk(req.params.id);

        if (!frame) {
            return res.status(404).json({
                message: 'Campaign frame not found',
            });
        }

        const usageCount = await DiscountCampaign.count({
            where: { visual_frame_id: frame.id },
        });

        if (usageCount > 0) {
            return res.status(409).json({
                message: 'This frame is assigned to one or more campaigns. Remove it from those campaigns before deleting it.',
                usage_count: usageCount,
            });
        }

        const oldPath = frame.image_path;

        await frame.destroy();

        if (oldPath && !/^https?:\/\//i.test(oldPath)) {
            await removeStoredFile(oldPath);
        }

        await writeAudit(
            req,
            'CAMPAIGN_FRAME_DELETED',
            frame,
            `Deleted campaign frame: ${frame.name}`
        );

        return res.status(200).json({
            message: 'Campaign frame deleted successfully',
        });
    } catch (error) {
        console.error('Delete campaign frame error:', error);

        return res.status(500).json({
            message: 'Failed to delete campaign frame',
        });
    }
};
