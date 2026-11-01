'use strict';

const express = require('express');
const router = express.Router();

const {
    getActiveTheme,
} = require('../controllers/websiteThemeController');

router.get('/active', getActiveTheme);

module.exports = router;
