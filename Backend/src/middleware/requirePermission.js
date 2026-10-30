
'use strict';

const { User, Role, Permission } = require('../models');

async function getRequestPermissions(req) {
    // Reuse the database lookup if this request checks multiple permissions.
    if (!req.authorizationPermissionsPromise) {
        req.authorizationPermissionsPromise = (async () => {
            const user = await User.findByPk(req.user.id, {
                attributes: ['id', 'is_active'],
                include: [
                    {
                        model: Role,
                        as: 'roles',
                        through: { attributes: [] },
                        include: [
                            {
                                model: Permission,
                                as: 'permissions',
                                through: { attributes: [] }
                            }
                        ]
                    }
                ]
            });

            if (!user || !user.is_active) {
                const error = new Error('User is unavailable');
                error.status = 401;
                throw error;
            }

            return new Set(
                (user.roles || []).flatMap(role =>
                    (role.permissions || []).map(permission => permission.name)
                )
            );
        })();
    }

    return req.authorizationPermissionsPromise;
}

function requirePermission(permissionName) {
    return async (req, res, next) => {
        try {
            if (!req.user?.id) {
                return res.status(401).json({
                    message: 'Authentication required'
                });
            }

            if (
                typeof permissionName !== 'string' ||
                !permissionName.trim()
            ) {
                console.error('Invalid permission configuration');

                return res.status(500).json({
                    message: 'Unable to verify permission'
                });
            }

            const permissions = await getRequestPermissions(req);
            req.permissions = permissions;

            if (!permissions.has(permissionName)) {
                return res.status(403).json({
                    code: 'PERMISSION_DENIED',
                    message: 'Permission denied'
                });
            }

            return next();
        } catch (error) {
            if (error.status === 401) {
                return res.status(401).json({
                    message: error.message
                });
            }

            console.error('Permission verification failed:', error.message);

            return res.status(500).json({
                message: 'Unable to verify permission'
            });
        }
    };
}

module.exports = { requirePermission };
