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


// GET all item images
router.get(
    '/',
    authenticate,
    requirePermission('item_images.view'),
    getItemImages
);


// GET item image by ID
router.get(
    '/:id',
    authenticate,
    requirePermission('item_images.view'),
    getItemImageById
);


// CREATE item image
router.post(
    '/',
    authenticate,
    requirePermission('item_images.create'),
    createItemImage
);


// UPDATE item image
router.put(
    '/:id',
    authenticate,
    requirePermission('item_images.update'),
    updateItemImage
);


// DELETE item image
router.delete(
    '/:id',
    authenticate,
    requirePermission('item_images.delete'),
    deleteItemImage
);


module.exports = router;
