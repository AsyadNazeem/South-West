const { Role, Permission } = require('../models');

const getRolePermissions = async (req, res) => {
    try {
        const { id } = req.params;

        const role = await Role.findByPk(id, {
            include: [
                {
                    model: Permission,
                    as: 'permissions',
                    through: {
                        attributes: []
                    }
                }
            ]
        });

        if (!role) {
            return res.status(404).json({
                message: 'Role not found'
            });
        }

        return res.status(200).json({
            message: 'Role permissions retrieved successfully',
            data: role
        });
    } catch (error) {
        console.error(error);

        return res.status(500).json({
            message: 'Failed to retrieve role permissions'
        });
    }
};


const updateRolePermissions = async (req, res) => {
    try {
        const { id } = req.params;
        const { permission_ids } = req.body;

        if (!Array.isArray(permission_ids)) {
            return res.status(400).json({
                message: 'permission_ids must be an array'
            });
        }

        const role = await Role.findByPk(id);

        if (!role) {
            return res.status(404).json({
                message: 'Role not found'
            });
        }

        const permissions = await Permission.findAll({
            where: {
                id: permission_ids
            }
        });

        if (permissions.length !== permission_ids.length) {
            return res.status(400).json({
                message: 'One or more permission IDs are invalid'
            });
        }

        await role.setPermissions(permission_ids);

        const updatedRole = await Role.findByPk(id, {
            include: [
                {
                    model: Permission,
                    as: 'permissions',
                    through: {
                        attributes: []
                    }
                }
            ]
        });

        return res.status(200).json({
            message: 'Role permissions updated successfully',
            data: updatedRole
        });
    } catch (error) {
        console.error(error);

        return res.status(500).json({
            message: 'Failed to update role permissions'
        });
    }
};


module.exports = {
    getRolePermissions,
    updateRolePermissions
};
