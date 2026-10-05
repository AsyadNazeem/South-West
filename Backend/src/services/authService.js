const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { User, UserSession, Role, Permission } = require('../models');
const { generateToken, verifyToken } = require('../utils/jwt');

const authorizationInclude = [
    {
        model: Role,
        as: 'roles',
        attributes: ['id', 'name'],
        through: { attributes: [] },
        include: [
            {
                model: Permission,
                as: 'permissions',
                attributes: ['id', 'name', 'module'],
                through: { attributes: [] }
            }
        ]
    }
];

function hashSessionToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

function serializeAuthorizedUser(user) {
    const permissionNames = new Set();
    const roles = (user.roles || []).map((role) => {
        (role.permissions || []).forEach((permission) => {
            permissionNames.add(permission.name);
        });

        return {
            id: role.id,
            name: role.name
        };
    });

    return {
        id: user.id,
        email: user.email,
        is_active: user.is_active,
        roles,
        permissions: [...permissionNames].sort()
    };
}

async function getUserAuthorization(userId) {
    const user = await User.findByPk(userId, {
        include: authorizationInclude
    });

    if (!user) {
        throw new Error('User not found');
    }

    return serializeAuthorizedUser(user);
}

async function register(email, password) {
    const existingUser = await User.findOne({
        where: { email }
    });

    if (existingUser) {
        throw new Error('Email is already registered');
    }

    const passwordHash = await hashPassword(password);

    const user = await User.create({
        email,
        password_hash: passwordHash,
        is_active: true
    });

    return {
        id: user.id,
        email: user.email
    };
}

async function login(email, password) {
    const user = await User.findOne({
        where: { email }
    });

    if (!user) {
        throw new Error('Invalid email or password');
    }

    if (!user.is_active) {
        throw new Error('User account is inactive');
    }

    if (!user.password_hash) {
        throw new Error('Password login is not available for this account');
    }

    const passwordValid = await bcrypt.compare(
        password,
        user.password_hash
    );

    if (!passwordValid) {
        throw new Error('Invalid email or password');
    }

    await user.update({
        last_login_at: new Date()
    });

    const token = generateToken({
        userId: user.id
    });
    const decodedToken = verifyToken(token);

    await UserSession.create({
        user_id: user.id,
        refresh_token_hash: hashSessionToken(token),
        expires_at: new Date(decodedToken.exp * 1000)
    });

    return {
        token,
        user: await getUserAuthorization(user.id)
    };
}

async function logout(token) {
    await UserSession.update(
        { revoked_at: new Date() },
        {
            where: {
                refresh_token_hash: hashSessionToken(token),
                revoked_at: null
            }
        }
    );
}

async function hashPassword(password) {
    return bcrypt.hash(password, 12);
}

module.exports = {
    getUserAuthorization,
    hashSessionToken,
    register,
    login,
    logout,
    hashPassword
};
