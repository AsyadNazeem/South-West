'use strict';

const {
    DeliveryStatusHistory,
    Delivery,
    User
} = require('../models');

const { recordAuditLog } = require('../services/auditLogService');

const AUDIT_MODULE = 'DELIVERY_STATUS_HISTORY';

const getActorId = (req) =>
    req.user?.id ?? req.user?.user_id ?? null;

const getHistorySnapshot = (history) => {
    if (!history) return null;

    return {
        id: history.id,
        delivery_id: history.delivery_id,
        status: history.status,
        notes: history.notes ?? null,
        changed_by: history.changed_by
    };
};

// Audit logging must not interrupt the main controller operation.
const auditStatusHistory = async (
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
            entityType: 'DeliveryStatusHistory',
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
            'Delivery status history audit logging failed:',
            auditError.message
        );
    }
};

const getDeliveryStatusHistories = async (req, res) => {
    try {
        const histories = await DeliveryStatusHistory.findAll({
            include: [
                {
                    model: Delivery,
                    as: 'delivery'
                },
                {
                    model: User,
                    as: 'changedBy',
                    attributes: {
                        exclude: ['password_hash']
                    }
                }
            ],
            order: [['created_at', 'DESC']]
        });

        await auditStatusHistory(req, {
            action: 'DELIVERY_STATUS_HISTORY_LIST_VIEWED',
            description: 'Retrieved delivery status history records'
        });

        return res.status(200).json({
            message: 'Delivery status histories retrieved successfully',
            data: histories
        });
    } catch (error) {
        console.error('Get delivery status histories error:', error);

        await auditStatusHistory(req, {
            action: 'DELIVERY_STATUS_HISTORY_LIST_FAILED',
            description: 'Failed to retrieve delivery status histories'
        });

        return res.status(500).json({
            message: 'Failed to retrieve delivery status histories',
            error: error.message
        });
    }
};

const getDeliveryStatusHistoryById = async (req, res) => {
    const { id } = req.params;

    try {
        const history = await DeliveryStatusHistory.findByPk(id, {
            include: [
                {
                    model: Delivery,
                    as: 'delivery'
                },
                {
                    model: User,
                    as: 'changedBy',
                    attributes: {
                        exclude: ['password_hash']
                    }
                }
            ]
        });

        if (!history) {
            await auditStatusHistory(req, {
                action: 'DELIVERY_STATUS_HISTORY_NOT_FOUND',
                entityId: id,
                description: 'Requested delivery status history was not found'
            });

            return res.status(404).json({
                message: 'Delivery status history not found'
            });
        }

        await auditStatusHistory(req, {
            action: 'DELIVERY_STATUS_HISTORY_VIEWED',
            entityId: history.id,
            description: 'Retrieved a delivery status history record'
        });

        return res.status(200).json({
            message: 'Delivery status history retrieved successfully',
            data: history
        });
    } catch (error) {
        console.error('Get delivery status history error:', error);

        await auditStatusHistory(req, {
            action: 'DELIVERY_STATUS_HISTORY_VIEW_FAILED',
            entityId: id,
            description: 'Failed to retrieve delivery status history'
        });

        return res.status(500).json({
            message: 'Failed to retrieve delivery status history',
            error: error.message
        });
    }
};

const createDeliveryStatusHistory = async (req, res) => {
    const {
        delivery_id,
        status,
        notes
    } = req.body;

    try {
        if (!delivery_id) {
            await auditStatusHistory(req, {
                action: 'DELIVERY_STATUS_HISTORY_CREATE_REJECTED',
                description: 'Delivery status history creation rejected: missing delivery ID'
            });

            return res.status(400).json({
                message: 'Delivery ID is required'
            });
        }

        if (!status) {
            await auditStatusHistory(req, {
                action: 'DELIVERY_STATUS_HISTORY_CREATE_REJECTED',
                description: 'Delivery status history creation rejected: missing status',
                newValues: { delivery_id }
            });

            return res.status(400).json({
                message: 'Status is required'
            });
        }

        const delivery = await Delivery.findByPk(delivery_id);

        if (!delivery) {
            await auditStatusHistory(req, {
                action: 'DELIVERY_STATUS_HISTORY_CREATE_REJECTED',
                description: 'Delivery status history creation rejected: delivery not found',
                newValues: { delivery_id, status }
            });

            return res.status(404).json({
                message: 'Delivery not found'
            });
        }

        const history = await DeliveryStatusHistory.create({
            delivery_id,
            status,
            notes: notes || null,
            changed_by: getActorId(req)
        });

        await auditStatusHistory(req, {
            action: 'DELIVERY_STATUS_HISTORY_CREATED',
            entityId: history.id,
            description: 'Created a delivery status history record',
            newValues: getHistorySnapshot(history)
        });

        return res.status(201).json({
            message: 'Delivery status history created successfully',
            data: history
        });
    } catch (error) {
        console.error('Create delivery status history error:', error);

        await auditStatusHistory(req, {
            action: 'DELIVERY_STATUS_HISTORY_CREATE_FAILED',
            description: 'Failed to create delivery status history',
            newValues: {
                delivery_id: delivery_id ?? null,
                status: status ?? null
            }
        });

        return res.status(500).json({
            message: 'Failed to create delivery status history',
            error: error.message
        });
    }
};

const updateDeliveryStatusHistory = async (req, res) => {
    const { id } = req.params;

    try {
        const history = await DeliveryStatusHistory.findByPk(id);

        if (!history) {
            await auditStatusHistory(req, {
                action: 'DELIVERY_STATUS_HISTORY_UPDATE_REJECTED',
                entityId: id,
                description: 'Delivery status history update rejected: record not found'
            });

            return res.status(404).json({
                message: 'Delivery status history not found'
            });
        }

        const oldValues = getHistorySnapshot(history);

        const allowedFields = ['status', 'notes'];
        const updates = {};

        allowedFields.forEach((field) => {
            if (req.body[field] !== undefined) {
                updates[field] = req.body[field];
            }
        });

        if (Object.keys(updates).length === 0) {
            await auditStatusHistory(req, {
                action: 'DELIVERY_STATUS_HISTORY_UPDATE_REJECTED',
                entityId: history.id,
                description: 'Delivery status history update rejected: no permitted fields supplied',
                oldValues
            });

            return res.status(400).json({
                message: 'No valid fields provided for update'
            });
        }

        await history.update(updates);

        await auditStatusHistory(req, {
            action: 'DELIVERY_STATUS_HISTORY_UPDATED',
            entityId: history.id,
            description: 'Updated a delivery status history record',
            oldValues,
            newValues: getHistorySnapshot(history)
        });

        return res.status(200).json({
            message: 'Delivery status history updated successfully',
            data: history
        });
    } catch (error) {
        console.error('Update delivery status history error:', error);

        await auditStatusHistory(req, {
            action: 'DELIVERY_STATUS_HISTORY_UPDATE_FAILED',
            entityId: id,
            description: 'Failed to update delivery status history',
            newValues: {
                status: req.body.status ?? null,
                notes: req.body.notes ?? null
            }
        });

        return res.status(500).json({
            message: 'Failed to update delivery status history',
            error: error.message
        });
    }
};

const deleteDeliveryStatusHistory = async (req, res) => {
    const { id } = req.params;

    try {
        const history = await DeliveryStatusHistory.findByPk(id);

        if (!history) {
            await auditStatusHistory(req, {
                action: 'DELIVERY_STATUS_HISTORY_DELETE_REJECTED',
                entityId: id,
                description: 'Delivery status history deletion rejected: record not found'
            });

            return res.status(404).json({
                message: 'Delivery status history not found'
            });
        }

        const oldValues = getHistorySnapshot(history);

        await history.destroy();

        await auditStatusHistory(req, {
            action: 'DELIVERY_STATUS_HISTORY_DELETED',
            entityId: id,
            description: 'Deleted a delivery status history record',
            oldValues
        });

        return res.status(200).json({
            message: 'Delivery status history deleted successfully'
        });
    } catch (error) {
        console.error('Delete delivery status history error:', error);

        await auditStatusHistory(req, {
            action: 'DELIVERY_STATUS_HISTORY_DELETE_FAILED',
            entityId: id,
            description: 'Failed to delete delivery status history'
        });

        return res.status(500).json({
            message: 'Failed to delete delivery status history',
            error: error.message
        });
    }
};

module.exports = {
    getDeliveryStatusHistories,
    getDeliveryStatusHistoryById,
    createDeliveryStatusHistory,
    updateDeliveryStatusHistory,
    deleteDeliveryStatusHistory
};
