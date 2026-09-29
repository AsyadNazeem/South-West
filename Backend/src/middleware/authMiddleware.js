const { verifyToken } = require('../utils/jwt');
const { User } = require('../models');

async function authenticate(req, res, next) {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                message: 'Authentication token required'
            });
        }

        const token = authHeader.split(' ')[1];

        const decoded = verifyToken(token);

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

        next();
    } catch (error) {
        return res.status(401).json({
            message: 'Invalid or expired token'
        });
    }
}

module.exports = authenticate;
