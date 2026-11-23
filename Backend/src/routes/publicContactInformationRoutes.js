'use strict';

const express = require('express');
const router = express.Router();

const {
    getPublicContactInformation,
} = require('../controllers/contactInformationController');

router.get('/', getPublicContactInformation);

module.exports = router;
