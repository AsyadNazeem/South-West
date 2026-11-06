const { Op, QueryTypes } = require('sequelize');

const {
    sequelize,
    Category,
    Item,
    PromotionCategory
} = require('../models');
const { removeStoredImage } = require('../utils/fileStorage');
const { recordAuditLog } = require('../services/auditLogService');

const MAX_CATEGORY_ID = '18446744073709551615';

function isValidId(id) {
    if (
        (typeof id !== 'string' && typeof id !== 'number') ||
        !/^[1-9]\d*$/.test(String(id))
    ) {
        return false;
    }

    const value = String(id);

    return (
        value.length < MAX_CATEGORY_ID.length ||
        (value.length === MAX_CATEGORY_ID.length &&
            value <= MAX_CATEGORY_ID)
    );
}

function isPlainObject(value) {
    return (
        value !== null &&
        typeof value === 'object' &&
        !Array.isArray(value)
    );
}

function validateText(value, field, maxLength, required = false) {
    if (value === undefined) {
        return required ? `${field} is required` : null;
    }

    if (typeof value !== 'string') {
        return `${field} must be a string`;
    }

    if (required && !value.trim()) {
        return `${field} is required`;
    }

    if (value.trim().length > maxLength) {
        return `${field} must not exceed ${maxLength} characters`;
    }

    return null;
}

function validateDescription(value) {
    if (value === undefined || value === null) {
        return null;
    }

    if (typeof value !== 'string') {
        return 'Description must be a string or null';
    }

    if (Buffer.byteLength(value, 'utf8') > 65535) {
        return 'Description is too long';
    }

    return null;
}

function validateActive(value) {
    return (
        typeof value === 'boolean' ||
        value === 0 ||
        value === 1 ||
        value === 'true' ||
        value === 'false' ||
        value === '0' ||
        value === '1'
    );
}

function sendValidationError(res, message) {
    return res.status(400).json({
        success: false,
        message
    });
}

function handleCategoryError(res, error, operation) {
    const dbCode = error.original?.code || error.parent?.code;

    console.error(`${operation} failed:`, {
        name: error.name,
        code: dbCode
    });

    if (
        error.name === 'SequelizeUniqueConstraintError' ||
        dbCode === 'ER_DUP_ENTRY'
    ) {
        return res.status(409).json({
            success: false,
            message: 'Category name or code already exists'
        });
    }

    if (error.name === 'SequelizeForeignKeyConstraintError') {
        return res.status(409).json({
            success: false,
            message: 'Category is referenced by another record'
        });
    }

    if (
        error.name === 'SequelizeValidationError' ||
        dbCode === 'ER_DATA_TOO_LONG'
    ) {
        return res.status(400).json({
            success: false,
            message: 'Invalid category data'
        });
    }

    return res.status(500).json({
        success: false,
        message: 'An internal server error occurred'
    });
}

async function validateParent(parentId, categoryId = null) {
    if (parentId === undefined || parentId === null) {
        return { error: null, parent: null };
    }

    if (!isValidId(parentId)) {
        return { error: 'Invalid parent category ID', parent: null };
    }

    if (
        categoryId !== null &&
        String(parentId) === String(categoryId)
    ) {
        return {
            error: 'Category cannot be its own parent',
            parent: null
        };
    }

    const parent = await Category.findByPk(parentId);

    if (!parent) {
        return { error: 'Parent category not found', parent: null };
    }

    if (!parent.is_active) {
        return {
            error: 'Cannot assign an inactive parent category',
            parent: null
        };
    }

    // Walk up the parent chain to prevent indirect cycles.
    const visited = new Set(
        categoryId === null ? [] : [String(categoryId)]
    );

    let current = parent;

    while (current) {
        const currentId = String(current.id);

        if (visited.has(currentId)) {
            return {
                error: 'This parent would create a category cycle',
                parent: null
            };
        }

        visited.add(currentId);

        if (current.parent_id === null) {
            break;
        }

        current = await Category.findByPk(current.parent_id);

        if (!current) {
            break;
        }
    }

    return { error: null, parent };
}

// GET ALL CATEGORIES
const getCategories = async (req, res) => {
    try {
        const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
        const pageSize = Math.min(100, Math.max(1, Number.parseInt(req.query.pageSize ?? req.query.limit, 10) || 25));
        const paginationEnabled = req.query.page !== undefined || req.query.pageSize !== undefined || req.query.limit !== undefined;
        const search = String(req.query.search || '').trim();
        const where = {};
        if (search) where[Op.or] = [
            { name: { [Op.like]: `%${search}%` } },
            { code: { [Op.like]: `%${search}%` } },
            { '$parent.name$': { [Op.like]: `%${search}%` } },
        ];
        if (req.query.status === 'active') where.is_active = true;
        if (req.query.status === 'inactive') where.is_active = false;
        const result = await Category.findAndCountAll({
            where,
            include: [
                {
                    model: Category,
                    as: 'parent',
                    attributes: ['id', 'name', 'code']
                }
            ],
            order: [['id', 'ASC']], limit: paginationEnabled ? pageSize : undefined, offset: paginationEnabled ? (page - 1) * pageSize : undefined, distinct: true
        });
        const categories = result.rows;

        const counts = await Item.count({
            attributes: ['category_id'],
            group: ['category_id']
        });

        const countMap = {};

        counts.forEach(row => {
            countMap[String(row.category_id)] = Number(row.count);
        });

        const data = categories.map(category => {
            const row = category.toJSON();

            return {
                ...row,
                category_code: row.code,
                category_name: row.name,
                parent_category_name: row.parent?.name || '',
                product_count: countMap[String(row.id)] || 0,
                status: row.is_active ? 'active' : 'inactive'
            };
        });

        return res.status(200).json({
            success: true,
            message: 'Categories retrieved successfully',
            data,
            pagination: { page, pageSize, total: result.count, totalPages: Math.ceil(result.count / pageSize) }
        });
    } catch (error) {
        return handleCategoryError(res, error, 'Get categories');
    }
};

// GET CATEGORY BY ID
const getCategoryById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!isValidId(id)) {
            return sendValidationError(res, 'Invalid category ID');
        }

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
                success: false,
                message: 'Category not found'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Category retrieved successfully',
            data: category
        });
    } catch (error) {
        return handleCategoryError(res, error, 'Get category');
    }
};

// CREATE CATEGORY

const createCategory = async (req, res) => {
    try {
        if (!isPlainObject(req.body)) {
            return sendValidationError(
                res,
                'Request body must be a JSON object'
            );
        }

        const { name, description, parent_id } = req.body;

        // Accept code temporarily for backward compatibility, but ignore it.
        const allowedFields = [
            'name',
            'code',
            'description',
            'parent_id',
            'is_active'
        ];

        const unexpected = Object.keys(req.body).find(
            field => !allowedFields.includes(field)
        );

        if (unexpected) {
            return sendValidationError(
                res,
                `Unsupported field: ${unexpected}`
            );
        }

        let error = validateText(name, 'Name', 100, true);
        if (error) return sendValidationError(res, error);

        error = validateDescription(description);
        if (error) return sendValidationError(res, error);

        const normalizedName = name.trim();

        const existingName = await Category.findOne({
            where: { name: normalizedName }
        });

        if (existingName) {
            return res.status(409).json({
                success: false,
                message: 'Category name already exists'
            });
        }

        const normalizedParentId =
            parent_id === '' ||
            parent_id === undefined ||
            parent_id === null
                ? null
                : parent_id;

        const parentResult = await validateParent(normalizedParentId);

        if (parentResult.error) {
            return parentResult.error === 'Parent category not found'
                ? res.status(404).json({
                    success: false,
                    message: parentResult.error
                })
                : sendValidationError(res, parentResult.error);
        }

        const imageUrl = req.file
            ? `/uploads/${req.file.relativePath}`
            : null;

        const category = await sequelize.transaction(
            async transaction => {
                // Lock the sequence row so concurrent requests
                // cannot receive the same category code.
                const sequences = await sequelize.query(
                    `SELECT next_value
                     FROM category_code_sequences
                     WHERE id = 1
                     FOR UPDATE`,
                    {
                        type: QueryTypes.SELECT,
                        transaction
                    }
                );

                if (!sequences.length) {
                    throw new Error(
                        'Category code sequence is not initialized'
                    );
                }

                const nextValue = Number(sequences[0].next_value);

                if (
                    !Number.isSafeInteger(nextValue) ||
                    nextValue < 1
                ) {
                    throw new Error(
                        'Category code sequence value is invalid'
                    );
                }

                const generatedCode =
                    `CAT-${String(nextValue).padStart(4, '0')}`;

                await sequelize.query(
                    `UPDATE category_code_sequences
                     SET next_value = next_value + 1
                     WHERE id = 1`,
                    { transaction }
                );

                const created = await Category.create(
                    {
                        name: normalizedName,
                        code: generatedCode,
                        description: description ?? null,
                        parent_id: normalizedParentId,
                        image_url: imageUrl
                    },
                    { transaction }
                );
                await recordAuditLog({ userId: req.user?.id ?? null, action: 'CATEGORY_CREATED', module: 'categories', entityType: 'Category', entityId: created.id, description: `Created category ${created.name}`, newValues: { name: created.name, code: created.code, description: created.description, parent_id: created.parent_id, is_active: created.is_active }, ipAddress: req.ip, userAgent: req.get('user-agent') || null, requestId: req.id || null, transaction });
                return created;
            }
        );

        return res.status(201).json({
            success: true,
            message: 'Category created successfully',
            data: category
        });
    } catch (error) {
        return handleCategoryError(
            res,
            error,
            'Create category'
        );
    }
};


// UPDATE CATEGORY
const updateCategory = async (req, res) => {
    try {
        const { id } = req.params;

        if (!isValidId(id)) {
            return sendValidationError(res, 'Invalid category ID');
        }

        if (!isPlainObject(req.body)) {
            return sendValidationError(
                res,
                'Request body must be a JSON object'
            );
        }

const allowedFields = [
    'name',
    'code',
    'description',
    'parent_id',
    'is_active',
    'image_url',
];

        const unexpected = Object.keys(req.body).find(
            field => !allowedFields.includes(field)
        );

        if (unexpected) {
            return sendValidationError(res, `Unsupported field: ${unexpected}`);
        }

if (Object.keys(req.body).length === 0 && !req.file) {
            return sendValidationError(
                res,
                'Provide at least one field to update'
            );
        }

        const category = await Category.findByPk(id);

        if (!category) {
            return res.status(404).json({
                success: false,
                message: 'Category not found'
            });
        }

        const { name, code, description, parent_id, is_active } = req.body;

        if (name !== undefined) {
            const error = validateText(name, 'Name', 100, true);
            if (error) return sendValidationError(res, error);
        }

        if (code !== undefined) {
            const error = validateText(code, 'Code', 50, true);
            if (error) return sendValidationError(res, error);
        }

        if (description !== undefined) {
            const error = validateDescription(description);
            if (error) return sendValidationError(res, error);
        }

        if (is_active !== undefined && !validateActive(is_active)) {
            return sendValidationError(
                res,
                'is_active must be true, false, 1, or 0'
            );
        }

        const normalizedName =
            name === undefined ? category.name : name.trim();

        const normalizedCode =
            code === undefined ? category.code : code.trim();

        if (name !== undefined && normalizedName !== category.name) {
            const existingName = await Category.findOne({
                where: {
                    name: normalizedName,
                    id: { [Op.ne]: category.id }
                }
            });

            if (existingName) {
                return res.status(409).json({
                    success: false,
                    message: 'Category name already exists'
                });
            }
        }

        if (code !== undefined && normalizedCode !== category.code) {
            const existingCode = await Category.findOne({
                where: {
                    code: normalizedCode,
                    id: { [Op.ne]: category.id }
                }
            });

            if (existingCode) {
                return res.status(409).json({
                    success: false,
                    message: 'Category code already exists'
                });
            }
        }

const normalizedParentId =
    parent_id === '' || parent_id === null
        ? null
        : parent_id;

if (parent_id !== undefined) {
    const parentResult = await validateParent(
        normalizedParentId,
        category.id
    );

    if (parentResult.error) {
        return parentResult.error === 'Parent category not found'
            ? res.status(404).json({
                success: false,
                message: parentResult.error
            })
            : sendValidationError(res, parentResult.error);
    }
}

const isDeactivating =
    is_active === false ||
    is_active === 0 ||
    is_active === 'false' ||
    is_active === '0';

if (isDeactivating) {
            const [childCount, itemCount] = await Promise.all([
                Category.count({
                    where: { parent_id: category.id }
                }),
                Item.count({
                    where: { category_id: category.id }
                })
            ]);

            if (childCount > 0 || itemCount > 0) {
                return res.status(409).json({
                    success: false,
                    message: 'Cannot deactivate a category with child categories or assigned items'
                });
            }
        }

const previousImageUrl = category.image_url;
const updates = {};

if (name !== undefined) {
    updates.name = normalizedName;
}

if (code !== undefined) {
    updates.code = normalizedCode;
}

if (description !== undefined) {
    updates.description = description;
}

if (parent_id !== undefined) {
    updates.parent_id = normalizedParentId;
}

if (is_active !== undefined) {
    updates.is_active =
        is_active === true ||
        is_active === 1 ||
        is_active === 'true' ||
        is_active === '1';
}

// Only replace the image when a new file was uploaded.
if (req.file) {
    updates.image_url = `/uploads/${req.file.relativePath}`;
}

const oldValues = category.toJSON();
await category.update(updates);
await recordAuditLog({ userId: req.user?.id ?? null, action: 'CATEGORY_UPDATED', module: 'categories', entityType: 'Category', entityId: category.id, description: `Updated category ${category.name}`, oldValues, newValues: category.toJSON(), ipAddress: req.ip, userAgent: req.get('user-agent') || null, requestId: req.id || null });

if (
    req.file &&
    previousImageUrl &&
    previousImageUrl !== category.image_url
) {
    const cleanup = await removeStoredImage(previousImageUrl);
    if (cleanup.status === 'failed') {
        console.error('Category image cleanup requires follow-up.');
    }
}

        return res.status(200).json({
            success: true,
            message: 'Category updated successfully',
            data: category
        });
    } catch (error) {
        return handleCategoryError(res, error, 'Update category');
    }
};

// DELETE CATEGORY
const deleteCategory = async (req, res) => {
    try {
        const { id } = req.params;

        if (!isValidId(id)) {
            return sendValidationError(res, 'Invalid category ID');
        }

        const category = await Category.findByPk(id);

        if (!category) {
            return res.status(404).json({
                success: false,
                message: 'Category not found'
            });
        }

        const [childCount, itemCount, promotionCount] = await Promise.all([
            Category.count({
                where: { parent_id: category.id }
            }),
            Item.count({
                where: { category_id: category.id }
            }),
            PromotionCategory.count({
                where: { category_id: category.id }
            })
        ]);

        if (childCount > 0 || itemCount > 0 || promotionCount > 0) {
            return res.status(409).json({
                success: false,
                message: 'Cannot delete a category that has child categories, assigned items, or promotion records'
            });
        }

        const imageUrl = category.image_url;
        const oldValues = category.toJSON();
        await category.destroy();
        await recordAuditLog({ userId: req.user?.id ?? null, action: 'CATEGORY_DELETED', module: 'categories', entityType: 'Category', entityId: category.id, description: `Deleted category ${category.name}`, oldValues, ipAddress: req.ip, userAgent: req.get('user-agent') || null, requestId: req.id || null });

        if (imageUrl) {
            const cleanup = await removeStoredImage(imageUrl);
            if (cleanup.status === 'failed') {
                console.error('Category image cleanup requires follow-up.');
            }
        }

        return res.status(200).json({
            success: true,
            message: 'Category deleted successfully'
        });
    } catch (error) {
        return handleCategoryError(res, error, 'Delete category');
    }
};

module.exports = {
    getCategories,
    getCategoryById,
    createCategory,
    updateCategory,
    deleteCategory
};
