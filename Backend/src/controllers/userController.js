const bcrypt = require('bcryptjs');
const {
    User,
    Role,
    UserRole,
    UserSession
} = require('../models');

const getUsers = async (req, res) => {
    try {
        const users = await User.findAll({
            attributes: [
                'id',
                'email',
                'email_verified_at',
                'is_active',
                'last_login_at',
                'created_at',
                'updated_at'
            ],
            include: [
                {
                    model: Role,
                    as: 'roles',
                    attributes: ['id', 'name'],
                    through: {
                        attributes: []
                    }
                }
            ],
            order: [['id', 'ASC']]
        });

        return res.status(200).json({
            message: 'Users retrieved successfully',
            data: users
        });
    } catch (error) {
        console.error(error);

        return res.status(500).json({
            message: 'Failed to retrieve users'
        });
    }
};

const getUser = async (req, res) => {
    try {
        const user = await User.findByPk(req.params.id, {
            attributes: [
                'id',
                'email',
                'email_verified_at',
                'is_active',
                'last_login_at',
                'created_at',
                'updated_at'
            ],
            include: [
                {
                    model: Role,
                    as: 'roles',
                    attributes: ['id', 'name'],
                    through: {
                        attributes: []
                    }
                }
            ]
        });

        if (!user) {
            return res.status(404).json({
                message: 'User not found'
            });
        }

        return res.status(200).json({
            message: 'User retrieved successfully',
            data: user
        });
    } catch (error) {
        console.error(error);

        return res.status(500).json({
            message: 'Failed to retrieve user'
        });
    }
};

const createUser = async (req, res) => {
    try {
        const { email, password, role_id } = req.body;

        if (!email || !password || !role_id) {
            return res.status(400).json({
                message: 'Email, password and role are required'
            });
        }

        const existingUser = await User.findOne({
            where: { email }
        });

        if (existingUser) {
            return res.status(409).json({
                message: 'User with this email already exists'
            });
        }

        const role = await Role.findByPk(role_id);

        if (!role) {
            return res.status(400).json({
                message: 'Invalid role'
            });
        }

        const passwordHash = await bcrypt.hash(password, 12);

        const user = await User.create({
            email,
            password_hash: passwordHash,
            is_active: true
        });

        await UserRole.create({
            user_id: user.id,
            role_id: role.id
        });

        const createdUser = await User.findByPk(user.id, {
            attributes: [
                'id',
                'email',
                'is_active',
                'created_at'
            ],
            include: [
                {
                    model: Role,
                    as: 'roles',
                    attributes: ['id', 'name'],
                    through: {
                        attributes: []
                    }
                }
            ]
        });

        return res.status(201).json({
            message: 'User created successfully',
            data: createdUser
        });
    } catch (error) {
        console.error(error);

        return res.status(500).json({
            message: 'Failed to create user'
        });
    }
};


const updateUser = async (req, res) => {
    try {
        const userId = req.params.id;
        const { email } = req.body;

        // Only allow the email field through this endpoint.
        const allowedFields = ['email'];
        const invalidFields = Object.keys(req.body).filter(
            field => !allowedFields.includes(field)
        );

        if (invalidFields.length > 0) {
            return res.status(400).json({
                message: 'Unsupported fields in request',
                fields: invalidFields
            });
        }

        if (typeof email !== 'string' || !email.trim()) {
            return res.status(400).json({
                message: 'A valid email is required'
            });
        }

        const normalizedEmail = email.trim().toLowerCase();

        const user = await User.findByPk(userId);

        if (!user) {
            return res.status(404).json({
                message: 'User not found'
            });
        }

        const existingUser = await User.findOne({
            where: { email: normalizedEmail }
        });

        if (
            existingUser &&
            String(existingUser.id) !== String(user.id)
        ) {
            return res.status(409).json({
                message: 'Email is already in use'
            });
        }

        user.email = normalizedEmail;
        await user.save();

        return res.status(200).json({
            message: 'User updated successfully',
            data: {
                id: user.id,
                email: user.email,
                is_active: user.is_active
            }
        });
    } catch (error) {
        console.error('Update user error:', error);

        return res.status(500).json({
            message: 'Failed to update user'
        });
    }
};


const deleteUser = async (req, res) => {
    try {
        const user = await User.findByPk(req.params.id);

        if (!user) {
            return res.status(404).json({
                message: 'User not found'
            });
        }

        user.is_active = false;
        await user.save();

        return res.status(200).json({
            message: 'User deactivated successfully'
        });
    } catch (error) {
        console.error(error);

        return res.status(500).json({
            message: 'Failed to deactivate user'
        });
    }
};


const updateUserRole = async (req, res) => {
    try {
        const userId = req.params.id;
        const { role_id } = req.body;

        if (!role_id) {
            return res.status(400).json({
                message: 'Role ID is required'
            });
        }

        // Prevent users from changing their own role.
        if (String(req.user.id) === String(userId)) {
            return res.status(403).json({
                message: 'You cannot change your own role'
            });
        }

        const user = await User.findByPk(userId);

        if (!user) {
            return res.status(404).json({
                message: 'User not found'
            });
        }

        const role = await Role.findByPk(role_id);

        if (!role) {
            return res.status(400).json({
                message: 'Invalid role'
            });
        }

        // Do not allow assignment of the Admin role through this endpoint.
        if (role.name === 'Admin') {
            return res.status(403).json({
                message: 'The Admin role cannot be assigned through this endpoint'
            });
        }

        await UserRole.destroy({
            where: { user_id: user.id }
        });

        await UserRole.create({
            user_id: user.id,
            role_id: role.id
        });

        return res.status(200).json({
            message: 'User role updated successfully'
        });
    } catch (error) {
        console.error('Update user role error:', error);

        return res.status(500).json({
            message: 'Failed to update user role'
        });
    }
};

const updateUserStatus = async (req, res) => {
    try {
        const userId = req.params.id;
        const { is_active } = req.body;

        if (typeof is_active !== 'boolean') {
            return res.status(400).json({
                message: 'is_active must be a boolean'
            });
        }

        if (String(req.user.id) === String(userId) && !is_active) {
            return res.status(403).json({
                message: 'You cannot deactivate your own account'
            });
        }

        const user = await User.findByPk(userId);

        if (!user) {
            return res.status(404).json({
                message: 'User not found'
            });
        }

        user.is_active = is_active;
        await user.save();

        if (!is_active && UserSession) {
            await UserSession.update(
                { revoked_at: new Date() },
                {
                    where: {
                        user_id: user.id,
                        revoked_at: null
                    }
                }
            );
        }

        return res.status(200).json({
            message: is_active
                ? 'User activated successfully'
                : 'User deactivated successfully'
        });
    } catch (error) {
        console.error('Update user status error:', error);

        return res.status(500).json({
            message: 'Failed to update user status'
        });
    }
};

const resetUserPassword = async (req, res) => {
    try {
        const userId = req.params.id;
        const { password } = req.body;

        if (typeof password !== 'string' || password.length < 12) {
            return res.status(400).json({
                message: 'Password must contain at least 12 characters'
            });
        }

        if (String(req.user.id) === String(userId)) {
            return res.status(403).json({
                message: 'Use the normal password-change process for your own account'
            });
        }

        const user = await User.findByPk(userId);

        if (!user) {
            return res.status(404).json({
                message: 'User not found'
            });
        }

        user.password_hash = await bcrypt.hash(password, 12);
        await user.save();

        if (UserSession) {
            await UserSession.update(
                { revoked_at: new Date() },
                {
                    where: {
                        user_id: user.id,
                        revoked_at: null
                    }
                }
            );
        }

        return res.status(200).json({
            message: 'Password reset successfully. Existing sessions have been revoked.'
        });
    } catch (error) {
        console.error('Reset user password error:', error);

        return res.status(500).json({
            message: 'Failed to reset password'
        });
    }
};


module.exports = {
    getUsers,
    getUser,
    createUser,
    updateUser,
    deleteUser,
    updateUserRole,
    updateUserStatus,
    resetUserPassword
};
