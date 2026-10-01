const express = require('express');
const router = express.Router();

const authenticate = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/requirePermission');

const {
    getItems,
    getItemById,
    createItem
} = require('../controllers/itemController');

// GET all items
router.get(
    '/',
    authenticate,
    requirePermission('products.view'),
    getItems
);

// GET single item
router.get(
    '/:id',
    authenticate,
    requirePermission('products.view'),
    getItemById
);

// CREATE item
router.post(
    '/',
    authenticate,
    requirePermission('products.create'),
    createItem
);

module.exports = router;
