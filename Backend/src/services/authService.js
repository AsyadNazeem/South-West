const bcrypt = require('bcryptjs');
const { User, UserSession } = require('../models');
const { generateToken } = require('../utils/jwt');

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

    await UserSession.create({
        user_id: user.id,
        refresh_token_hash: token,
        expires_at: new Date(
            Date.now() +
            24 * 60 * 60 * 1000
        )
    });

    return {
        token,
        user: {
            id: user.id,
            email: user.email
        }
    };
}

async function logout(token) {
    await UserSession.destroy({
        where: {
            refresh_token_hash: token
        }
    });
}

async function hashPassword(password) {
    return bcrypt.hash(password, 12);
}

module.exports = {
    register,
    login,
    logout,
    hashPassword
};
