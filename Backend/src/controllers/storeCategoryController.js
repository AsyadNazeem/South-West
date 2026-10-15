
const { Category } = require('../models');

async function getStoreCategories(req, res) {
    try {
        const categories = await Category.findAll({
            where: {
                is_active: true,
                parent_id: null,
            },
            attributes: ['id', 'name', 'code', 'description', 'parent_id'],
            include: [
                {
                    model: Category,
                    as: 'children',
                    attributes: ['id', 'name', 'code', 'description', 'parent_id'],
                    where: { is_active: true },
                    required: false,
                    separate: false,
                    order: [['name', 'ASC']],
                },
            ],
            order: [['name', 'ASC']],
        });

        return res.status(200).json({
            success: true,
            message: 'Store categories retrieved successfully',
            data: categories,
        });
    } catch (error) {
        console.error('Get store categories failed:', {
            name: error.name,
            code: error.original?.code || error.parent?.code,
        });

        return res.status(500).json({
            success: false,
            message: 'Unable to retrieve store categories',
        });
    }
}

module.exports = { getStoreCategories };
