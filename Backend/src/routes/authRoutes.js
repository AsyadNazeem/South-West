const express = require('express');
const authController = require('../controllers/authController');
const authenticate = require('../middleware/authMiddleware');
const requirePermission = require('../middleware/permissionMiddleware');

const router = express.Router();

router.post('/login', authController.login);

router.get('/me', authenticate, authController.me);

router.get(
    '/admin-dashboard',
    authenticate,
    requirePermission('dashboard.view'),
    (req, res) => {
        res.status(200).json({
            message: 'Admin dashboard access granted',
            user: req.user
        });
    }
);

module.exports = router;
