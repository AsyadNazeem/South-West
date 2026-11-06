'use strict';

const { Op } = require('sequelize');
const {
    Promotion,
    User,
    Item,
    Category,
    Brand,
    PromotionItem,
    PromotionCategory,
    PromotionBrand,
    OrderPromotion,
    sequelize
} = require('../models');

const { recordAuditLog } = require('../services/auditLogService');

const AUDIT_MODULE = 'PROMOTION';

const getActorId = (req) =>
    req.user?.id ?? req.user?.user_id ?? req.user?.userId ?? null;

const getPromotionSnapshot = (promotion) => {
    if (!promotion) return null;

    return {
        id: promotion.id,
        promotion_code: promotion.promotion_code,
        promotion_name: promotion.promotion_name,
        promotion_type: promotion.promotion_type,
        discount_value: promotion.discount_value,
        eligibility_type: promotion.eligibility_type,
        minimum_order_amount: promotion.minimum_order_amount,
        maximum_discount_amount: promotion.maximum_discount_amount,
        usage_limit: promotion.usage_limit,
        usage_limit_per_customer: promotion.usage_limit_per_customer,
        used_count: promotion.used_count,
        start_date: promotion.start_date,
        end_date: promotion.end_date,
        status: promotion.status,
        is_active: promotion.is_active,
        created_by: promotion.created_by
    };
};

const ELIGIBILITY_TYPES = [
    'all_products',
    'selected_products',
    'selected_categories',
    'selected_brands'
];

const normalizeIds = (value) => {
    if (value === undefined || value === null) return [];

    if (!Array.isArray(value)) {
        throw new Error('Selected IDs must be an array');
    }

    const ids = value.map((id) => String(id));

    if (
        ids.some((id) => !/^[1-9]\d*$/.test(id)) ||
        new Set(ids).size !== ids.length
    ) {
        throw new Error('Selected IDs must be valid and unique');
    }

    return ids;
};

const validateEligibility = async (body, transaction) => {
    const eligibilityType = body.eligibility_type ?? 'all_products';

    if (!ELIGIBILITY_TYPES.includes(eligibilityType)) {
        throw new Error('Invalid eligibility_type');
    }

    const itemIds = normalizeIds(body.selected_item_ids);
    const categoryIds = normalizeIds(body.selected_category_ids);
    const brandIds = normalizeIds(body.selected_brand_ids);

    const hasItems = itemIds.length > 0;
    const hasCategories = categoryIds.length > 0;
    const hasBrands = brandIds.length > 0;

    if (
        (eligibilityType !== 'selected_products' && hasItems) ||
        (eligibilityType !== 'selected_categories' && hasCategories) ||
        (eligibilityType !== 'selected_brands' && hasBrands)
    ) {
        throw new Error(
            'Selections must match the chosen eligibility_type'
        );
    }

    let Model;
    let ids;

    switch (eligibilityType) {
        case 'selected_products':
            Model = Item;
            ids = itemIds;
            break;
        case 'selected_categories':
            Model = Category;
            ids = categoryIds;
            break;
        case 'selected_brands':
            Model = Brand;
            ids = brandIds;
            break;
        default:
            ids = [];
    }

    if (eligibilityType !== 'all_products' && ids.length === 0) {
        throw new Error(
            'Select at least one target for the chosen eligibility type'
        );
    }

    if (ids.length > 0) {
        const records = await Model.findAll({
            attributes: ['id'],
            where: { id: ids },
            transaction
        });

        if (records.length !== ids.length) {
            throw new Error(
                'One or more selected products, categories, or brands do not exist'
            );
        }
    }

    return {
        eligibility_type: eligibilityType,
        itemIds,
        categoryIds,
        brandIds
    };
};

const savePromotionEligibility = async (
    promotion,
    eligibility,
    transaction
) => {
    await Promise.all([
        PromotionItem.destroy({
            where: { promotion_id: promotion.id },
            transaction
        }),
        PromotionCategory.destroy({
            where: { promotion_id: promotion.id },
            transaction
        }),
        PromotionBrand.destroy({
            where: { promotion_id: promotion.id },
            transaction
        })
    ]);

    if (eligibility.eligibility_type === 'selected_products') {
        await PromotionItem.bulkCreate(
            eligibility.itemIds.map((item_id) => ({
                promotion_id: promotion.id,
                item_id
            })),
            { transaction }
        );
    }

    if (eligibility.eligibility_type === 'selected_categories') {
        await PromotionCategory.bulkCreate(
            eligibility.categoryIds.map((category_id) => ({
                promotion_id: promotion.id,
                category_id
            })),
            { transaction }
        );
    }

    if (eligibility.eligibility_type === 'selected_brands') {
        await PromotionBrand.bulkCreate(
            eligibility.brandIds.map((brand_id) => ({
                promotion_id: promotion.id,
                brand_id
            })),
            { transaction }
        );
    }

    await promotion.update(
        { eligibility_type: eligibility.eligibility_type },
        { transaction }
    );
};

const auditPromotion = async (
    req,
    {
        action,
        entityId = null,
        description = null,
        oldValues = null,
        newValues = null
    }
) => {
    try {
        await recordAuditLog({
            userId: getActorId(req),
            action,
            module: AUDIT_MODULE,
            entityType: 'Promotion',
            entityId: entityId != null ? String(entityId) : null,
            description,
            oldValues,
            newValues,
            ipAddress: req.ip ?? null,
            userAgent: req.get('user-agent') ?? null,
            requestId: req.id ?? req.requestId ?? null
        });
    } catch (auditError) {
        console.error(
            'Promotion audit logging failed:',
            auditError.message
        );
    }
};

const getPromotionIncludes = (includeOrderPromotions = false) => {
    const includes = [
        {
            model: User,
            as: 'creator',
            attributes: ['id', 'email', 'is_active']
        },
        {
            model: PromotionItem,
            as: 'items'
        },
        {
            model: PromotionCategory,
            as: 'categories'
        },
        {
    model: PromotionBrand,
    as: 'brands'
}
    ];

    if (includeOrderPromotions) {
        includes.push({
            model: OrderPromotion,
            as: 'orderPromotions'
        });
    }

    return includes;
};

const allowedStatuses = [
    'draft',
    'scheduled',
    'active',
    'paused',
    'expired',
    'cancelled'
];

// GET ALL PROMOTIONS
exports.getAllPromotions = async (req, res) => {
    try {
        const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
        const pageSize = Math.min(100, Math.max(1, Number.parseInt(req.query.pageSize ?? req.query.limit, 10) || 25));
        const paginationEnabled = req.query.page !== undefined || req.query.pageSize !== undefined || req.query.limit !== undefined;
        const search = String(req.query.search || '').trim();
        const where = {};
        if (search) where[Op.or] = [
            { promotion_code: { [Op.like]: `%${search}%` } },
            { promotion_name: { [Op.like]: `%${search}%` } },
        ];
        if (req.query.status && req.query.status !== 'all') where.status = req.query.status;
        const result = await Promotion.findAndCountAll({
            where,
            include: getPromotionIncludes(),
            order: [['id', 'DESC']], limit: paginationEnabled ? pageSize : undefined, offset: paginationEnabled ? (page - 1) * pageSize : undefined, distinct: true
        });
        const promotions = result.rows;

        await auditPromotion(req, {
            action: 'PROMOTION_LIST_VIEWED',
            description: 'Retrieved promotion records'
        });

        return res.status(200).json({
            message: 'Promotions retrieved successfully',
            data: promotions,
            pagination: { page, pageSize, total: result.count, totalPages: Math.ceil(result.count / pageSize) }
        });
    } catch (error) {
        console.error('Get promotions error:', error);

        await auditPromotion(req, {
            action: 'PROMOTION_LIST_FAILED',
            description: 'Failed to retrieve promotions'
        });

        return res.status(500).json({
            message: 'Failed to retrieve promotions'
        });
    }
};

// GET PROMOTION BY ID
exports.getPromotionById = async (req, res) => {
    const { id } = req.params;

    try {
        const promotion = await Promotion.findByPk(id, {
            include: getPromotionIncludes(true)
        });

        if (!promotion) {
            await auditPromotion(req, {
                action: 'PROMOTION_NOT_FOUND',
                entityId: id,
                description: 'Requested promotion was not found'
            });

            return res.status(404).json({
                message: 'Promotion not found'
            });
        }

        await auditPromotion(req, {
            action: 'PROMOTION_VIEWED',
            entityId: promotion.id,
            description: 'Retrieved a promotion'
        });

        return res.status(200).json({
            message: 'Promotion retrieved successfully',
            data: promotion
        });
    } catch (error) {
        console.error('Get promotion error:', error);

        await auditPromotion(req, {
            action: 'PROMOTION_VIEW_FAILED',
            entityId: id,
            description: 'Failed to retrieve promotion'
        });

        return res.status(500).json({
            message: 'Failed to retrieve promotion'
        });
    }
};

// CREATE PROMOTION

exports.createPromotion = async (req, res) => {
    const {
        promotion_code,
        promotion_name,
        description,
        promotion_type,
        discount_value,
        minimum_order_amount,
        maximum_discount_amount,
        usage_limit,
        usage_limit_per_customer,
        start_date,
        end_date,
        status,
        is_active
    } = req.body;

    let transaction;

    try {
        if (!promotion_code || !promotion_name || !promotion_type) {
            await auditPromotion(req, {
                action: 'PROMOTION_CREATE_REJECTED',
                description: 'Creation rejected: required fields missing'
            });

            return res.status(400).json({
                message: 'promotion_code, promotion_name and promotion_type are required'
            });
        }

        if (!start_date || !end_date) {
            await auditPromotion(req, {
                action: 'PROMOTION_CREATE_REJECTED',
                description: 'Creation rejected: promotion dates are required'
            });

            return res.status(400).json({
                message: 'start_date and end_date are required'
            });
        }

        const start = new Date(start_date);
        const end = new Date(end_date);

        if (
            Number.isNaN(start.getTime()) ||
            Number.isNaN(end.getTime()) ||
            end < start
        ) {
            await auditPromotion(req, {
                action: 'PROMOTION_CREATE_REJECTED',
                description: 'Creation rejected: invalid promotion date range'
            });

            return res.status(400).json({
                message: 'Valid start_date and end_date are required, and end_date must not precede start_date'
            });
        }

        if (status !== undefined && !allowedStatuses.includes(status)) {
            await auditPromotion(req, {
                action: 'PROMOTION_CREATE_REJECTED',
                description: 'Creation rejected: invalid status'
            });

            return res.status(400).json({
                message: 'Invalid promotion status',
                allowed_statuses: allowedStatuses
            });
        }

        let eligibility;

        try {
            eligibility = await validateEligibility(req.body);
        } catch (error) {
            await auditPromotion(req, {
                action: 'PROMOTION_CREATE_REJECTED',
                description: 'Creation rejected: invalid eligibility settings'
            });

            return res.status(400).json({
                message: error.message
            });
        }

        const existingPromotion = await Promotion.findOne({
            where: { promotion_code }
        });

        if (existingPromotion) {
            await auditPromotion(req, {
                action: 'PROMOTION_CREATE_REJECTED',
                description: 'Creation rejected: promotion code already exists',
                newValues: { promotion_code }
            });

            return res.status(409).json({
                message: 'Promotion code already exists'
            });
        }

        const createdBy = getActorId(req);

        transaction = await sequelize.transaction();

        const promotion = await Promotion.create({
            promotion_code,
            promotion_name,
            description: description || null,
            eligibility_type: eligibility.eligibility_type,
            promotion_type,
            discount_value: discount_value ?? null,
            minimum_order_amount: minimum_order_amount ?? null,
            maximum_discount_amount: maximum_discount_amount ?? null,
            usage_limit: usage_limit ?? null,
            usage_limit_per_customer: usage_limit_per_customer ?? null,
            used_count: 0,
            start_date,
            end_date,
            status: status || 'draft',
            is_active: is_active ?? true,
            created_by: createdBy
        }, { transaction });

        await savePromotionEligibility(
            promotion,
            eligibility,
            transaction
        );

        await transaction.commit();
        transaction = null;

        const savedPromotion = await Promotion.findByPk(promotion.id, {
            include: getPromotionIncludes()
        });

        await auditPromotion(req, {
            action: 'PROMOTION_CREATED',
            entityId: promotion.id,
            description: 'Created a promotion',
            newValues: getPromotionSnapshot(savedPromotion)
        });

        return res.status(201).json({
            message: 'Promotion created successfully',
            data: savedPromotion
        });
    } catch (error) {
        if (transaction) {
            await transaction.rollback();
        }

        console.error('Create promotion error:', error);

        await auditPromotion(req, {
            action: 'PROMOTION_CREATE_FAILED',
            description: 'Failed to create promotion',
            newValues: {
                promotion_code: promotion_code ?? null,
                promotion_name: promotion_name ?? null
            }
        });

        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(409).json({
                message: 'Promotion code already exists'
            });
        }

        return res.status(500).json({
            message: 'Failed to create promotion'
        });
    }
};


// UPDATE PROMOTION

exports.updatePromotion = async (req, res) => {
    const { id } = req.params;
    let transaction;

    try {
        const promotion = await Promotion.findByPk(id);

        if (!promotion) {
            await auditPromotion(req, {
                action: 'PROMOTION_UPDATE_REJECTED',
                entityId: id,
                description: 'Update rejected: promotion not found'
            });

            return res.status(404).json({
                message: 'Promotion not found'
            });
        }

        const oldValues = getPromotionSnapshot(promotion);

        const {
            promotion_code,
            promotion_name,
            description,
            promotion_type,
            discount_value,
            minimum_order_amount,
            maximum_discount_amount,
            usage_limit,
            usage_limit_per_customer,
            start_date,
            end_date,
            status,
            is_active
        } = req.body;

        if (
            status !== undefined &&
            !allowedStatuses.includes(status)
        ) {
            await auditPromotion(req, {
                action: 'PROMOTION_UPDATE_REJECTED',
                entityId: promotion.id,
                description: 'Update rejected: invalid status',
                oldValues
            });

            return res.status(400).json({
                message: 'Invalid promotion status',
                allowed_statuses: allowedStatuses
            });
        }

        if (
            promotion_code &&
            promotion_code !== promotion.promotion_code
        ) {
            const existingPromotion = await Promotion.findOne({
                where: { promotion_code }
            });

            if (
                existingPromotion &&
                String(existingPromotion.id) !== String(promotion.id)
            ) {
                await auditPromotion(req, {
                    action: 'PROMOTION_UPDATE_REJECTED',
                    entityId: promotion.id,
                    description: 'Update rejected: promotion code already exists',
                    oldValues
                });

                return res.status(409).json({
                    message: 'Promotion code already exists'
                });
            }
        }

        const newStartDate = start_date ?? promotion.start_date;
        const newEndDate = end_date ?? promotion.end_date;
        const start = new Date(newStartDate);
        const end = new Date(newEndDate);

        if (
            Number.isNaN(start.getTime()) ||
            Number.isNaN(end.getTime()) ||
            end < start
        ) {
            await auditPromotion(req, {
                action: 'PROMOTION_UPDATE_REJECTED',
                entityId: promotion.id,
                description: 'Update rejected: invalid promotion date range',
                oldValues
            });

            return res.status(400).json({
                message: 'Valid promotion dates are required, and end_date must not precede start_date'
            });
        }

        const eligibilityFields = [
            'eligibility_type',
            'selected_item_ids',
            'selected_category_ids',
            'selected_brand_ids'
        ];

        const hasEligibilityUpdate = eligibilityFields.some(
            field => Object.prototype.hasOwnProperty.call(req.body, field)
        );

        let eligibility;

        if (hasEligibilityUpdate) {
            try {
                eligibility = await validateEligibility({
                    ...req.body,
                    eligibility_type:
                        req.body.eligibility_type ??
                        promotion.eligibility_type
                });
            } catch (error) {
                await auditPromotion(req, {
                    action: 'PROMOTION_UPDATE_REJECTED',
                    entityId: promotion.id,
                    description: 'Update rejected: invalid eligibility settings',
                    oldValues
                });

                return res.status(400).json({
                    message: error.message
                });
            }
        }

        transaction = await sequelize.transaction();

        await promotion.update({
            promotion_code: promotion_code ?? promotion.promotion_code,
            promotion_name: promotion_name ?? promotion.promotion_name,
            description: description ?? promotion.description,
            promotion_type: promotion_type ?? promotion.promotion_type,
            discount_value: discount_value ?? promotion.discount_value,
            minimum_order_amount:
                minimum_order_amount ?? promotion.minimum_order_amount,
            maximum_discount_amount:
                maximum_discount_amount ?? promotion.maximum_discount_amount,
            usage_limit: usage_limit ?? promotion.usage_limit,
            usage_limit_per_customer:
                usage_limit_per_customer ?? promotion.usage_limit_per_customer,
            start_date: newStartDate,
            end_date: newEndDate,
            status: status ?? promotion.status,
            is_active: is_active ?? promotion.is_active
        }, { transaction });

        if (hasEligibilityUpdate) {
            await savePromotionEligibility(
                promotion,
                eligibility,
                transaction
            );
        }

        await transaction.commit();
        transaction = null;

        const savedPromotion = await Promotion.findByPk(promotion.id, {
            include: getPromotionIncludes()
        });

        await auditPromotion(req, {
            action: 'PROMOTION_UPDATED',
            entityId: promotion.id,
            description: 'Updated a promotion',
            oldValues,
            newValues: getPromotionSnapshot(savedPromotion)
        });

        return res.status(200).json({
            message: 'Promotion updated successfully',
            data: savedPromotion
        });
    } catch (error) {
        if (transaction) {
            await transaction.rollback();
        }

        console.error('Update promotion error:', error);

        await auditPromotion(req, {
            action: 'PROMOTION_UPDATE_FAILED',
            entityId: id,
            description: 'Failed to update promotion'
        });

        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(409).json({
                message: 'Promotion code already exists'
            });
        }

        return res.status(500).json({
            message: 'Failed to update promotion'
        });
    }
};


// UPDATE PROMOTION STATUS
exports.updatePromotionStatus = async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    try {
        if (!status || !allowedStatuses.includes(status)) {
            await auditPromotion(req, {
                action: 'PROMOTION_STATUS_UPDATE_REJECTED',
                entityId: id,
                description: 'Status update rejected: invalid status',
                newValues: { status: status ?? null }
            });

            return res.status(400).json({
                message: 'Invalid promotion status',
                allowed_statuses: allowedStatuses
            });
        }

        const promotion = await Promotion.findByPk(id);

        if (!promotion) {
            await auditPromotion(req, {
                action: 'PROMOTION_STATUS_UPDATE_REJECTED',
                entityId: id,
                description: 'Status update rejected: promotion not found'
            });

            return res.status(404).json({
                message: 'Promotion not found'
            });
        }

        const oldValues = {
            status: promotion.status,
            is_active: promotion.is_active
        };

        await promotion.update({ status });

        await auditPromotion(req, {
            action: 'PROMOTION_STATUS_UPDATED',
            entityId: promotion.id,
            description: 'Updated promotion status',
            oldValues,
            newValues: {
                status: promotion.status,
                is_active: promotion.is_active
            }
        });

        return res.status(200).json({
            message: 'Promotion status updated successfully',
            data: promotion
        });
    } catch (error) {
        console.error('Update promotion status error:', error);

        await auditPromotion(req, {
            action: 'PROMOTION_STATUS_UPDATE_FAILED',
            entityId: id,
            description: 'Failed to update promotion status'
        });

        return res.status(500).json({
            message: 'Failed to update promotion status'
        });
    }
};

// DELETE PROMOTION
exports.deletePromotion = async (req, res) => {
    const { id } = req.params;

    try {
        const promotion = await Promotion.findByPk(id);

        if (!promotion) {
            await auditPromotion(req, {
                action: 'PROMOTION_DELETE_REJECTED',
                entityId: id,
                description: 'Deletion rejected: promotion not found'
            });

            return res.status(404).json({
                message: 'Promotion not found'
            });
        }

        const oldValues = getPromotionSnapshot(promotion);

        await promotion.destroy();

        await auditPromotion(req, {
            action: 'PROMOTION_DELETED',
            entityId: id,
            description: 'Deleted a promotion',
            oldValues
        });

        return res.status(200).json({
            message: 'Promotion deleted successfully'
        });
    } catch (error) {
        console.error('Delete promotion error:', error);

        await auditPromotion(req, {
            action: 'PROMOTION_DELETE_FAILED',
            entityId: id,
            description: 'Failed to delete promotion'
        });

        return res.status(500).json({
            message: 'Failed to delete promotion'
        });
    }
};
