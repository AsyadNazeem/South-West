'use strict';

const express = require('express');
const router = express.Router();

const authenticate = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/requirePermission');

const {
    getSettings,
    updateSettings
} = require('../controllers/stockConfirmationController');

// Public read-only settings for Customer checkout.
router.get('/public', getSettings);

// All routes below require Admin authentication.
router.use(authenticate);

router.get(
    '/',
    requirePermission('stock_confirmation.view'),
    getSettings
);

router.put(
    '/',
    requirePermission('stock_confirmation.update'),
    updateSettings
);

module.exports = router;
