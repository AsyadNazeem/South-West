'use strict';

const { Role, Permission, UserRole } = require('../models');

exports.getRoles = async (req, res) => {
    try {
        const roles = await Role.findAll({
            include: [
                {
                    model: Permission,
                    as: 'permissions',
                    attributes: ['id', 'name', 'module']
                }
            ],
            order: [['id', 'ASC']]
        });

        return res.status(200).json({
            message: 'Roles retrieved successfully',
            data: roles
        });
    } catch (error) {
        console.error(error);

        return res.status(500).json({
            message: 'Failed to retrieve roles'
        });
    }
};

exports.getRole = async (req, res) => {
    try {
        const role = await Role.findByPk(req.params.id, {
            include: [
                {
                    model: Permission,
                    as: 'permissions',
                    attributes: ['id', 'name', 'module']
                }
            ]
        });

        if (!role) {
            return res.status(404).json({
                message: 'Role not found'
            });
        }

        return res.status(200).json({
            message: 'Role retrieved successfully',
            data: role
        });
    } catch (error) {
        console.error(error);

        return res.status(500).json({
            message: 'Failed to retrieve role'
        });
    }
};


exports.createRole = async (req, res) => {
    try {
        const { name, description } = req.body;

        const normalizedName =
            typeof name === 'string' ? name.trim() : '';

        if (!normalizedName) {
            return res.status(400).json({
                message: 'Role name is required'
            });
        }

        if (normalizedName.toLowerCase() === 'admin') {
            return res.status(400).json({
                message: 'The system Admin role name is reserved'
            });
        }

        const existingRole = await Role.findOne({
            where: { name: normalizedName }
        });

        if (existingRole) {
            return res.status(409).json({
                message: 'Role with this name already exists'
            });
        }

        const role = await Role.create({
            name: normalizedName,
            description
        });

        return res.status(201).json({
            message: 'Role created successfully',
            data: role
        });
    } catch (error) {
        console.error('Create role error:', error);

        return res.status(500).json({
            message: 'Failed to create role'
        });
    }
};



exports.updateRole = async (req, res) => {
    try {
        const { name, description } = req.body;
        const role = await Role.findByPk(req.params.id);

        if (!role) {
            return res.status(404).json({
                message: 'Role not found'
            });
        }

        const requestedName =
            typeof name === 'string' ? name.trim() : undefined;

        if (name !== undefined && !requestedName) {
            return res.status(400).json({
                message: 'Role name cannot be empty'
            });
        }

        if (
            role.name.trim().toLowerCase() === 'admin' &&
            requestedName !== undefined &&
            requestedName.toLowerCase() !== 'admin'
        ) {
            return res.status(403).json({
                message: 'The system Admin role cannot be renamed'
            });
        }

        if (
            requestedName &&
            requestedName.toLowerCase() === 'admin' &&
            role.name.trim().toLowerCase() !== 'admin'
        ) {
            return res.status(400).json({
                message: 'The system Admin role name is reserved'
            });
        }

        if (requestedName && requestedName !== role.name) {
            const existingRole = await Role.findOne({
                where: { name: requestedName }
            });

            if (existingRole) {
                return res.status(409).json({
                    message: 'Role with this name already exists'
                });
            }
        }

        const updates = {};

        if (requestedName !== undefined) {
            updates.name = requestedName;
        }

        if (description !== undefined) {
            updates.description = description;
        }

        await role.update(updates);

        return res.status(200).json({
            message: 'Role updated successfully',
            data: role
        });
    } catch (error) {
        console.error('Update role error:', error);

        return res.status(500).json({
            message: 'Failed to update role'
        });
    }
};

exports.deleteRole = async (req, res) => {
    try {
        const role = await Role.findByPk(req.params.id);

        if (!role) {
            return res.status(404).json({
                message: 'Role not found'
            });
        }

        // Prevent deletion of the system Admin role.
        if (
            typeof role.name === 'string' &&
            role.name.trim().toLowerCase() === 'admin'
        ) {
            return res.status(403).json({
                message: 'The system Admin role cannot be deleted'
            });
        }

        // Prevent deleting roles that are still assigned to users.
        const { UserRole } = require('../models');

        const assignedUsers = await UserRole.count({
            where: {
                role_id: role.id
            }
        });

        if (assignedUsers > 0) {
            return res.status(409).json({
                message: 'Cannot delete a role assigned to users. Reassign those users first.'
            });
        }

        await role.destroy();

        return res.status(200).json({
            message: 'Role deleted successfully'
        });
    } catch (error) {
        console.error('Delete role error:', error);

        return res.status(500).json({
            message: 'Failed to delete role'
        });
    }
};

