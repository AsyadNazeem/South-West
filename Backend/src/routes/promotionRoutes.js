'use strict';

const express = require('express');

const router = express.Router();

const promotionController = require('../controllers/promotionController');

const authMiddleware = require('../middleware/authMiddleware');
const {requirePermission} = require('../middleware/requirePermission');


// GET ALL
router.get(
    '/',
    authMiddleware,
    requirePermission('promotions.view'),
    promotionController.getAllPromotions
);


// GET ONE
router.get(
    '/:id',
    authMiddleware,
    requirePermission('promotions.view'),
    promotionController.getPromotionById
);


// CREATE
router.post(
    '/',
    authMiddleware,
    requirePermission('promotions.create'),
    promotionController.createPromotion
);


// UPDATE
router.put(
    '/:id',
    authMiddleware,
    requirePermission('promotions.update'),
    promotionController.updatePromotion
);


// UPDATE STATUS
router.patch(
    '/:id/status',
    authMiddleware,
    requirePermission('promotions.update'),
    promotionController.updatePromotionStatus
);


// DELETE
router.delete(
    '/:id',
    authMiddleware,
    requirePermission('promotions.delete'),
    promotionController.deletePromotion
);


module.exports = router;
