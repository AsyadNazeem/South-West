
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

function revalidateProducts(req, res, next) {
    res.set('Cache-Control', 'private, no-cache');
    next();
}

router.get('/', revalidateProducts, getStoreProducts);
router.get('/top-rated', revalidateProducts, getTopRatedStoreProducts);
router.get('/filters', getStoreProductFilters);
router.get('/:id/related', revalidateProducts, getRelatedStoreProducts);
router.get('/:id/variants', getStoreProductVariants);

module.exports = router;
