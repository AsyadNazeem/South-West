'use strict';

const {
    sequelize,
    ItemSpecificationValue,
    Item,
    ItemSpecification,
    ItemTypeSpecification
} = require('../models');

const { recordAuditLog } = require('../services/auditLogService');

const VALUE_FIELDS = ['id', 'item_id', 'specification_id', 'value'];

const valueIncludes = [
    {
        model: Item,
        as: 'item',
        attributes: ['id', 'item_code', 'item_name']
    },
    {
        model: ItemSpecification,
        as: 'specification',
        attributes: ['id', 'name', 'code', 'data_type', 'unit']
    }
];

const isValidId = (id) =>
    (typeof id === 'string' ||
        typeof id === 'number' ||
        typeof id === 'bigint') &&
    /^[1-9]\d*$/.test(String(id));

const snapshot = (record) => ({
    id: record.id,
    item_id: record.item_id,
    specification_id: record.specification_id,
    value: record.value
});

const validateSpecificationValue = (value, dataType) => {
    if (value === null) {
        return { valid: true, value: null };
    }

    if (
        value === undefined ||
        !['string', 'number', 'boolean'].includes(typeof value)
    ) {
        return { valid: false };
    }

    const text = String(value);

    switch (dataType) {
        case 'text':
        case 'select':
            if (text.length > 65535) {
                return { valid: false };
            }

            return { valid: true, value: text };

        case 'number':
        case 'decimal': {
            if (text.trim() === '') {
                return { valid: false };
            }

            const number = Number(text);

            if (!Number.isFinite(number)) {
                return { valid: false };
            }

            if (
                dataType === 'number' &&
                !Number.isInteger(number)
            ) {
                return { valid: false };
            }

            return { valid: true, value: text };
        }

        case 'boolean': {
            const normalized = text.trim().toLowerCase();

            if (!['true', 'false', '1', '0'].includes(normalized)) {
                return { valid: false };
            }

            return {
                valid: true,
                value:
                    normalized === 'true' || normalized === '1'
                        ? 'true'
                        : 'false'
            };
        }

        case 'date': {
            if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
                return { valid: false };
            }

            const [year, month, day] = text.split('-').map(Number);
            const date = new Date(Date.UTC(year, month - 1, day));

            if (
                date.getUTCFullYear() !== year ||
                date.getUTCMonth() !== month - 1 ||
                date.getUTCDate() !== day
            ) {
                return { valid: false };
            }

            return { valid: true, value: text };
        }

        default:
            return { valid: false };
    }
};

const validateBodyFields = (body, allowedFields) => {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return ['body'];
    }

    return Object.keys(body).filter(
        (field) => !allowedFields.includes(field)
    );
};

const loadAndValidatePair = async (
    itemId,
    specificationId,
    transaction
) => {
    const item = await Item.findByPk(itemId, {
        transaction,
        lock: transaction ? transaction.LOCK.UPDATE : undefined
    });

    if (!item) {
        return {
            error: { status: 404, message: 'Item not found' }
        };
    }

    const specification = await ItemSpecification.findByPk(
        specificationId,
        { transaction }
    );

    if (!specification) {
        return {
            error: {
                status: 404,
                message: 'Item specification not found'
            }
        };
    }

    if (!specification.is_active) {
        return {
            error: {
                status: 400,
                message: 'Item specification is inactive'
            }
        };
    }

    if (item.item_type_id !== null && item.item_type_id !== undefined) {
        const assignment = await ItemTypeSpecification.findOne({
            where: {
                item_type_id: item.item_type_id,
                specification_id: specification.id
            },
            transaction
        });

        if (!assignment) {
            return {
                error: {
                    status: 400,
                    message:
                        'This specification is not assigned to the item type'
                }
            };
        }
    }

    return { item, specification };
};

const handleControllerError = (res, message, error) => {
    console.error(`${message}:`, error);

    if (
        error?.name === 'SequelizeUniqueConstraintError' ||
        error?.original?.code === 'ER_DUP_ENTRY'
    ) {
        return res.status(409).json({
            message:
                'Specification value already exists for this item'
        });
    }

    if (
        error?.name === 'SequelizeForeignKeyConstraintError' ||
        error?.original?.code === 'ER_NO_REFERENCED_ROW_2'
    ) {
        return res.status(400).json({
            message: 'Invalid item or specification reference'
        });
    }

    return res.status(500).json({ message });
};

const writeAudit = async ({
                              req,
                              action,
                              record,
                              oldValues = null,
                              newValues = null,
                              transaction
                          }) => {
    await recordAuditLog({
        userId: req.user?.id ?? null,
        action,
        module: 'item_specification_values',
        entityType: 'item_specification_value',
        entityId: record.id,
        description: `${action} for item ${record.item_id}`,
        oldValues,
        newValues,
        ipAddress: req.ip || null,
        userAgent: req.get('user-agent') || null,
        requestId: req.id || null,
        transaction
    });
};

const rollbackQuietly = async (transaction) => {
    if (transaction && !transaction.finished) {
        try {
            await transaction.rollback();
        } catch (error) {
            console.error('Transaction rollback failed:', error);
        }
    }
};

// GET ALL
const getItemSpecificationValues = async (req, res) => {
    try {
        const records = await ItemSpecificationValue.findAll({
            include: valueIncludes,
            order: [['id', 'DESC']]
        });

        return res.status(200).json({
            message: 'Item specification values retrieved successfully',
            data: records
        });
    } catch (error) {
        return handleControllerError(
            res,
            'Failed to retrieve item specification values',
            error
        );
    }
};

// GET BY ID
const getItemSpecificationValueById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!isValidId(id)) {
            return res.status(400).json({
                message: 'Invalid item specification value ID'
            });
        }

        const record = await ItemSpecificationValue.findByPk(id, {
            include: valueIncludes
        });

        if (!record) {
            return res.status(404).json({
                message: 'Item specification value not found'
            });
        }

        return res.status(200).json({
            message: 'Item specification value retrieved successfully',
            data: record
        });
    } catch (error) {
        return handleControllerError(
            res,
            'Failed to retrieve item specification value',
            error
        );
    }
};

// CREATE
const createItemSpecificationValue = async (req, res) => {
    let transaction;

    try {
        const body = req.body || {};
        const invalidFields = validateBodyFields(body, [
            'item_id',
            'specification_id',
            'value'
        ]);

        if (invalidFields.length) {
            return res.status(400).json({
                message: 'Unsupported fields provided',
                fields: invalidFields
            });
        }

        const { item_id, specification_id, value } = body;

        if (!isValidId(item_id) || !isValidId(specification_id)) {
            return res.status(400).json({
                message: 'Valid item_id and specification_id are required'
            });
        }

        if (!Object.prototype.hasOwnProperty.call(body, 'value')) {
            return res.status(400).json({
                message: 'value is required'
            });
        }

        transaction = await sequelize.transaction();

        const pair = await loadAndValidatePair(
            item_id,
            specification_id,
            transaction
        );

        if (pair.error) {
            await transaction.rollback();
            transaction = null;

            return res.status(pair.error.status).json({
                message: pair.error.message
            });
        }

        const checkedValue = validateSpecificationValue(
            value,
            pair.specification.data_type
        );

        if (!checkedValue.valid) {
            await transaction.rollback();
            transaction = null;

            return res.status(400).json({
                message:
                    `Value is invalid for specification data type '${pair.specification.data_type}'`
            });
        }

        const existing = await ItemSpecificationValue.findOne({
            where: { item_id, specification_id },
            transaction,
            lock: transaction.LOCK.UPDATE
        });

        if (existing) {
            await transaction.rollback();
            transaction = null;

            return res.status(409).json({
                message:
                    'Specification value already exists for this item'
            });
        }

        const record = await ItemSpecificationValue.create(
            {
                item_id,
                specification_id,
                value: checkedValue.value
            },
            { transaction }
        );

        await writeAudit({
            req,
            action: 'ITEM_SPECIFICATION_VALUE_CREATED',
            record,
            newValues: snapshot(record),
            transaction
        });

        await transaction.commit();
        transaction = null;

        const createdRecord = await ItemSpecificationValue.findByPk(
            record.id,
            { include: valueIncludes }
        );

        return res.status(201).json({
            message: 'Item specification value created successfully',
            data: createdRecord
        });
    } catch (error) {
        await rollbackQuietly(transaction);

        return handleControllerError(
            res,
            'Failed to create item specification value',
            error
        );
    }
};

// UPDATE
const updateItemSpecificationValue = async (req, res) => {
    let transaction;

    try {
        const { id } = req.params;
        const body = req.body || {};

        if (!isValidId(id)) {
            return res.status(400).json({
                message: 'Invalid item specification value ID'
            });
        }

        const invalidFields = validateBodyFields(body, ['value']);

        if (invalidFields.length) {
            return res.status(400).json({
                message: 'Unsupported fields provided',
                fields: invalidFields
            });
        }

        if (!Object.prototype.hasOwnProperty.call(body, 'value')) {
            return res.status(400).json({
                message: 'value is required'
            });
        }

        transaction = await sequelize.transaction();

        const record = await ItemSpecificationValue.findByPk(id, {
            transaction,
            lock: transaction.LOCK.UPDATE
        });

        if (!record) {
            await transaction.rollback();
            transaction = null;

            return res.status(404).json({
                message: 'Item specification value not found'
            });
        }

        const pair = await loadAndValidatePair(
            record.item_id,
            record.specification_id,
            transaction
        );

        if (pair.error) {
            await transaction.rollback();
            transaction = null;

            return res.status(pair.error.status).json({
                message: pair.error.message
            });
        }

        const checkedValue = validateSpecificationValue(
            body.value,
            pair.specification.data_type
        );

        if (!checkedValue.valid) {
            await transaction.rollback();
            transaction = null;

            return res.status(400).json({
                message:
                    `Value is invalid for specification data type '${pair.specification.data_type}'`
            });
        }

        const oldValues = snapshot(record);

        if (record.value === checkedValue.value) {
            await transaction.commit();
            transaction = null;

            return res.status(200).json({
                message: 'Specification value unchanged',
                data: record
            });
        }

        await record.update(
            { value: checkedValue.value },
            { transaction }
        );

        await writeAudit({
            req,
            action: 'ITEM_SPECIFICATION_VALUE_UPDATED',
            record,
            oldValues,
            newValues: snapshot(record),
            transaction
        });

        await transaction.commit();
        transaction = null;

        const updatedRecord = await ItemSpecificationValue.findByPk(
            id,
            { include: valueIncludes }
        );

        return res.status(200).json({
            message: 'Item specification value updated successfully',
            data: updatedRecord
        });
    } catch (error) {
        await rollbackQuietly(transaction);

        return handleControllerError(
            res,
            'Failed to update item specification value',
            error
        );
    }
};

// DELETE
const deleteItemSpecificationValue = async (req, res) => {
    let transaction;

    try {
        const { id } = req.params;

        if (!isValidId(id)) {
            return res.status(400).json({
                message: 'Invalid item specification value ID'
            });
        }

        transaction = await sequelize.transaction();

        const record = await ItemSpecificationValue.findByPk(id, {
            transaction,
            lock: transaction.LOCK.UPDATE
        });

        if (!record) {
            await transaction.rollback();
            transaction = null;

            return res.status(404).json({
                message: 'Item specification value not found'
            });
        }

        const oldValues = snapshot(record);

        await writeAudit({
            req,
            action: 'ITEM_SPECIFICATION_VALUE_DELETED',
            record,
            oldValues,
            transaction
        });

        await record.destroy({ transaction });

        await transaction.commit();
        transaction = null;

        return res.status(200).json({
            message: 'Item specification value deleted successfully'
        });
    } catch (error) {
        await rollbackQuietly(transaction);

        return handleControllerError(
            res,
            'Failed to delete item specification value',
            error
        );
    }
};

// UPSERT
const upsertSpecificationValue = async (req, res) => {
    let transaction;

    try {
        const body = req.body || {};
        const invalidFields = validateBodyFields(body, [
            'item_id',
            'specification_id',
            'value'
        ]);

        if (invalidFields.length) {
            return res.status(400).json({
                message: 'Unsupported fields provided',
                fields: invalidFields
            });
        }

        const { item_id, specification_id, value } = body;

        if (!isValidId(item_id) || !isValidId(specification_id)) {
            return res.status(400).json({
                message: 'Valid item_id and specification_id are required'
            });
        }

        if (!Object.prototype.hasOwnProperty.call(body, 'value')) {
            return res.status(400).json({
                message: 'value is required'
            });
        }

        transaction = await sequelize.transaction();

        const pair = await loadAndValidatePair(
            item_id,
            specification_id,
            transaction
        );

        if (pair.error) {
            await transaction.rollback();
            transaction = null;

            return res.status(pair.error.status).json({
                message: pair.error.message
            });
        }

        const checkedValue = validateSpecificationValue(
            value,
            pair.specification.data_type
        );

        if (!checkedValue.valid) {
            await transaction.rollback();
            transaction = null;

            return res.status(400).json({
                message:
                    `Value is invalid for specification data type '${pair.specification.data_type}'`
            });
        }

        const record = await ItemSpecificationValue.findOne({
            where: { item_id, specification_id },
            transaction,
            lock: transaction.LOCK.UPDATE
        });

        let created;

        if (!record) {
            const newRecord = await ItemSpecificationValue.create(
                {
                    item_id,
                    specification_id,
                    value: checkedValue.value
                },
                { transaction }
            );

            await writeAudit({
                req,
                action: 'ITEM_SPECIFICATION_VALUE_CREATED',
                record: newRecord,
                newValues: snapshot(newRecord),
                transaction
            });

            created = true;

            await transaction.commit();
            transaction = null;

            const result = await ItemSpecificationValue.findByPk(
                newRecord.id,
                { include: valueIncludes }
            );

            return res.status(201).json({
                message: 'Specification value created successfully',
                data: result
            });
        }

        const oldValues = snapshot(record);

        if (record.value !== checkedValue.value) {
            await record.update(
                { value: checkedValue.value },
                { transaction }
            );

            await writeAudit({
                req,
                action: 'ITEM_SPECIFICATION_VALUE_UPDATED',
                record,
                oldValues,
                newValues: snapshot(record),
                transaction
            });
        }

        created = false;

        await transaction.commit();
        transaction = null;

        const result = await ItemSpecificationValue.findByPk(
            record.id,
            { include: valueIncludes }
        );

        return res.status(200).json({
            message: created
                ? 'Specification value created successfully'
                : 'Specification value saved successfully',
            data: result
        });
    } catch (error) {
        await rollbackQuietly(transaction);

        return handleControllerError(
            res,
            'Failed to save specification value',
            error
        );
    }
};

module.exports = {
    getItemSpecificationValues,
    getItemSpecificationValueById,
    createItemSpecificationValue,
    updateItemSpecificationValue,
    deleteItemSpecificationValue,
    upsertSpecificationValue
};
