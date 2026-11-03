'use strict';

const { Op } = require('sequelize');
const { sequelize, User, UserSession } = require('../models');
const { verifyToken } = require('../utils/jwt');
const { hashSessionToken } = require('../services/authService');

const ADMIN_INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000;
const MAX_FUTURE_ACTIVITY_SKEW_MS = 30 * 1000;

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
        const suppliedActivity = Number(
            req.headers['x-user-activity-at']
        );

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

                let lastActivity = storedActivity;

                if (
                    Number.isFinite(suppliedActivity) &&
                    suppliedActivity > 0 &&
                    suppliedActivity <= now + MAX_FUTURE_ACTIVITY_SKEW_MS &&
                    suppliedActivity > storedActivity
                ) {
                    lastActivity = Math.min(suppliedActivity, now);
                }

                if (
                    !Number.isFinite(lastActivity) ||
                    now - lastActivity >= ADMIN_INACTIVITY_TIMEOUT_MS
                ) {
                    await session.update(
                        { revoked_at: new Date(now) },
                        { transaction }
                    );

                    return { status: 'inactive' };
                }

                if (lastActivity > storedActivity) {
                    await session.update(
                        { updated_at: new Date(lastActivity) },
                        {
                            transaction,
                            silent: true
                        }
                    );
                }

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
