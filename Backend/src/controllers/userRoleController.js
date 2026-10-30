'use strict';

const { UserRole, User, Role } = require('../models');
const { recordAuditLog } = require('../services/auditLogService');

const AUDIT_MODULE = 'USER_ROLE';

const getActorId = (req) =>
    req.user?.id ?? req.user?.user_id ?? req.user?.userId ?? null;

const auditUserRole = async (
    req,
    {
        action,
        entityId = null,
        description = null,
        oldValues = null,
        newValues = null
    }
) => {
    try {
        await recordAuditLog({
            userId: getActorId(req),
            action,
            module: AUDIT_MODULE,
            entityType: 'UserRole',
            entityId: entityId != null ? String(entityId) : null,
            description,
            oldValues,
            newValues,
            ipAddress: req.ip ?? null,
            userAgent: req.get('user-agent') ?? null,
            requestId: req.id ?? req.requestId ?? null
        });
    } catch (auditError) {
        console.error(
            'User role audit logging failed:',
            auditError.message
        );
    }
};

const getUserRoleIncludes = () => [
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
];

const getUserRoleSnapshot = (userRole) => {
    if (!userRole) return null;

    return {
        id: userRole.id,
        user_id: userRole.user_id,
        role_id: userRole.role_id
    };
};

// GET ALL USER ROLES
exports.getAllUserRoles = async (req, res) => {
    try {
        const userRoles = await UserRole.findAll({
            include: getUserRoleIncludes(),
            order: [['id', 'ASC']]
        });

        await auditUserRole(req, {
            action: 'USER_ROLE_LIST_VIEWED',
            description: 'Retrieved user role assignments'
        });

        return res.status(200).json({
            message: 'User roles retrieved successfully',
            data: userRoles
        });
    } catch (error) {
        console.error('Get user roles error:', error);

        await auditUserRole(req, {
            action: 'USER_ROLE_LIST_FAILED',
            description: 'Failed to retrieve user role assignments'
        });

        return res.status(500).json({
            message: 'An internal server error occurred'
        });
    }
};

// GET USER ROLE BY ID
exports.getUserRoleById = async (req, res) => {
    const { id } = req.params;

    try {
        const userRole = await UserRole.findByPk(id, {
            include: getUserRoleIncludes()
        });

        if (!userRole) {
            await auditUserRole(req, {
                action: 'USER_ROLE_NOT_FOUND',
                entityId: id,
                description: 'Requested user role assignment was not found'
            });

            return res.status(404).json({
                message: 'User role not found'
            });
        }

        await auditUserRole(req, {
            action: 'USER_ROLE_VIEWED',
            entityId: userRole.id,
            description: 'Retrieved a user role assignment',
            newValues: getUserRoleSnapshot(userRole)
        });

        return res.status(200).json({
            message: 'User role retrieved successfully',
            data: userRole
        });
    } catch (error) {
        console.error('Get user role error:', error);

        await auditUserRole(req, {
            action: 'USER_ROLE_VIEW_FAILED',
            entityId: id,
            description: 'Failed to retrieve user role assignment'
        });

        return res.status(500).json({
            message: 'An internal server error occurred'
        });
    }
};

// CREATE USER ROLE — BLOCKED
exports.createUserRole = async (req, res) => {
    await auditUserRole(req, {
        action: 'USER_ROLE_CREATE_BLOCKED',
        description: 'Direct user role assignment creation was blocked'
    });

    return res.status(405).json({
        message:
            'Role assignment creation is temporarily disabled until an authorized role-assignment workflow is implemented.'
    });
};

// UPDATE USER ROLE — BLOCKED
exports.updateUserRole = async (req, res) => {
    await auditUserRole(req, {
        action: 'USER_ROLE_UPDATE_BLOCKED',
        entityId: req.params?.id ?? null,
        description: 'Direct user role assignment modification was blocked'
    });

    return res.status(405).json({
        message:
            'Role assignments cannot be modified directly. Use an authorized workflow.'
    });
};

// DELETE USER ROLE — BLOCKED
exports.deleteUserRole = async (req, res) => {
    await auditUserRole(req, {
        action: 'USER_ROLE_DELETE_BLOCKED',
        entityId: req.params?.id ?? null,
        description: 'Direct user role assignment deletion was blocked'
    });

    return res.status(405).json({
        message:
            'Role assignments cannot be deleted until an authorized revocation workflow is implemented.'
    });
};
