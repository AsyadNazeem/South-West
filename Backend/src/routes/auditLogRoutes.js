'use strict';

const express = require('express');
const router = express.Router();

const authenticate = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/requirePermission');

const {
    getAuditLogs
} = require('../controllers/auditLogController');

router.get(
    '/',
    authenticate,
    requirePermission('audit_logs.view'),
    getAuditLogs
);

module.exports = router;
