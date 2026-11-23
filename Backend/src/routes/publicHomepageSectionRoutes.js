'use strict';

const express = require('express');
const router = express.Router();

const {
    getPublicSections,
} = require('../controllers/homepageSectionController');

router.get('/', getPublicSections);

module.exports = router;
