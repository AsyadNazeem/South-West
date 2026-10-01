const express = require('express');

const authController = require('../controllers/authController');
const authenticate = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/requirePermission');

const router = express.Router();

router.post('/register', authController.register);

router.post('/login', authController.login);

router.post(
    '/logout',
    authenticate,
    authController.logout
);

router.get(
    '/me',
    authenticate,
    authController.me
);

router.get(
    '/admin-dashboard',
    authenticate,
    requirePermission('admin.dashboard.view'),
    (req, res) => {
        res.status(200).json({
            message: 'Admin dashboard access granted',
            user: {
                id: req.user.id,
                email: req.user.email
            }
        });
    }
);

router.get(
    '/admin-test',
    authenticate,
    requirePermission('users.delete'),
    (req, res) => {
        res.status(200).json({
            message: 'Admin-level permission granted',
            user: {
                id: req.user.id,
                email: req.user.email
            }
        });
    }
);

module.exports = router;
