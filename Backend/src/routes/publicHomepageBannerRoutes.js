'use strict';

const express = require('express');
const router = express.Router();

const {
    getPublicBanners,
} = require('../controllers/homepageBannerController');

router.get('/', getPublicBanners);

module.exports = router;