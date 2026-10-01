const { Permission } = require('../models');

const getPermissions = async (req, res) => {
    try {
        const permissions = await Permission.findAll({
            order: [['id', 'ASC']]
        });

        return res.status(200).json({
            message: 'Permissions retrieved successfully',
            data: permissions
        });
    } catch (error) {
        console.error('Get permissions error:', error);

        return res.status(500).json({
            message: 'Failed to retrieve permissions'
        });
    }
};

const getPermissionById = async (req, res) => {
    try {
        const permission = await Permission.findByPk(req.params.id);

        if (!permission) {
            return res.status(404).json({
                message: 'Permission not found'
            });
        }

        return res.status(200).json({
            message: 'Permission retrieved successfully',
            data: permission
        });
    } catch (error) {
        console.error('Get permission error:', error);

        return res.status(500).json({
            message: 'Failed to retrieve permission'
        });
    }
};

module.exports = {
    getPermissions,
    getPermissionById
};
