
'use strict';

const { Op } = require('sequelize');
const {
    sequelize,
    DiscountCampaign,
    DiscountCampaignItem,
    DiscountCampaignCategory,
    DiscountCampaignBrand,
    CampaignFrame,
    Item,
    Category,
    Brand,
    User,
} = require('../models');

const { recordAuditLog } = require('../services/auditLogService');
const {
    buildFileUrl,
    removeStoredFile,
} = require('../utils/fileStorage');


const ALLOWED_TARGET_TYPES = [
    'all_products',
    'selected_products',
    'category',
    'brand',
];

const ALLOWED_DISCOUNT_TYPES = ['percentage', 'fixed_amount'];

const ALLOWED_STATUSES = [
    'draft',
    'scheduled',
    'active',
    'paused',
    'expired',
    'cancelled',
];

const ALLOWED_REASONS = [
    'seasonal',
    'clearance',
    'promotion',
    'launch',
    'custom',
];

const getActorId = (req) =>
    req.user?.id ?? req.user?.user_id ?? req.user?.userId ?? null;

const getAudit = async (req, action, campaignId, description) => {
    try {
        await recordAuditLog({
            userId: getActorId(req),
            action,
            module: 'DISCOUNT_CAMPAIGN',
            entityType: 'DiscountCampaign',
            entityId: campaignId != null ? String(campaignId) : null,
            description,
            ipAddress: req.ip ?? null,
            userAgent: req.get('user-agent') ?? null,
            requestId: req.id ?? req.requestId ?? null,
        });
    } catch (error) {
        console.error('Discount campaign audit logging failed:', error.message);
    }
};

const isPositiveId = (value) =>
    (typeof value === 'number' || typeof value === 'string') &&
    /^\d+$/.test(String(value)) &&
    Number(value) > 0;

const validateIdArray = (value) =>
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(isPositiveId) &&
    new Set(value.map(String)).size === value.length;

const validateCampaignInput = (body, { partial = false } = {}) => {
    const errors = [];
    const required = (field) => !partial || body[field] !== undefined;

    if (required('campaign_name')) {
        if (
            typeof body.campaign_name !== 'string' ||
            !body.campaign_name.trim() ||
            body.campaign_name.trim().length > 150
        ) {
            errors.push('campaign_name is required and must not exceed 150 characters');
        }
    }

    if (required('description') && body.description != null &&
        typeof body.description !== 'string') {
        errors.push('description must be a string or null');
    }

    if (required('discount_reason')) {
        if (body.discount_reason !== undefined &&
            !ALLOWED_REASONS.includes(body.discount_reason)) {
            errors.push(`discount_reason must be one of: ${ALLOWED_REASONS.join(', ')}`);
        }
    }

    if (body.discount_reason === 'custom' &&
        (typeof body.custom_reason !== 'string' ||
         !body.custom_reason.trim() ||
         body.custom_reason.trim().length > 150)) {
        errors.push('custom_reason is required for a custom discount reason');
    }

    if (required('target_type') &&
        !ALLOWED_TARGET_TYPES.includes(body.target_type)) {
        errors.push(`target_type must be one of: ${ALLOWED_TARGET_TYPES.join(', ')}`);
    }

    if (required('discount_type') &&
        !ALLOWED_DISCOUNT_TYPES.includes(body.discount_type)) {
        errors.push(`discount_type must be one of: ${ALLOWED_DISCOUNT_TYPES.join(', ')}`);
    }

    if (required('discount_value')) {
        const value = Number(body.discount_value);

        if (!Number.isFinite(value) || value <= 0) {
            errors.push('discount_value must be a positive number');
        } else if (
            body.discount_type === 'percentage' &&
            value > 100
        ) {
            errors.push('Percentage discount cannot exceed 100');
        }
    }

    if (required('allow_promo_code') &&
        body.allow_promo_code !== undefined &&
        typeof body.allow_promo_code !== 'boolean') {
        errors.push('allow_promo_code must be a boolean');
    }

    if (required('start_date') && !body.start_date) {
        errors.push('start_date is required');
    }

    if (required('end_date') && !body.end_date) {
        errors.push('end_date is required');
    }

    if (body.start_date !== undefined && body.end_date !== undefined) {
        const start = new Date(body.start_date);
        const end = new Date(body.end_date);

        if (
            Number.isNaN(start.getTime()) ||
            Number.isNaN(end.getTime()) ||
            end <= start
        ) {
            errors.push('Valid dates are required, and end_date must be after start_date');
        }
    }

    if (required('status') && body.status !== undefined &&
        !ALLOWED_STATUSES.includes(body.status)) {
        errors.push(`status must be one of: ${ALLOWED_STATUSES.join(', ')}`);
    }

    if (body.custom_reason != null &&
        (typeof body.custom_reason !== 'string' ||
         body.custom_reason.length > 150)) {
        errors.push('custom_reason must not exceed 150 characters');
    }

    if (body.target_type === 'selected_products' &&
        !validateIdArray(body.item_ids)) {
        errors.push('item_ids must contain unique positive IDs for selected_products');
    }

    if (body.target_type === 'category' &&
        !validateIdArray(body.category_ids)) {
        errors.push('category_ids must contain unique positive IDs for category targeting');
    }

    if (body.target_type === 'brand' &&
        !validateIdArray(body.brand_ids)) {
        errors.push('brand_ids must contain unique positive IDs for brand targeting');
    }

    if (
        body.visual_frame_enabled !== undefined &&
        typeof body.visual_frame_enabled !== 'boolean'
    ) {
        errors.push('visual_frame_enabled must be a boolean');
    }

    if (
        body.visual_frame_id !== undefined &&
        body.visual_frame_id !== null &&
        !isPositiveId(body.visual_frame_id)
    ) {
        errors.push('visual_frame_id must be a positive ID or null');
    }

    if (
        body.visual_frame_enabled === true &&
        !isPositiveId(body.visual_frame_id)
    ) {
        errors.push('Select an active campaign frame when frame display is enabled');
    }

    if (
        body.visual_priority !== undefined &&
        (
            !Number.isInteger(Number(body.visual_priority)) ||
            Number(body.visual_priority) < 0 ||
            Number(body.visual_priority) > 1000000
        )
    ) {
        errors.push('visual_priority must be a non-negative integer');
    }

    return errors;
};


const validateVisualFrame = async (body, transaction, existingCampaign = null) => {
    const enabled = body.visual_frame_enabled !== undefined
        ? body.visual_frame_enabled
        : Boolean(existingCampaign?.visual_frame_enabled);

    const frameId = body.visual_frame_id !== undefined
        ? body.visual_frame_id
        : existingCampaign?.visual_frame_id;

    if (!enabled) {
        return null;
    }

    if (!isPositiveId(frameId)) {
        const error = new Error('Select a campaign frame before enabling frame display');
        error.statusCode = 400;
        throw error;
    }

    const frame = await CampaignFrame.findOne({
        where: {
            id: frameId,
            is_active: true,
        },
        transaction,
        lock: transaction.LOCK.SHARE,
    });

    if (!frame) {
        const error = new Error('The selected campaign frame does not exist or is inactive');
        error.statusCode = 400;
        throw error;
    }

    return frame.id;
};

const validateTargetsExist = async (body, transaction) => {
    const targetType = body.target_type;

    if (targetType === 'selected_products') {
        const records = await Item.findAll({
            attributes: ['id'],
            where: { id: body.item_ids },
            transaction,
        });

        if (records.length !== body.item_ids.length) {
            throw Object.assign(
                new Error('One or more item_ids do not exist'),
                { statusCode: 400 }
            );
        }
    }

    if (targetType === 'category') {
        const records = await Category.findAll({
            attributes: ['id'],
            where: { id: body.category_ids },
            transaction,
        });

        if (records.length !== body.category_ids.length) {
            throw Object.assign(
                new Error('One or more category_ids do not exist'),
                { statusCode: 400 }
            );
        }
    }

    if (targetType === 'brand') {
        const records = await Brand.findAll({
            attributes: ['id'],
            where: { id: body.brand_ids },
            transaction,
        });

        if (records.length !== body.brand_ids.length) {
            throw Object.assign(
                new Error('One or more brand_ids do not exist'),
                { statusCode: 400 }
            );
        }
    }
};

const saveTargets = async (campaignId, body, transaction) => {
    if (body.target_type === 'selected_products') {
        await DiscountCampaignItem.bulkCreate(
            body.item_ids.map(item_id => ({
                campaign_id: campaignId,
                item_id,
            })),
            { transaction }
        );
    }

    if (body.target_type === 'category') {
        await DiscountCampaignCategory.bulkCreate(
            body.category_ids.map(category_id => ({
                campaign_id: campaignId,
                category_id,
            })),
            { transaction }
        );
    }

    if (body.target_type === 'brand') {
        await DiscountCampaignBrand.bulkCreate(
            body.brand_ids.map(brand_id => ({
                campaign_id: campaignId,
                brand_id,
            })),
            { transaction }
        );
    }
};

const getCampaignIncludes = () => [
    {
        model: DiscountCampaignItem,
        as: 'campaignItems',
        include: [{
            model: Item,
            as: 'item',
            required: false,
        }],
    },
    {
        model: DiscountCampaignCategory,
        as: 'campaignCategories',
        include: [{
            model: Category,
            as: 'category',
            required: false,
        }],
    },
    {
        model: DiscountCampaignBrand,
        as: 'campaignBrands',
        include: [{
            model: Brand,
            as: 'brand',
            required: false,
        }],
    },
    {
        model: User,
        as: 'creator',
        attributes: ['id', 'email'],
        required: false,
    },
    {
        model: CampaignFrame,
        as: 'visualFrame',
        required: false,
    },
];

// GET /api/discount-campaigns
exports.getAllCampaigns = async (req, res) => {
    try {
        const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
        const pageSize = Math.min(100, Math.max(1, Number.parseInt(req.query.pageSize ?? req.query.limit, 10) || 25));
        const paginationEnabled = req.query.page !== undefined || req.query.pageSize !== undefined || req.query.limit !== undefined;
        const search = String(req.query.search || '').trim();
        const where = {};
        if (search) where[Op.or] = [
            { campaign_name: { [Op.like]: `%${search}%` } },
            { id: Number.isInteger(Number(search)) ? Number(search) : null },
        ];
        if (req.query.status && req.query.status !== 'all') where.status = req.query.status;
        const result = await DiscountCampaign.findAndCountAll({
            where,
            include: getCampaignIncludes(),
            order: [['id', 'DESC']], limit: paginationEnabled ? pageSize : undefined, offset: paginationEnabled ? (page - 1) * pageSize : undefined, distinct: true
        });
        const campaigns = result.rows;

        return res.status(200).json({
            message: 'Discount campaigns retrieved successfully',
            data: campaigns,
            pagination: { page, pageSize, total: result.count, totalPages: Math.ceil(result.count / pageSize) },
        });
    } catch (error) {
        console.error('Get discount campaigns error:', error);

        return res.status(500).json({
            message: 'Failed to retrieve discount campaigns',
        });
    }
};

// GET /api/discount-campaigns/:id
exports.getCampaignById = async (req, res) => {
    try {
        if (!isPositiveId(req.params.id)) {
            return res.status(400).json({ message: 'Invalid campaign ID' });
        }

        const campaign = await DiscountCampaign.findByPk(req.params.id, {
            include: getCampaignIncludes(),
        });

        if (!campaign) {
            return res.status(404).json({ message: 'Discount campaign not found' });
        }

        return res.status(200).json({
            message: 'Discount campaign retrieved successfully',
            data: campaign,
        });
    } catch (error) {
        console.error('Get discount campaign error:', error);

        return res.status(500).json({
            message: 'Failed to retrieve discount campaign',
        });
    }
};

// POST /api/discount-campaigns
exports.createCampaign = async (req, res) => {
    const errors = validateCampaignInput(req.body);

    if (errors.length) {
        return res.status(400).json({
            message: 'Validation failed',
            errors,
        });
    }

    const transaction = await sequelize.transaction();

    try {
        await validateTargetsExist(req.body, transaction);
        const visualFrameId = await validateVisualFrame(req.body, transaction);

        const campaign = await DiscountCampaign.create({
            campaign_name: req.body.campaign_name.trim(),
            description: req.body.description ?? null,
            discount_reason: req.body.discount_reason ?? 'custom',
            custom_reason: req.body.discount_reason === 'custom'
                ? req.body.custom_reason.trim()
                : null,
            target_type: req.body.target_type,
            discount_type: req.body.discount_type,
            discount_value: req.body.discount_value,
            allow_promo_code: req.body.allow_promo_code ?? false,
            visual_frame_id: req.body.visual_frame_enabled
                ? visualFrameId
                : null,
            visual_frame_enabled: req.body.visual_frame_enabled ?? false,
            visual_priority: Number(req.body.visual_priority ?? 0),
            start_date: req.body.start_date,
            end_date: req.body.end_date,
            status: req.body.status ?? 'draft',
            created_by: getActorId(req),
        }, { transaction });

        await saveTargets(campaign.id, req.body, transaction);

        await transaction.commit();

        await getAudit(
            req,
            'DISCOUNT_CAMPAIGN_CREATED',
            campaign.id,
            `Created discount campaign: ${campaign.campaign_name}`
        );

        const created = await DiscountCampaign.findByPk(campaign.id, {
            include: getCampaignIncludes(),
        });

        return res.status(201).json({
            message: 'Discount campaign created successfully',
            data: created,
        });
    } catch (error) {
        if (!transaction.finished) {
            await transaction.rollback();
        }

        if (error.statusCode) {
            return res.status(error.statusCode).json({ message: error.message });
        }

        console.error('Create discount campaign error:', error);

        return res.status(500).json({
            message: 'Failed to create discount campaign',
        });
    }
};

// PUT /api/discount-campaigns/:id
// This endpoint replaces the campaign and all target records.
// Send the complete campaign payload, including the relevant target ID array.
exports.updateCampaign = async (req, res) => {
    if (!isPositiveId(req.params.id)) {
        return res.status(400).json({ message: 'Invalid campaign ID' });
    }

    const errors = validateCampaignInput(req.body);

    if (errors.length) {
        return res.status(400).json({
            message: 'Validation failed',
            errors,
        });
    }

    const transaction = await sequelize.transaction();

    try {
        const campaign = await DiscountCampaign.findByPk(req.params.id, {
            transaction,
            lock: transaction.LOCK.UPDATE,
        });

        if (!campaign) {
            await transaction.rollback();

            return res.status(404).json({
                message: 'Discount campaign not found',
            });
        }

        await validateTargetsExist(req.body, transaction);
        const visualFrameId = await validateVisualFrame(
            req.body,
            transaction,
            campaign
        );

        await campaign.update({
            campaign_name: req.body.campaign_name.trim(),
            description: req.body.description ?? null,
            discount_reason: req.body.discount_reason ?? 'custom',
            custom_reason: req.body.discount_reason === 'custom'
                ? req.body.custom_reason.trim()
                : null,
            target_type: req.body.target_type,
            discount_type: req.body.discount_type,
            discount_value: req.body.discount_value,
            allow_promo_code: req.body.allow_promo_code ?? false,
            visual_frame_id: visualFrameId,
            visual_frame_enabled: req.body.visual_frame_enabled !== undefined
                ? req.body.visual_frame_enabled
                : campaign.visual_frame_enabled,
            visual_priority: req.body.visual_priority !== undefined
                ? Number(req.body.visual_priority)
                : campaign.visual_priority,
            start_date: req.body.start_date,
            end_date: req.body.end_date,
            status: req.body.status ?? campaign.status,
        }, { transaction });

        await DiscountCampaignItem.destroy({
            where: { campaign_id: campaign.id },
            transaction,
        });

        await DiscountCampaignCategory.destroy({
            where: { campaign_id: campaign.id },
            transaction,
        });

        await DiscountCampaignBrand.destroy({
            where: { campaign_id: campaign.id },
            transaction,
        });

        await saveTargets(campaign.id, req.body, transaction);

        await transaction.commit();

        await getAudit(
            req,
            'DISCOUNT_CAMPAIGN_UPDATED',
            campaign.id,
            `Updated discount campaign: ${campaign.campaign_name}`
        );

        const updated = await DiscountCampaign.findByPk(campaign.id, {
            include: getCampaignIncludes(),
        });

        return res.status(200).json({
            message: 'Discount campaign updated successfully',
            data: updated,
        });
    } catch (error) {
        if (!transaction.finished) {
            await transaction.rollback();
        }

        if (error.statusCode) {
            return res.status(error.statusCode).json({ message: error.message });
        }

        console.error('Update discount campaign error:', error);

        return res.status(500).json({
            message: 'Failed to update discount campaign',
        });
    }
};


// POST /api/discount-campaigns/:id/visual-frame
exports.uploadCampaignVisualFrame = async (req, res) => {
    let uploadSucceeded = false;

    try {
        if (!isPositiveId(req.params.id)) {
            return res.status(400).json({ message: 'Invalid campaign ID' });
        }

        if (!req.file) {
            return res.status(400).json({ message: 'A campaign frame file is required' });
        }

        const newPath = req.file.relativePath;

        const result = await sequelize.transaction(async (transaction) => {
            const campaign = await DiscountCampaign.findByPk(req.params.id, {
                transaction,
                lock: transaction.LOCK.UPDATE,
            });

            if (!campaign) {
                const error = new Error('Discount campaign not found');
                error.statusCode = 404;
                throw error;
            }

            const oldPath = campaign.visual_frame_path;

            await campaign.update({
                visual_theme: 'custom',
                visual_frame_path: newPath,
                visual_frame_enabled: true,
            }, { transaction });

            return { campaign, oldPath };
        });

        uploadSucceeded = true;

        if (
            result.oldPath &&
            result.oldPath !== newPath &&
            !/^https?:\/\//i.test(result.oldPath)
        ) {
            await removeStoredFile(result.oldPath);
        }

        await getAudit(
            req,
            'DISCOUNT_CAMPAIGN_FRAME_UPLOADED',
            result.campaign.id,
            `Uploaded visual frame for campaign: ${result.campaign.campaign_name}`
        );

        return res.status(200).json({
            message: 'Campaign visual frame uploaded successfully',
            data: {
                campaign_id: result.campaign.id,
                visual_theme: result.campaign.visual_theme,
                visual_frame_enabled: result.campaign.visual_frame_enabled,
                visual_frame_path: result.campaign.visual_frame_path,
                visual_frame_url: buildFileUrl(result.campaign.visual_frame_path),
            },
        });
    } catch (error) {
        console.error('Upload campaign visual frame error:', error);

        if (error.statusCode) {
            return res.status(error.statusCode).json({ message: error.message });
        }

        return res.status(500).json({
            message: 'Failed to upload campaign visual frame',
        });
    } finally {
        if (!uploadSucceeded && req.file?.relativePath) {
            await removeStoredFile(req.file.relativePath);
        }
    }
};

// PATCH /api/discount-campaigns/:id/status
exports.updateCampaignStatus = async (req, res) => {
    if (!isPositiveId(req.params.id)) {
        return res.status(400).json({ message: 'Invalid campaign ID' });
    }

    const { status } = req.body;

    if (!ALLOWED_STATUSES.includes(status)) {
        return res.status(400).json({
            message: `status must be one of: ${ALLOWED_STATUSES.join(', ')}`,
        });
    }

    try {
        const campaign = await DiscountCampaign.findByPk(req.params.id);

        if (!campaign) {
            return res.status(404).json({
                message: 'Discount campaign not found',
            });
        }

        await campaign.update({ status });

        await getAudit(
            req,
            'DISCOUNT_CAMPAIGN_STATUS_UPDATED',
            campaign.id,
            `Changed campaign status to ${status}`
        );

        return res.status(200).json({
            message: 'Discount campaign status updated successfully',
            data: campaign,
        });
    } catch (error) {
        console.error('Update discount campaign status error:', error);

        return res.status(500).json({
            message: 'Failed to update discount campaign status',
        });
    }
};

// DELETE /api/discount-campaigns/:id
exports.deleteCampaign = async (req, res) => {
    if (!isPositiveId(req.params.id)) {
        return res.status(400).json({ message: 'Invalid campaign ID' });
    }

    const transaction = await sequelize.transaction();

    try {
        const campaign = await DiscountCampaign.findByPk(req.params.id, {
            transaction,
            lock: transaction.LOCK.UPDATE,
        });

        if (!campaign) {
            await transaction.rollback();

            return res.status(404).json({
                message: 'Discount campaign not found',
            });
        }

        await DiscountCampaignItem.destroy({
            where: { campaign_id: campaign.id },
            transaction,
        });

        await DiscountCampaignCategory.destroy({
            where: { campaign_id: campaign.id },
            transaction,
        });

        await DiscountCampaignBrand.destroy({
            where: { campaign_id: campaign.id },
            transaction,
        });

        await campaign.destroy({ transaction });

        await transaction.commit();

        await getAudit(
            req,
            'DISCOUNT_CAMPAIGN_DELETED',
            campaign.id,
            `Deleted discount campaign: ${campaign.campaign_name}`
        );

        return res.status(200).json({
            message: 'Discount campaign deleted successfully',
        });
    } catch (error) {
        if (!transaction.finished) {
            await transaction.rollback();
        }

        console.error('Delete discount campaign error:', error);

        return res.status(500).json({
            message: 'Failed to delete discount campaign',
        });
    }
};
