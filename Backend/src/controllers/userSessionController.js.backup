'use strict';

const { UserSession } = require('../models');

/**
 * Get all active sessions for a user
 */
const getUserSessions = async (req, res) => {
    try {
        const { userId } = req.params;

        const sessions = await UserSession.findAll({
            where: {
                user_id: userId,
                revoked_at: null
            },
            attributes: {
                exclude: ['refresh_token_hash']
            },
            order: [['created_at', 'DESC']]
        });

        return res.status(200).json({
            message: 'User sessions retrieved successfully',
            data: sessions
        });

    } catch (error) {
        console.error(error);

        return res.status(500).json({
            message: 'Failed to retrieve user sessions'
        });
    }
};


/**
 * Get a specific session
 */
const getUserSession = async (req, res) => {
    try {
        const { id } = req.params;

        const session = await UserSession.findByPk(id, {
            attributes: {
                exclude: ['refresh_token_hash']
            }
        });

        if (!session) {
            return res.status(404).json({
                message: 'Session not found'
            });
        }

        return res.status(200).json({
            message: 'User session retrieved successfully',
            data: session
        });

    } catch (error) {
        console.error(error);

        return res.status(500).json({
            message: 'Failed to retrieve user session'
        });
    }
};


/**
 * Revoke a specific session
 */
const revokeUserSession = async (req, res) => {
    try {
        const { id } = req.params;

        const session = await UserSession.findByPk(id);

        if (!session) {
            return res.status(404).json({
                message: 'Session not found'
            });
        }

        if (session.revoked_at) {
            return res.status(400).json({
                message: 'Session has already been revoked'
            });
        }

        await session.update({
            revoked_at: new Date()
        });

        return res.status(200).json({
            message: 'Session revoked successfully'
        });

    } catch (error) {
        console.error(error);

        return res.status(500).json({
            message: 'Failed to revoke session'
        });
    }
};


/**
 * Revoke all sessions for a user
 */
const revokeAllUserSessions = async (req, res) => {
    try {
        const { userId } = req.params;

        const [updatedCount] = await UserSession.update(
            {
                revoked_at: new Date()
            },
            {
                where: {
                    user_id: userId,
                    revoked_at: null
                }
            }
        );

        return res.status(200).json({
            message: 'All user sessions revoked successfully',
            data: {
                revoked_sessions: updatedCount
            }
        });

    } catch (error) {
        console.error(error);

        return res.status(500).json({
            message: 'Failed to revoke user sessions'
        });
    }
};


/**
 * Delete expired or revoked sessions
 */
const cleanupUserSessions = async (req, res) => {
    try {
        const { Op } = require('sequelize');

        const deletedCount = await UserSession.destroy({
            where: {
                [Op.or]: [
                    {
                        expires_at: {
                            [Op.lt]: new Date()
                        }
                    },
                    {
                        revoked_at: {
                            [Op.not]: null
                        }
                    }
                ]
            }
        });

        return res.status(200).json({
            message: 'Expired and revoked sessions cleaned up successfully',
            data: {
                deleted_sessions: deletedCount
            }
        });

    } catch (error) {
        console.error(error);

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
