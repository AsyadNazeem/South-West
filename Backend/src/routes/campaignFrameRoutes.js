'use strict';

const express = require('express');
const router = express.Router();

const controller = require('../controllers/campaignFrameController');
const authMiddleware = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/requirePermission');
const { uploadCampaignFrame } = require('../middleware/uploadMiddleware');

router.use(authMiddleware);

router.get(
    '/',
    requirePermission('discount_campaigns.view'),
    controller.getAllFrames
);

router.post(
    '/',
    requirePermission('discount_campaigns.create'),
    uploadCampaignFrame,
    controller.createFrame
);

router.put(
    '/:id',
    requirePermission('discount_campaigns.update'),
    uploadCampaignFrame,
    controller.updateFrame
);

router.patch(
    '/:id/status',
    requirePermission('discount_campaigns.update'),
    controller.updateFrameStatus
);

router.delete(
    '/:id',
    requirePermission('discount_campaigns.delete'),
    controller.deleteFrame
);

module.exports = router;
