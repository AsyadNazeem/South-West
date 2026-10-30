'use strict';

const { Warranty, Item, sequelize } = require('../models');
const { QueryTypes } = require('sequelize');
const { recordAuditLog } = require('../services/auditLogService');

const AUDIT_MODULE = 'WARRANTY';

const getActorId = (req) =>
    req.user?.id ?? req.user?.user_id ?? req.user?.userId ?? null;

const getWarrantySnapshot = (warranty) => {
    if (!warranty) return null;

    const data = warranty.toJSON ? warranty.toJSON() : warranty;

    return {
        id: data.id,
        name: data.name,
        code: data.code,
        duration_value: data.duration_value,
        duration_unit: data.duration_unit,
        description: data.description,
        is_active: data.is_active
    };
};

const auditWarranty = async (
    req,
    {
        action,
        entityId = null,
        description = null,
        oldValues = null,
        newValues = null
    }
) => {
    try {
        await recordAuditLog({
            userId: getActorId(req),
            action,
            module: AUDIT_MODULE,
            entityType: 'Warranty',
            entityId: entityId != null ? String(entityId) : null,
            description,
            oldValues,
            newValues,
            ipAddress: req.ip ?? null,
            userAgent: req.get('user-agent') ?? null,
            requestId: req.id ?? req.requestId ?? null
        });
    } catch (auditError) {
        console.error(
            'Warranty audit logging failed:',
            auditError.message
        );
    }
};

const isValidDuration = (value) =>
    value !== null &&
    value !== undefined &&
    value !== '' &&
    Number.isFinite(Number(value)) &&
    Number(value) >= 0;

const validDurationUnits = [
    'day',
    'days',
    'week',
    'weeks',
    'month',
    'months',
    'year',
    'years'
];

const validateDurationUnit = (value) =>
    typeof value === 'string' &&
    validDurationUnits.includes(value.trim().toLowerCase());

// GET ALL WARRANTIES
const getWarranties = async (req, res) => {
    try {
        const warranties = await Warranty.findAll({
            order: [['id', 'DESC']]
        });

        const counts = await Item.count({
            group: ['warranty_id']
        });

        const countMap = {};

        counts.forEach((row) => {
            countMap[row.warranty_id] = Number(row.count);
        });

        const data = warranties.map((warranty) => ({
            ...warranty.toJSON(),
            product_count: countMap[warranty.id] || 0
        }));

        await auditWarranty(req, {
            action: 'WARRANTY_LIST_VIEWED',
            description: 'Retrieved warranty list'
        });

        return res.status(200).json({
            message: 'Warranties retrieved successfully',
            data
        });
    } catch (error) {
        console.error('Get warranties error:', error);

        await auditWarranty(req, {
            action: 'WARRANTY_LIST_FAILED',
            description: 'Failed to retrieve warranties'
        });

        return res.status(500).json({
            message: 'Failed to retrieve warranties'
        });
    }
};

// GET WARRANTY BY ID
const getWarrantyById = async (req, res) => {
    const { id } = req.params;

    try {
        const warranty = await Warranty.findByPk(id);

        if (!warranty) {
            await auditWarranty(req, {
                action: 'WARRANTY_NOT_FOUND',
                entityId: id,
                description: 'Requested warranty was not found'
            });

            return res.status(404).json({
                message: 'Warranty not found'
            });
        }

        await auditWarranty(req, {
            action: 'WARRANTY_VIEWED',
            entityId: warranty.id,
            description: 'Retrieved warranty details',
            newValues: getWarrantySnapshot(warranty)
        });

        return res.status(200).json({
            message: 'Warranty retrieved successfully',
            data: warranty
        });
    } catch (error) {
        console.error('Get warranty error:', error);

        await auditWarranty(req, {
            action: 'WARRANTY_VIEW_FAILED',
            entityId: id,
            description: 'Failed to retrieve warranty'
        });

        return res.status(500).json({
            message: 'Failed to retrieve warranty'
        });
    }
};

// CREATE WARRANTY
const createWarranty = async (req, res) => {
    try {
const {
    name,
    duration_value,
    duration_unit,
    description
} = req.body;

        if (typeof name !== 'string' || !name.trim()) {
            await auditWarranty(req, {
                action: 'WARRANTY_CREATE_REJECTED',
                description: 'Warranty creation rejected: invalid name'
            });

            return res.status(400).json({
                message: 'Warranty name is required'
            });
        }

        if (!isValidDuration(duration_value)) {
            await auditWarranty(req, {
                action: 'WARRANTY_CREATE_REJECTED',
                description: 'Warranty creation rejected: invalid duration'
            });

            return res.status(400).json({
                message: 'Warranty duration must be a valid non-negative number'
            });
        }

        if (!validateDurationUnit(duration_unit)) {
            await auditWarranty(req, {
                action: 'WARRANTY_CREATE_REJECTED',
                description: 'Warranty creation rejected: invalid duration unit'
            });

            return res.status(400).json({
                message: 'Warranty duration unit is invalid'
            });
        }

        const normalizedName = name.trim();

        const existingName = await Warranty.findOne({
            where: { name: normalizedName }
        });

        if (existingName) {
            await auditWarranty(req, {
                action: 'WARRANTY_CREATE_REJECTED',
                description: 'Warranty creation rejected: duplicate name'
            });

            return res.status(409).json({
                message: 'Warranty name already exists'
            });
        }

    const durationUnitMap = {
    days: 'Days',
    months: 'Months',
    years: 'Years',
};

const normalizedDurationUnit =
    durationUnitMap[String(duration_unit).trim().toLowerCase()];

if (!normalizedDurationUnit) {
    return res.status(400).json({
        message: 'Warranty duration unit is invalid'
    });
}

const warranty = await sequelize.transaction(async (transaction) => {
    const [sequence] = await sequelize.query(
        `SELECT next_value
         FROM warranty_code_sequences
         WHERE id = 1
         FOR UPDATE`,
        {
            type: QueryTypes.SELECT,
            transaction,
        }
    );

    if (!sequence) {
        throw new Error('Warranty code sequence is missing. Run migrations first.');
    }

    const nextValue = Number(sequence.next_value);
    const generatedCode = `WAR-${String(nextValue).padStart(4, '0')}`;

    await sequelize.query(
        `UPDATE warranty_code_sequences
         SET next_value = next_value + 1
         WHERE id = 1`,
        { transaction }
    );

    return Warranty.create({
        name: normalizedName,
        code: generatedCode,
        duration_value: Number(duration_value),
        duration_unit: normalizedDurationUnit,
        description:
            typeof description === 'string'
                ? description.trim()
                : description ?? null,
        is_active: true
    }, { transaction });
});

        await auditWarranty(req, {
            action: 'WARRANTY_CREATED',
            entityId: warranty.id,
            description: 'Warranty created',
            newValues: getWarrantySnapshot(warranty)
        });

        return res.status(201).json({
            message: 'Warranty created successfully',
            data: warranty
        });
    } catch (error) {
        console.error('Create warranty error:', error);

        await auditWarranty(req, {
            action: 'WARRANTY_CREATE_FAILED',
            description: 'Failed to create warranty'
        });

        return res.status(500).json({
            message: 'Failed to create warranty'
        });
    }
};

// UPDATE WARRANTY
const updateWarranty = async (req, res) => {
    const { id } = req.params;

    try {
        const warranty = await Warranty.findByPk(id);

        if (!warranty) {
            await auditWarranty(req, {
                action: 'WARRANTY_NOT_FOUND',
                entityId: id,
                description: 'Warranty update rejected: warranty not found'
            });

            return res.status(404).json({
                message: 'Warranty not found'
            });
        }

        const {
            name,
            code,
            duration_value,
            duration_unit,
            description,
            is_active
        } = req.body;

        const oldValues = getWarrantySnapshot(warranty);
        const updates = {};

        if (name !== undefined) {
            if (typeof name !== 'string' || !name.trim()) {
                return res.status(400).json({
                    message: 'Warranty name cannot be empty'
                });
            }

            const normalizedName = name.trim();

            if (normalizedName !== warranty.name) {
                const existingName = await Warranty.findOne({
                    where: { name: normalizedName }
                });

                if (existingName) {
                    await auditWarranty(req, {
                        action: 'WARRANTY_UPDATE_REJECTED',
                        entityId: id,
                        description: 'Warranty update rejected: duplicate name'
                    });

                    return res.status(409).json({
                        message: 'Warranty name already exists'
                    });
                }
            }

            updates.name = normalizedName;
        }

        if (code !== undefined) {
            if (typeof code !== 'string' || !code.trim()) {
                return res.status(400).json({
                    message: 'Warranty code cannot be empty'
                });
            }

            const normalizedCode = code.trim();

            if (normalizedCode !== warranty.code) {
                const existingCode = await Warranty.findOne({
                    where: { code: normalizedCode }
                });

                if (existingCode) {
                    await auditWarranty(req, {
                        action: 'WARRANTY_UPDATE_REJECTED',
                        entityId: id,
                        description: 'Warranty update rejected: duplicate code'
                    });

                    return res.status(409).json({
                        message: 'Warranty code already exists'
                    });
                }
            }

            updates.code = normalizedCode;
        }

        if (duration_value !== undefined) {
            if (!isValidDuration(duration_value)) {
                await auditWarranty(req, {
                    action: 'WARRANTY_UPDATE_REJECTED',
                    entityId: id,
                    description: 'Warranty update rejected: invalid duration'
                });

                return res.status(400).json({
                    message: 'Warranty duration must be a valid non-negative number'
                });
            }

            updates.duration_value = Number(duration_value);
        }

        if (duration_unit !== undefined) {
            if (!validateDurationUnit(duration_unit)) {
                await auditWarranty(req, {
                    action: 'WARRANTY_UPDATE_REJECTED',
                    entityId: id,
                    description: 'Warranty update rejected: invalid duration unit'
                });

                return res.status(400).json({
                    message: 'Warranty duration unit is invalid'
                });
            }

            updates.duration_unit = duration_unit.trim().toLowerCase();
        }

        if (description !== undefined) {
            if (description !== null && typeof description !== 'string') {
                return res.status(400).json({
                    message: 'Warranty description must be a string or null'
                });
            }

            updates.description =
                typeof description === 'string'
                    ? description.trim()
                    : null;
        }

        if (is_active !== undefined) {
            if (typeof is_active !== 'boolean') {
                await auditWarranty(req, {
                    action: 'WARRANTY_UPDATE_REJECTED',
                    entityId: id,
                    description: 'Warranty update rejected: invalid active status'
                });

                return res.status(400).json({
                    message: 'is_active must be a boolean'
                });
            }

            updates.is_active = is_active;
        }

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({
                message: 'No valid fields provided for update'
            });
        }

        await warranty.update(updates);

        await auditWarranty(req, {
            action: 'WARRANTY_UPDATED',
            entityId: warranty.id,
            description: 'Warranty updated',
            oldValues,
            newValues: getWarrantySnapshot(warranty)
        });

        return res.status(200).json({
            message: 'Warranty updated successfully',
            data: warranty
        });
    } catch (error) {
        console.error('Update warranty error:', error);

        await auditWarranty(req, {
            action: 'WARRANTY_UPDATE_FAILED',
            entityId: id,
            description: 'Failed to update warranty'
        });

        return res.status(500).json({
            message: 'Failed to update warranty'
        });
    }
};

// DEACTIVATE WARRANTY (SOFT DELETE)
const deleteWarranty = async (req, res) => {
    const { id } = req.params;

    try {
        const warranty = await Warranty.findByPk(id);

        if (!warranty) {
            await auditWarranty(req, {
                action: 'WARRANTY_NOT_FOUND',
                entityId: id,
                description: 'Warranty deactivation rejected: warranty not found'
            });

            return res.status(404).json({
                message: 'Warranty not found'
            });
        }

        if (!warranty.is_active) {
            await auditWarranty(req, {
                action: 'WARRANTY_DEACTIVATION_REJECTED',
                entityId: id,
                description: 'Warranty is already inactive'
            });

            return res.status(409).json({
                message: 'Warranty is already deactivated'
            });
        }

        const oldValues = getWarrantySnapshot(warranty);

        await warranty.update({
            is_active: false
        });

        await auditWarranty(req, {
            action: 'WARRANTY_DEACTIVATED',
            entityId: warranty.id,
            description: 'Warranty deactivated',
            oldValues,
            newValues: getWarrantySnapshot(warranty)
        });

        return res.status(200).json({
            message: 'Warranty deactivated successfully'
        });
    } catch (error) {
        console.error('Delete warranty error:', error);

        await auditWarranty(req, {
            action: 'WARRANTY_DEACTIVATION_FAILED',
            entityId: id,
            description: 'Failed to deactivate warranty'
        });

        return res.status(500).json({
            message: 'Failed to deactivate warranty'
        });
    }
};

module.exports = {
    getWarranties,
    getWarrantyById,
    createWarranty,
    updateWarranty,
    deleteWarranty
};
