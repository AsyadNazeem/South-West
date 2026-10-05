const express = require('express');

const router = express.Router();

const authenticate = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/requirePermission');

const {
    getPermissions,
    getPermissionById
} = require('../controllers/permissionController');

router.get(
    '/',
    authenticate,
    requirePermission('permissions.view'),
    getPermissions
);

router.get(
    '/:id',
    authenticate,
    requirePermission('permissions.view'),
    getPermissionById
);

module.exports = router;
