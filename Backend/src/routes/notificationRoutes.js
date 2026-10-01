'use strict';

const express = require('express');
const router = express.Router();

const {
    getNotifications,
    getNotificationById,
    createNotification,
    updateNotification,
    deleteNotification
} = require('../controllers/notificationController');

const authenticate = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/requirePermission');

router.get(
    '/',
    authenticate,
    requirePermission('notifications.view'),
    getNotifications
);

router.get(
    '/:id',
    authenticate,
    requirePermission('notifications.view'),
    getNotificationById
);

router.post(
    '/',
    authenticate,
    requirePermission('notifications.create'),
    createNotification
);

router.put(
    '/:id',
    authenticate,
    requirePermission('notifications.update'),
    updateNotification
);

router.delete(
    '/:id',
    authenticate,
    requirePermission('notifications.delete'),
    deleteNotification
);

module.exports = router;
