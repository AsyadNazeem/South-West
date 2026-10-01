const express = require('express');

const router = express.Router();

const {
    getRolePermissions,
    updateRolePermissions
} = require('../controllers/rolePermissionController');

const authenticate = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/requirePermission');

router.get(
    '/roles/:id/permissions',
    authenticate,
    requirePermission('roles.view'),
    getRolePermissions
);

router.put(
    '/roles/:id/permissions',
    authenticate,
    requirePermission('roles.manage'),
    updateRolePermissions
);

module.exports = router;
