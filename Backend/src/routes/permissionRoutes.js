const express = require('express');

const router = express.Router();

const authenticate = require('../middleware/authMiddleware');

const {
    getPermissions,
    getPermissionById
} = require('../controllers/permissionController');

router.get(
    '/',
    authenticate,
    getPermissions
);

router.get(
    '/:id',
    authenticate,
    getPermissionById
);

module.exports = router;
