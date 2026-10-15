'use strict';

const authService = require('../services/authService');
const { recordAuditLog } = require('../services/auditLogService');

const getActorId = (req) =>
    req.user?.id ?? req.user?.user_id ?? null;

async function safeAudit(req, {
    userId = getActorId(req),
    action,
    entityType = 'user',
    entityId = userId,
    description
}) {
    try {
        await recordAuditLog({
            userId: userId ?? null,
            action,
            module: 'authentication',
            entityType,
            entityId: entityId != null ? String(entityId) : null,
            description,
            ipAddress: req.ip ?? null,
            userAgent: req.get('user-agent') ?? null,
            requestId: req.id ?? req.requestId ?? null
        });
    } catch (error) {
        // Do not expose audit failures to clients or log credentials.
        console.error('Authentication audit logging failed:', error.message);
    }
}

async function register(req, res) {
    try {
        const { email, password } = req.body || {};

        if (
            typeof email !== 'string' ||
            typeof password !== 'string' ||
            !email.trim() ||
            !password
        ) {
            return res.status(400).json({
                message: 'Email and password are required'
            });
        }

        const normalizedEmail = email.trim().toLowerCase();

        if (
            normalizedEmail.length > 254 ||
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
        ) {
            return res.status(400).json({
                message: 'Please provide a valid email address'
            });
        }

        // bcrypt only processes up to 72 bytes of a password.
        // Reject longer UTF-8 inputs instead of silently truncating.
        if (
            password.length < 12 ||
            Buffer.byteLength(password, 'utf8') > 72
        ) {
            return res.status(400).json({
                message: 'Password must be at least 12 characters and no more than 72 UTF-8 bytes'
            });
        }

        const user = await authService.register(
            normalizedEmail,
            password
        );

        await safeAudit(req, {
            userId: user.id,
            entityId: user.id,
            action: 'REGISTER_SUCCESS',
            description: 'User registered successfully'
        });

        return res.status(201).json({
            message: 'Registration successful',
            data: user
        });
    } catch (error) {
        if (error.message === 'Email is already registered') {
            return res.status(409).json({
                message: 'Unable to register with these details'
            });
        }

        // Also handle a database unique-constraint race safely.
        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(409).json({
                message: 'Unable to register with these details'
            });
        }

        console.error('Registration error:', error.message);

        await safeAudit(req, {
            userId: null,
            entityId: null,
            action: 'REGISTER_FAILED',
            description: 'Registration failed'
        });

        return res.status(500).json({
            message: 'Unable to complete registration'
        });
    }
}

async function login(req, res) {
    try {
        const { email, password } = req.body || {};

        if (
            typeof email !== 'string' ||
            typeof password !== 'string' ||
            !email.trim() ||
            !password
        ) {
            return res.status(400).json({
                message: 'Email and password are required'
            });
        }

        const normalizedEmail = email.trim().toLowerCase();

        if (
            normalizedEmail.length > 254 ||
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) ||
            Buffer.byteLength(password, 'utf8') > 72
        ) {
            await safeAudit(req, {
                userId: null,
                entityId: null,
                action: 'LOGIN_FAILED',
                description: 'Login rejected due to invalid input'
            });

            return res.status(401).json({
                message: 'Invalid email or password'
            });
        }

        const result = await authService.login(
            normalizedEmail,
            password
        );

        await safeAudit(req, {
            userId: result.user.id,
            entityId: result.user.id,
            action: 'LOGIN_SUCCESS',
            description: 'User logged in successfully'
        });

        return res.status(200).json({
            message: 'Login successful',
            data: result
        });
    } catch (error) {
        if (
            error.message === 'Invalid email or password' ||
            error.message === 'Password login is not available for this account' ||
            error.message === 'User account is inactive'
        ) {
            await safeAudit(req, {
                userId: null,
                entityId: null,
                action: 'LOGIN_FAILED',
                description: 'Login rejected due to invalid credentials or account status'
            });

            // Keep the response generic to avoid revealing account status.
            return res.status(401).json({
                message: 'Invalid email or password'
            });
        }

        console.error('Login error:', error.message);

        await safeAudit(req, {
            userId: null,
            entityId: null,
            action: 'LOGIN_ERROR',
            description: 'Login could not be completed due to a server error'
        });

        return res.status(500).json({
            message: 'Unable to log in'
        });
    }
}

async function logout(req, res) {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader?.startsWith('Bearer ')
            ? authHeader.slice(7).trim()
            : '';

        if (!token) {
            return res.status(401).json({
                message: 'Authentication token required'
            });
        }

        // Authentication middleware must have verified the token.
        await authService.logout(token);

        await safeAudit(req, {
            userId: getActorId(req),
            entityId: getActorId(req),
            action: 'LOGOUT_SUCCESS',
            description: 'User logged out successfully'
        });

        return res.status(200).json({
            message: 'Logout successful'
        });
    } catch (error) {
        console.error('Logout error:', error.message);

        await safeAudit(req, {
            action: 'LOGOUT_FAILED',
            description: 'Logout could not be completed'
        });

        return res.status(500).json({
            message: 'Unable to logout'
        });
    }
}

async function me(req, res) {
    try {
        if (!req.user?.id) {
            return res.status(401).json({
                message: 'Authentication required'
            });
        }

        const user = await authService.getUserAuthorization(req.user.id);

        return res.status(200).json({
            message: 'Authenticated user',
            data: user
        });
    } catch (error) {
        console.error('Current-user lookup error:', error.message);

        return res.status(500).json({
            message: 'Unable to retrieve authenticated user'
        });
    }
}

module.exports = {
    register,
    login,
    logout,
    me
};
