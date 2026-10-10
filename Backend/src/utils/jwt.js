
const jwt = require('jsonwebtoken');

function getJwtSecret() {
    const secret = process.env.JWT_SECRET;

    if (!secret || secret === 'your-secret-key') {
        throw new Error('JWT_SECRET is missing or uses the placeholder value');
    }

    return secret;
}

function generateToken(payload) {
    return jwt.sign(
        payload,
        getJwtSecret(),
        {
            expiresIn: process.env.JWT_EXPIRES_IN || '1d',
            algorithm: 'HS256',
        }
    );
}

function verifyToken(token) {
    return jwt.verify(
        token,
        getJwtSecret(),
        {
            algorithms: ['HS256'],
        }
    );
}

module.exports = {
    generateToken,
    verifyToken,
};
