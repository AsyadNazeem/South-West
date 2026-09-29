const authService = require('../services/authService');

async function login(req, res) {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                message: 'Email and password are required'
            });
        }

        const result = await authService.login(email, password);

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

async function me(req, res) {
    return res.status(200).json({
        message: 'Authenticated user',
        data: {
            id: req.user.id,
            email: req.user.email,
            is_active: req.user.is_active
        }
    });
}

module.exports = {
    login,
    me
};
