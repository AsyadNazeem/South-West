const bcrypt = require('bcryptjs');
const { User } = require('../models');
const { generateToken } = require('../utils/jwt');

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

    return {
        token,
        user: {
            id: user.id,
            email: user.email
        }
    };
}

async function hashPassword(password) {
    return bcrypt.hash(password, 12);
}

module.exports = {
    login,
    hashPassword
};
