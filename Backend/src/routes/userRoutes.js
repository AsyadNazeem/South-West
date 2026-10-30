
const express = require('express');
const userController = require('../controllers/userController');
const authenticate = require('../middleware/authMiddleware');
const { requirePermission } =
    require('../middleware/requirePermission');

const router = express.Router();

router.use(authenticate);

// Read users
router.get(
    '/',
    requirePermission('users.view'),
    userController.getUsers
);

router.get(
    '/:id',
    requirePermission('users.view'),
    userController.getUser
);

// Create a user and assign an initial role
router.post(
    '/',
    requirePermission('users.create'),
    requirePermission('users.roles.manage'),
    userController.createUser
);

// Update permitted profile fields only
router.put(
    '/:id',
    requirePermission('users.update'),
    userController.updateUser
);

// Change a user's role
router.put(
    '/:id/role',
    requirePermission('users.roles.manage'),
    userController.updateUserRole
);

// Activate or deactivate a user
router.put(
    '/:id/status',
    requirePermission('users.status.manage'),
    userController.updateUserStatus
);

// Reset another user's password
router.put(
    '/:id/password',
    requirePermission('users.password.reset'),
    userController.resetUserPassword
);

// Deactivate a user rather than permanently deleting the record
router.delete(
    '/:id',
    requirePermission('users.delete'),
    userController.deleteUser
);

module.exports = router;
