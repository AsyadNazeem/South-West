const { UserRole, User, Role } = require('../models');

// GET ALL USER ROLES
exports.getAllUserRoles = async (req, res) => {
    try {
        const userRoles = await UserRole.findAll({
            include: [
                {
                    model: User,
                    as: 'user',
                    attributes: ['id', 'email']
                },
                {
                    model: Role,
                    as: 'role',
                    attributes: ['id', 'name']
                }
            ],
            order: [['id', 'ASC']]
        });

        res.status(200).json({
            message: 'User roles retrieved successfully',
            data: userRoles
        });
    } catch (error) {
        console.error('Get user roles error:', error);

        res.status(500).json({
            message: 'Failed to retrieve user roles',
            error: error.message
        });
    }
};


// GET USER ROLE BY ID
exports.getUserRoleById = async (req, res) => {
    try {
        const { id } = req.params;

        const userRole = await UserRole.findByPk(id, {
            include: [
                {
                    model: User,
                    as: 'user',
                    attributes: ['id', 'email']
                },
                {
                    model: Role,
                    as: 'role',
                    attributes: ['id', 'name']
                }
            ]
        });

        if (!userRole) {
            return res.status(404).json({
                message: 'User role not found'
            });
        }

        res.status(200).json({
            message: 'User role retrieved successfully',
            data: userRole
        });
    } catch (error) {
        console.error('Get user role error:', error);

        res.status(500).json({
            message: 'Failed to retrieve user role',
            error: error.message
        });
    }
};


// CREATE USER ROLE
exports.createUserRole = async (req, res) => {
    try {
        const { user_id, role_id } = req.body;

        if (!user_id || !role_id) {
            return res.status(400).json({
                message: 'user_id and role_id are required'
            });
        }

        // Check user exists
        const user = await User.findByPk(user_id);

        if (!user) {
            return res.status(404).json({
                message: 'User not found'
            });
        }

        // Check role exists
        const role = await Role.findByPk(role_id);

        if (!role) {
            return res.status(404).json({
                message: 'Role not found'
            });
        }

        // Prevent duplicate assignment
        const existingUserRole = await UserRole.findOne({
            where: {
                user_id,
                role_id
            }
        });

        if (existingUserRole) {
            return res.status(409).json({
                message: 'This role is already assigned to the user'
            });
        }

        const userRole = await UserRole.create({
            user_id,
            role_id
        });

        const createdUserRole = await UserRole.findByPk(userRole.id, {
            include: [
                {
                    model: User,
                    as: 'user',
                    attributes: ['id', 'email']
                },
                {
                    model: Role,
                    as: 'role',
                    attributes: ['id', 'name']
                }
            ]
        });

        res.status(201).json({
            message: 'User role created successfully',
            data: createdUserRole
        });
    } catch (error) {
        console.error('Create user role error:', error);

        res.status(500).json({
            message: 'Failed to create user role',
            error: error.message
        });
    }
};


// UPDATE USER ROLE
exports.updateUserRole = async (req, res) => {
    try {
        const { id } = req.params;
        const { user_id, role_id } = req.body;

        const userRole = await UserRole.findByPk(id);

        if (!userRole) {
            return res.status(404).json({
                message: 'User role not found'
            });
        }

        if (user_id) {
            const user = await User.findByPk(user_id);

            if (!user) {
                return res.status(404).json({
                    message: 'User not found'
                });
            }
        }

        if (role_id) {
            const role = await Role.findByPk(role_id);

            if (!role) {
                return res.status(404).json({
                    message: 'Role not found'
                });
            }
        }

        const newUserId = user_id || userRole.user_id;
        const newRoleId = role_id || userRole.role_id;

        // Prevent duplicate assignment
        const duplicate = await UserRole.findOne({
            where: {
                user_id: newUserId,
                role_id: newRoleId
            }
        });

        if (duplicate && duplicate.id !== userRole.id) {
            return res.status(409).json({
                message: 'This role is already assigned to the user'
            });
        }

        await userRole.update({
            user_id: newUserId,
            role_id: newRoleId
        });

        const updatedUserRole = await UserRole.findByPk(id, {
            include: [
                {
                    model: User,
                    as: 'user',
                    attributes: ['id', 'email']
                },
                {
                    model: Role,
                    as: 'role',
                    attributes: ['id', 'name']
                }
            ]
        });

        res.status(200).json({
            message: 'User role updated successfully',
            data: updatedUserRole
        });
    } catch (error) {
        console.error('Update user role error:', error);

        res.status(500).json({
            message: 'Failed to update user role',
            error: error.message
        });
    }
};


// DELETE USER ROLE
exports.deleteUserRole = async (req, res) => {
    try {
        const { id } = req.params;

        const userRole = await UserRole.findByPk(id);

        if (!userRole) {
            return res.status(404).json({
                message: 'User role not found'
            });
        }

        await userRole.destroy();

        res.status(200).json({
            message: 'User role deleted successfully'
        });
    } catch (error) {
        console.error('Delete user role error:', error);

        res.status(500).json({
            message: 'Failed to delete user role',
            error: error.message
        });
    }
};
