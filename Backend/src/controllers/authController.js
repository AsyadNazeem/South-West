const authService = require('../services/authService');

async function register(req, res) {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                message: 'Email and password are required'
            });
        }

        if (password.length < 8) {
            return res.status(400).json({
                message: 'Password must be at least 8 characters'
            });
        }

        const user = await authService.register(
            email,
            password
        );

        return res.status(201).json({
            message: 'Registration successful',
            data: user
        });
    } catch (error) {
        return res.status(400).json({
            message: error.message
        });
    }
}

async function login(req, res) {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                message: 'Email and password are required'
            });
        }

        const result = await authService.login(
            email,
            password
        );

        return res.status(200).json({
            message: 'Login successful',
            data: result
        });
    } catch (error) {
        return res.status(401).json({
            message: error.message
        });
    }
}

async function logout(req, res) {
    try {
        const authHeader = req.headers.authorization;

        const token = authHeader.split(' ')[1];

        await authService.logout(token);

        return res.status(200).json({
            message: 'Logout successful'
        });
    } catch (error) {
        return res.status(500).json({
            message: 'Unable to logout'
        });
    }
}

async function me(req, res) {
    try {
        const user = await authService.getUserAuthorization(req.user.id);

        return res.status(200).json({
            message: 'Authenticated user',
            data: user
        });
    } catch (error) {
        return res.status(401).json({
            message: 'User not found'
        });
    }
}

module.exports = {
    register,
    login,
    logout,
    me
};
