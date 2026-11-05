const { Op, Sequelize } = require('sequelize');

const {
    sequelize,
    Item,
    Brand,
    Category,
    Unit,
    ItemType,
    Warranty,
    ItemSpecificationValue,
    ItemSpecification
} = require('../models');
const { recordAuditLog } = require('../services/auditLogService');
const { generateItemCode } = require('../services/itemCodeService');
const { randomUUID } = require('crypto');

const getItems = async (req, res) => {
    try {
        if (req.query.paginate === '1') {
            const requestedPageSize = Number.parseInt(
                req.query.pageSize ?? req.query.limit,
                10
            );
            const pageSize = Number.isInteger(requestedPageSize) && requestedPageSize > 0
                ? Math.min(requestedPageSize, 100)
                : 25;
            const requestedPage = Number.parseInt(req.query.page, 10);
            const page = Number.isInteger(requestedPage) && requestedPage > 0
                ? requestedPage
                : 1;
            const offset = (page - 1) * pageSize;
            const where = {};
            const search = String(req.query.search || '').trim();
            const status = String(req.query.status || 'all');
            const condition = String(req.query.condition || 'all');
            const categoryId = String(req.query.categoryId || '').trim();
            const brandId = String(req.query.brandId || '').trim();
            const sortableFields = new Set([
                'id',
                'item_code',
                'item_name',
                'condition',
                'is_active',
            ]);
            const requestedSort = String(req.query.sortBy || 'id');
            const sortBy = sortableFields.has(requestedSort)
                ? requestedSort
                : 'id';
            const sortOrder = String(req.query.sortOrder || 'DESC').toUpperCase() === 'ASC'
                ? 'ASC'
                : 'DESC';
            const order = sortBy === 'id'
                ? [['id', sortOrder]]
                : [[sortBy, sortOrder], ['id', 'DESC']];

            if (status === 'active') where.is_active = true;
            if (status === 'inactive') where.is_active = false;
            if (['new', 'used', 'refurbished'].includes(condition)) {
                where.condition = condition;
            }
            if (/^[1-9]\d*$/.test(categoryId)) {
                where.category_id = categoryId;
            }
            if (/^[1-9]\d*$/.test(brandId)) {
                where.brand_id = brandId;
            }

            if (search) {
                const pattern = `%${search}%`;
                where[Op.or] = [
                    { item_code: { [Op.like]: pattern } },
                    { item_name: { [Op.like]: pattern } },
                    Sequelize.where(Sequelize.col('category.name'), {
                        [Op.like]: pattern,
                    }),
                    Sequelize.where(Sequelize.col('brand.name'), {
                        [Op.like]: pattern,
                    }),
                ];
            }

            const result = await Item.findAndCountAll({
                where,
                attributes: [
                    'id',
                    'item_code',
                    'item_name',
                    'condition',
                    'is_serialized',
                    'is_active',
                ],
                include: [
                    {
                        model: Brand,
                        as: 'brand',
                        attributes: ['id', 'name'],
                    },
                    {
                        model: Category,
                        as: 'category',
                        attributes: ['id', 'name'],
                    },
                ],
                order,
                limit: pageSize,
                offset,
                distinct: true,
                col: 'id',
                subQuery: false,
            });

            const totalPages = Math.ceil(result.count / pageSize);

            return res.status(200).json({
                message: 'Item retrieved successfully',
                data: result.rows,
                pagination: {
                    total: result.count,
                    page,
                    pageSize,
                    totalPages,
                },
            });
        }

        const items = await Item.findAll({
            include: [
                {
                    model: Brand,
                    as: 'brand'
                },
                {
                    model: Category,
                    as: 'category'
                },
                {
                    model: Unit,
                    as: 'unitOfMeasure'
                },
                {
                    model: ItemType,
                    as: 'itemType'
                },
                {
                    model: Warranty,
                    as: 'warranty'
                }
            ]
        });

        return res.status(200).json({
            message: 'Item retrieved successfully',
            data: items
        });

    } catch (error) {
        console.error('Get Item error:', error);

        return res.status(500).json({
            message: 'Failed to retrieve Item'
        });
    }
};

const getItemFilterOptions = async (req, res) => {
    try {
        const [categories, brands] = await Promise.all([
            Category.findAll({
                attributes: ['id', 'name'],
                order: [['name', 'ASC']],
                raw: true,
            }),
            Brand.findAll({
                attributes: ['id', 'name'],
                order: [['name', 'ASC']],
                raw: true,
            }),
        ]);

        return res.status(200).json({
            data: { categories, brands },
        });
    } catch (error) {
        console.error('Product filter options loading error:', error);
        return res.status(500).json({
            message: 'Failed to retrieve product filter options',
        });
    }
};

const getItemById = async (req, res) => {
    try {
        const { id } = req.params;

        const item = await Item.findByPk(id, {
            include: [
                {
                    model: Brand,
                    as: 'brand'
                },
                {
                    model: Category,
                    as: 'category'
                },
                {
                    model: Unit,
                    as: 'unitOfMeasure'
                },
                {
                    model: ItemType,
                    as: 'itemType'
                },
                {
                    model: Warranty,
                    as: 'warranty'
                },
                {
                    model: ItemSpecificationValue,
                    as: 'specificationValues',
                    include: [
                        {
                            model: ItemSpecification,
                            as: 'specification'
                        }
                    ]
                }
            ]
        });

        if (!item) {
            return res.status(404).json({
                message: 'Item not found'
            });
        }

        return res.status(200).json({
            message: 'Item retrieved successfully',
            data: item
        });

    } catch (error) {
        console.error('Get Item By ID error:', error);

        return res.status(500).json({
            message: 'Failed to retrieve item',
            error: error.message
        });
    }
};

const createItem = async (req, res) => {
    const transaction = await sequelize.transaction();

    try {
       const {
    category_id,
    brand_id,
    unit_id,
    item_type_id,
    warranty_id,
    item_name,
    description,
    shipping_weight,
    shipping_weight_unit,
    condition,
    is_serialized,
    is_active
} = req.body;

      if (!item_name || !item_name.trim()) {
    await transaction.rollback();

    return res.status(400).json({
        message: 'item_name is required'
    });
}

const item_code = await generateItemCode(transaction);

const public_id = randomUUID();

const slugBase = item_name
    .trim()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 180)
    .replace(/-+$/g, '') || 'product';

let slug = slugBase;
let suffix = 2;

while (await Item.findOne({
    where: { slug },
    transaction,
    attributes: ['id'],
})) {
    slug = `${slugBase}-${suffix++}`;
}

        const item = await Item.create({
            category_id: category_id || null,
            brand_id: brand_id || null,
            unit_id: unit_id || null,
            item_type_id: item_type_id || null,
            warranty_id: warranty_id || null,

           item_code,
               public_id,
    slug,
qb_item_code: null,
item_name: item_name.trim(),

            description: description || null,

            shipping_weight:
                shipping_weight !== undefined && shipping_weight !== null
                    ? shipping_weight
                    : null,

            shipping_weight_unit:
                shipping_weight_unit || 'kg',

            condition: condition || 'new',

            is_serialized:
                is_serialized ?? false,

            is_active:
                is_active ?? true
        });

        await recordAuditLog({
            userId: req.user ? (req.user.id ?? req.user.userId) : null,
            action: 'ITEM_CREATED',
            module: 'items',
            entityType: 'item',
            entityId: item.id,
            description: `Item ${item.item_code} created`,
            newValues: {
                item_code: item.item_code,
                item_name: item.item_name,
                category_id: item.category_id,
                brand_id: item.brand_id,
                unit_id: item.unit_id,
                item_type_id: item.item_type_id,
                warranty_id: item.warranty_id
            },
            ipAddress: req.ip || null,
            userAgent: req.get('user-agent') || null,
            requestId: req.id || null,

            transaction
        });

        const createdItem = await Item.findByPk(item.id, {
            include: [
                {
                    model: Brand,
                    as: 'brand'
                },
                {
                    model: Category,
                    as: 'category'
                },
                {
                    model: Unit,
                    as: 'unitOfMeasure'
                },
                {
                    model: Warranty,
                    as: 'warranty'
                },
                {
                    model: ItemType,
                    as: 'itemType'
                }
            ]
        });

        await transaction.commit();

        return res.status(201).json({
            message: 'Item created successfully',
            data: createdItem
        });

    } catch (error) {
        console.error('Create item error:', error);

        if (!transaction.finished) {
            await transaction.rollback();
        }

        return res.status(500).json({
            message: 'Failed to create item'
        });
    }
};

const updateItem = async (req, res) => {
    const transaction = await sequelize.transaction();
    try {
        const { id } = req.params

        const item = await Item.findByPk(id)

        if (!item) {
            return res.status(404).json({
                message: 'Item not found'
            })
        }

       const {
    category_id,
    brand_id,
    unit_id,
    item_type_id,
    warranty_id,
    item_name,
            description,
            shipping_weight,
            shipping_weight_unit,
            condition,
            is_serialized,
            is_active
        } = req.body

        const oldValues = {
            item_code: item.item_code,
            item_name: item.item_name,
            category_id: item.category_id,
            brand_id: item.brand_id,
            unit_id: item.unit_id,
            item_type_id: item.item_type_id,
            warranty_id: item.warranty_id
        };

        await item.update({
            category_id: category_id !== undefined
                ? category_id
                : item.category_id,

            brand_id: brand_id !== undefined
                ? brand_id
                : item.brand_id,

            unit_id: unit_id !== undefined
                ? unit_id
                : item.unit_id,

            item_type_id: item_type_id !== undefined
                ? item_type_id
                : item.item_type_id,

            warranty_id: warranty_id !== undefined
                ? warranty_id
                : item.warranty_id,

            // Item Code is system-generated and cannot be changed here.
// QuickBooks item codes are no longer managed by this application.
            qb_item_code: null,

            item_name: item_name !== undefined
                ? item_name
                : item.item_name,

            description: description !== undefined
                ? description
                : item.description,

            shipping_weight: shipping_weight !== undefined
                ? shipping_weight
                : item.shipping_weight,

            shipping_weight_unit: shipping_weight_unit !== undefined
                ? shipping_weight_unit
                : item.shipping_weight_unit,

            condition: condition !== undefined
                ? condition
                : item.condition,

            is_serialized: is_serialized !== undefined
                ? is_serialized
                : item.is_serialized,

            is_active: is_active !== undefined
                ? is_active
                : item.is_active
        })

        await recordAuditLog({
            userId: req.user ? (req.user.id ?? req.user.userId) : null,
            action: 'ITEM_UPDATED',
            module: 'items',
            entityType: 'item',
            entityId: item.id,
            description: `Item ${item.item_code} updated`,
            oldValues,
            newValues: {
                item_code: item.item_code,
                item_name: item.item_name,
                category_id: item.category_id,
                brand_id: item.brand_id,
                unit_id: item.unit_id,
                item_type_id: item.item_type_id,
                warranty_id: item.warranty_id
            },
            ipAddress: req.ip || null,
            userAgent: req.get('user-agent') || null,
            requestId: req.id || null,

            transaction
        });

        const updatedItem = await Item.findByPk(id, {
            include: [
                {
                    model: Brand,
                    as: 'brand'
                },
                {
                    model: Category,
                    as: 'category'
                },
                {
                    model: Unit,
                    as: 'unitOfMeasure'
                },
                {
                    model: Warranty,
                    as: 'warranty'
                },
                {
                    model: ItemType,
                    as: 'itemType'
                }
            ]
        })

        await transaction.commit();

        return res.status(200).json({
            message: 'Item updated successfully',
            data: updatedItem
        })

    } catch (error) {
        console.error('Update item error:', error)

        if (!transaction.finished) {
            await transaction.rollback();
        }

        return res.status(500).json({
            message: 'Failed to update item'
        })
    }
}


module.exports = {
    getItems,
    getItemFilterOptions,
    getItemById,
    createItem,
    updateItem
};
