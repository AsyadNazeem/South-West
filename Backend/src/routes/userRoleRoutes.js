const express = require('express');
const router = express.Router();

const userRoleController = require('../controllers/userRoleController');

const authenticate = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/requirePermission');



// GET ALL
router.get(
    '/',
    authenticate,
    requirePermission('user_roles.view'),
    userRoleController.getAllUserRoles
);


// GET BY ID
router.get(
    '/:id',
    authenticate,
    requirePermission('user_roles.view'),
    userRoleController.getUserRoleById
);


// CREATE
router.post(
    '/',
    authenticate,
    requirePermission('user_roles.create'),
    userRoleController.createUserRole
);


// UPDATE
router.put(
    '/:id',
    authenticate,
    requirePermission('user_roles.update'),
    userRoleController.updateUserRole
);


// DELETE
router.delete(
    '/:id',
    authenticate,
    requirePermission('user_roles.delete'),
    userRoleController.deleteUserRole
);


module.exports = router;
