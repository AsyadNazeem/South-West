'use strict';

const { Op } = require('sequelize');
const { sequelize, User, UserSession } = require('../models');
const { verifyToken } = require('../utils/jwt');
const { hashSessionToken } = require('../services/authService');

const ADMIN_INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000;

async function authenticate(req, res, next) {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                message: 'Authentication token required'
            });
        }

        const token = authHeader.slice('Bearer '.length).trim();

        if (!token) {
            return res.status(401).json({
                message: 'Authentication token required'
            });
        }

        const decoded = verifyToken(token);
        const now = Date.now();

        const sessionResult = await sequelize.transaction(
            async (transaction) => {
                const session = await UserSession.findOne({
                    where: {
                        user_id: decoded.userId,
                        refresh_token_hash: hashSessionToken(token),
                        revoked_at: null,
                        expires_at: {
                            [Op.gt]: new Date(now)
                        }
                    },
                    transaction,
                    lock: transaction.LOCK.UPDATE
                });

                if (!session) {
                    return { status: 'invalid' };
                }

                const storedActivity = new Date(
                    session.updated_at
                ).getTime();

                if (
                    !Number.isFinite(storedActivity) ||
                    now - storedActivity >= ADMIN_INACTIVITY_TIMEOUT_MS
                ) {
                    await session.update(
                        { revoked_at: new Date(now) },
                        { transaction }
                    );

                    return { status: 'inactive' };
                }

                // Only server-observed authenticated activity may refresh the
                // idle timeout. Never trust a timestamp supplied by the client.
                // Use SQL directly because Sequelize instance updates are not
                // persisting updated_at for this model.
                await sequelize.query(
                    `UPDATE user_sessions
                     SET updated_at = NOW()
                     WHERE id = :sessionId`,
                    {
                        replacements: {
                            sessionId: session.id
                        },
                        transaction
                    }
                );

                return {
                    status: 'valid',
                    session
                };
            }
        );

        if (sessionResult.status === 'invalid') {
            return res.status(401).json({
                message: 'Session is expired or has been revoked'
            });
        }

        if (sessionResult.status === 'inactive') {
            return res.status(401).json({
                message: 'Admin session expired due to inactivity'
            });
        }

        const user = await User.findByPk(decoded.userId);

        if (!user) {
            return res.status(401).json({
                message: 'User not found'
            });
        }

        if (!user.is_active) {
            return res.status(403).json({
                message: 'User account is inactive'
            });
        }

        req.user = user;
        req.session = sessionResult.session;

        return next();
    } catch (error) {
        if (
            error.name === 'JsonWebTokenError' ||
            error.name === 'TokenExpiredError' ||
            error.name === 'NotBeforeError'
        ) {
            return res.status(401).json({
                message: 'Invalid or expired token'
            });
        }

        console.error(
            'Authentication middleware error:',
            error.message
        );

        return res.status(500).json({
            message: 'Unable to authenticate request'
        });
    }
}

module.exports = authenticate;
