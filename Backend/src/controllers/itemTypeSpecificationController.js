'use strict';

const {
    sequelize,
    ItemTypeSpecification,
    ItemType,
    ItemSpecification,
    ItemSpecificationValue,
    Item
} = require('../models');

const { recordAuditLog } = require('../services/auditLogService');

const MAX_BIGINT = 9223372036854775807n;

const isValidId = (value) =>
    (typeof value === 'string' || typeof value === 'number') &&
    /^\d+$/.test(String(value)) &&
    BigInt(value) > 0n &&
    BigInt(value) <= MAX_BIGINT;

const isPlainObject = (value) =>
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value);

const validateBody = (body, allowedFields) => {
    if (!isPlainObject(body)) {
        return 'Request body must be an object';
    }

    const unknownFields = Object.keys(body).filter(
        (key) => !allowedFields.includes(key)
    );

    if (unknownFields.length) {
        return `Unsupported fields: ${unknownFields.join(', ')}`;
    }

    return null;
};

const validateAssignmentFields = (body) => {
    if (
        Object.hasOwn(body, 'is_required') &&
        typeof body.is_required !== 'boolean' &&
        body.is_required !== 0 &&
        body.is_required !== 1
    ) {
        return 'is_required must be a boolean';
    }

    if (
        Object.hasOwn(body, 'sort_order') &&
        (!Number.isSafeInteger(body.sort_order) || body.sort_order < 0)
    ) {
        return 'sort_order must be a non-negative integer';
    }

    return null;
};

const snapshot = (record) => {
    if (!record) return null;

    const value = record.get({ plain: true });

    return {
        id: value.id,
        item_type_id: value.item_type_id,
        specification_id: value.specification_id,
        is_required: value.is_required,
        sort_order: value.sort_order
    };
};

const writeAudit = async ({
                              req,
                              record,
                              action,
                              description,
                              oldValues = null,
                              newValues = null,
                              transaction
                          }) => {
    await recordAuditLog({
        userId: req.user?.id ?? null,
        action,
        module: 'item_type_specifications',
        entityType: 'item_type_specification',
        entityId: record.id,
        description,
        oldValues,
        newValues,
        ipAddress: req.ip,
        userAgent: req.get('user-agent') || null,
        requestId: req.id || null,
        transaction
    });
};

const isDatabaseConflict = (error) =>
    error.name === 'SequelizeUniqueConstraintError' ||
    error.name === 'SequelizeForeignKeyConstraintError';

const handleError = (res, error, operation) => {
    if (isDatabaseConflict(error)) {
        return res.status(409).json({
            message: 'The assignment conflicts with existing database records'
        });
    }

    console.error(`${operation} error:`, error);

    return res.status(500).json({
        message: `Failed to ${operation.toLowerCase()}`
    });
};

const assignmentIncludes = [
    {
        model: ItemType,
        as: 'itemType',
        attributes: ['id', 'name', 'code']
    },
    {
        model: ItemSpecification,
        as: 'specification',
        attributes: ['id', 'name', 'code', 'data_type', 'unit']
    }
];

const getExpandedRecord = (id, transaction) =>
    ItemTypeSpecification.findByPk(id, {
        include: assignmentIncludes,
        transaction
    });

// GET ALL
const getItemTypeSpecifications = async (req, res) => {
    try {
        const records = await ItemTypeSpecification.findAll({
            include: assignmentIncludes,
            order: [
                ['item_type_id', 'ASC'],
                ['sort_order', 'ASC'],
                ['id', 'ASC']
            ]
        });

        return res.status(200).json({
            message: 'Item type specifications retrieved successfully',
            data: records
        });
    } catch (error) {
        return handleError(res, error, 'Retrieve item type specifications');
    }
};

// GET BY ID
const getItemTypeSpecificationById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!isValidId(id)) {
            return res.status(400).json({
                message: 'A valid assignment ID is required'
            });
        }

        const record = await getExpandedRecord(id);

        if (!record) {
            return res.status(404).json({
                message: 'Item type specification not found'
            });
        }

        return res.status(200).json({
            message: 'Item type specification retrieved successfully',
            data: record
        });
    } catch (error) {
        return handleError(res, error, 'Retrieve item type specification');
    }
};

// CREATE
const createItemTypeSpecification = async (req, res) => {
    const bodyError = validateBody(req.body, [
        'item_type_id',
        'specification_id',
        'is_required',
        'sort_order'
    ]);

    if (bodyError) {
        return res.status(400).json({ message: bodyError });
    }

    const fieldError = validateAssignmentFields(req.body);

    if (fieldError) {
        return res.status(400).json({ message: fieldError });
    }

    const {
        item_type_id,
        specification_id,
        is_required,
        sort_order
    } = req.body;

    if (!isValidId(item_type_id) || !isValidId(specification_id)) {
        return res.status(400).json({
            message: 'Valid item_type_id and specification_id are required'
        });
    }

    try {
        const record = await sequelize.transaction(async (transaction) => {
            const itemType = await ItemType.findByPk(item_type_id, {
                transaction,
                lock: transaction.LOCK.UPDATE
            });

            if (!itemType) {
                const error = new Error('ITEM_TYPE_NOT_FOUND');
                throw error;
            }

            if (!itemType.is_active) {
                const error = new Error('ITEM_TYPE_INACTIVE');
                throw error;
            }

            const specification = await ItemSpecification.findByPk(
                specification_id,
                {
                    transaction,
                    lock: transaction.LOCK.UPDATE
                }
            );

            if (!specification) {
                const error = new Error('SPECIFICATION_NOT_FOUND');
                throw error;
            }

            if (!specification.is_active) {
                const error = new Error('SPECIFICATION_INACTIVE');
                throw error;
            }

            const created = await ItemTypeSpecification.create(
                {
                    item_type_id,
                    specification_id,
                    is_required: is_required ?? specification.is_required,
                    sort_order: sort_order ?? 0
                },
                { transaction }
            );

            await writeAudit({
                req,
                record: created,
                action: 'ITEM_TYPE_SPECIFICATION_CREATED',
                description: 'Specification assigned to item type',
                newValues: snapshot(created),
                transaction
            });

            return created;
        });

        const expanded = await getExpandedRecord(record.id);

        return res.status(201).json({
            message: 'Item type specification created successfully',
            data: expanded
        });
    } catch (error) {
        if (error.message === 'ITEM_TYPE_NOT_FOUND') {
            return res.status(404).json({ message: 'Item type not found' });
        }

        if (error.message === 'ITEM_TYPE_INACTIVE') {
            return res.status(409).json({ message: 'Item type is inactive' });
        }

        if (error.message === 'SPECIFICATION_NOT_FOUND') {
            return res.status(404).json({
                message: 'Item specification not found'
            });
        }

        if (error.message === 'SPECIFICATION_INACTIVE') {
            return res.status(409).json({
                message: 'Item specification is inactive'
            });
        }

        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(409).json({
                message: 'Specification is already assigned to this item type'
            });
        }

        return handleError(res, error, 'Create item type specification');
    }
};

// UPDATE
const updateItemTypeSpecification = async (req, res) => {
    const bodyError = validateBody(req.body, [
        'is_required',
        'sort_order'
    ]);

    if (bodyError) {
        return res.status(400).json({ message: bodyError });
    }

    const fieldError = validateAssignmentFields(req.body);

    if (fieldError) {
        return res.status(400).json({ message: fieldError });
    }

    if (!isValidId(req.params.id)) {
        return res.status(400).json({
            message: 'A valid assignment ID is required'
        });
    }

    if (Object.keys(req.body).length === 0) {
        return res.status(400).json({
            message: 'At least one field must be provided'
        });
    }

    try {
        const updatedId = await sequelize.transaction(async (transaction) => {
            const record = await ItemTypeSpecification.findByPk(
                req.params.id,
                {
                    transaction,
                    lock: transaction.LOCK.UPDATE
                }
            );

            if (!record) {
                const error = new Error('ASSIGNMENT_NOT_FOUND');
                throw error;
            }

            const oldValues = snapshot(record);

            await record.update(req.body, { transaction });

            await writeAudit({
                req,
                record,
                action: 'ITEM_TYPE_SPECIFICATION_UPDATED',
                description: 'Item type specification assignment updated',
                oldValues,
                newValues: snapshot(record),
                transaction
            });

            return record.id;
        });

        const updatedRecord = await getExpandedRecord(updatedId);

        return res.status(200).json({
            message: 'Item type specification updated successfully',
            data: updatedRecord
        });
    } catch (error) {
        if (error.message === 'ASSIGNMENT_NOT_FOUND') {
            return res.status(404).json({
                message: 'Item type specification not found'
            });
        }

        return handleError(res, error, 'Update item type specification');
    }
};

// DELETE
const deleteItemTypeSpecification = async (req, res) => {
    if (!isValidId(req.params.id)) {
        return res.status(400).json({
            message: 'A valid assignment ID is required'
        });
    }

    try {
        await sequelize.transaction(async (transaction) => {
            const record = await ItemTypeSpecification.findByPk(
                req.params.id,
                {
                    transaction,
                    lock: transaction.LOCK.UPDATE
                }
            );

            if (!record) {
                const error = new Error('ASSIGNMENT_NOT_FOUND');
                throw error;
            }

            // Preserve existing values rather than silently orphaning them.
            const existingValues = await ItemSpecificationValue.count({
                where: {
                    specification_id: record.specification_id
                },
                transaction
            });

            if (existingValues > 0) {
                const error = new Error('SPECIFICATION_VALUES_EXIST');
                throw error;
            }

            const oldValues = snapshot(record);

            await writeAudit({
                req,
                record,
                action: 'ITEM_TYPE_SPECIFICATION_DELETED',
                description: 'Specification assignment removed from item type',
                oldValues,
                transaction
            });

            await record.destroy({ transaction });
        });

        return res.status(200).json({
            message: 'Item type specification deleted successfully'
        });
    } catch (error) {
        if (error.message === 'ASSIGNMENT_NOT_FOUND') {
            return res.status(404).json({
                message: 'Item type specification not found'
            });
        }

        if (error.message === 'SPECIFICATION_VALUES_EXIST') {
            return res.status(409).json({
                message: 'Cannot delete this assignment while values exist for the specification. Review existing values before removing it.'
            });
        }

        return handleError(res, error, 'Delete item type specification');
    }
};

// GET SPECIFICATIONS BY ITEM TYPE
const getSpecificationsByItemType = async (req, res) => {
    const { itemTypeId } = req.params;

    if (!isValidId(itemTypeId)) {
        return res.status(400).json({
            message: 'A valid item type ID is required'
        });
    }

    try {
        const itemType = await ItemType.findByPk(itemTypeId);

        if (!itemType) {
            return res.status(404).json({
                message: 'Item type not found'
            });
        }

        const records = await ItemTypeSpecification.findAll({
            where: {
                item_type_id: itemTypeId
            },
            include: [
                {
                    model: ItemSpecification,
                    as: 'specification',
                    attributes: [
                        'id',
                        'name',
                        'code',
                        'data_type',
                        'unit',
                        'options',
                        'is_required'
                    ],
                    required: true,
                    where: {
                        is_active: true
                    }
                }
            ],
            order: [
                ['sort_order', 'ASC'],
                ['id', 'ASC']
            ]
        });

        return res.status(200).json({
            message: 'Specifications for item type retrieved successfully',
            data: records
        });
    } catch (error) {
        return handleError(res, error, 'Retrieve specifications by item type');
    }
};

module.exports = {
    getItemTypeSpecifications,
    getItemTypeSpecificationById,
    createItemTypeSpecification,
    updateItemTypeSpecification,
    deleteItemTypeSpecification,
    getSpecificationsByItemType
};
