'use strict';

const express = require('express');

const authController = require('../controllers/authController');
const authenticate = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/requirePermission');
const { loginLimiter } = require('../middleware/authRateLimit');

const router = express.Router();

router.post(
    '/login',
    loginLimiter,
    authController.login
);

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

router.post(
    '/heartbeat',
    authenticate,
    (req, res) => {
        return res.status(200).json({
            message: 'Session activity recorded'
        });
    }
);

router.get(
    '/admin-dashboard',
    authenticate,
    requirePermission('dashboard.view'),
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

module.exports = router;
