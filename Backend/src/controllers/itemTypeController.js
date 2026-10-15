'use strict';

const { sequelize, ItemType } = require('../models');
const { recordAuditLog } = require('../services/auditLogService');

const ALLOWED_FIELDS = [
    'name',
    'code',
    'description',
    'is_active'
];

const isValidId = (id) =>
    typeof id === 'string' &&
    /^[1-9]\d*$/.test(id);

const snapshot = (itemType) => ({
    id: itemType.id,
    name: itemType.name,
    code: itemType.code,
    description: itemType.description,
    is_active: itemType.is_active
});

const validateBody = (body, isCreate = false) => {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return 'A valid request body is required';
    }

    const unsupported = Object.keys(body).filter(
        (key) => !ALLOWED_FIELDS.includes(key)
    );

    if (unsupported.length) {
        return `Unsupported fields: ${unsupported.join(', ')}`;
    }

    if (isCreate && (!('name' in body) || !('code' in body))) {
        return 'Name and code are required';
    }

    if (isCreate && !('name' in body && 'code' in body)) {
        return 'Name and code are required';
    }

    if (Object.keys(body).length === 0) {
        return 'At least one field must be provided';
    }

    if ('name' in body) {
        if (
            typeof body.name !== 'string' ||
            !body.name.trim() ||
            body.name.trim().length > 50
        ) {
            return 'Name must be a non-empty string of up to 50 characters';
        }
    }

    if ('code' in body) {
        if (
            typeof body.code !== 'string' ||
            !body.code.trim() ||
            body.code.trim().length > 30
        ) {
            return 'Code must be a non-empty string of up to 30 characters';
        }
    }

    if ('description' in body) {
        if (
            body.description !== null &&
            (
                typeof body.description !== 'string' ||
                body.description.length > 255
            )
        ) {
            return 'Description must be a string of up to 255 characters or null';
        }
    }

    if (
        'is_active' in body &&
        typeof body.is_active !== 'boolean' &&
        body.is_active !== 0 &&
        body.is_active !== 1
    ) {
        return 'is_active must be a boolean';
    }

    return null;
};

const handleError = (res, message, error) => {
    console.error(`${message}:`, error);

    if (
        error?.name === 'SequelizeUniqueConstraintError' ||
        error?.original?.code === 'ER_DUP_ENTRY'
    ) {
        return res.status(409).json({
            message: 'An item type with this name or code already exists'
        });
    }

    if (
        error?.name === 'SequelizeForeignKeyConstraintError' ||
        error?.original?.code === 'ER_ROW_IS_REFERENCED_2'
    ) {
        return res.status(409).json({
            message: 'This item type is referenced by other records'
        });
    }

    return res.status(500).json({ message });
};

const writeAudit = async ({
                              req,
                              action,
                              itemType,
                              oldValues = null,
                              newValues = null,
                              transaction
                          }) => {
    await recordAuditLog({
        userId: req.user?.id ?? null,
        action,
        module: 'item_types',
        entityType: 'item_type',
        entityId: itemType.id,
        description: `Item type ${itemType.code}: ${action}`,
        oldValues,
        newValues,
        ipAddress: req.ip || null,
        userAgent: req.get('user-agent') || null,
        requestId: req.id || null,
        transaction
    });
};

// GET ALL
const getAllItemTypes = async (req, res) => {
    try {
        const itemTypes = await ItemType.findAll({
            order: [['name', 'ASC']]
        });

        return res.status(200).json({
            message: 'Item types retrieved successfully',
            data: itemTypes
        });
    } catch (error) {
        return handleError(
            res,
            'Failed to fetch item types',
            error
        );
    }
};

// GET BY ID
const getItemTypeById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!isValidId(id)) {
            return res.status(400).json({
                message: 'Invalid item type ID'
            });
        }

        const itemType = await ItemType.findByPk(id);

        if (!itemType) {
            return res.status(404).json({
                message: 'Item type not found'
            });
        }

        return res.status(200).json({
            message: 'Item type retrieved successfully',
            data: itemType
        });
    } catch (error) {
        return handleError(
            res,
            'Failed to fetch item type',
            error
        );
    }
};

// CREATE
const createItemType = async (req, res) => {
    let transaction;

    try {
        const body = req.body;
        const validationError = validateBody(body, true);

        if (validationError) {
            return res.status(400).json({
                message: validationError
            });
        }

        const fields = {
            name: body.name.trim(),
            code: body.code.trim(),
            description:
                typeof body.description === 'string'
                    ? body.description.trim() || null
                    : body.description ?? null,
            is_active: body.is_active ?? true
        };

        if (typeof fields.is_active === 'number') {
            fields.is_active = Boolean(fields.is_active);
        }

        transaction = await sequelize.transaction();

        const itemType = await ItemType.create(fields, {
            transaction
        });

        await writeAudit({
            req,
            action: 'ITEM_TYPE_CREATED',
            itemType,
            newValues: snapshot(itemType),
            transaction
        });

        await transaction.commit();
        transaction = null;

        return res.status(201).json({
            message: 'Item type created successfully',
            data: itemType
        });
    } catch (error) {
        if (transaction && !transaction.finished) {
            try {
                await transaction.rollback();
            } catch (rollbackError) {
                console.error('Rollback failed:', rollbackError);
            }
        }

        return handleError(
            res,
            'Failed to create item type',
            error
        );
    }
};

// UPDATE
const updateItemType = async (req, res) => {
    let transaction;

    try {
        const { id } = req.params;

        if (!isValidId(id)) {
            return res.status(400).json({
                message: 'Invalid item type ID'
            });
        }

        const validationError = validateBody(req.body);

        if (validationError) {
            return res.status(400).json({
                message: validationError
            });
        }

        const body = { ...req.body };

        if (typeof body.name === 'string') {
            body.name = body.name.trim();
        }

        if (typeof body.code === 'string') {
            body.code = body.code.trim();
        }

        if (typeof body.description === 'string') {
            body.description = body.description.trim() || null;
        }

        if (typeof body.is_active === 'number') {
            body.is_active = Boolean(body.is_active);
        }

        transaction = await sequelize.transaction();

        const itemType = await ItemType.findByPk(id, {
            transaction,
            lock: transaction.LOCK.UPDATE
        });

        if (!itemType) {
            await transaction.rollback();
            transaction = null;

            return res.status(404).json({
                message: 'Item type not found'
            });
        }

        const oldValues = snapshot(itemType);

        const changed = Object.keys(body).some(
            (key) => body[key] !== itemType[key]
        );

        if (!changed) {
            await transaction.commit();
            transaction = null;

            return res.status(200).json({
                message: 'No changes detected',
                data: itemType
            });
        }

        await itemType.update(body, { transaction });

        await writeAudit({
            req,
            action: 'ITEM_TYPE_UPDATED',
            itemType,
            oldValues,
            newValues: snapshot(itemType),
            transaction
        });

        await transaction.commit();
        transaction = null;

        return res.status(200).json({
            message: 'Item type updated successfully',
            data: itemType
        });
    } catch (error) {
        if (transaction && !transaction.finished) {
            try {
                await transaction.rollback();
            } catch (rollbackError) {
                console.error('Rollback failed:', rollbackError);
            }
        }

        return handleError(
            res,
            'Failed to update item type',
            error
        );
    }
};

// DELETE: soft-deactivate the item type
const deleteItemType = async (req, res) => {
    let transaction;

    try {
        const { id } = req.params;

        if (!isValidId(id)) {
            return res.status(400).json({
                message: 'Invalid item type ID'
            });
        }

        transaction = await sequelize.transaction();

        const itemType = await ItemType.findByPk(id, {
            transaction,
            lock: transaction.LOCK.UPDATE
        });

        if (!itemType) {
            await transaction.rollback();
            transaction = null;

            return res.status(404).json({
                message: 'Item type not found'
            });
        }

        if (!itemType.is_active) {
            await transaction.commit();
            transaction = null;

            return res.status(200).json({
                message: 'Item type is already inactive'
            });
        }

        const oldValues = snapshot(itemType);

        await itemType.update(
            { is_active: false },
            { transaction }
        );

        await writeAudit({
            req,
            action: 'ITEM_TYPE_DEACTIVATED',
            itemType,
            oldValues,
            newValues: snapshot(itemType),
            transaction
        });

        await transaction.commit();
        transaction = null;

        return res.status(200).json({
            message: 'Item type deactivated successfully'
        });
    } catch (error) {
        if (transaction && !transaction.finished) {
            try {
                await transaction.rollback();
            } catch (rollbackError) {
                console.error('Rollback failed:', rollbackError);
            }
        }

        return handleError(
            res,
            'Failed to deactivate item type',
            error
        );
    }
};

module.exports = {
    getAllItemTypes,
    getItemTypeById,
    createItemType,
    updateItemType,
    deleteItemType
};
