'use strict';

const {
    PromotionCategory,
    Promotion,
    Category
} = require('../models');

const { recordAuditLog } = require('../services/auditLogService');

const AUDIT_MODULE = 'PROMOTION_CATEGORY';

const getActorId = (req) =>
    req.user?.id ?? req.user?.user_id ?? null;

const getSnapshot = (record) => {
    if (!record) return null;

    return {
        id: record.id,
        promotion_id: record.promotion_id,
        category_id: record.category_id
    };
};

const auditPromotionCategory = async (
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
            entityType: 'PromotionCategory',
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
            'Promotion category audit logging failed:',
            auditError.message
        );
    }
};

const getIncludes = () => [
    {
        model: Promotion,
        as: 'promotion',
        attributes: [
            'id',
            'promotion_code',
            'promotion_name',
            'promotion_type',
            'status',
            'is_active'
        ]
    },
    {
        model: Category,
        as: 'category',
        attributes: ['id', 'category_name']
    }
];

// GET all promotion categories
const getAllPromotionCategories = async (req, res) => {
    try {
        const data = await PromotionCategory.findAll({
            include: getIncludes(),
            order: [['id', 'DESC']]
        });

        await auditPromotionCategory(req, {
            action: 'PROMOTION_CATEGORY_LIST_VIEWED',
            description: 'Retrieved promotion category assignments'
        });

        return res.status(200).json({
            message: 'Promotion categories retrieved successfully',
            data
        });
    } catch (error) {
        console.error('Get promotion categories error:', error);

        await auditPromotionCategory(req, {
            action: 'PROMOTION_CATEGORY_LIST_FAILED',
            description: 'Failed to retrieve promotion category assignments'
        });

        return res.status(500).json({
            message: 'Failed to retrieve promotion categories'
        });
    }
};

// GET promotion category by ID
const getPromotionCategoryById = async (req, res) => {
    const { id } = req.params;

    try {
        const data = await PromotionCategory.findByPk(id, {
            include: getIncludes()
        });

        if (!data) {
            await auditPromotionCategory(req, {
                action: 'PROMOTION_CATEGORY_NOT_FOUND',
                entityId: id,
                description: 'Requested promotion category assignment was not found'
            });

            return res.status(404).json({
                message: 'Promotion category not found'
            });
        }

        await auditPromotionCategory(req, {
            action: 'PROMOTION_CATEGORY_VIEWED',
            entityId: data.id,
            description: 'Retrieved a promotion category assignment'
        });

        return res.status(200).json({
            message: 'Promotion category retrieved successfully',
            data
        });
    } catch (error) {
        console.error('Get promotion category error:', error);

        await auditPromotionCategory(req, {
            action: 'PROMOTION_CATEGORY_VIEW_FAILED',
            entityId: id,
            description: 'Failed to retrieve promotion category assignment'
        });

        return res.status(500).json({
            message: 'Failed to retrieve promotion category'
        });
    }
};

// CREATE promotion category
const createPromotionCategory = async (req, res) => {
    const { promotion_id, category_id } = req.body;

    try {
        if (!promotion_id || !category_id) {
            await auditPromotionCategory(req, {
                action: 'PROMOTION_CATEGORY_CREATE_REJECTED',
                description: 'Creation rejected: required IDs are missing',
                newValues: {
                    promotion_id: promotion_id ?? null,
                    category_id: category_id ?? null
                }
            });

            return res.status(400).json({
                message: 'promotion_id and category_id are required'
            });
        }

        const promotion = await Promotion.findByPk(promotion_id);

        if (!promotion) {
            await auditPromotionCategory(req, {
                action: 'PROMOTION_CATEGORY_CREATE_REJECTED',
                description: 'Creation rejected: promotion not found',
                newValues: { promotion_id, category_id }
            });

            return res.status(404).json({
                message: 'Promotion not found'
            });
        }

        const category = await Category.findByPk(category_id);

        if (!category) {
            await auditPromotionCategory(req, {
                action: 'PROMOTION_CATEGORY_CREATE_REJECTED',
                description: 'Creation rejected: category not found',
                newValues: { promotion_id, category_id }
            });

            return res.status(404).json({
                message: 'Category not found'
            });
        }

        const existing = await PromotionCategory.findOne({
            where: { promotion_id, category_id }
        });

        if (existing) {
            await auditPromotionCategory(req, {
                action: 'PROMOTION_CATEGORY_CREATE_REJECTED',
                entityId: existing.id,
                description: 'Creation rejected: category already assigned to promotion',
                newValues: { promotion_id, category_id }
            });

            return res.status(409).json({
                message: 'This category is already assigned to the promotion'
            });
        }

        const data = await PromotionCategory.create({
            promotion_id,
            category_id
        });

        await auditPromotionCategory(req, {
            action: 'PROMOTION_CATEGORY_CREATED',
            entityId: data.id,
            description: 'Assigned a category to a promotion',
            newValues: getSnapshot(data)
        });

        return res.status(201).json({
            message: 'Promotion category created successfully',
            data
        });
    } catch (error) {
        console.error('Create promotion category error:', error);

        await auditPromotionCategory(req, {
            action: 'PROMOTION_CATEGORY_CREATE_FAILED',
            description: 'Failed to create promotion category assignment',
            newValues: {
                promotion_id: promotion_id ?? null,
                category_id: category_id ?? null
            }
        });

        return res.status(500).json({
            message: 'Failed to create promotion category'
        });
    }
};

// UPDATE promotion category
const updatePromotionCategory = async (req, res) => {
    const { id } = req.params;
    const { promotion_id, category_id } = req.body;

    try {
        const data = await PromotionCategory.findByPk(id);

        if (!data) {
            await auditPromotionCategory(req, {
                action: 'PROMOTION_CATEGORY_UPDATE_REJECTED',
                entityId: id,
                description: 'Update rejected: promotion category assignment not found'
            });

            return res.status(404).json({
                message: 'Promotion category not found'
            });
        }

        const oldValues = getSnapshot(data);

        const newPromotionId =
            promotion_id !== undefined ? promotion_id : data.promotion_id;

        const newCategoryId =
            category_id !== undefined ? category_id : data.category_id;

        if (!newPromotionId || !newCategoryId) {
            await auditPromotionCategory(req, {
                action: 'PROMOTION_CATEGORY_UPDATE_REJECTED',
                entityId: data.id,
                description: 'Update rejected: promotion and category IDs are required',
                oldValues
            });

            return res.status(400).json({
                message: 'promotion_id and category_id are required'
            });
        }

        if (promotion_id !== undefined) {
            const promotion = await Promotion.findByPk(newPromotionId);

            if (!promotion) {
                await auditPromotionCategory(req, {
                    action: 'PROMOTION_CATEGORY_UPDATE_REJECTED',
                    entityId: data.id,
                    description: 'Update rejected: promotion not found',
                    oldValues
                });

                return res.status(404).json({
                    message: 'Promotion not found'
                });
            }
        }

        if (category_id !== undefined) {
            const category = await Category.findByPk(newCategoryId);

            if (!category) {
                await auditPromotionCategory(req, {
                    action: 'PROMOTION_CATEGORY_UPDATE_REJECTED',
                    entityId: data.id,
                    description: 'Update rejected: category not found',
                    oldValues
                });

                return res.status(404).json({
                    message: 'Category not found'
                });
            }
        }

        const existing = await PromotionCategory.findOne({
            where: {
                promotion_id: newPromotionId,
                category_id: newCategoryId
            }
        });

        if (existing && String(existing.id) !== String(data.id)) {
            await auditPromotionCategory(req, {
                action: 'PROMOTION_CATEGORY_UPDATE_REJECTED',
                entityId: data.id,
                description: 'Update rejected: category already assigned to promotion',
                oldValues,
                newValues: {
                    promotion_id: newPromotionId,
                    category_id: newCategoryId
                }
            });

            return res.status(409).json({
                message: 'This category is already assigned to the promotion'
            });
        }

        await data.update({
            promotion_id: newPromotionId,
            category_id: newCategoryId
        });

        await auditPromotionCategory(req, {
            action: 'PROMOTION_CATEGORY_UPDATED',
            entityId: data.id,
            description: 'Updated a promotion category assignment',
            oldValues,
            newValues: getSnapshot(data)
        });

        return res.status(200).json({
            message: 'Promotion category updated successfully',
            data
        });
    } catch (error) {
        console.error('Update promotion category error:', error);

        await auditPromotionCategory(req, {
            action: 'PROMOTION_CATEGORY_UPDATE_FAILED',
            entityId: id,
            description: 'Failed to update promotion category assignment'
        });

        return res.status(500).json({
            message: 'Failed to update promotion category'
        });
    }
};

// DELETE promotion category
const deletePromotionCategory = async (req, res) => {
    const { id } = req.params;

    try {
        const data = await PromotionCategory.findByPk(id);

        if (!data) {
            await auditPromotionCategory(req, {
                action: 'PROMOTION_CATEGORY_DELETE_REJECTED',
                entityId: id,
                description: 'Deletion rejected: promotion category assignment not found'
            });

            return res.status(404).json({
                message: 'Promotion category not found'
            });
        }

        const oldValues = getSnapshot(data);

        await data.destroy();

        await auditPromotionCategory(req, {
            action: 'PROMOTION_CATEGORY_DELETED',
            entityId: id,
            description: 'Removed a category from a promotion',
            oldValues
        });

        return res.status(200).json({
            message: 'Promotion category deleted successfully'
        });
    } catch (error) {
        console.error('Delete promotion category error:', error);

        await auditPromotionCategory(req, {
            action: 'PROMOTION_CATEGORY_DELETE_FAILED',
            entityId: id,
            description: 'Failed to delete promotion category assignment'
        });

        return res.status(500).json({
            message: 'Failed to delete promotion category'
        });
    }
};

module.exports = {
    getAllPromotionCategories,
    getPromotionCategoryById,
    createPromotionCategory,
    updatePromotionCategory,
    deletePromotionCategory
};
