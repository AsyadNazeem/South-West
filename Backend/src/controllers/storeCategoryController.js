
const { Category } = require('../models');

async function getStoreCategories(req, res) {
    try {
        const allCategories = await Category.findAll({
            where: { is_active: true },
            attributes: [
                'id',
                'name',
                'code',
                'description',
                'image_url',
                'parent_id',
                'is_active',
            ],
            order: [['name', 'ASC']],
            raw: true,
        });

        // Build a category tree, including every descendant.
        const categoryMap = new Map();

        for (const category of allCategories) {
            categoryMap.set(String(category.id), {
                ...category,
                children: [],
            });
        }

        const rootCategories = [];

        for (const category of categoryMap.values()) {
            if (category.parent_id == null) {
                rootCategories.push(category);
            } else {
                const parent = categoryMap.get(
                    String(category.parent_id)
                );

                if (parent) {
                    parent.children.push(category);
                }
            }
        }

        return res.status(200).json({
            success: true,
            message: 'Store categories retrieved successfully',
            data: rootCategories,
        });
    } catch (error) {
        console.error('Get store categories failed:', {
            name: error.name,
            code: error.original?.code || error.parent?.code,
            message: error.message,
        });

        return res.status(500).json({
            success: false,
            message: 'Unable to retrieve store categories',
        });
    }
}

module.exports = { getStoreCategories };
