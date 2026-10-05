'use strict';

const express = require('express');
const router = express.Router();

const {
    getItemImages,
    getItemImageById,
    createItemImage,
    updateItemImage,
    deleteItemImage
} = require('../controllers/itemImageController');

const authenticate = require('../middleware/authMiddleware');
const requirePermission = require('../middleware/permissionMiddleware');
const { uploadItemImage } = require('../middleware/uploadMiddleware');


router.get(
    '/',
    authenticate,
    requirePermission('item_images.view'),
    getItemImages
);


router.get(
    '/:id',
    authenticate,
    requirePermission('item_images.view'),
    getItemImageById
);


// Auth + permission first, so unauthorised users can't write files to disk
router.post(
    '/',
    authenticate,
    requirePermission('item_images.create'),
    uploadItemImage,
    createItemImage
);


router.put(
    '/:id',
    authenticate,
    requirePermission('item_images.update'),
    updateItemImage
);


router.delete(
    '/:id',
    authenticate,
    requirePermission('item_images.delete'),
    deleteItemImage
);


module.exports = router;
