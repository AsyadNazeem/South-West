const { Op } = require('sequelize');
const { verifyToken } = require('../utils/jwt');
const { User, UserSession } = require('../models');
const { hashSessionToken } = require('../services/authService');

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
        const session = await UserSession.findOne({
            where: {
                user_id: decoded.userId,
                refresh_token_hash: hashSessionToken(token),
                revoked_at: null,
                expires_at: {
                    [Op.gt]: new Date()
                }
            }
        });

        if (!session) {
            return res.status(401).json({
                message: 'Session is expired or has been revoked'
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
        req.session = session;

        next();
    } catch (error) {
        return res.status(401).json({
            message: 'Invalid or expired token'
        });
    }
}

module.exports = authenticate;
