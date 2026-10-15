'use strict';

const {
    PromotionItem,
    Promotion,
    Item
} = require('../models');

const { recordAuditLog } = require('../services/auditLogService');

const AUDIT_MODULE = 'PROMOTION_ITEM';

const getActorId = (req) =>
    req.user?.id ?? req.user?.user_id ?? req.user?.userId ?? null;

const getSnapshot = (record) => {
    if (!record) return null;

    return {
        id: record.id,
        promotion_id: record.promotion_id,
        item_id: record.item_id
    };
};

const auditPromotionItem = async (
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
            entityType: 'PromotionItem',
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
            'Promotion item audit logging failed:',
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
            'status',
            'is_active'
        ]
    },
    {
        model: Item,
        as: 'item'
    }
];

// GET /api/promotion-items
const getAllPromotionItems = async (req, res) => {
    try {
        const promotionItems = await PromotionItem.findAll({
            include: getIncludes(),
            order: [['id', 'ASC']]
        });

        await auditPromotionItem(req, {
            action: 'PROMOTION_ITEM_LIST_VIEWED',
            description: 'Retrieved promotion item assignments'
        });

        return res.status(200).json({
            message: 'Promotion items retrieved successfully',
            data: promotionItems
        });
    } catch (error) {
        console.error('Get promotion items error:', error);

        await auditPromotionItem(req, {
            action: 'PROMOTION_ITEM_LIST_FAILED',
            description: 'Failed to retrieve promotion item assignments'
        });

        return res.status(500).json({
            message: 'Failed to retrieve promotion items'
        });
    }
};

// GET /api/promotion-items/:id
const getPromotionItemById = async (req, res) => {
    const { id } = req.params;

    try {
        const promotionItem = await PromotionItem.findByPk(id, {
            include: getIncludes()
        });

        if (!promotionItem) {
            await auditPromotionItem(req, {
                action: 'PROMOTION_ITEM_NOT_FOUND',
                entityId: id,
                description: 'Requested promotion item assignment was not found'
            });

            return res.status(404).json({
                message: 'Promotion item not found'
            });
        }

        await auditPromotionItem(req, {
            action: 'PROMOTION_ITEM_VIEWED',
            entityId: promotionItem.id,
            description: 'Retrieved a promotion item assignment'
        });

        return res.status(200).json({
            message: 'Promotion item retrieved successfully',
            data: promotionItem
        });
    } catch (error) {
        console.error('Get promotion item error:', error);

        await auditPromotionItem(req, {
            action: 'PROMOTION_ITEM_VIEW_FAILED',
            entityId: id,
            description: 'Failed to retrieve promotion item assignment'
        });

        return res.status(500).json({
            message: 'Failed to retrieve promotion item'
        });
    }
};

// POST /api/promotion-items
const createPromotionItem = async (req, res) => {
    const { promotion_id, item_id } = req.body;

    try {
        if (!promotion_id || !item_id) {
            await auditPromotionItem(req, {
                action: 'PROMOTION_ITEM_CREATE_REJECTED',
                description: 'Creation rejected: required IDs missing',
                newValues: {
                    promotion_id: promotion_id ?? null,
                    item_id: item_id ?? null
                }
            });

            return res.status(400).json({
                message: 'promotion_id and item_id are required'
            });
        }

        const promotion = await Promotion.findByPk(promotion_id);

        if (!promotion) {
            await auditPromotionItem(req, {
                action: 'PROMOTION_ITEM_CREATE_REJECTED',
                description: 'Creation rejected: promotion not found',
                newValues: { promotion_id, item_id }
            });

            return res.status(404).json({
                message: 'Promotion not found'
            });
        }

        const item = await Item.findByPk(item_id);

        if (!item) {
            await auditPromotionItem(req, {
                action: 'PROMOTION_ITEM_CREATE_REJECTED',
                description: 'Creation rejected: item not found',
                newValues: { promotion_id, item_id }
            });

            return res.status(404).json({
                message: 'Item not found'
            });
        }

        const existingPromotionItem = await PromotionItem.findOne({
            where: { promotion_id, item_id }
        });

        if (existingPromotionItem) {
            await auditPromotionItem(req, {
                action: 'PROMOTION_ITEM_CREATE_REJECTED',
                entityId: existingPromotionItem.id,
                description: 'Creation rejected: item already assigned to promotion',
                newValues: { promotion_id, item_id }
            });

            return res.status(409).json({
                message: 'This item is already assigned to this promotion'
            });
        }

        const promotionItem = await PromotionItem.create({
            promotion_id,
            item_id
        });

        await auditPromotionItem(req, {
            action: 'PROMOTION_ITEM_CREATED',
            entityId: promotionItem.id,
            description: 'Assigned an item to a promotion',
            newValues: getSnapshot(promotionItem)
        });

        const createdPromotionItem = await PromotionItem.findByPk(
            promotionItem.id,
            { include: getIncludes() }
        );

        return res.status(201).json({
            message: 'Promotion item created successfully',
            data: createdPromotionItem
        });
    } catch (error) {
        console.error('Create promotion item error:', error);

        await auditPromotionItem(req, {
            action: 'PROMOTION_ITEM_CREATE_FAILED',
            description: 'Failed to create promotion item assignment',
            newValues: {
                promotion_id: promotion_id ?? null,
                item_id: item_id ?? null
            }
        });

        return res.status(500).json({
            message: 'Failed to create promotion item'
        });
    }
};

// PUT /api/promotion-items/:id
const updatePromotionItem = async (req, res) => {
    const { id } = req.params;
    const { promotion_id, item_id } = req.body;

    try {
        const promotionItem = await PromotionItem.findByPk(id);

        if (!promotionItem) {
            await auditPromotionItem(req, {
                action: 'PROMOTION_ITEM_UPDATE_REJECTED',
                entityId: id,
                description: 'Update rejected: promotion item not found'
            });

            return res.status(404).json({
                message: 'Promotion item not found'
            });
        }

        const oldValues = getSnapshot(promotionItem);

        const newPromotionId =
            promotion_id !== undefined
                ? promotion_id
                : promotionItem.promotion_id;

        const newItemId =
            item_id !== undefined
                ? item_id
                : promotionItem.item_id;

        if (!newPromotionId || !newItemId) {
            await auditPromotionItem(req, {
                action: 'PROMOTION_ITEM_UPDATE_REJECTED',
                entityId: promotionItem.id,
                description: 'Update rejected: promotion and item IDs are required',
                oldValues
            });

            return res.status(400).json({
                message: 'promotion_id and item_id are required'
            });
        }

        if (promotion_id !== undefined) {
            const promotion = await Promotion.findByPk(newPromotionId);

            if (!promotion) {
                await auditPromotionItem(req, {
                    action: 'PROMOTION_ITEM_UPDATE_REJECTED',
                    entityId: promotionItem.id,
                    description: 'Update rejected: promotion not found',
                    oldValues
                });

                return res.status(404).json({
                    message: 'Promotion not found'
                });
            }
        }

        if (item_id !== undefined) {
            const item = await Item.findByPk(newItemId);

            if (!item) {
                await auditPromotionItem(req, {
                    action: 'PROMOTION_ITEM_UPDATE_REJECTED',
                    entityId: promotionItem.id,
                    description: 'Update rejected: item not found',
                    oldValues
                });

                return res.status(404).json({
                    message: 'Item not found'
                });
            }
        }

        const duplicate = await PromotionItem.findOne({
            where: {
                promotion_id: newPromotionId,
                item_id: newItemId
            }
        });

        if (
            duplicate &&
            String(duplicate.id) !== String(promotionItem.id)
        ) {
            await auditPromotionItem(req, {
                action: 'PROMOTION_ITEM_UPDATE_REJECTED',
                entityId: promotionItem.id,
                description: 'Update rejected: item already assigned to promotion',
                oldValues,
                newValues: {
                    promotion_id: newPromotionId,
                    item_id: newItemId
                }
            });

            return res.status(409).json({
                message: 'This item is already assigned to this promotion'
            });
        }

        await promotionItem.update({
            promotion_id: newPromotionId,
            item_id: newItemId
        });

        await auditPromotionItem(req, {
            action: 'PROMOTION_ITEM_UPDATED',
            entityId: promotionItem.id,
            description: 'Updated a promotion item assignment',
            oldValues,
            newValues: getSnapshot(promotionItem)
        });

        const updatedPromotionItem = await PromotionItem.findByPk(id, {
            include: getIncludes()
        });

        return res.status(200).json({
            message: 'Promotion item updated successfully',
            data: updatedPromotionItem
        });
    } catch (error) {
        console.error('Update promotion item error:', error);

        await auditPromotionItem(req, {
            action: 'PROMOTION_ITEM_UPDATE_FAILED',
            entityId: id,
            description: 'Failed to update promotion item assignment'
        });

        return res.status(500).json({
            message: 'Failed to update promotion item'
        });
    }
};

// DELETE /api/promotion-items/:id
const deletePromotionItem = async (req, res) => {
    const { id } = req.params;

    try {
        const promotionItem = await PromotionItem.findByPk(id);

        if (!promotionItem) {
            await auditPromotionItem(req, {
                action: 'PROMOTION_ITEM_DELETE_REJECTED',
                entityId: id,
                description: 'Deletion rejected: promotion item not found'
            });

            return res.status(404).json({
                message: 'Promotion item not found'
            });
        }

        const oldValues = getSnapshot(promotionItem);

        await promotionItem.destroy();

        await auditPromotionItem(req, {
            action: 'PROMOTION_ITEM_DELETED',
            entityId: id,
            description: 'Removed an item from a promotion',
            oldValues
        });

        return res.status(200).json({
            message: 'Promotion item deleted successfully'
        });
    } catch (error) {
        console.error('Delete promotion item error:', error);

        await auditPromotionItem(req, {
            action: 'PROMOTION_ITEM_DELETE_FAILED',
            entityId: id,
            description: 'Failed to delete promotion item assignment'
        });

        return res.status(500).json({
            message: 'Failed to delete promotion item'
        });
    }
};

module.exports = {
    getAllPromotionItems,
    getPromotionItemById,
    createPromotionItem,
    updatePromotionItem,
    deletePromotionItem
};
