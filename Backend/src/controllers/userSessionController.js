'use strict';

const { Op } = require('sequelize');
const {
    User,
    UserSession,
    Role,
    sequelize
} = require('../models');
const { recordAuditLog } = require('../services/auditLogService');

const isValidId = (id) =>
    typeof id === 'string' &&
    /^[1-9]\d*$/.test(id) &&
    Number.isSafeInteger(Number(id));

function hasSessionPermission(req, permissionName) {
    return req.permissions instanceof Set &&
        req.permissions.has(permissionName);
}


async function isAdmin(userId) {
    const user = await User.findByPk(userId, {
        attributes: ['id'],
        include: [{
            model: Role,
            as: 'roles',
            attributes: ['id', 'name'],
            through: { attributes: [] }
        }]
    });

    return Boolean(
        user &&
        user.roles &&
        user.roles.some(
            role =>
                typeof role.name === 'string' &&
                role.name.trim().toLowerCase() === 'admin'
        )
    );
}


function denyPermission(res) {
    return res.status(403).json({
        code: 'PERMISSION_DENIED',
        message: 'Permission denied'
    });
}

async function getTargetUser(userId) {
    return User.findByPk(userId, {
        attributes: ['id', 'is_active'],
        include: [{
            model: Role,
            as: 'roles',
            attributes: ['id', 'name'],
            through: { attributes: [] }
        }]
    });
}

const getUserSessions = async (req, res) => {
    try {
        if (!hasSessionPermission(req, 'user_sessions.view')) {
            return denyPermission(res);
        }

        const { userId } = req.params;

        if (!isValidId(userId)) {
            return res.status(400).json({ message: 'Invalid user ID' });
        }

        if (!(await isAdmin(String(req.user.id)))) {
            return denyPermission(res);
        }

        const user = await getTargetUser(userId);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const sessions = await UserSession.findAll({
            where: { user_id: userId, revoked_at: null },
            attributes: { exclude: ['refresh_token_hash'] },
            order: [['created_at', 'DESC']]
        });

        return res.status(200).json({
            message: 'User sessions retrieved successfully',
            data: sessions
        });
    } catch (error) {
        console.error('Get user sessions error:', error.message);
        return res.status(500).json({
            message: 'Failed to retrieve user sessions'
        });
    }
};

const getUserSession = async (req, res) => {
    try {
        if (!hasSessionPermission(req, 'user_sessions.view')) {
            return denyPermission(res);
        }

        const { id } = req.params;

        if (!isValidId(id)) {
            return res.status(400).json({ message: 'Invalid session ID' });
        }

        if (!(await isAdmin(String(req.user.id)))) {
            return denyPermission(res);
        }

        const session = await UserSession.findByPk(id, {
            attributes: { exclude: ['refresh_token_hash'] }
        });

        if (!session) {
            return res.status(404).json({ message: 'Session not found' });
        }

        return res.status(200).json({
            message: 'User session retrieved successfully',
            data: session
        });
    } catch (error) {
        console.error('Get user session error:', error.message);
        return res.status(500).json({
            message: 'Failed to retrieve user session'
        });
    }
};

const revokeUserSession = async (req, res) => {
    try {
        if (!hasSessionPermission(req, 'user_sessions.revoke')) {
            return denyPermission(res);
        }

        const { id } = req.params;

        if (!isValidId(id)) {
            return res.status(400).json({ message: 'Invalid session ID' });
        }

        if (!(await isAdmin(String(req.user.id)))) {
            return denyPermission(res);
        }

        const session = await UserSession.findByPk(id);

        if (!session) {
            return res.status(404).json({ message: 'Session not found' });
        }

        if (session.revoked_at) {
            return res.status(409).json({
                message: 'Session has already been revoked'
            });
        }

        await session.update({ revoked_at: new Date() });

        await sequelize.transaction(async (transaction) => {
            const session = await UserSession.findByPk(id, {
                transaction,
                lock: transaction.LOCK.UPDATE
            });

            if (!session) {
                const error = new Error('Session not found');
                error.code = 'SESSION_NOT_FOUND';
                throw error;
            }

            if (session.revoked_at) {
                const error = new Error('Session has already been revoked');
                error.code = 'SESSION_ALREADY_REVOKED';
                throw error;
            }

            await session.update(
                { revoked_at: new Date() },
                { transaction }
            );

            await recordAuditLog({
                userId: req.user.id,
                action: 'SESSION_REVOKED',
                module: 'user_sessions',
                entityType: 'user_session',
                entityId: session.id,
                description: `Session revoked for user ${session.user_id}`,
                newValues: { revoked: true },
                ipAddress: req.ip || null,
                userAgent: req.get('user-agent') || null,
                requestId: req.id || null,
                transaction
            });
        });

        return res.status(200).json({
            message: 'Session revoked successfully'
        });
    } catch (error) {
        console.error('Revoke user session error:', error.message);
        return res.status(500).json({
            message: 'Failed to revoke session'
        });
    }
};

const revokeAllUserSessions = async (req, res) => {
    try {
        if (!hasSessionPermission(req, 'user_sessions.revoke')) {
            return denyPermission(res);
        }

        const { userId } = req.params;

        if (!isValidId(userId)) {
            return res.status(400).json({ message: 'Invalid user ID' });
        }

        if (!(await isAdmin(String(req.user.id)))) {
            return denyPermission(res);
        }

        const user = await User.findByPk(userId, {
            attributes: ['id']
        });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const updatedCount = await sequelize.transaction(async (transaction) => {
            const [count] = await UserSession.update(
                { revoked_at: new Date() },
                {
                    where: {
                        user_id: userId,
                        revoked_at: null
                    },
                    transaction
                }
            );

            if (count > 0) {
                await recordAuditLog({
                    userId: req.user.id,
                    action: 'USER_SESSIONS_REVOKED',
                    module: 'user_sessions',
                    entityType: 'user',
                    entityId: userId,
                    description: `All active sessions revoked for user ${userId}`,
                    newValues: {
                        revoked_sessions: count
                    },
                    ipAddress: req.ip || null,
                    userAgent: req.get('user-agent') || null,
                    requestId: req.id || null,
                    transaction
                });
            }

            return count;
        });

        return res.status(200).json({
            message: 'User sessions revoked successfully',
            data: { revoked_sessions: updatedCount }
        });
    } catch (error) {
        console.error('Revoke all user sessions error:', error.message);
        return res.status(500).json({
            message: 'Failed to revoke user sessions'
        });
    }
};

const cleanupUserSessions = async (req, res) => {
    try {
        if (!hasSessionPermission(req, 'user_sessions.cleanup')) {
            return denyPermission(res);
        }

        if (!(await isAdmin(String(req.user.id)))) {
            return denyPermission(res);
        }

        const now = new Date();

        const deletedCount = await sequelize.transaction(async (transaction) => {
            const count = await UserSession.destroy({
                where: {
                    [Op.or]: [
                        { expires_at: { [Op.lt]: now } },
                        { revoked_at: { [Op.not]: null } }
                    ]
                },
                transaction
            });

            if (count > 0) {
                await recordAuditLog({
                    userId: req.user.id,
                    action: 'USER_SESSIONS_CLEANED_UP',
                    module: 'user_sessions',
                    entityType: 'user_session',
                    entityId: null,
                    description: 'Expired and revoked sessions cleaned up',
                    newValues: {
                        deleted_sessions: count
                    },
                    ipAddress: req.ip || null,
                    userAgent: req.get('user-agent') || null,
                    requestId: req.id || null,
                    transaction
                });
            }

            return count;
        });

        return res.status(200).json({
            message: 'Expired and revoked sessions cleaned up successfully',
            data: { deleted_sessions: deletedCount }
        });
    } catch (error) {
        console.error('Cleanup user sessions error:', error.message);
        return res.status(500).json({
            message: 'Failed to cleanup user sessions'
        });
    }
};

module.exports = {
    getUserSessions,
    getUserSession,
    revokeUserSession,
    revokeAllUserSessions,
    cleanupUserSessions
};
