
'use strict';

const express = require('express');
const router = express.Router();

const customerAuthMiddleware = require('../middleware/customerAuthMiddleware');

const {
    getMyNotificationPreferences,
    saveMyNotificationPreferences
} = require('../controllers/notificationPreferenceController');

router.use(customerAuthMiddleware);

router.get('/', getMyNotificationPreferences);
router.put('/', saveMyNotificationPreferences);

module.exports = router;
