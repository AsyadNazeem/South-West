const bcrypt = require('bcryptjs');
const { User, Role, UserRole } = require('../models');

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
        const { email, password, role_id, is_active } = req.body;

        const user = await User.findByPk(userId);

        if (!user) {
            return res.status(404).json({
                message: 'User not found'
            });
        }

        if (email) {
            const existingUser = await User.findOne({
                where: { email }
            });

            if (existingUser && existingUser.id !== user.id) {
                return res.status(409).json({
                    message: 'Email is already in use'
                });
            }

            user.email = email;
        }

        if (password) {
            user.password_hash = await bcrypt.hash(password, 12);
        }

        if (typeof is_active !== 'undefined') {
            user.is_active = is_active;
        }

        await user.save();

        if (role_id) {
            const role = await Role.findByPk(role_id);

            if (!role) {
                return res.status(400).json({
                    message: 'Invalid role'
                });
            }

            await UserRole.destroy({
                where: {
                    user_id: user.id
                }
            });

            await UserRole.create({
                user_id: user.id,
                role_id: role.id
            });
        }

        return res.status(200).json({
            message: 'User updated successfully'
        });
    } catch (error) {
        console.error(error);

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

module.exports = {
    getUsers,
    getUser,
    createUser,
    updateUser,
    deleteUser
};
