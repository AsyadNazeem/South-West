
'use strict';

const express = require('express');

const {
    getStoreProducts,
    getRelatedStoreProducts,
    getStoreProductFilters,
    getStoreProductVariants,
} = require('../controllers/storeProductController');

const router = express.Router();

router.get('/', getStoreProducts);
router.get('/filters', getStoreProductFilters);
router.get('/:id/related', getRelatedStoreProducts);
router.get('/:id/variants', getStoreProductVariants);

module.exports = router;
