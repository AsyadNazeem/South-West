const bcrypt = require('bcryptjs');
const { recordAuditLog } = require('../services/auditLogService');
const {
    sequelize,
    User,
    Role,
    UserRole,
    UserSession
} = require('../models');

const isAdminUser = async (userId) => {
    const assignment = await UserRole.findOne({
        where: { user_id: userId },
        include: [{
            model: Role,
            as: 'role',
            attributes: ['id', 'name']
        }]
    });

    return String(assignment?.role?.name || '')
        .trim()
        .toLowerCase() === 'admin';
};

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
        const userId = req.params.id;

        // Validate the user ID before querying the database.
        if (
            typeof userId !== 'string' ||
            !/^[1-9]\d*$/.test(userId) ||
            !Number.isSafeInteger(Number(userId))
        ) {
            return res.status(400).json({
                message: 'Invalid user ID'
            });
        }

        const user = await User.findByPk(userId, {
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
        console.error('Get user error:', error);

        return res.status(500).json({
            message: 'Failed to retrieve user'
        });
    }
};



const createUser = async (req, res) => {
    const { sequelize, User, Role, UserRole } = require('../models');

    let transaction;

    try {
        const { email, password, role_id } = req.body;

        // Validate email.
        if (typeof email !== 'string' || !email.trim()) {
            return res.status(400).json({
                message: 'A valid email is required'
            });
        }

        const normalizedEmail = email.trim().toLowerCase();

        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (
            normalizedEmail.length > 255 ||
            !emailPattern.test(normalizedEmail)
        ) {
            return res.status(400).json({
                message: 'A valid email is required'
            });
        }

        // Validate password.
        if (
            typeof password !== 'string' ||
            password.length < 12 ||
            password.length > 128
        ) {
            return res.status(400).json({
                message: 'Password must contain 12–128 characters'
            });
        }

        // Validate role ID.
        const parsedRoleId = Number(role_id);

        if (
            !Number.isSafeInteger(parsedRoleId) ||
            parsedRoleId <= 0
        ) {
            return res.status(400).json({
                message: 'A valid role ID is required'
            });
        }

        // Do not accept unexpected fields.
        const allowedFields = ['email', 'password', 'role_id'];

        const invalidFields = Object.keys(req.body).filter(
            field => !allowedFields.includes(field)
        );

        if (invalidFields.length > 0) {
            return res.status(400).json({
                message: 'Unsupported fields in request',
                fields: invalidFields
            });
        }

        // Check duplicate email.
        const existingUser = await User.findOne({
            where: { email: normalizedEmail }
        });

        if (existingUser) {
            return res.status(409).json({
                message: 'User with this email already exists'
            });
        }

        // Verify the requested role.
        const role = await Role.findByPk(parsedRoleId);

        if (!role) {
            return res.status(400).json({
                message: 'Invalid role'
            });
        }

        // Only an existing Admin may create another Admin account.
        if (
            String(role.name || '').trim().toLowerCase() === 'admin' &&
            !(await isAdminUser(req.user.id))
        ) {
            return res.status(403).json({
                message: 'Only an Admin can create an Admin account'
            });
        }

        transaction = await sequelize.transaction();

        const passwordHash = await bcrypt.hash(password, 12);

        const user = await User.create(
            {
                email: normalizedEmail,
                password_hash: passwordHash,
                is_active: true
            },
            { transaction }
        );

        await UserRole.create(
            {
                user_id: user.id,
                role_id: role.id
            },
            { transaction }
        );

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
            ],
            transaction
        });

        await recordAuditLog({
            userId: req.user.id,
            action: 'USER_CREATED',
            module: 'users',
            entityType: 'User',
            entityId: user.id,
            description: 'A user account was created',
            newValues: {
                email: normalizedEmail,
                is_active: true,
                role_id: role.id,
                role_name: role.name
            },
            ipAddress: req.ip,
            userAgent: req.get('user-agent'),
            requestId: req.id,
            transaction
        });

        await transaction.commit();
        transaction = null;

        return res.status(201).json({
            message: 'User created successfully',
            data: createdUser
        });
    } catch (error) {
        if (transaction) {
            try {
                await transaction.rollback();
            } catch (rollbackError) {
                console.error(
                    'User creation rollback failed:',
                    rollbackError
                );
            }
        }

        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(409).json({
                message: 'The email or role assignment already exists'
            });
        }

        console.error('Create user error:', error);

        return res.status(500).json({
            message: 'Failed to create user'
        });
    }
};




const updateUser = async (req, res) => {
    const isValidId = value =>
        typeof value === 'string' &&
        /^[1-9]\d*$/.test(value) &&
        Number.isSafeInteger(Number(value));

    try {
        const userId = req.params.id;
        const body = req.body || {};
        const { email } = body;

        if (!isValidId(userId)) {
            return res.status(400).json({
                message: 'Invalid user ID'
            });
        }

        const invalidFields = Object.keys(body).filter(
            field => field !== 'email'
        );

        if (invalidFields.length > 0) {
            return res.status(400).json({
                message: 'Unsupported fields in request',
                fields: invalidFields
            });
        }

        if (typeof email !== 'string') {
            return res.status(400).json({
                message: 'A valid email is required'
            });
        }

        const normalizedEmail = email.trim().toLowerCase();
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (
            normalizedEmail.length > 255 ||
            !emailPattern.test(normalizedEmail)
        ) {
            return res.status(400).json({
                message: 'A valid email is required'
            });
        }

        await sequelize.transaction(async transaction => {
            const user = await User.findByPk(userId, {
                transaction,
                lock: transaction.LOCK.UPDATE
            });

            if (!user) {
                const error = new Error('USER_NOT_FOUND');
                throw error;
            }

            const existingUser = await User.findOne({
                where: { email: normalizedEmail },
                transaction
            });

            if (
                existingUser &&
                String(existingUser.id) !== String(user.id)
            ) {
                const error = new Error('EMAIL_ALREADY_IN_USE');
                throw error;
            }

            const previousEmail = user.email;

            if (previousEmail !== normalizedEmail) {
                await user.update(
                    { email: normalizedEmail },
                    { transaction }
                );

                await recordAuditLog({
                    userId: req.user.id,
                    action: 'USER_UPDATED',
                    module: 'users',
                    entityType: 'User',
                    entityId: user.id,
                    description: 'User email updated',
                    oldValues: {
                        email: previousEmail
                    },
                    newValues: {
                        email: normalizedEmail
                    },
                    ipAddress: req.ip,
                    userAgent: req.get('user-agent'),
                    requestId: req.id,
                    transaction
                });
            }
        });

        const updatedUser = await User.findByPk(userId, {
            attributes: [
                'id',
                'email',
                'is_active',
                'email_verified_at',
                'updated_at'
            ]
        });

        return res.status(200).json({
            message: 'User updated successfully',
            data: updatedUser
        });
    } catch (error) {
        if (error.message === 'USER_NOT_FOUND') {
            return res.status(404).json({
                message: 'User not found'
            });
        }

        if (error.message === 'EMAIL_ALREADY_IN_USE') {
            return res.status(409).json({
                message: 'Email is already in use'
            });
        }

        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(409).json({
                message: 'Email is already in use'
            });
        }

        console.error('Update user error:', error);

        return res.status(500).json({
            message: 'Failed to update user'
        });
    }
};




const deleteUser = async (req, res) => {
    const { sequelize, User, UserSession } = require('../models');

    const isValidId = value =>
        typeof value === 'string' &&
        /^[1-9]\d*$/.test(value) &&
        Number.isSafeInteger(Number(value));

    try {
        const userId = req.params.id;

        if (!isValidId(userId)) {
            return res.status(400).json({
                message: 'Invalid user ID'
            });
        }

        if (String(req.user.id) === String(userId)) {
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


        await sequelize.transaction(async transaction => {
            const previousStatus = user.is_active;

            if (previousStatus) {
                await User.update(
                    { is_active: false },
                    {
                        where: { id: user.id },
                        transaction
                    }
                );

                await UserSession.update(
                    { revoked_at: new Date() },
                    {
                        where: {
                            user_id: user.id,
                            revoked_at: null
                        },
                        transaction
                    }
                );

                await recordAuditLog({
                    userId: req.user.id,
                    action: 'USER_DEACTIVATED',
                    module: 'users',
                    entityType: 'User',
                    entityId: user.id,
                    description: 'User account deactivated through delete endpoint',
                    oldValues: {
                        is_active: true
                    },
                    newValues: {
                        is_active: false
                    },
                    ipAddress: req.ip,
                    userAgent: req.get('user-agent'),
                    requestId: req.id,
                    transaction
                });
            }
        });


        return res.status(200).json({
            message: 'User deactivated successfully'
        });
    } catch (error) {
        console.error('Deactivate user error:', error);

        return res.status(500).json({
            message: 'Failed to deactivate user'
        });
    }
};


const updateUserRole = async (req, res) => {
    const { sequelize, User, Role, UserRole } = require('../models');

    const isValidId = value =>
        (typeof value === 'number' || typeof value === 'string') &&
        /^[1-9]\d*$/.test(String(value)) &&
        Number.isSafeInteger(Number(value));

    try {
        const userId = req.params.id;
        const { role_id } = req.body || {};

        // Validate the target user ID.
        if (!isValidId(userId)) {
            return res.status(400).json({
                message: 'Invalid user ID'
            });
        }

        // Validate request fields.
        const invalidFields = Object.keys(req.body || {}).filter(
            field => field !== 'role_id'
        );

        if (invalidFields.length > 0) {
            return res.status(400).json({
                message: 'Unsupported fields in request',
                fields: invalidFields
            });
        }

        if (!isValidId(role_id)) {
            return res.status(400).json({
                message: 'A valid role ID is required'
            });
        }

        // Prevent changing the requester's own role.
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

        // Only an existing Admin may promote another user to Admin.
        if (
            String(role.name || '').trim().toLowerCase() === 'admin' &&
            !(await isAdminUser(req.user.id))
        ) {
            return res.status(403).json({
                message: 'Only an Admin can assign the Admin role'
            });
        }

// Replace the role assignment and record the audit atomically.
        await sequelize.transaction(async transaction => {
            const previousAssignment = await UserRole.findOne({
                where: { user_id: user.id },
                include: [{
                    model: Role,
                    as: 'role',
                    attributes: ['id', 'name']
                }],
                transaction
            });

            const previousRoleId = previousAssignment?.role_id ?? null;
            const previousRoleName = previousAssignment?.role?.name ?? null;

            // Skip unchanged roles to avoid unnecessary audit entries.
            if (String(previousRoleId) === String(role.id)) {
                return;
            }

            await UserRole.destroy({
                where: { user_id: user.id },
                transaction
            });

            await UserRole.create(
                {
                    user_id: user.id,
                    role_id: role.id
                },
                { transaction }
            );

            await recordAuditLog({
                userId: req.user.id,
                action: 'USER_ROLE_UPDATED',
                module: 'users',
                entityType: 'User',
                entityId: user.id,
                description: 'User role updated',
                oldValues: {
                    role_id: previousRoleId,
                    role_name: previousRoleName
                },
                newValues: {
                    role_id: role.id,
                    role_name: role.name
                },
                ipAddress: req.ip,
                userAgent: req.get('user-agent'),
                requestId: req.id,
                transaction
            });
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
    const { sequelize, User, UserSession } = require('../models');

    const isValidId = value =>
        typeof value === 'string' &&
        /^[1-9]\d*$/.test(value) &&
        Number.isSafeInteger(Number(value));

    try {
        const userId = req.params.id;
        const { is_active } = req.body || {};

        if (!isValidId(userId)) {
            return res.status(400).json({
                message: 'Invalid user ID'
            });
        }

        const invalidFields = Object.keys(req.body || {}).filter(
            field => field !== 'is_active'
        );

        if (invalidFields.length > 0) {
            return res.status(400).json({
                message: 'Unsupported fields in request',
                fields: invalidFields
            });
        }

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

        const previousStatus = user.is_active;

        await sequelize.transaction(async transaction => {
            await User.update(
                { is_active },
                {
                    where: { id: user.id },
                    transaction
                }
            );

            if (!is_active) {
                await UserSession.update(
                    { revoked_at: new Date() },
                    {
                        where: {
                            user_id: user.id,
                            revoked_at: null
                        },
                        transaction
                    }
                );
            }

            if (previousStatus !== is_active) {
                await recordAuditLog({
                    userId: req.user.id,
                    action: is_active
                        ? 'USER_ACTIVATED'
                        : 'USER_DEACTIVATED',
                    module: 'users',
                    entityType: 'User',
                    entityId: user.id,
                    description: is_active
                        ? 'User account activated'
                        : 'User account deactivated',
                    oldValues: {
                        is_active: previousStatus
                    },
                    newValues: {
                        is_active
                    },
                    ipAddress: req.ip,
                    userAgent: req.get('user-agent'),
                    requestId: req.id,
                    transaction
                });
            }
        });

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
    const { sequelize, User, UserSession } = require('../models');

    const isValidId = value =>
        typeof value === 'string' &&
        /^[1-9]\d*$/.test(value) &&
        Number.isSafeInteger(Number(value));

    try {
        const userId = req.params.id;
        const body = req.body || {};
        const { password } = body;

        // Validate the user ID
        if (!isValidId(userId)) {
            return res.status(400).json({
                message: 'Invalid user ID'
            });
        }

        // Reject unexpected request fields
        const invalidFields = Object.keys(body).filter(
            field => field !== 'password'
        );

        if (invalidFields.length > 0) {
            return res.status(400).json({
                message: 'Unsupported fields in request',
                fields: invalidFields
            });
        }

        // Validate password length
        if (
            typeof password !== 'string' ||
            password.length < 12 ||
            password.length > 128
        ) {
            return res.status(400).json({
                message: 'Password must contain between 12 and 128 characters'
            });
        }

        // Prevent resetting your own password through this endpoint
        if (String(req.user.id) === userId) {
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

        // Hash before opening the transaction to keep it short
        const passwordHash = await bcrypt.hash(password, 12);

        await sequelize.transaction(async transaction => {
            await User.update(
                { password_hash: passwordHash },
                {
                    where: { id: user.id },
                    transaction
                }
            );

            await UserSession.update(
                { revoked_at: new Date() },
                {
                    where: {
                        user_id: user.id,
                        revoked_at: null
                    },
                    transaction
                }
            );

            await recordAuditLog({
                userId: req.user.id,
                action: 'USER_PASSWORD_RESET',
                module: 'users',
                entityType: 'User',
                entityId: user.id,
                description: 'User password reset by an administrator',
                ipAddress: req.ip,
                userAgent: req.get('user-agent'),
                requestId: req.id,
                transaction
            });
        });

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
