'use strict';

const { Role, Permission } = require('../models');

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

        if (!name) {
            return res.status(400).json({
                message: 'Role name is required'
            });
        }

        const existingRole = await Role.findOne({
            where: { name }
        });

        if (existingRole) {
            return res.status(409).json({
                message: 'Role with this name already exists'
            });
        }

        const role = await Role.create({
            name,
            description
        });

        return res.status(201).json({
            message: 'Role created successfully',
            data: role
        });
    } catch (error) {
        console.error(error);

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

        if (name && name !== role.name) {
            const existingRole = await Role.findOne({
                where: { name }
            });

            if (existingRole) {
                return res.status(409).json({
                    message: 'Role with this name already exists'
                });
            }
        }

        await role.update({
            name: name ?? role.name,
            description: description ?? role.description
        });

        return res.status(200).json({
            message: 'Role updated successfully',
            data: role
        });
    } catch (error) {
        console.error(error);

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

        if (role.name === 'Admin') {
            return res.status(400).json({
                message: 'Admin role cannot be deleted'
            });
        }

        await role.destroy();

        return res.status(200).json({
            message: 'Role deleted successfully'
        });
    } catch (error) {
        console.error(error);

        return res.status(500).json({
            message: 'Failed to delete role'
        });
    }
};
