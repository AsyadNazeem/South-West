
'use strict';

const express = require('express');
const router = express.Router();

const {
    getAdminBanners,
    getAdminBannerById,
    createBanner,
    updateBanner,
    updateBannerStatus,
    deleteBanner,
} = require('../controllers/homepageBannerController');

const authenticate = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/requirePermission');
const { uploadBannerImage } = require('../middleware/uploadMiddleware');

router.use(authenticate);

// View all banners
router.get(
    '/',
    requirePermission('homepage_banners.view'),
    getAdminBanners
);

// Create a banner; multipart/form-data field name: image
router.post(
    '/',
    requirePermission('homepage_banners.create'),
    uploadBannerImage,
    createBanner
);

// Activate/deactivate a banner
router.patch(
    '/:id/status',
    requirePermission('homepage_banners.update'),
    updateBannerStatus
);

// Update banner fields; optional replacement image field: image
router.put(
    '/:id',
    requirePermission('homepage_banners.update'),
    uploadBannerImage,
    updateBanner
);

// Delete a banner
router.delete(
    '/:id',
    requirePermission('homepage_banners.delete'),
    deleteBanner
);

// Get one banner by ID
router.get(
    '/:id',
    requirePermission('homepage_banners.view'),
    getAdminBannerById
);

module.exports = router;
