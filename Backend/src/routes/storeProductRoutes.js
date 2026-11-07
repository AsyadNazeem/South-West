
'use strict';

const express = require('express');

const {
    getStoreProducts,
    getTopRatedStoreProducts,
    getRelatedStoreProducts,
    getStoreProductFilters,
    getStoreProductVariants,
} = require('../controllers/storeProductController');

const router = express.Router();

router.get('/', getStoreProducts);
router.get('/top-rated', getTopRatedStoreProducts);
router.get('/filters', getStoreProductFilters);
router.get('/:id/related', getRelatedStoreProducts);
router.get('/:id/variants', getStoreProductVariants);

module.exports = router;
