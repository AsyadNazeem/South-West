
'use strict';

const express = require('express');
const {
    getStoreProducts,
} = require('../controllers/storeProductController');

const router = express.Router();

router.get('/', getStoreProducts);


module.exports = router;
