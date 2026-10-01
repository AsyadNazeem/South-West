'use strict';

const { NotificationPreference, Customer } = require('../models');

// GET /api/notification-preferences
const getNotificationPreferences = async (req, res) => {
    try {
        const preferences = await NotificationPreference.findAll({
            include: [
                {
                    model: Customer,
                    as: 'customer',
                    attributes: [
                        'id',
                        'customer_code',
                        'first_name',
                        'last_name',
                        'email'
                    ]
                }
            ],
            order: [['id', 'ASC']]
        });

        return res.status(200).json({
            message: 'Notification preferences retrieved successfully',
            data: preferences
        });
    } catch (error) {
        console.error('Get notification preferences error:', error);

        return res.status(500).json({
            message: 'Failed to retrieve notification preferences',
            error: error.message
        });
    }
};

// GET /api/notification-preferences/:id
const getNotificationPreferenceById = async (req, res) => {
    try {
        const preference = await NotificationPreference.findByPk(req.params.id, {
            include: [
                {
                    model: Customer,
                    as: 'customer',
                    attributes: [
                        'id',
                        'customer_code',
                        'first_name',
                        'last_name',
                        'email'
                    ]
                }
            ]
        });

        if (!preference) {
            return res.status(404).json({
                message: 'Notification preference not found'
            });
        }

        return res.status(200).json({
            message: 'Notification preference retrieved successfully',
            data: preference
        });
    } catch (error) {
        console.error('Get notification preference error:', error);

        return res.status(500).json({
            message: 'Failed to retrieve notification preference',
            error: error.message
        });
    }
};

// POST /api/notification-preferences
const createNotificationPreference = async (req, res) => {
    try {
        const {
            customer_id,
            order_updates,
            payment_updates,
            delivery_updates,
            promotional_notifications,
            product_updates
        } = req.body;

        if (!customer_id) {
            return res.status(400).json({
                message: 'Customer ID is required'
            });
        }

        const customer = await Customer.findByPk(customer_id);

        if (!customer) {
            return res.status(404).json({
                message: 'Customer not found'
            });
        }

        const existingPreference = await NotificationPreference.findOne({
            where: { customer_id }
        });

        if (existingPreference) {
            return res.status(409).json({
                message: 'Notification preference already exists for this customer'
            });
        }

        const preference = await NotificationPreference.create({
            customer_id,
            order_updates,
            payment_updates,
            delivery_updates,
            promotional_notifications,
            product_updates
        });

        return res.status(201).json({
            message: 'Notification preference created successfully',
            data: preference
        });
    } catch (error) {
        console.error('Create notification preference error:', error);

        return res.status(500).json({
            message: 'Failed to create notification preference',
            error: error.message
        });
    }
};

// PUT /api/notification-preferences/:id
const updateNotificationPreference = async (req, res) => {
    try {
        const preference = await NotificationPreference.findByPk(req.params.id);

        if (!preference) {
            return res.status(404).json({
                message: 'Notification preference not found'
            });
        }

        const {
            order_updates,
            payment_updates,
            delivery_updates,
            promotional_notifications,
            product_updates
        } = req.body;

        await preference.update({
            order_updates,
            payment_updates,
            delivery_updates,
            promotional_notifications,
            product_updates
        });

        return res.status(200).json({
            message: 'Notification preference updated successfully',
            data: preference
        });
    } catch (error) {
        console.error('Update notification preference error:', error);

        return res.status(500).json({
            message: 'Failed to update notification preference',
            error: error.message
        });
    }
};

// DELETE /api/notification-preferences/:id
const deleteNotificationPreference = async (req, res) => {
    try {
        const preference = await NotificationPreference.findByPk(req.params.id);

        if (!preference) {
            return res.status(404).json({
                message: 'Notification preference not found'
            });
        }

        await preference.destroy();

        return res.status(200).json({
            message: 'Notification preference deleted successfully'
        });
    } catch (error) {
        console.error('Delete notification preference error:', error);

        return res.status(500).json({
            message: 'Failed to delete notification preference',
            error: error.message
        });
    }
};

module.exports = {
    getNotificationPreferences,
    getNotificationPreferenceById,
    createNotificationPreference,
    updateNotificationPreference,
    deleteNotificationPreference
};
