
'use strict';
const { Op } = require('sequelize');
const { recordAuditLog } = require('../services/auditLogService');
const { Role, Permission, UserRole, sequelize } = require('../models');

const isValidId = (id) =>
    typeof id === 'string' && /^[1-9]\d*$/.test(id) &&
    Number.isSafeInteger(Number(id));

const normalizeName = (name) =>
    typeof name === 'string' ? name.trim() : '';

const validateDescription = (description) =>
    description === undefined ||
    description === null ||
    (typeof description === 'string' && description.length <= 255);

const isAdminRole = (role) =>
    typeof role.name === 'string' &&
    role.name.trim().toLowerCase() === 'admin';

const handleError = (res, error, operation) => {
    if (error.name === 'SequelizeUniqueConstraintError') {
        return res.status(409).json({
            message: 'Role with this name already exists'
        });
    }

    console.error(`${operation} error:`, error);

    return res.status(500).json({
        message: `${operation} failed`
    });
};

exports.getRoles = async (req, res) => {
    try {
        const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
        const pageSize = Math.min(100, Math.max(1, Number.parseInt(req.query.pageSize ?? req.query.limit, 10) || 25));
        const paginationEnabled = req.query.page !== undefined || req.query.pageSize !== undefined || req.query.limit !== undefined;
        const search = String(req.query.search || '').trim();
        const where = search ? { [Op.or]: [
            { name: { [Op.like]: `%${search}%` } },
            { description: { [Op.like]: `%${search}%` } },
        ] } : {};
        const result = await Role.findAndCountAll({
            where,
            include: [{
                model: Permission,
                as: 'permissions',
                attributes: ['id', 'name', 'module'],
                through: { attributes: [] }
            }],
            order: [['id', 'ASC']],
            limit: paginationEnabled ? pageSize : undefined,
            offset: paginationEnabled ? (page - 1) * pageSize : undefined,
            distinct: true
        });
        const roles = result.rows;

        return res.status(200).json({
            message: 'Roles retrieved successfully',
            data: roles,
            pagination: { page, pageSize, total: result.count, totalPages: Math.ceil(result.count / pageSize) }
        });
    } catch (error) {
        return handleError(res, error, 'Retrieve roles');
    }
};

exports.getRole = async (req, res) => {
    try {
        if (!isValidId(req.params.id)) {
            return res.status(400).json({ message: 'Invalid role ID' });
        }

        const role = await Role.findByPk(req.params.id, {
            include: [{
                model: Permission,
                as: 'permissions',
                attributes: ['id', 'name', 'module'],
                through: { attributes: [] }
            }]
        });

        if (!role) {
            return res.status(404).json({ message: 'Role not found' });
        }

        return res.status(200).json({
            message: 'Role retrieved successfully',
            data: role
        });
    } catch (error) {
        return handleError(res, error, 'Retrieve role');
    }
};

exports.createRole = async (req, res) => {
    try {
        const allowedFields = ['name', 'description'];
        const invalidFields = Object.keys(req.body || {}).filter(
            field => !allowedFields.includes(field)
        );

        if (invalidFields.length) {
            return res.status(400).json({
                message: 'Unsupported fields in request',
                fields: invalidFields
            });
        }

        const name = normalizeName(req.body?.name);
        const { description } = req.body || {};

        if (!name || name.length > 100) {
            return res.status(400).json({
                message: 'Role name must contain 1–100 characters'
            });
        }

        if (!validateDescription(description)) {
            return res.status(400).json({
                message: 'Description must be a string of at most 255 characters'
            });
        }

        if (name.toLowerCase() === 'admin') {
            return res.status(403).json({
                message: 'The system Admin role name is reserved'
            });
        }

        const existingRole = await Role.findOne({
            where: sequelize.where(
                sequelize.fn('LOWER', sequelize.col('name')),
                name.toLowerCase()
            )
        });

        if (existingRole) {
            return res.status(409).json({
                message: 'Role with this name already exists'
            });
        }

        const role = await sequelize.transaction(async (transaction) => {
            const createdRole = await Role.create(
                {
                    name,
                    description: description ?? null
                },
                { transaction }
            );

            await recordAuditLog({
                userId: req.user.id,
                action: 'ROLE_CREATED',
                module: 'roles',
                entityType: 'role',
                entityId: createdRole.id,
                description: `Role ${createdRole.name} created`,
                newValues: {
                    name: createdRole.name,
                    description: createdRole.description
                },
                ipAddress: req.ip || null,
                userAgent: req.get('user-agent') || null,
                requestId: req.id || null,
                transaction
            });

            return createdRole;
        });

        return res.status(201).json({
            message: 'Role created successfully',
            data: role
        });
    } catch (error) {
        return handleError(res, error, 'Create role');
    }
};

exports.updateRole = async (req, res) => {
    try {
        if (!isValidId(req.params.id)) {
            return res.status(400).json({ message: 'Invalid role ID' });
        }

        const allowedFields = ['name', 'description'];
        const invalidFields = Object.keys(req.body || {}).filter(
            field => !allowedFields.includes(field)
        );

        if (invalidFields.length) {
            return res.status(400).json({
                message: 'Unsupported fields in request',
                fields: invalidFields
            });
        }

        const role = await Role.findByPk(req.params.id);

        if (!role) {
            return res.status(404).json({ message: 'Role not found' });
        }

        const { name, description } = req.body || {};
        const updates = {};

        if (name !== undefined) {
            const normalizedName = normalizeName(name);

            if (!normalizedName || normalizedName.length > 100) {
                return res.status(400).json({
                    message: 'Role name must contain 1–100 characters'
                });
            }

            if (isAdminRole(role) && normalizedName.toLowerCase() !== 'admin') {
                return res.status(403).json({
                    message: 'The system Admin role cannot be renamed'
                });
            }

            if (!isAdminRole(role) && normalizedName.toLowerCase() === 'admin') {
                return res.status(403).json({
                    message: 'The system Admin role name is reserved'
                });
            }

            const existingRole = await Role.findOne({
                where: sequelize.where(
                    sequelize.fn('LOWER', sequelize.col('name')),
                    normalizedName.toLowerCase()
                )
            });

            if (
                existingRole &&
                String(existingRole.id) !== String(role.id)
            ) {
                return res.status(409).json({
                    message: 'Role with this name already exists'
                });
            }

            updates.name = normalizedName;
        }

        if (description !== undefined) {
            if (!validateDescription(description)) {
                return res.status(400).json({
                    message: 'Description must be a string of at most 255 characters'
                });
            }

            updates.description = description;
        }

        if (!Object.keys(updates).length) {
            return res.status(400).json({
                message: 'No supported fields supplied'
            });
        }

        await sequelize.transaction(async (transaction) => {
            const oldValues = {
                name: role.name,
                description: role.description
            };

            await role.update(updates, { transaction });

            await recordAuditLog({
                userId: req.user.id,
                action: 'ROLE_UPDATED',
                module: 'roles',
                entityType: 'role',
                entityId: role.id,
                description: `Role ${role.name} updated`,
                oldValues,
                newValues: {
                    name: role.name,
                    description: role.description
                },
                ipAddress: req.ip || null,
                userAgent: req.get('user-agent') || null,
                requestId: req.id || null,
                transaction
            });
        });

        return res.status(200).json({
            message: 'Role updated successfully',
            data: role
        });
    } catch (error) {
        return handleError(res, error, 'Update role');
    }
};

exports.deleteRole = async (req, res) => {
    try {
        if (!isValidId(req.params.id)) {
            return res.status(400).json({ message: 'Invalid role ID' });
        }

        await sequelize.transaction(async transaction => {
            const role = await Role.findByPk(req.params.id, {
                transaction,
                lock: transaction.LOCK.UPDATE
            });

            if (!role) {
                const error = new Error('ROLE_NOT_FOUND');
                error.code = 'ROLE_NOT_FOUND';
                throw error;
            }

            if (isAdminRole(role)) {
                const error = new Error('ADMIN_ROLE_PROTECTED');
                error.code = 'ADMIN_ROLE_PROTECTED';
                throw error;
            }

            const assignedUsers = await UserRole.count({
                where: { role_id: role.id },
                transaction
            });

            if (assignedUsers > 0) {
                const error = new Error('ROLE_HAS_USERS');
                error.code = 'ROLE_HAS_USERS';
                throw error;
            }

            await recordAuditLog({
                userId: req.user.id,
                action: 'ROLE_DELETED',
                module: 'roles',
                entityType: 'role',
                entityId: role.id,
                description: `Role ${role.name} deleted`,
                oldValues: {
                    name: role.name,
                    description: role.description
                },
                ipAddress: req.ip || null,
                userAgent: req.get('user-agent') || null,
                requestId: req.id || null,
                transaction
            });


            await role.destroy({ transaction });
        });

        return res.status(200).json({
            message: 'Role deleted successfully'
        });
    } catch (error) {
        if (error.code === 'ROLE_NOT_FOUND') {
            return res.status(404).json({ message: 'Role not found' });
        }

        if (error.code === 'ADMIN_ROLE_PROTECTED') {
            return res.status(403).json({
                message: 'The system Admin role cannot be deleted'
            });
        }

        if (error.code === 'ROLE_HAS_USERS') {
            return res.status(409).json({
                message: 'Cannot delete a role assigned to users. Reassign those users first.'
            });
        }

        return handleError(res, error, 'Delete role');
    }
};
