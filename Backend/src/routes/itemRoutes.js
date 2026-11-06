const express = require('express');
const router = express.Router();

const authenticate = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/requirePermission');
const {
    createItemColor,
    getItemColors,
    replaceItemColors
} = require('../controllers/itemColorController');

const {
    getItems,
    getAdminItemMedia,
    getItemFilterOptions,
    getItemById,
    createItem,
    updateItem
} = require('../controllers/itemController')

const {
    getAdminItemVariants,
    getItemVariants,
    getItemVariantById,
    createItemVariant,
    bulkCreateItemVariants,
    updateItemVariant,
    getVariantColors,
    updateVariantColors
} = require('../controllers/itemVariantController');

// GET all items
router.get(
    '/',
    authenticate,
    requirePermission('products.view'),
    getItems
);

router.get(
    '/filter-options',
    authenticate,
    requirePermission('products.view'),
    getItemFilterOptions
);

router.get(
    '/media',
    authenticate,
    requirePermission('item_images.view'),
    getAdminItemMedia
);

router.get(
    '/variants',
    authenticate,
    requirePermission('products.view'),
    getAdminItemVariants
);

// GET all variants for an item
router.get(
    '/:id/variants',
    authenticate,
    requirePermission('products.view'),
    getItemVariants
);

// GET one variant for an item
router.get(
    '/:id/variants/:variantId',
    authenticate,
    requirePermission('products.view'),
    getItemVariantById
);

// CREATE multiple variants for an item
router.post(
    '/:id/variants/bulk',
    authenticate,
    requirePermission('products.create'),
    bulkCreateItemVariants
);

// CREATE a variant for an item
router.post(
    '/:id/variants',
    authenticate,
    requirePermission('products.create'),
    createItemVariant
);

// UPDATE a variant for an item
router.put(
    '/:id/variants/:variantId',
    authenticate,
    requirePermission('products.update'),
    updateItemVariant
);


 // GET colours assigned to a variant
router.get(
    '/:id/variants/:variantId/colors',
    authenticate,
    requirePermission('products.view'),
    getVariantColors
);

// Replace colours assigned to a variant
router.put(
    '/:id/variants/:variantId/colors',
    authenticate,
    requirePermission('products.update'),
    updateVariantColors
);


// GET colors assigned to an item
router.get(
    '/:id/colors',
    authenticate,
    requirePermission('products.view'),
    getItemColors
);

// Replace colors assigned to an item
router.put(
    '/:id/colors',
    authenticate,
    requirePermission('products.update'),
    replaceItemColors
);

// CREATE a colour for an item
router.post(
    '/:id/colors',
    authenticate,
    requirePermission('products.create'),
    createItemColor
);

// GET single item
router.get(
    '/:id',
    authenticate,
    requirePermission('products.view'),
    getItemById
);

// UPDATE item
router.put(
    '/:id',
    authenticate,
    requirePermission('products.update'),
    updateItem
)

// CREATE item
router.post(
    '/',
    authenticate,
    requirePermission('products.create'),
    createItem
);

module.exports = router;
