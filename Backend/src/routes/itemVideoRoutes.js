'use strict';

const express = require('express');
const router = express.Router();

const {
    getItemVideos,
    getItemVideoById,
    createItemVideo,
    updateItemVideo,
    deleteItemVideo
} = require('../controllers/itemVideoController');

const authenticate = require('../middleware/authMiddleware');
const requirePermission = require('../middleware/permissionMiddleware');
const { uploadItemVideo } = require('../middleware/uploadMiddleware');


// Videos reuse the item_images.* permissions
router.get(
    '/',
    authenticate,
    requirePermission('item_images.view'),
    getItemVideos
);


router.get(
    '/:id',
    authenticate,
    requirePermission('item_images.view'),
    getItemVideoById
);


router.post(
    '/',
    authenticate,
    requirePermission('item_images.create'),
    uploadItemVideo,
    createItemVideo
);


router.put(
    '/:id',
    authenticate,
    requirePermission('item_images.update'),
    updateItemVideo
);


router.delete(
    '/:id',
    authenticate,
    requirePermission('item_images.delete'),
    deleteItemVideo
);


module.exports = router;
