'use strict';

const express = require('express');
const router = express.Router();

const {
    getOAuthAccounts,
    getOAuthAccountById,
    createOAuthAccount,
    updateOAuthAccount,
    deleteOAuthAccount
} = require('../controllers/oauthAccountController');

const authenticate = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/requirePermission');


router.get(
    '/',
    authenticate,
    requirePermission('oauth_accounts.view'),
    getOAuthAccounts
);


router.get(
    '/:id',
    authenticate,
    requirePermission('oauth_accounts.view'),
    getOAuthAccountById
);


// TEMPORARILY DISABLED:
// OAuth accounts must be created through a validated provider flow.
router.post(
    '/',
    authenticate,
    requirePermission('oauth_accounts.create'),
    (req, res) => {
        return res.status(405).json({
            message: 'Use the authorized OAuth linking workflow.'
        });
    }
);

// TEMPORARILY DISABLED:
// Credentials and account ownership cannot be changed through generic CRUD.
router.put(
    '/:id',
    authenticate,
    requirePermission('oauth_accounts.update'),
    (req, res) => {
        return res.status(405).json({
            message: 'OAuth accounts cannot be modified through this endpoint.'
        });
    }
);

router.delete(
    '/:id',
    authenticate,
    requirePermission('oauth_accounts.delete'),
    deleteOAuthAccount
);


module.exports = router;
