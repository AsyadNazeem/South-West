
'use strict';
const { recordAuditLog } = require('../services/auditLogService');

const {
    Role,
    Permission,
    UserRole,
    sequelize
} = require('../models');

const getRolePermissions = async (req, res) => {
    try {
        const { id } = req.params;

        const role = await Role.findByPk(id, {
            attributes: ['id', 'name', 'description'],
            include: [
                {
                    model: Permission,
                    as: 'permissions',
                    attributes: ['id', 'name', 'module'],
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
        console.error('Get role permissions error:', error);

        return res.status(500).json({
            message: 'Failed to retrieve role permissions'
        });
    }
};

const updateRolePermissions = async (req, res) => {
    try {
        const { id } = req.params;
        const { permission_ids } = req.body;

        if (!/^[1-9]\d*$/.test(id)) {
            return res.status(400).json({
                message: 'Invalid role ID'
            });
        }

        // Validate the request body.
        if (
            !Array.isArray(permission_ids) ||
            !permission_ids.every(
                permissionId =>
                    Number.isSafeInteger(permissionId) &&
                    permissionId > 0
            )
        ) {
            return res.status(400).json({
                message:
                    'permission_ids must be an array of positive integer IDs'
            });
        }

        // Reject duplicates instead of silently accepting them.
        if (new Set(permission_ids).size !== permission_ids.length) {
            return res.status(400).json({
                message: 'Duplicate permission IDs are not allowed'
            });
        }

        const role = await Role.findByPk(id);

        if (!role) {
            return res.status(404).json({
                message: 'Role not found'
            });
        }

        // Protect the system Admin role.
        // Protect system administrator roles.
        const normalizedRoleName = String(role.name || '')
            .trim()
            .toLowerCase()
            .replace(/[_-]+/g, ' ')
            .replace(/\s+/g, ' ');

        if (['admin', 'super admin'].includes(normalizedRoleName)) {
            return res.status(403).json({
                message: 'Protected system role permissions cannot be changed'
            });
        }

        // Prevent editing a role assigned to the requester.
        const requesterRole = await UserRole.findOne({
            where: {
                user_id: req.user.id,
                role_id: role.id
            }
        });

        if (requesterRole) {
            return res.status(403).json({
                message:
                    'You cannot modify permissions for a role assigned to your own account'
            });
        }

        // Confirm every requested permission exists.
        const permissions = await Permission.findAll({
            where: {
                id: permission_ids
            },
            attributes: ['id', 'name']
        });

        if (permissions.length !== permission_ids.length) {
            return res.status(400).json({
                message: 'One or more permission IDs are invalid'
            });
        }

        const grantsPrivilegedPermission = permissions.some(
            permission => permission.name === 'permissions.privileged.manage'
        );

        if (grantsPrivilegedPermission) {
            return res.status(403).json({
                message: 'The privileged permission cannot be delegated to another role'
            });
        }

// Fail closed if trusted permission middleware did not populate the Set.
        if (!(req.permissions instanceof Set)) {
            return res.status(403).json({
                message: 'Unable to verify your permissions'
            });
        }

        const unauthorizedPermissions = permissions.filter(
            permission => !req.permissions.has(permission.name)
        );

        if (unauthorizedPermissions.length > 0) {
            return res.status(403).json({
                message: 'You cannot grant permissions you do not possess',
                permissions: unauthorizedPermissions.map(
                    permission => permission.name
                )
            });
        }


        // Replace permissions atomically and record the audit event.
        await sequelize.transaction(async transaction => {
            const oldPermissions = await role.getPermissions({
                transaction,
                attributes: ['id', 'name']
            });

            const oldValues = oldPermissions
                .map(permission => permission.name)
                .sort();

            const newValues = permissions
                .map(permission => permission.name)
                .sort();

            await role.setPermissions(permission_ids, {
                transaction
            });

            await recordAuditLog({
                userId: req.user.id,
                action: 'ROLE_PERMISSIONS_UPDATED',
                module: 'roles',
                entityType: 'role',
                entityId: role.id,
                description: `Permissions updated for role ${role.name}`,
                oldValues: {
                    permissions: oldValues
                },
                newValues: {
                    permissions: newValues
                },
                ipAddress: req.ip || null,
                userAgent: req.get('user-agent') || null,
                requestId: req.id || null,
                transaction
            });
        });


        const updatedRole = await Role.findByPk(id, {
            attributes: ['id', 'name', 'description'],
            include: [
                {
                    model: Permission,
                    as: 'permissions',
                    attributes: ['id', 'name', 'module'],
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
        console.error('Update role permissions error:', error);

        return res.status(500).json({
            message: 'Failed to update role permissions'
        });
    }
};

module.exports = {
    getRolePermissions,
    updateRolePermissions
};
