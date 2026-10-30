'use strict';

const jwt = require('jsonwebtoken');

const JWT_ISSUER = 'south-west-api';
const JWT_AUDIENCE = 'south-west-admin';

function getJwtSecret() {
    const secret = process.env.JWT_SECRET;

    if (
        typeof secret !== 'string' ||
        secret.length < 32 ||
        secret === 'your-secret-key'
    ) {
        throw new Error(
            'JWT_SECRET must be configured with a strong secret'
        );
    }

    return secret;
}

function generateToken(payload) {
    if (!payload || payload.userId == null) {
        throw new Error('A valid userId is required');
    }

    return jwt.sign(
        { userId: payload.userId },
        getJwtSecret(),
        {
            expiresIn: process.env.JWT_EXPIRES_IN || '15m',
            algorithm: 'HS256',
            issuer: JWT_ISSUER,
            audience: JWT_AUDIENCE
        }
    );
}

function verifyToken(token) {
    const decoded = jwt.verify(token, getJwtSecret(), {
        algorithms: ['HS256'],
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE
    });

    if (decoded.userId == null) {
        throw new Error('Required JWT claim is missing');
    }

    return decoded;
}

module.exports = {
    generateToken,
    verifyToken
};
