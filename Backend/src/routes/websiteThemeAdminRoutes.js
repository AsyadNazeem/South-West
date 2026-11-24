'use strict';

const express = require('express');
const router = express.Router();

const controller = require('../controllers/websiteThemeAdminController');
const authMiddleware = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/requirePermission');

router.use(authMiddleware);

// List developer-managed website themes.
router.get(
    '/',
    requirePermission('website_themes.view'),
    controller.getAllThemes
);

// Enable or disable an existing website theme.
router.patch(
    '/:id/status',
    requirePermission('website_themes.update'),
    controller.updateThemeStatus
);

module.exports = router;
