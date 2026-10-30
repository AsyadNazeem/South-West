
'use strict';

const express = require('express');
const router = express.Router();

const customerAuth = require('../middleware/customerAuthMiddleware');

const {
    getMyCart,
    addItem,
    updateItem,
    removeItem
} = require('../controllers/customerCartController');

router.use(customerAuth);

router.get('/', getMyCart);
router.post('/items', addItem);
router.patch('/items/:id', updateItem);
router.delete('/items/:id', removeItem);

module.exports = router;
