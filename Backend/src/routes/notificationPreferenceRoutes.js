'use strict';

const express = require('express');
const router = express.Router();

const {
    getNotificationPreferences,
    getNotificationPreferenceById,
    createNotificationPreference,
    updateNotificationPreference,
    deleteNotificationPreference
} = require('../controllers/notificationPreferenceController');

const authenticate = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/requirePermission');


router.get(
    '/',
    authenticate,
    requirePermission('notification_preferences.view'),
    getNotificationPreferences
);

router.get(
    '/:id',
    authenticate,
    requirePermission('notification_preferences.view'),
    getNotificationPreferenceById
);

router.post(
    '/',
    authenticate,
    requirePermission('notification_preferences.create'),
    createNotificationPreference
);

router.put(
    '/:id',
    authenticate,
    requirePermission('notification_preferences.update'),
    updateNotificationPreference
);

router.delete(
    '/:id',
    authenticate,
    requirePermission('notification_preferences.delete'),
    deleteNotificationPreference
);

module.exports = router;
