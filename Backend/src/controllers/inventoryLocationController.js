
const { InventoryLocation, sequelize } = require('../models');
const { recordAuditLog } = require('../services/auditLogService');

const VALID_LOCATION_TYPES = ['store', 'warehouse', 'online', 'service'];
const ALLOWED_FIELDS = ['code', 'name', 'location_type', 'address', 'is_active'];

const isValidId = id =>
    /^[1-9]\d*$/.test(String(id));

const getAuditUserId = req =>
    req.user?.id ?? req.user?.userId ?? null;

const getRequestMetadata = req => ({
    ipAddress: req.ip || null,
    userAgent: req.get('user-agent') || null,
    requestId: req.id || null
});

const isUniqueConstraintError = error =>
    error?.name === 'SequelizeUniqueConstraintError' ||
    error?.original?.code === 'ER_DUP_ENTRY' ||
    error?.parent?.code === 'ER_DUP_ENTRY';

const getLocationValues = location => ({
    code: location.code,
    name: location.name,
    location_type: location.location_type,
    address: location.address ?? null,
    is_active: location.is_active
});

const validateLocationFields = (body, { creating = false } = {}) => {
    const errors = {};

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return { body: 'A valid JSON object is required' };
    }

    const suppliedFields = Object.keys(body);

    const unknownFields = suppliedFields.filter(
        field => !ALLOWED_FIELDS.includes(field)
    );

    if (unknownFields.length) {
        errors.fields = `Unsupported fields: ${unknownFields.join(', ')}`;
    }

if (body.code !== undefined) {
        if (typeof body.code !== 'string' || !body.code.trim()) {
            errors.code = 'Code is required and must be a non-empty string';
        } else if (body.code.trim().length > 50) {
            errors.code = 'Code cannot exceed 50 characters';
        }
    }

    if (creating || body.name !== undefined) {
        if (typeof body.name !== 'string' || !body.name.trim()) {
            errors.name = 'Name is required and must be a non-empty string';
        } else if (body.name.trim().length > 150) {
            errors.name = 'Name cannot exceed 150 characters';
        }
    }

    if (body.location_type !== undefined) {
        if (
            typeof body.location_type !== 'string' ||
            !VALID_LOCATION_TYPES.includes(body.location_type)
        ) {
            errors.location_type =
                `Location type must be one of: ${VALID_LOCATION_TYPES.join(', ')}`;
        }
    }

    if (
        body.address !== undefined &&
        body.address !== null &&
        typeof body.address !== 'string'
    ) {
        errors.address = 'Address must be a string or null';
    }

    if (body.is_active !== undefined && typeof body.is_active !== 'boolean') {
        errors.is_active = 'is_active must be a boolean';
    }

    if (!creating && suppliedFields.length === 0) {
        errors.body = 'Provide at least one field to update';
    }

    return errors;
};

// GET ALL INVENTORY LOCATIONS
const getInventoryLocations = async (req, res) => {
    try {
        const locations = await InventoryLocation.findAll({
            order: [['id', 'DESC']]
        });

        return res.status(200).json({
            message: 'Inventory locations retrieved successfully',
            data: locations
        });
    } catch (error) {
        console.error('Get inventory locations error:', error);

        return res.status(500).json({
            message: 'Failed to retrieve inventory locations'
        });
    }
};

// GET INVENTORY LOCATION BY ID
const getInventoryLocationById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!isValidId(id)) {
            return res.status(400).json({
                message: 'Invalid inventory location ID'
            });
        }

        const location = await InventoryLocation.findByPk(id);

        if (!location) {
            return res.status(404).json({
                message: 'Inventory location not found'
            });
        }

        return res.status(200).json({
            message: 'Inventory location retrieved successfully',
            data: location
        });
    } catch (error) {
        console.error('Get inventory location error:', error);

        return res.status(500).json({
            message: 'Failed to retrieve inventory location'
        });
    }
};

// CREATE INVENTORY LOCATION

const createInventoryLocation = async (req, res) => {
    let transaction;

    try {
        const errors = validateLocationFields(req.body, {
            creating: true
        });

        if (Object.keys(errors).length) {
            return res.status(400).json({
                message: 'Invalid inventory location data',
                errors
            });
        }

        transaction = await sequelize.transaction();

        // Lock the sequence row to prevent duplicate codes
        // when multiple locations are created concurrently.
        const sequences = await sequelize.query(
            `SELECT next_value
             FROM inventory_location_code_sequences
             WHERE id = 1
             FOR UPDATE`,
            { transaction }
        );

        const sequenceRows = sequences[0];

        if (!sequenceRows || sequenceRows.length === 0) {
            throw new Error(
                'Inventory location code sequence is not initialized.'
            );
        }

        const nextValue = Number(sequenceRows[0].next_value);

        if (
            !Number.isSafeInteger(nextValue) ||
            nextValue < 1
        ) {
            throw new Error(
                'Inventory location code sequence is invalid.'
            );
        }

        const generatedCode =
            `LOC-${String(nextValue).padStart(4, '0')}`;

        await sequelize.query(
            `UPDATE inventory_location_code_sequences
             SET next_value = next_value + 1
             WHERE id = 1`,
            { transaction }
        );

        const values = {
            code: generatedCode,
            name: req.body.name.trim(),
            location_type: req.body.location_type ?? 'store',
            address: req.body.address?.trim() || null,
            is_active: true
        };

        const existingLocation = await InventoryLocation.findOne({
            where: { code: generatedCode },
            transaction
        });

        if (existingLocation) {
            throw new Error(
                `Generated inventory location code ${generatedCode} already exists.`
            );
        }

        const location = await InventoryLocation.create(values, {
            transaction
        });

        await recordAuditLog({
            userId: getAuditUserId(req),
            action: 'INVENTORY_LOCATION_CREATED',
            module: 'inventory',
            entityType: 'inventory_location',
            entityId: location.id,
            description: `Inventory location ${location.code} created`,
            oldValues: null,
            newValues: getLocationValues(location),
            ...getRequestMetadata(req),
            transaction
        });

        await transaction.commit();

        return res.status(201).json({
            message: 'Inventory location created successfully',
            data: location
        });
    } catch (error) {
        if (transaction && !transaction.finished) {
            await transaction.rollback();
        }

        if (isUniqueConstraintError(error)) {
            return res.status(409).json({
                message: 'Inventory location code already exists'
            });
        }

        console.error('Create inventory location error:', error);

        return res.status(500).json({
            message: 'Failed to create inventory location'
        });
    }
};


// UPDATE INVENTORY LOCATION
const updateInventoryLocation = async (req, res) => {
    let transaction;

    try {
        const { id } = req.params;

        if (!isValidId(id)) {
            return res.status(400).json({
                message: 'Invalid inventory location ID'
            });
        }

        const errors = validateLocationFields(req.body);

        if (Object.keys(errors).length) {
            return res.status(400).json({
                message: 'Invalid inventory location data',
                errors
            });
        }

        const body = req.body;

        const changes = {};

        for (const field of ALLOWED_FIELDS) {
            if (body[field] !== undefined) {
                changes[field] = body[field];
            }
        }

        if (changes.code !== undefined) {
            changes.code = changes.code.trim();
        }

        if (changes.name !== undefined) {
            changes.name = changes.name.trim();
        }

        if (changes.address !== undefined) {
            changes.address = changes.address?.trim() || null;
        }

        transaction = await sequelize.transaction();

        const location = await InventoryLocation.findByPk(id, {
            transaction,
            lock: transaction.LOCK.UPDATE
        });

        if (!location) {
            await transaction.rollback();

            return res.status(404).json({
                message: 'Inventory location not found'
            });
        }

        if (changes.code !== undefined && changes.code !== location.code) {
            const existingLocation = await InventoryLocation.findOne({
                where: { code: changes.code },
                transaction
            });

            if (existingLocation) {
                await transaction.rollback();

                return res.status(409).json({
                    message: 'Inventory location code already exists'
                });
            }
        }

        const oldValues = getLocationValues(location);

        await location.update(changes, { transaction });

        const newValues = getLocationValues(location);

        const changed = Object.keys(oldValues).some(
            key => oldValues[key] !== newValues[key]
        );

        if (changed) {
            await recordAuditLog({
                userId: getAuditUserId(req),
                action: 'INVENTORY_LOCATION_UPDATED',
                module: 'inventory',
                entityType: 'inventory_location',
                entityId: location.id,
                description: `Inventory location ${location.code} updated`,
                oldValues,
                newValues,
                ...getRequestMetadata(req),
                transaction
            });
        }

        await transaction.commit();

        return res.status(200).json({
            message: 'Inventory location updated successfully',
            data: location
        });
    } catch (error) {
        if (transaction && !transaction.finished) {
            await transaction.rollback();
        }

        if (isUniqueConstraintError(error)) {
            return res.status(409).json({
                message: 'Inventory location code already exists'
            });
        }

        console.error('Update inventory location error:', error);

        return res.status(500).json({
            message: 'Failed to update inventory location'
        });
    }
};

// DELETE INVENTORY LOCATION (SOFT DELETE)
const deleteInventoryLocation = async (req, res) => {
    let transaction;

    try {
        const { id } = req.params;

        if (!isValidId(id)) {
            return res.status(400).json({
                message: 'Invalid inventory location ID'
            });
        }

        transaction = await sequelize.transaction();

        const location = await InventoryLocation.findByPk(id, {
            transaction,
            lock: transaction.LOCK.UPDATE
        });

        if (!location) {
            await transaction.rollback();

            return res.status(404).json({
                message: 'Inventory location not found'
            });
        }

        if (!location.is_active) {
            await transaction.rollback();

            return res.status(200).json({
                message: 'Inventory location is already inactive'
            });
        }

        const oldValues = getLocationValues(location);

        await location.update(
            { is_active: false },
            { transaction }
        );

        const newValues = getLocationValues(location);

        await recordAuditLog({
            userId: getAuditUserId(req),
            action: 'INVENTORY_LOCATION_DEACTIVATED',
            module: 'inventory',
            entityType: 'inventory_location',
            entityId: location.id,
            description: `Inventory location ${location.code} deactivated`,
            oldValues,
            newValues,
            ...getRequestMetadata(req),
            transaction
        });

        await transaction.commit();

        return res.status(200).json({
            message: 'Inventory location deactivated successfully'
        });
    } catch (error) {
        if (transaction && !transaction.finished) {
            await transaction.rollback();
        }

        console.error('Delete inventory location error:', error);

        return res.status(500).json({
            message: 'Failed to deactivate inventory location'
        });
    }
};

module.exports = {
    getInventoryLocations,
    getInventoryLocationById,
    createInventoryLocation,
    updateInventoryLocation,
    deleteInventoryLocation
};
