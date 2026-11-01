'use strict';

const express = require('express');
const router = express.Router();

const controller = require('../controllers/websiteThemeAdminController');
const authMiddleware = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/requirePermission');

router.use(authMiddleware);

router.get(
    '/',
    requirePermission('website_themes.view'),
    controller.getAllThemes
);

router.post(
    '/',
    requirePermission('website_themes.create'),
    controller.createTheme
);

router.put(
    '/:id',
    requirePermission('website_themes.update'),
    controller.updateTheme
);

router.patch(
    '/:id/status',
    requirePermission('website_themes.update'),
    controller.updateThemeStatus
);

router.delete(
    '/:id',
    requirePermission('website_themes.delete'),
    controller.deleteTheme
);

module.exports = router;
