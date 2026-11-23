'use strict';

const express = require('express');
const router = express.Router();

const authenticate = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/requirePermission');

const {
    getAdminContactInformation,
    updateContactInformation,
} = require('../controllers/contactInformationController');

router.use(authenticate);

router.get(
    '/',
    requirePermission('contact_information.view'),
    getAdminContactInformation
);

router.put(
    '/',
    requirePermission('contact_information.update'),
    updateContactInformation
);

module.exports = router;
