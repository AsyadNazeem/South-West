const express = require('express');
const roleController = require('../controllers/roleController');
const authenticate = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/requirePermission');

const router = express.Router();

router.get(
    '/',
    authenticate,
    requirePermission('roles.view'),
    roleController.getRoles
);

router.get(
    '/:id',
    authenticate,
    requirePermission('roles.view'),
    roleController.getRole
);

router.post(
    '/',
    authenticate,
    requirePermission('roles.manage'),
    roleController.createRole
);

router.put(
    '/:id',
    authenticate,
    requirePermission('roles.manage'),
    roleController.updateRole
);

router.delete(
    '/:id',
    authenticate,
    requirePermission('roles.manage'),
    roleController.deleteRole
);

module.exports = router;
