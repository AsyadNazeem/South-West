'use strict';

const express = require('express');
const {
    getProductSocialPreview,
} = require('../controllers/socialPreviewController');

const router = express.Router();

router.get('/product/:slug', getProductSocialPreview);

module.exports = router;
