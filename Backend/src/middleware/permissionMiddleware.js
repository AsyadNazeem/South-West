const { User, Role, Permission } = require('../models');

function requirePermission(permissionName) {
    return async (req, res, next) => {
        try {
            if (!req.user) {
                return res.status(401).json({
                    message: 'Authentication required'
                });
            }

            const user = await User.findByPk(req.user.id, {
                include: [
                    {
                        model: Role,
                        as: 'roles',
                        include: [
                            {
                                model: Permission,
                                as: 'permissions'
                            }
                        ]
                    }
                ]
            });

            if (!user) {
                return res.status(401).json({
                    message: 'User not found'
                });
            }

            const permissions = new Set(
                user.roles.flatMap((role) =>
                    role.permissions.map((permission) => permission.name)
                )
            );

            req.permissions = permissions;

            if (!permissions.has(permissionName)) {
                return res.status(403).json({
                    code: 'PERMISSION_DENIED',
                    message: 'Permission denied'
                });
            }

            next();
        } catch (error) {
            console.error('Permission middleware error:', error);

            return res.status(500).json({
                message: 'Unable to verify permission'
            });
        }
    };
}

module.exports = requirePermission;
