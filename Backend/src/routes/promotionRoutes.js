'use strict';

const express = require('express');

const router = express.Router();

const promotionController = require('../controllers/promotionController');

const authMiddleware = require('../middleware/authMiddleware');
const permissionMiddleware = require('../middleware/permissionMiddleware');


// GET ALL
router.get(
    '/',
    authMiddleware,
    permissionMiddleware('promotions.view'),
    promotionController.getAllPromotions
);


// GET ONE
router.get(
    '/:id',
    authMiddleware,
    permissionMiddleware('promotions.view'),
    promotionController.getPromotionById
);


// CREATE
router.post(
    '/',
    authMiddleware,
    permissionMiddleware('promotions.create'),
    promotionController.createPromotion
);


// UPDATE
router.put(
    '/:id',
    authMiddleware,
    permissionMiddleware('promotions.update'),
    promotionController.updatePromotion
);


// UPDATE STATUS
router.patch(
    '/:id/status',
    authMiddleware,
    permissionMiddleware('promotions.update'),
    promotionController.updatePromotionStatus
);


// DELETE
router.delete(
    '/:id',
    authMiddleware,
    permissionMiddleware('promotions.delete'),
    promotionController.deletePromotion
);


module.exports = router;
