const { Category } = require('../models');

const getCategories = async (req, res) => {
    try {
        const categories = await Category.findAll({
            include: [
                {
                    model: Category,
                    as: 'parent',
                    attributes: ['id', 'name', 'code']
                },
                {
                    model: Category,
                    as: 'children',
                    attributes: ['id', 'name', 'code', 'parent_id']
                }
            ],
            order: [['id', 'ASC']]
        });

        res.status(200).json({
            message: 'Categories retrieved successfully',
            data: categories
        });
    } catch (error) {
        console.error('Get categories error:', error);

        res.status(500).json({
            message: 'Failed to retrieve categories'
        });
    }
};


const getCategoryById = async (req, res) => {
    try {
        const { id } = req.params;

        const category = await Category.findByPk(id, {
            include: [
                {
                    model: Category,
                    as: 'parent',
                    attributes: ['id', 'name', 'code']
                },
                {
                    model: Category,
                    as: 'children',
                    attributes: ['id', 'name', 'code', 'parent_id']
                }
            ]
        });

        if (!category) {
            return res.status(404).json({
                message: 'Category not found'
            });
        }

        res.status(200).json({
            message: 'Category retrieved successfully',
            data: category
        });
    } catch (error) {
        console.error('Get category error:', error);

        res.status(500).json({
            message: 'Failed to retrieve category'
        });
    }
};


const createCategory = async (req, res) => {
    try {
        const {
            name,
            code,
            description,
            parent_id
        } = req.body;

        if (!name || !code) {
            return res.status(400).json({
                message: 'Name and code are required'
            });
        }

        const existingName = await Category.findOne({
            where: { name }
        });

        if (existingName) {
            return res.status(409).json({
                message: 'Category name already exists'
            });
        }

        const existingCode = await Category.findOne({
            where: { code }
        });

        if (existingCode) {
            return res.status(409).json({
                message: 'Category code already exists'
            });
        }

        if (parent_id) {
            const parentCategory = await Category.findByPk(parent_id);

            if (!parentCategory) {
                return res.status(404).json({
                    message: 'Parent category not found'
                });
            }
        }

        const category = await Category.create({
            name,
            code,
            description,
            parent_id: parent_id || null
        });

        res.status(201).json({
            message: 'Category created successfully',
            data: category
        });
    } catch (error) {
        console.error('Create category error:', error);

        res.status(500).json({
            message: 'Failed to create category'
        });
    }
};


const updateCategory = async (req, res) => {
    try {
        const { id } = req.params;

        const category = await Category.findByPk(id);

        if (!category) {
            return res.status(404).json({
                message: 'Category not found'
            });
        }

        const {
            name,
            code,
            description,
            parent_id,
            is_active
        } = req.body;

        if (name && name !== category.name) {
            const existingName = await Category.findOne({
                where: { name }
            });

            if (existingName) {
                return res.status(409).json({
                    message: 'Category name already exists'
                });
            }
        }

        if (code && code !== category.code) {
            const existingCode = await Category.findOne({
                where: { code }
            });

            if (existingCode) {
                return res.status(409).json({
                    message: 'Category code already exists'
                });
            }
        }

        if (parent_id !== undefined && parent_id !== null) {
            if (Number(parent_id) === Number(id)) {
                return res.status(400).json({
                    message: 'Category cannot be its own parent'
                });
            }

            const parentCategory = await Category.findByPk(parent_id);

            if (!parentCategory) {
                return res.status(404).json({
                    message: 'Parent category not found'
                });
            }
        }

        await category.update({
            name: name ?? category.name,
            code: code ?? category.code,
            description: description ?? category.description,
            parent_id: parent_id !== undefined ? parent_id : category.parent_id,
            is_active: is_active !== undefined ? is_active : category.is_active
        });

        res.status(200).json({
            message: 'Category updated successfully',
            data: category
        });
    } catch (error) {
        console.error('Update category error:', error);

        res.status(500).json({
            message: 'Failed to update category'
        });
    }
};


const deleteCategory = async (req, res) => {
    try {
        const { id } = req.params;

        const category = await Category.findByPk(id);

        if (!category) {
            return res.status(404).json({
                message: 'Category not found'
            });
        }

        const childCategories = await Category.count({
            where: {
                parent_id: id
            }
        });

        if (childCategories > 0) {
            return res.status(409).json({
                message: 'Cannot delete category with child categories'
            });
        }

        await category.destroy();

        res.status(200).json({
            message: 'Category deleted successfully'
        });
    } catch (error) {
        console.error('Delete category error:', error);

        res.status(500).json({
            message: 'Failed to delete category'
        });
    }
};


module.exports = {
    getCategories,
    getCategoryById,
    createCategory,
    updateCategory,
    deleteCategory
};
