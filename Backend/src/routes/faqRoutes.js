'use strict';

const express = require('express');
const router = express.Router();

const authenticate = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/requirePermission');

const {
    getAdminFaqs,
    getAdminFaqById,
    createFaq,
    updateFaq,
    updateFaqStatus,
    deleteFaq,
} = require('../controllers/faqController');

router.use(authenticate);

router.get(
    '/',
    requirePermission('faqs.view'),
    getAdminFaqs
);

router.post(
    '/',
    requirePermission('faqs.create'),
    createFaq
);

router.patch(
    '/:id/status',
    requirePermission('faqs.update'),
    updateFaqStatus
);

router.put(
    '/:id',
    requirePermission('faqs.update'),
    updateFaq
);

router.delete(
    '/:id',
    requirePermission('faqs.delete'),
    deleteFaq
);

router.get(
    '/:id',
    requirePermission('faqs.view'),
    getAdminFaqById
);

module.exports = router;
