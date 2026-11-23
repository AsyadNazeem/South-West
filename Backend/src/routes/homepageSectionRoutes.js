'use strict';

const express = require('express');
const router = express.Router();

const authenticate = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/requirePermission');

const {
    getAdminSections,
    updateSections,
} = require('../controllers/homepageSectionController');

router.use(authenticate);

router.get(
    '/',
    requirePermission('homepage_sections.view'),
    getAdminSections
);

router.put(
    '/',
    requirePermission('homepage_sections.update'),
    updateSections
);

module.exports = router;
