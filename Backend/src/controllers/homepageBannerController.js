
'use strict';

const fs = require('fs/promises');
const path = require('path');
const { Op, QueryTypes } = require('sequelize');

const { HomepageBanner, sequelize } = require('../models');
const {
    UPLOAD_ROOT,
    buildFileUrl,
    getResponsiveImageMetadata,
    removeStoredImage,
} = require('../utils/fileStorage');
const { recordAuditLog } = require('../services/auditLogService');

const MAX_BANNERS = 10;
const BANNER_LOCK_NAME = 'south_west_homepage_banners_limit';

class BannerError extends Error {
    constructor(message, status = 400) {
        super(message);
        this.status = status;
    }
}

function parseBoolean(value, fieldName = 'is_active') {
    if (typeof value === 'boolean') return value;

    if (value === 'true' || value === '1' || value === 1) return true;
    if (value === 'false' || value === '0' || value === 0) return false;

    throw new BannerError(`${fieldName} must be true or false`);
}

function parseDate(value, fieldName) {
    if (value === undefined || value === null || value === '') {
        return null;
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        throw new BannerError(`${fieldName} must be a valid date`);
    }

    return date;
}

function validateLink(value) {
    if (value === undefined || value === null || value === '') {
        return null;
    }

    if (typeof value !== 'string') {
        throw new BannerError('link_url must be a string');
    }

    const link = value.trim();

    if (link.length > 1000) {
        throw new BannerError('link_url cannot exceed 1000 characters');
    }

    // Allow internal paths, but reject protocol-relative URLs.
    if (link.startsWith('/') && !link.startsWith('//')) {
        return link;
    }

    let parsed;

    try {
        parsed = new URL(link);
    } catch {
        throw new BannerError('link_url must be an internal path or an HTTP/HTTPS URL');
    }

    if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new BannerError('Only HTTP and HTTPS links are allowed');
    }

    return link;
}

function cleanOptionalText(value, fieldName, maxLength) {
    if (value === undefined) return undefined;
    if (value === null || value === '') return null;

    if (typeof value !== 'string') {
        throw new BannerError(`${fieldName} must be a string`);
    }

    const cleaned = value.trim();

    if (cleaned.length > maxLength) {
        throw new BannerError(
            `${fieldName} cannot exceed ${maxLength} characters`
        );
    }

    return cleaned || null;
}

function parseSortOrder(value) {
    if (value === undefined) return undefined;

    const number = Number(value);

    if (!Number.isSafeInteger(number) || number < 0) {
        throw new BannerError('sort_order must be a non-negative integer');
    }

    return number;
}

function validateSchedule(startAt, endAt) {
    if (startAt && endAt && startAt.getTime() > endAt.getTime()) {
        throw new BannerError('start_at must be before or equal to end_at');
    }
}

function getStoredPath(file) {
    if (!file || !file.path) return null;

    const relative = path.relative(UPLOAD_ROOT, file.path);

    if (
        !relative ||
        relative === '..' ||
        relative.startsWith(`..${path.sep}`) ||
        path.isAbsolute(relative)
    ) {
        throw new BannerError('Uploaded file is outside the permitted upload directory', 500);
    }

    return relative.split(path.sep).join('/');
}

async function cleanupUpload(file) {
    if (!file || !file.path) return;

    try {
        await fs.unlink(file.path);
    } catch (error) {
        if (error.code !== 'ENOENT') {
            console.error('Failed to clean up uploaded banner image:', error);
        }
    }
}

async function cleanupStoredFile(filePath) {
    if (!filePath) return;

    try {
        const result = await removeStoredImage(filePath);
        if (result.status === 'failed') {
            console.error('Banner image cleanup requires follow-up.');
        }
    } catch (error) {
        console.error('Failed to remove stored banner image:', error);
    }
}

function requestAuditDetails(req) {
    return {
        ipAddress: req.ip,
        userAgent: req.get('user-agent') || null,
        requestId: req.id || null,
    };
}

function auditSnapshot(banner) {
    if (!banner) return null;

    const value = typeof banner.toJSON === 'function'
        ? banner.toJSON()
        : banner;

    return {
        id: value.id,
        title: value.title,
        subtitle: value.subtitle,
        image_path: value.image_path,
        mobile_image_path: value.mobile_image_path,
        button_text: value.button_text,
        link_url: value.link_url,
        sort_order: value.sort_order,
        is_active: value.is_active,
        start_at: value.start_at,
        end_at: value.end_at,
    };
}

async function adminBannerResponse(banner, responsiveImageCache = new Map()) {
    const value = typeof banner.toJSON === 'function'
        ? banner.toJSON()
        : banner;

    return {
        ...value,
        image_url: buildFileUrl(value.image_path),
        mobile_image_url: buildFileUrl(value.mobile_image_path),
        responsive_images: await getResponsiveImageMetadata(
            value.image_path,
            'banners',
            responsiveImageCache
        ),
        mobile_responsive_images: await getResponsiveImageMetadata(
            value.mobile_image_path,
            'banners',
            responsiveImageCache
        ),
    };
}

function handleError(res, error, operation) {
    if (error instanceof BannerError) {
        return res.status(error.status).json({ message: error.message });
    }

    if (error.name === 'SequelizeValidationError') {
        return res.status(400).json({
            message: 'The banner data is invalid',
            errors: error.errors.map((item) => item.message),
        });
    }

    if (error.name === 'SequelizeUniqueConstraintError') {
        return res.status(409).json({
            message: 'A conflicting banner record already exists',
        });
    }

    console.error(`${operation}:`, error);

    return res.status(500).json({
        message: 'An unexpected error occurred while processing the banner',
    });
}

async function writeAuditLog(req, transaction, details) {
    await recordAuditLog({
        userId: req.user?.id || req.user?.user_id || null,
        action: details.action,
        module: 'homepage_banners',
        entityType: 'homepage_banner',
        entityId: details.entityId ? String(details.entityId) : null,
        description: details.description,
        oldValues: details.oldValues || null,
        newValues: details.newValues || null,
        ...requestAuditDetails(req),
        transaction,
    });
}

const getPublicBanners = async (req, res) => {
    try {
        const now = new Date();

        const banners = await HomepageBanner.findAll({
            where: {
                is_active: true,
                [Op.and]: [
                    {
                        [Op.or]: [
                            { start_at: null },
                            { start_at: { [Op.lte]: now } },
                        ],
                    },
                    {
                        [Op.or]: [
                            { end_at: null },
                            { end_at: { [Op.gte]: now } },
                        ],
                    },
                ],
            },
            order: [
                ['sort_order', 'ASC'],
                ['id', 'ASC'],
            ],
        });

        const responsiveImageCache = new Map();
        const data = await Promise.all(banners.map(async (banner) => ({
                id: banner.id,
                title: banner.title,
                subtitle: banner.subtitle,
                image_url: buildFileUrl(banner.image_path),
                mobile_image_url: buildFileUrl(banner.mobile_image_path),
                responsive_images: await getResponsiveImageMetadata(
                    banner.image_path,
                    'banners',
                    responsiveImageCache
                ),
                mobile_responsive_images: await getResponsiveImageMetadata(
                    banner.mobile_image_path,
                    'banners',
                    responsiveImageCache
                ),
                button_text: banner.button_text,
                link_url: banner.link_url,
                sort_order: banner.sort_order,
            })));

        return res.status(200).json({
            data,
        });
    } catch (error) {
        console.error('Get public homepage banners error:', error);

        return res.status(500).json({
            message: 'Failed to retrieve homepage banners',
        });
    }
};

const getAdminBanners = async (req, res) => {
    try {
        const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
        const pageSize = Math.min(100, Math.max(1, Number.parseInt(req.query.pageSize, 10) || 25));
        const paginationEnabled = req.query.page !== undefined || req.query.pageSize !== undefined;
        const where = {};
        const search = String(req.query.search || '').trim();
        if (search) where[Op.or] = ['title', 'subtitle', 'button_text'].map(field => ({ [field]: { [Op.like]: `%${search}%` } }));
        if (req.query.status === 'active') where.is_active = true;
        if (req.query.status === 'inactive') where.is_active = false;
        const result = await HomepageBanner.findAndCountAll({
            where,
            order: [
                ['sort_order', 'ASC'],
                ['id', 'ASC'],
            ],
            limit: paginationEnabled ? pageSize : undefined,
            offset: paginationEnabled ? (page - 1) * pageSize : undefined,
        });
        const [allCount, activeCount] = await Promise.all([
            HomepageBanner.count(),
            HomepageBanner.count({ where: { is_active: true } })
        ]);
        const banners = result.rows;

        const responsiveImageCache = new Map();
        return res.status(200).json({
            data: await Promise.all(banners.map((banner) =>
                adminBannerResponse(banner, responsiveImageCache)
            )),
            summary: { total: allCount, active: activeCount, inactive: allCount - activeCount },
            pagination: { page, pageSize, total: result.count, totalPages: Math.ceil(result.count / pageSize) },
        });
    } catch (error) {
        return handleError(res, error, 'Get admin homepage banners error');
    }
};

const getAdminBannerById = async (req, res) => {
    try {
        const banner = await HomepageBanner.findByPk(req.params.id);

        if (!banner) {
            return res.status(404).json({ message: 'Banner not found' });
        }

        return res.status(200).json({
            data: await adminBannerResponse(banner),
        });
    } catch (error) {
        return handleError(res, error, 'Get admin homepage banner error');
    }
};


function getBannerUploads(req) {
    return {
        desktop: req.files?.image?.[0] || null,
        mobile: req.files?.mobile_image?.[0] || null,
    };
}

async function cleanupBannerUploads(req) {
    const { desktop, mobile } = getBannerUploads(req);

    await Promise.all([
        cleanupUpload(desktop),
        cleanupUpload(mobile),
    ]);
}

const createBanner = async (req, res) => {
    let transactionCommitted = false;

    try {
        const { desktop, mobile } = getBannerUploads(req);

        if (!desktop) {
            throw new BannerError('A desktop banner image is required');
        }

        const uploadedPath = getStoredPath(desktop);
        const mobileUploadedPath = mobile
            ? getStoredPath(mobile)
            : null;

        const title = cleanOptionalText(req.body.title, 'title', 150);
        const subtitle = cleanOptionalText(req.body.subtitle, 'subtitle', 255);
        const buttonText = cleanOptionalText(
            req.body.button_text,
            'button_text',
            60
        );
        const linkUrl = validateLink(req.body.link_url);
        const sortOrder = parseSortOrder(req.body.sort_order) ?? 0;

        const isActive = req.body.is_active === undefined
            ? false
            : parseBoolean(req.body.is_active);

        const startAt = parseDate(req.body.start_at, 'start_at');
        const endAt = parseDate(req.body.end_at, 'end_at');

        validateSchedule(startAt, endAt);

        const banner = await sequelize.transaction(async (transaction) => {
            const lockRows = await sequelize.query(
                'SELECT id FROM homepage_banner_locks WHERE id = 1 FOR UPDATE',
                {
                    type: QueryTypes.SELECT,
                    transaction,
                }
            );

            if (!lockRows.length) {
                throw new BannerError(
                    'Banner creation lock is not configured. Run the required migration.',
                    500
                );
            }

            const count = await HomepageBanner.count({ transaction });

            if (count >= MAX_BANNERS) {
                throw new BannerError(
                    `You can create a maximum of ${MAX_BANNERS} banners`,
                    409
                );
            }

            const created = await HomepageBanner.create(
                {
                    title,
                    subtitle,
                    image_path: uploadedPath,
                    mobile_image_path: mobileUploadedPath,
                    button_text: buttonText,
                    link_url: linkUrl,
                    sort_order: sortOrder,
                    is_active: isActive,
                    start_at: startAt,
                    end_at: endAt,
                },
                { transaction }
            );

            await writeAuditLog(req, transaction, {
                action: 'HOMEPAGE_BANNER_CREATED',
                entityId: created.id,
                description: 'Created a homepage banner',
                newValues: auditSnapshot(created),
            });

            return created;
        });

        transactionCommitted = true;

        return res.status(201).json({
            message: 'Homepage banner created successfully',
            data: await adminBannerResponse(banner),
        });
    } catch (error) {
        if (!transactionCommitted) {
            await cleanupBannerUploads(req);
        }

        return handleError(
            res,
            error,
            'Create homepage banner error'
        );
    }
};


const updateBanner = async (req, res) => {
    let oldImagePath = null;
    let oldMobileImagePath = null;
    let updateSucceeded = false;

    try {
        const { desktop, mobile } = getBannerUploads(req);

        const uploadedPath = desktop ? getStoredPath(desktop) : null;
        const mobileUploadedPath = mobile ? getStoredPath(mobile) : null;

        const result = await sequelize.transaction(async (transaction) => {
            const banner = await HomepageBanner.findByPk(req.params.id, {
                transaction,
                lock: transaction.LOCK.UPDATE,
            });

            if (!banner) {
                throw new BannerError('Banner not found', 404);
            }

            const oldValues = auditSnapshot(banner);
            const changes = {};

            if (req.body.title !== undefined) {
                changes.title = cleanOptionalText(req.body.title, 'title', 150);
            }

            if (req.body.subtitle !== undefined) {
                changes.subtitle = cleanOptionalText(req.body.subtitle, 'subtitle', 255);
            }

            if (req.body.button_text !== undefined) {
                changes.button_text = cleanOptionalText(
                    req.body.button_text,
                    'button_text',
                    60
                );
            }

            if (req.body.link_url !== undefined) {
                changes.link_url = validateLink(req.body.link_url);
            }

            if (req.body.sort_order !== undefined) {
                changes.sort_order = parseSortOrder(req.body.sort_order);
            }

            if (req.body.start_at !== undefined) {
                changes.start_at = parseDate(req.body.start_at, 'start_at');
            }

            if (req.body.end_at !== undefined) {
                changes.end_at = parseDate(req.body.end_at, 'end_at');
            }

            if (req.body.is_active !== undefined) {
                changes.is_active = parseBoolean(req.body.is_active);
            }

            if (uploadedPath) {
                oldImagePath = banner.image_path;
                changes.image_path = uploadedPath;
            }

            if (mobileUploadedPath) {
                oldMobileImagePath = banner.mobile_image_path;
                changes.mobile_image_path = mobileUploadedPath;
            }

            const nextStart = changes.start_at !== undefined
                ? changes.start_at
                : banner.start_at;

            const nextEnd = changes.end_at !== undefined
                ? changes.end_at
                : banner.end_at;

            validateSchedule(nextStart, nextEnd);

            await banner.update(changes, { transaction });

            await writeAuditLog(req, transaction, {
                action: 'HOMEPAGE_BANNER_UPDATED',
                entityId: banner.id,
                description: 'Updated a homepage banner',
                oldValues,
                newValues: auditSnapshot(banner),
            });

            return banner;
        });

        updateSucceeded = true;

        if (oldImagePath && uploadedPath && oldImagePath !== uploadedPath) {
            await cleanupStoredFile(oldImagePath);
        }

        if (
            oldMobileImagePath &&
            mobileUploadedPath &&
            oldMobileImagePath !== mobileUploadedPath &&
            oldMobileImagePath !== oldImagePath
        ) {
            await cleanupStoredFile(oldMobileImagePath);
        }

        return res.status(200).json({
            message: 'Homepage banner updated successfully',
            data: await adminBannerResponse(result),
        });
    } catch (error) {
        if (!updateSucceeded) {
            await cleanupBannerUploads(req);
        }

        return handleError(res, error, 'Update homepage banner error');
    }
};


const updateBannerStatus = async (req, res) => {
    try {
        if (req.body.is_active === undefined) {
            throw new BannerError('is_active is required');
        }

        const isActive = parseBoolean(req.body.is_active);

        const banner = await sequelize.transaction(async (transaction) => {
            const current = await HomepageBanner.findByPk(req.params.id, {
                transaction,
                lock: transaction.LOCK.UPDATE,
            });

            if (!current) {
                throw new BannerError('Banner not found', 404);
            }

            const oldValues = auditSnapshot(current);

            if (isActive) {
                validateSchedule(current.start_at, current.end_at);
            }

            await current.update({ is_active: isActive }, { transaction });

            await writeAuditLog(req, transaction, {
                action: isActive
                    ? 'HOMEPAGE_BANNER_ACTIVATED'
                    : 'HOMEPAGE_BANNER_DEACTIVATED',
                entityId: current.id,
                description: isActive
                    ? 'Activated a homepage banner'
                    : 'Deactivated a homepage banner',
                oldValues,
                newValues: auditSnapshot(current),
            });

            return current;
        });

        return res.status(200).json({
            message: `Homepage banner ${isActive ? 'activated' : 'deactivated'} successfully`,
            data: await adminBannerResponse(banner),
        });
    } catch (error) {
        return handleError(res, error, 'Update homepage banner status error');
    }
};

const deleteBanner = async (req, res) => {
    let removedImagePath = null;
    let removedMobileImagePath = null;

    try {
        const deleted = await sequelize.transaction(async (transaction) => {
            const banner = await HomepageBanner.findByPk(req.params.id, {
                transaction,
                lock: transaction.LOCK.UPDATE,
            });

            if (!banner) {
                throw new BannerError('Banner not found', 404);
            }

            const oldValues = auditSnapshot(banner);
            removedImagePath = banner.image_path;
            removedMobileImagePath = banner.mobile_image_path;

            await writeAuditLog(req, transaction, {
                action: 'HOMEPAGE_BANNER_DELETED',
                entityId: banner.id,
                description: 'Deleted a homepage banner',
                oldValues,
            });

            await banner.destroy({ transaction });

            return { id: banner.id };
        });

        if (removedImagePath) {
            await cleanupStoredFile(removedImagePath);
        }

        if (
            removedMobileImagePath &&
            removedMobileImagePath !== removedImagePath
        ) {
            await cleanupStoredFile(removedMobileImagePath);
        }

        return res.status(200).json({
            message: 'Homepage banner deleted successfully',
            data: deleted,
        });
    } catch (error) {
        return handleError(res, error, 'Delete homepage banner error');
    }
};


module.exports = {
    getPublicBanners,
    getAdminBanners,
    getAdminBannerById,
    createBanner,
    updateBanner,
    updateBannerStatus,
    deleteBanner,
};
