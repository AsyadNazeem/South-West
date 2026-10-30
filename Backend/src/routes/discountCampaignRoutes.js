
'use strict';

const express = require('express');
const router = express.Router();

const controller = require('../controllers/discountCampaignController');
const authMiddleware = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/requirePermission');

router.get(
    '/',
    authMiddleware,
    requirePermission('discount_campaigns.view'),
    controller.getAllCampaigns
);

router.get(
    '/:id',
    authMiddleware,
    requirePermission('discount_campaigns.view'),
    controller.getCampaignById
);

router.post(
    '/',
    authMiddleware,
    requirePermission('discount_campaigns.create'),
    controller.createCampaign
);

router.put(
    '/:id',
    authMiddleware,
    requirePermission('discount_campaigns.update'),
    controller.updateCampaign
);

router.patch(
    '/:id/status',
    authMiddleware,
    requirePermission('discount_campaigns.update'),
    controller.updateCampaignStatus
);

router.delete(
    '/:id',
    authMiddleware,
    requirePermission('discount_campaigns.delete'),
    controller.deleteCampaign
);

module.exports = router;
