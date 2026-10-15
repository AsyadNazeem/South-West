'use strict';

const { Unit } = require('../models');
const { recordAuditLog } = require('../services/auditLogService');

const AUDIT_MODULE = 'UNIT';

const getActorId = (req) =>
    req.user?.id ?? req.user?.user_id ?? req.user?.userId ?? null;

const getUnitSnapshot = (unit) => {
    if (!unit) return null;

    return {
        id: unit.id,
        name: unit.name,
        code: unit.code,
        description: unit.description,
        is_active: unit.is_active
    };
};

const auditUnit = async (
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
            entityType: 'Unit',
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
            'Unit audit logging failed:',
            auditError.message
        );
    }
};

// GET ALL UNITS
const getUnits = async (req, res) => {
    try {
        const units = await Unit.findAll({
            order: [['id', 'DESC']]
        });

        await auditUnit(req, {
            action: 'UNIT_LIST_VIEWED',
            description: 'Retrieved unit records'
        });

        return res.status(200).json({
            message: 'Units retrieved successfully',
            data: units
        });
    } catch (error) {
        console.error('Get units error:', error);

        await auditUnit(req, {
            action: 'UNIT_LIST_FAILED',
            description: 'Failed to retrieve units'
        });

        return res.status(500).json({
            message: 'Failed to retrieve units'
        });
    }
};

// GET UNIT BY ID
const getUnitById = async (req, res) => {
    const { id } = req.params;

    try {
        const unit = await Unit.findByPk(id);

        if (!unit) {
            await auditUnit(req, {
                action: 'UNIT_NOT_FOUND',
                entityId: id,
                description: 'Requested unit was not found'
            });

            return res.status(404).json({
                message: 'Unit not found'
            });
        }

        await auditUnit(req, {
            action: 'UNIT_VIEWED',
            entityId: unit.id,
            description: 'Retrieved a unit'
        });

        return res.status(200).json({
            message: 'Unit retrieved successfully',
            data: unit
        });
    } catch (error) {
        console.error('Get unit error:', error);

        await auditUnit(req, {
            action: 'UNIT_VIEW_FAILED',
            entityId: id,
            description: 'Failed to retrieve unit'
        });

        return res.status(500).json({
            message: 'Failed to retrieve unit'
        });
    }
};

// CREATE UNIT
const createUnit = async (req, res) => {
    const { name, code, description } = req.body;

    try {
        if (
            typeof name !== 'string' ||
            !name.trim() ||
            typeof code !== 'string' ||
            !code.trim()
        ) {
            await auditUnit(req, {
                action: 'UNIT_CREATE_REJECTED',
                description: 'Creation rejected: unit name or code missing'
            });

            return res.status(400).json({
                message: 'Unit name and code are required'
            });
        }

        const normalizedName = name.trim();
        const normalizedCode = code.trim();

        const existingName = await Unit.findOne({
            where: { name: normalizedName }
        });

        if (existingName) {
            await auditUnit(req, {
                action: 'UNIT_CREATE_REJECTED',
                description: 'Creation rejected: unit name already exists',
                newValues: {
                    name: normalizedName,
                    code: normalizedCode
                }
            });

            return res.status(409).json({
                message: 'Unit name already exists'
            });
        }

        const existingCode = await Unit.findOne({
            where: { code: normalizedCode }
        });

        if (existingCode) {
            await auditUnit(req, {
                action: 'UNIT_CREATE_REJECTED',
                description: 'Creation rejected: unit code already exists',
                newValues: {
                    name: normalizedName,
                    code: normalizedCode
                }
            });

            return res.status(409).json({
                message: 'Unit code already exists'
            });
        }

        const unit = await Unit.create({
            name: normalizedName,
            code: normalizedCode,
            description: description ?? null,
            is_active: true
        });

        await auditUnit(req, {
            action: 'UNIT_CREATED',
            entityId: unit.id,
            description: 'Created a unit',
            newValues: getUnitSnapshot(unit)
        });

        return res.status(201).json({
            message: 'Unit created successfully',
            data: unit
        });
    } catch (error) {
        console.error('Create unit error:', error);

        await auditUnit(req, {
            action: 'UNIT_CREATE_FAILED',
            description: 'Failed to create unit',
            newValues: {
                name: name ?? null,
                code: code ?? null
            }
        });

        return res.status(500).json({
            message: 'Failed to create unit'
        });
    }
};

// UPDATE UNIT
const updateUnit = async (req, res) => {
    const { id } = req.params;

    try {
        const unit = await Unit.findByPk(id);

        if (!unit) {
            await auditUnit(req, {
                action: 'UNIT_UPDATE_REJECTED',
                entityId: id,
                description: 'Update rejected: unit not found'
            });

            return res.status(404).json({
                message: 'Unit not found'
            });
        }

        const oldValues = getUnitSnapshot(unit);
        const { name, code, description, is_active } = req.body;

        if (
            name !== undefined &&
            (typeof name !== 'string' || !name.trim())
        ) {
            await auditUnit(req, {
                action: 'UNIT_UPDATE_REJECTED',
                entityId: unit.id,
                description: 'Update rejected: invalid unit name',
                oldValues
            });

            return res.status(400).json({
                message: 'Unit name must be a non-empty string'
            });
        }

        if (
            code !== undefined &&
            (typeof code !== 'string' || !code.trim())
        ) {
            await auditUnit(req, {
                action: 'UNIT_UPDATE_REJECTED',
                entityId: unit.id,
                description: 'Update rejected: invalid unit code',
                oldValues
            });

            return res.status(400).json({
                message: 'Unit code must be a non-empty string'
            });
        }

        if (
            is_active !== undefined &&
            typeof is_active !== 'boolean'
        ) {
            await auditUnit(req, {
                action: 'UNIT_UPDATE_REJECTED',
                entityId: unit.id,
                description: 'Update rejected: invalid active flag',
                oldValues
            });

            return res.status(400).json({
                message: 'is_active must be a boolean'
            });
        }

        const normalizedName =
            name !== undefined ? name.trim() : unit.name;

        const normalizedCode =
            code !== undefined ? code.trim() : unit.code;

        if (normalizedName !== unit.name) {
            const existingName = await Unit.findOne({
                where: { name: normalizedName }
            });

            if (
                existingName &&
                String(existingName.id) !== String(unit.id)
            ) {
                await auditUnit(req, {
                    action: 'UNIT_UPDATE_REJECTED',
                    entityId: unit.id,
                    description: 'Update rejected: unit name already exists',
                    oldValues
                });

                return res.status(409).json({
                    message: 'Unit name already exists'
                });
            }
        }

        if (normalizedCode !== unit.code) {
            const existingCode = await Unit.findOne({
                where: { code: normalizedCode }
            });

            if (
                existingCode &&
                String(existingCode.id) !== String(unit.id)
            ) {
                await auditUnit(req, {
                    action: 'UNIT_UPDATE_REJECTED',
                    entityId: unit.id,
                    description: 'Update rejected: unit code already exists',
                    oldValues
                });

                return res.status(409).json({
                    message: 'Unit code already exists'
                });
            }
        }

        const updates = {};

        if (name !== undefined) updates.name = normalizedName;
        if (code !== undefined) updates.code = normalizedCode;
        if (description !== undefined) updates.description = description;
        if (is_active !== undefined) updates.is_active = is_active;

        if (Object.keys(updates).length === 0) {
            await auditUnit(req, {
                action: 'UNIT_UPDATE_REJECTED',
                entityId: unit.id,
                description: 'Update rejected: no fields supplied',
                oldValues
            });

            return res.status(400).json({
                message: 'No valid fields provided for update'
            });
        }

        await unit.update(updates);

        await auditUnit(req, {
            action: 'UNIT_UPDATED',
            entityId: unit.id,
            description: 'Updated a unit',
            oldValues,
            newValues: getUnitSnapshot(unit)
        });

        return res.status(200).json({
            message: 'Unit updated successfully',
            data: unit
        });
    } catch (error) {
        console.error('Update unit error:', error);

        await auditUnit(req, {
            action: 'UNIT_UPDATE_FAILED',
            entityId: id,
            description: 'Failed to update unit'
        });

        return res.status(500).json({
            message: 'Failed to update unit'
        });
    }
};

// DEACTIVATE UNIT (SOFT DELETE)
const deleteUnit = async (req, res) => {
    const { id } = req.params;

    try {
        const unit = await Unit.findByPk(id);

        if (!unit) {
            await auditUnit(req, {
                action: 'UNIT_DEACTIVATION_REJECTED',
                entityId: id,
                description: 'Deactivation rejected: unit not found'
            });

            return res.status(404).json({
                message: 'Unit not found'
            });
        }

        const oldValues = getUnitSnapshot(unit);

        if (!unit.is_active) {
            await auditUnit(req, {
                action: 'UNIT_DEACTIVATION_REJECTED',
                entityId: unit.id,
                description: 'Unit is already inactive',
                oldValues
            });

            return res.status(409).json({
                message: 'Unit is already inactive'
            });
        }

        await unit.update({
            is_active: false
        });

        await auditUnit(req, {
            action: 'UNIT_DEACTIVATED',
            entityId: unit.id,
            description: 'Deactivated a unit',
            oldValues,
            newValues: getUnitSnapshot(unit)
        });

        return res.status(200).json({
            message: 'Unit deactivated successfully'
        });
    } catch (error) {
        console.error('Delete unit error:', error);

        await auditUnit(req, {
            action: 'UNIT_DEACTIVATION_FAILED',
            entityId: id,
            description: 'Failed to deactivate unit'
        });

        return res.status(500).json({
            message: 'Failed to deactivate unit'
        });
    }
};

module.exports = {
    getUnits,
    getUnitById,
    createUnit,
    updateUnit,
    deleteUnit
};
