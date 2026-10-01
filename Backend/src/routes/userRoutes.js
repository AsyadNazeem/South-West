const express = require('express');
const userController = require('../controllers/userController');
const authenticate = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/requirePermission');

const router = express.Router();

router.get(
    '/',
    authenticate,
    requirePermission('users.view'),
    userController.getUsers
);

router.get(
    '/:id',
    authenticate,
    requirePermission('users.view'),
    userController.getUser
);

router.post(
    '/',
    authenticate,
    requirePermission('users.create'),
    userController.createUser
);

router.put(
    '/:id',
    authenticate,
    requirePermission('users.update'),
    userController.updateUser
);

router.delete(
    '/:id',
    authenticate,
    requirePermission('users.delete'),
    userController.deleteUser
);

module.exports = router;
