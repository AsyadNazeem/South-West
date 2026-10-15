
'use strict';

const express = require('express');
const router = express.Router();

const customerAuthMiddleware = require('../middleware/customerAuthMiddleware');

const {
    getMyNotifications,
    getMyNotificationById,
    markMyNotificationRead
} = require('../controllers/notificationController');

router.get('/', customerAuthMiddleware, getMyNotifications);

router.get('/:id', customerAuthMiddleware, getMyNotificationById);

router.patch(
    '/:id/read',
    customerAuthMiddleware,
    markMyNotificationRead
);

module.exports = router;
