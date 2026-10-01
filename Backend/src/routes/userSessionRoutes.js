'use strict';

const express = require('express');

const router = express.Router();

const {
    getUserSessions,
    getUserSession,
    revokeUserSession,
    revokeAllUserSessions,
    cleanupUserSessions
} = require('../controllers/userSessionController');

const authenticate = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/requirePermission');


/*
|--------------------------------------------------------------------------
| User Sessions
|--------------------------------------------------------------------------
*/


// Get all active sessions for a user
router.get(
    '/users/:userId/sessions',
    authenticate,
    requirePermission('user_sessions.view'),
    getUserSessions
);


// Get a specific session
router.get(
    '/sessions/:id',
    authenticate,
    requirePermission('user_sessions.view'),
    getUserSession
);


// Revoke a specific session
router.put(
    '/sessions/:id/revoke',
    authenticate,
    requirePermission('user_sessions.revoke'),
    revokeUserSession
);


// Revoke all sessions for a user
router.put(
    '/users/:userId/sessions/revoke-all',
    authenticate,
    requirePermission('user_sessions.revoke'),
    revokeAllUserSessions
);


// Cleanup expired/revoked sessions
router.delete(
    '/sessions/cleanup',
    authenticate,
    requirePermission('user_sessions.cleanup'),
    cleanupUserSessions
);


module.exports = router;
