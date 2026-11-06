
'use strict';

const express = require('express');
const router = express.Router();

const authenticate = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/requirePermission');

const {
    getNotifications,
    getNotificationById,
    createNotification,
    updateNotification,
    deleteNotification,
    getMyNotifications,
    getMyNotificationById,
    markMyNotificationRead
} = require('../controllers/notificationController');
const adminNotifications = require('../controllers/adminNotificationController');

// Staff/admin endpoints
router.get('/admin/unread-count', authenticate, requirePermission('notifications.view'), adminNotifications.unreadCount);
router.get('/admin/mine', authenticate, requirePermission('notifications.view'), adminNotifications.list);
router.patch('/admin/mine/:id/dismiss', authenticate, requirePermission('notifications.view'), adminNotifications.dismiss);
router.patch('/admin/mine/:id/read', authenticate, requirePermission('notifications.view'), adminNotifications.markRead);
router.get('/admin/preferences', authenticate, requirePermission('notifications.view'), adminNotifications.preferences);
router.put('/admin/preferences', authenticate, requirePermission('notifications.view'), adminNotifications.updatePreferences);
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
