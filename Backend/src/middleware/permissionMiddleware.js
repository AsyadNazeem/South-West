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

            const hasPermission = user.roles.some(role =>
                role.permissions.some(
                    permission => permission.name === permissionName
                )
            );

            if (!hasPermission) {
                return res.status(403).json({
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
