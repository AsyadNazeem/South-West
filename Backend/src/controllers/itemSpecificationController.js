
const { ItemSpecification, ItemType, sequelize } = require('../models');
const { recordAuditLog } = require('../services/auditLogService');
const { Op, QueryTypes } = require('sequelize');

const VALID_DATA_TYPES = [
    'text',
    'number',
    'decimal',
    'boolean',
    'date',
    'select'
];

const ALLOWED_FIELDS = [
    'name',
    'code',
    'data_type',
    'unit',
    'options',
    'description',
    'is_required',
    'is_active'
];

const isValidId = id =>
    (typeof id === 'string' || typeof id === 'number') &&
    /^[1-9]\d*$/.test(String(id));

const isUniqueConstraintError = error =>
    error?.name === 'SequelizeUniqueConstraintError' ||
    error?.original?.code === 'ER_DUP_ENTRY' ||
    error?.parent?.code === 'ER_DUP_ENTRY';

const getMetadata = req => ({
    ipAddress: req.ip || null,
    userAgent: req.get('user-agent') || null,
    requestId: req.id || null
});

const getUserId = req =>
    req.user?.id ?? req.user?.userId ?? null;

const specificationValues = specification => ({
    name: specification.name,
    code: specification.code,
    data_type: specification.data_type,
    unit: specification.unit ?? null,
    options: Array.isArray(specification.options) ? specification.options : [],
    description: specification.description ?? null,
    is_required: specification.is_required,
    is_active: specification.is_active
});

const validateBody = (body, creating = false) => {
    const errors = {};

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return { body: 'A valid JSON object is required' };
    }

    const unknownFields = Object.keys(body).filter(
        field => !ALLOWED_FIELDS.includes(field)
    );

    if (unknownFields.length) {
        errors.fields = `Unsupported fields: ${unknownFields.join(', ')}`;
    }

    if (creating || body.name !== undefined) {
        if (
            typeof body.name !== 'string' ||
            !body.name.trim() ||
            body.name.trim().length > 100
        ) {
            errors.name = 'Name is required and must not exceed 100 characters';
        }
    }

if (!creating && body.code !== undefined) {
        if (
            typeof body.code !== 'string' ||
            !body.code.trim() ||
            body.code.trim().length > 50
        ) {
            errors.code = 'Code is required and must not exceed 50 characters';
        }
    }

    if (body.data_type !== undefined) {
        if (
            typeof body.data_type !== 'string' ||
            !VALID_DATA_TYPES.includes(body.data_type)
        ) {
            errors.data_type =
                `Data type must be one of: ${VALID_DATA_TYPES.join(', ')}`;
        }
    } else if (creating) {
        // The model defaults this field to "text".
    }

    if (
        body.unit !== undefined &&
        body.unit !== null &&
        (typeof body.unit !== 'string' || body.unit.length > 30)
    ) {
        errors.unit = 'Unit must be a string of at most 30 characters or null';
    }

    if (
        body.description !== undefined &&
        body.description !== null &&
        (typeof body.description !== 'string' || body.description.length > 255)
    ) {
        errors.description =
            'Description must be a string of at most 255 characters or null';
    }

    if (body.options !== undefined) {
        if (
            !Array.isArray(body.options) ||
            body.options.length > 100 ||
            body.options.some(option =>
                typeof option !== 'string' ||
                !option.trim() ||
                option.trim().length > 100
            )
        ) {
            errors.options = 'Options must be an array of up to 100 non-empty strings, each at most 100 characters';
        }
    }

    for (const field of ['is_required', 'is_active']) {
        if (body[field] !== undefined && typeof body[field] !== 'boolean') {
            errors[field] = `${field} must be a boolean`;
        }
    }

    if (!creating && Object.keys(body).length === 0) {
        errors.body = 'Provide at least one field to update';
    }

    return errors;
};

const specificationInclude = [
    {
        model: ItemType,
        as: 'itemTypes',
        attributes: ['id', 'name', 'code'],
        through: { attributes: [] }
    }
];

// GET ALL SPECIFICATIONS
const getItemSpecifications = async (req, res) => {
    try {
        const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
        const pageSize = Math.min(100, Math.max(1, Number.parseInt(req.query.pageSize ?? req.query.limit, 10) || 25));
        const paginationEnabled = req.query.page !== undefined || req.query.pageSize !== undefined || req.query.limit !== undefined;
        const search = String(req.query.search || '').trim();
        const where = {};
        if (search) where[Op.or] = ['name', 'code', 'data_type', 'unit'].map(field => ({ [field]: { [Op.like]: `%${search}%` } }));
        if (req.query.type && req.query.type !== 'all') where.data_type = req.query.type;
        if (req.query.status === 'active') where.is_active = true;
        if (req.query.status === 'inactive') where.is_active = false;
        const result = await ItemSpecification.findAndCountAll({
            where,
            include: specificationInclude,
            order: [['id', 'DESC']], limit: paginationEnabled ? pageSize : undefined, offset: paginationEnabled ? (page - 1) * pageSize : undefined, distinct: true
        });
        const specifications = result.rows;

        return res.status(200).json({
            message: 'Item specifications retrieved successfully',
            data: specifications,
            pagination: { page, pageSize, total: result.count, totalPages: Math.ceil(result.count / pageSize) }
        });
    } catch (error) {
        console.error('Get item specifications error:', error);

        return res.status(500).json({
            message: 'Failed to retrieve item specifications'
        });
    }
};

// GET SPECIFICATION BY ID
const getItemSpecificationById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!isValidId(id)) {
            return res.status(400).json({
                message: 'Invalid item specification ID'
            });
        }

        const specification = await ItemSpecification.findByPk(id, {
            include: specificationInclude
        });

        if (!specification) {
            return res.status(404).json({
                message: 'Item specification not found'
            });
        }

        return res.status(200).json({
            message: 'Item specification retrieved successfully',
            data: specification
        });
    } catch (error) {
        console.error('Get item specification error:', error);

        return res.status(500).json({
            message: 'Failed to retrieve item specification'
        });
    }
};

// CREATE SPECIFICATION
const createItemSpecification = async (req, res) => {
    let transaction;

    try {
        const errors = validateBody(req.body, true);

        if (Object.keys(errors).length) {
            return res.status(400).json({
                message: 'Invalid item specification data',
                errors
            });
        }

        const values = {
            name: req.body.name.trim(),
            data_type: req.body.data_type ?? 'text',
            unit: req.body.unit?.trim() || null,
            options: (req.body.data_type ?? 'text') === 'select'
                ? [...new Set((req.body.options || []).map(option => option.trim()))]
                : [],
            description: req.body.description?.trim() || null,
            is_required: req.body.is_required ?? false,
            is_active: true
        };

transaction = await sequelize.transaction();

const existingName = await ItemSpecification.findOne({
    where: { name: values.name },
    transaction
});

if (existingName) {
    await transaction.rollback();

    return res.status(409).json({
        message: 'A specification with this name already exists'
    });
}

if (existingName) {
    await transaction.rollback();

    return res.status(409).json({
        message: 'A specification with this name already exists'
    });
}

const sequences = await sequelize.query(
    `SELECT next_value
     FROM item_specification_code_sequences
     WHERE id = 1
     FOR UPDATE`,
    {
        type: QueryTypes.SELECT,
        transaction
    }
);

if (!sequences.length) {
    throw new Error(
        'Item specification code sequence is not initialized'
    );
}

const nextValue = Number(sequences[0].next_value);

if (!Number.isSafeInteger(nextValue) || nextValue < 1) {
    throw new Error(
        'Item specification code sequence value is invalid'
    );
}

values.code = `SPEC-${String(nextValue).padStart(4, '0')}`;

await sequelize.query(
    `UPDATE item_specification_code_sequences
     SET next_value = next_value + 1
     WHERE id = 1`,
    { transaction }
);

const specification = await ItemSpecification.create(values, {
    transaction
});

        await recordAuditLog({
            userId: getUserId(req),
            action: 'ITEM_SPECIFICATION_CREATED',
            module: 'inventory',
            entityType: 'item_specification',
            entityId: specification.id,
            description: `Specification ${specification.code} created`,
            oldValues: null,
            newValues: specificationValues(specification),
            ...getMetadata(req),
            transaction
        });

        const created = await ItemSpecification.findByPk(specification.id, {
            include: specificationInclude,
            transaction
        });

        await transaction.commit();

        return res.status(201).json({
            message: 'Item specification created successfully',
            data: created
        });
    } catch (error) {
        if (transaction && !transaction.finished) {
            await transaction.rollback();
        }

        if (isUniqueConstraintError(error)) {
            return res.status(409).json({
                message: 'A specification with this name or code already exists'
            });
        }

        console.error('Create item specification error:', error);

        return res.status(500).json({
            message: 'Failed to create item specification'
        });
    }
};

// UPDATE SPECIFICATION
const updateItemSpecification = async (req, res) => {
    let transaction;

    try {
        const { id } = req.params;

        if (!isValidId(id)) {
            return res.status(400).json({
                message: 'Invalid item specification ID'
            });
        }

        const errors = validateBody(req.body);

        if (Object.keys(errors).length) {
            return res.status(400).json({
                message: 'Invalid item specification data',
                errors
            });
        }

        const changes = {};

        for (const field of ALLOWED_FIELDS) {
            if (req.body[field] !== undefined) {
                changes[field] = req.body[field];
            }
        }

        for (const field of ['name', 'code']) {
            if (changes[field] !== undefined) {
                changes[field] = changes[field].trim();
            }
        }

        for (const field of ['unit', 'description']) {
            if (changes[field] !== undefined) {
                changes[field] = changes[field]?.trim() || null;
            }
        }

        if (changes.options !== undefined) {
            changes.options = [...new Set(changes.options.map(option => option.trim()))];
        }

        transaction = await sequelize.transaction();

        const specification = await ItemSpecification.findByPk(id, {
            transaction,
            lock: transaction.LOCK.UPDATE
        });

        if (!specification) {
            await transaction.rollback();

            return res.status(404).json({
                message: 'Item specification not found'
            });
        }

        const duplicateConditions = [];

        if (
            changes.name !== undefined &&
            changes.name !== specification.name
        ) {
            duplicateConditions.push({ name: changes.name });
        }

        if (
            changes.code !== undefined &&
            changes.code !== specification.code
        ) {
            duplicateConditions.push({ code: changes.code });
        }

        if (duplicateConditions.length) {
            const existing = await ItemSpecification.findOne({
                where: {
                    [sequelize.Sequelize.Op.or]: duplicateConditions,
                    id: { [sequelize.Sequelize.Op.ne]: id }
                },
                transaction
            });

            if (existing) {
                await transaction.rollback();

                return res.status(409).json({
                    message: 'A specification with this name or code already exists'
                });
            }
        }

        const oldValues = specificationValues(specification);

        await specification.update(changes, { transaction });

        const newValues = specificationValues(specification);

        const changed = Object.keys(oldValues).some(
            key => oldValues[key] !== newValues[key]
        );

        if (changed) {
            await recordAuditLog({
                userId: getUserId(req),
                action: 'ITEM_SPECIFICATION_UPDATED',
                module: 'inventory',
                entityType: 'item_specification',
                entityId: specification.id,
                description: `Specification ${specification.code} updated`,
                oldValues,
                newValues,
                ...getMetadata(req),
                transaction
            });
        }

        const updated = await ItemSpecification.findByPk(id, {
            include: specificationInclude,
            transaction
        });

        await transaction.commit();

        return res.status(200).json({
            message: 'Item specification updated successfully',
            data: updated
        });
    } catch (error) {
        if (transaction && !transaction.finished) {
            await transaction.rollback();
        }

        if (isUniqueConstraintError(error)) {
            return res.status(409).json({
                message: 'A specification with this name or code already exists'
            });
        }

        console.error('Update item specification error:', error);

        return res.status(500).json({
            message: 'Failed to update item specification'
        });
    }
};

// DEACTIVATE SPECIFICATION (SOFT DELETE)
const deleteItemSpecification = async (req, res) => {
    let transaction;

    try {
        const { id } = req.params;

        if (!isValidId(id)) {
            return res.status(400).json({
                message: 'Invalid item specification ID'
            });
        }

        transaction = await sequelize.transaction();

        const specification = await ItemSpecification.findByPk(id, {
            transaction,
            lock: transaction.LOCK.UPDATE
        });

        if (!specification) {
            await transaction.rollback();

            return res.status(404).json({
                message: 'Item specification not found'
            });
        }

        if (!specification.is_active) {
            await transaction.rollback();

            return res.status(200).json({
                message: 'Item specification is already inactive'
            });
        }

        const oldValues = specificationValues(specification);

        await specification.update(
            { is_active: false },
            { transaction }
        );

        const newValues = specificationValues(specification);

        await recordAuditLog({
            userId: getUserId(req),
            action: 'ITEM_SPECIFICATION_DEACTIVATED',
            module: 'inventory',
            entityType: 'item_specification',
            entityId: specification.id,
            description: `Specification ${specification.code} deactivated`,
            oldValues,
            newValues,
            ...getMetadata(req),
            transaction
        });

        await transaction.commit();

        return res.status(200).json({
            message: 'Item specification deactivated successfully'
        });
    } catch (error) {
        if (transaction && !transaction.finished) {
            await transaction.rollback();
        }

        console.error('Deactivate item specification error:', error);

        return res.status(500).json({
            message: 'Failed to deactivate item specification'
        });
    }
};

module.exports = {
    getItemSpecifications,
    getItemSpecificationById,
    createItemSpecification,
    updateItemSpecification,
    deleteItemSpecification
};
