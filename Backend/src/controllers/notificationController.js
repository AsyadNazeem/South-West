'use strict';

const { Notification, Customer } = require('../models');

const getNotifications = async (req, res) => {
    try {
        const notifications = await Notification.findAll({
            include: [
                {
                    model: Customer,
                    as: 'customer'
                }
            ],
            order: [['created_at', 'DESC']]
        });

        res.status(200).json({
            message: 'Notifications retrieved successfully',
            data: notifications
        });
    } catch (error) {
        console.error('Get notifications error:', error);
        res.status(500).json({
            message: 'Failed to retrieve notifications'
        });
    }
};

const getNotificationById = async (req, res) => {
    try {
        const notification = await Notification.findByPk(req.params.id, {
            include: [
                {
                    model: Customer,
                    as: 'customer'
                }
            ]
        });

        if (!notification) {
            return res.status(404).json({
                message: 'Notification not found'
            });
        }

        res.status(200).json({
            message: 'Notification retrieved successfully',
            data: notification
        });
    } catch (error) {
        console.error('Get notification error:', error);
        res.status(500).json({
            message: 'Failed to retrieve notification'
        });
    }
};

const createNotification = async (req, res) => {
    try {
        const {
            customer_id,
            type,
            title,
            message,
            reference_type,
            reference_id,
            is_read,
            read_at
        } = req.body;

        if (!customer_id) {
            return res.status(400).json({
                message: 'Customer ID is required'
            });
        }

        if (!type) {
            return res.status(400).json({
                message: 'Notification type is required'
            });
        }

        if (!title) {
            return res.status(400).json({
                message: 'Notification title is required'
            });
        }

        if (!message) {
            return res.status(400).json({
                message: 'Notification message is required'
            });
        }

        const notification = await Notification.create({
            customer_id,
            type,
            title,
            message,
            reference_type: reference_type || null,
            reference_id: reference_id || null,
            is_read: is_read ?? false,
            read_at: read_at || null
        });

        res.status(201).json({
            message: 'Notification created successfully',
            data: notification
        });
    } catch (error) {
        console.error('Create notification error:', error);
        res.status(500).json({
            message: 'Failed to create notification'
        });
    }
};

const updateNotification = async (req, res) => {
    try {
        const notification = await Notification.findByPk(req.params.id);

        if (!notification) {
            return res.status(404).json({
                message: 'Notification not found'
            });
        }

        const {
            customer_id,
            type,
            title,
            message,
            reference_type,
            reference_id,
            is_read,
            read_at
        } = req.body;

        await notification.update({
            customer_id: customer_id ?? notification.customer_id,
            type: type ?? notification.type,
            title: title ?? notification.title,
            message: message ?? notification.message,
            reference_type: reference_type ?? notification.reference_type,
            reference_id: reference_id ?? notification.reference_id,
            is_read: is_read ?? notification.is_read,
            read_at: read_at ?? notification.read_at
        });

        res.status(200).json({
            message: 'Notification updated successfully',
            data: notification
        });
    } catch (error) {
        console.error('Update notification error:', error);
        res.status(500).json({
            message: 'Failed to update notification'
        });
    }
};

const deleteNotification = async (req, res) => {
    try {
        const notification = await Notification.findByPk(req.params.id);

        if (!notification) {
            return res.status(404).json({
                message: 'Notification not found'
            });
        }

        await notification.destroy();

        res.status(200).json({
            message: 'Notification deleted successfully'
        });
    } catch (error) {
        console.error('Delete notification error:', error);
        res.status(500).json({
            message: 'Failed to delete notification'
        });
    }
};

module.exports = {
    getNotifications,
    getNotificationById,
    createNotification,
    updateNotification,
    deleteNotification
};
