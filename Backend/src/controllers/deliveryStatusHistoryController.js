'use strict';

const {
    DeliveryStatusHistory,
    Delivery,
    User
} = require('../models');

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

        return res.status(200).json({
            message: 'Delivery status histories retrieved successfully',
            data: histories
        });

    } catch (error) {
        console.error('Get delivery status histories error:', error);

        return res.status(500).json({
            message: 'Failed to retrieve delivery status histories',
            error: error.message
        });
    }
};


const getDeliveryStatusHistoryById = async (req, res) => {
    try {
        const { id } = req.params;

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
            return res.status(404).json({
                message: 'Delivery status history not found'
            });
        }

        return res.status(200).json({
            message: 'Delivery status history retrieved successfully',
            data: history
        });

    } catch (error) {
        console.error('Get delivery status history error:', error);

        return res.status(500).json({
            message: 'Failed to retrieve delivery status history',
            error: error.message
        });
    }
};


const createDeliveryStatusHistory = async (req, res) => {
    try {
        const {
            delivery_id,
            status,
            notes
        } = req.body;

        if (!delivery_id) {
            return res.status(400).json({
                message: 'Delivery ID is required'
            });
        }

        if (!status) {
            return res.status(400).json({
                message: 'Status is required'
            });
        }

        const delivery = await Delivery.findByPk(delivery_id);

        if (!delivery) {
            return res.status(404).json({
                message: 'Delivery not found'
            });
        }

        const history = await DeliveryStatusHistory.create({
            delivery_id,
            status,
            notes: notes || null,
            changed_by: req.user.id
        });

        return res.status(201).json({
            message: 'Delivery status history created successfully',
            data: history
        });

    } catch (error) {
        console.error('Create delivery status history error:', error);

        return res.status(500).json({
            message: 'Failed to create delivery status history',
            error: error.message
        });
    }
};


const updateDeliveryStatusHistory = async (req, res) => {
    try {
        const { id } = req.params;

        const history = await DeliveryStatusHistory.findByPk(id);

        if (!history) {
            return res.status(404).json({
                message: 'Delivery status history not found'
            });
        }

        const allowedFields = [
            'status',
            'notes'
        ];

        const updates = {};

        allowedFields.forEach(field => {
            if (req.body[field] !== undefined) {
                updates[field] = req.body[field];
            }
        });

        await history.update(updates);

        return res.status(200).json({
            message: 'Delivery status history updated successfully',
            data: history
        });

    } catch (error) {
        console.error('Update delivery status history error:', error);

        return res.status(500).json({
            message: 'Failed to update delivery status history',
            error: error.message
        });
    }
};


const deleteDeliveryStatusHistory = async (req, res) => {
    try {
        const { id } = req.params;

        const history = await DeliveryStatusHistory.findByPk(id);

        if (!history) {
            return res.status(404).json({
                message: 'Delivery status history not found'
            });
        }

        await history.destroy();

        return res.status(200).json({
            message: 'Delivery status history deleted successfully'
        });

    } catch (error) {
        console.error('Delete delivery status history error:', error);

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
