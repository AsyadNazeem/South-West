
'use strict';

const express = require('express');

const {
    getStoreProducts,
    getStoreProductVariants,
} = require('../controllers/storeProductController');

const router = express.Router();

router.get('/', getStoreProducts);
router.get('/:id/variants', getStoreProductVariants);

module.exports = router;
