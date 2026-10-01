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


router.post(
    '/',
    authenticate,
    requirePermission('oauth_accounts.create'),
    createOAuthAccount
);


router.put(
    '/:id',
    authenticate,
    requirePermission('oauth_accounts.update'),
    updateOAuthAccount
);


router.delete(
    '/:id',
    authenticate,
    requirePermission('oauth_accounts.delete'),
    deleteOAuthAccount
);


module.exports = router;
