'use strict';

const { Unit } = require('../models');

// GET ALL UNITS
const getUnits = async (req, res) => {
    try {
        const units = await Unit.findAll({
            order: [['id', 'DESC']]
        });

        return res.status(200).json({
            message: 'Units retrieved successfully',
            data: units
        });
    } catch (error) {
        console.error('Get units error:', error);

        return res.status(500).json({
            message: 'Failed to retrieve units'
        });
    }
};

// GET UNIT BY ID
const getUnitById = async (req, res) => {
    try {
        const { id } = req.params;

        const unit = await Unit.findByPk(id);

        if (!unit) {
            return res.status(404).json({
                message: 'Unit not found'
            });
        }

        return res.status(200).json({
            message: 'Unit retrieved successfully',
            data: unit
        });
    } catch (error) {
        console.error('Get unit error:', error);

        return res.status(500).json({
            message: 'Failed to retrieve unit'
        });
    }
};

// CREATE UNIT
const createUnit = async (req, res) => {
    try {
        const {
            name,
            code,
            description
        } = req.body;

        // Required validation
        if (!name) {
            return res.status(400).json({
                message: 'Unit name is required'
            });
        }

        if (!code) {
            return res.status(400).json({
                message: 'Unit code is required'
            });
        }

        // Check duplicate name
        const existingName = await Unit.findOne({
            where: { name }
        });

        if (existingName) {
            return res.status(409).json({
                message: 'Unit name already exists'
            });
        }

        // Check duplicate code
        const existingCode = await Unit.findOne({
            where: { code }
        });

        if (existingCode) {
            return res.status(409).json({
                message: 'Unit code already exists'
            });
        }

        const unit = await Unit.create({
            name,
            code,
            description,
            is_active: true
        });

        return res.status(201).json({
            message: 'Unit created successfully',
            data: unit
        });
    } catch (error) {
        console.error('Create unit error:', error);

        return res.status(500).json({
            message: 'Failed to create unit'
        });
    }
};

// UPDATE UNIT
const updateUnit = async (req, res) => {
    try {
        const { id } = req.params;

        const unit = await Unit.findByPk(id);

        if (!unit) {
            return res.status(404).json({
                message: 'Unit not found'
            });
        }

        const {
            name,
            code,
            description,
            is_active
        } = req.body;

        // Check duplicate name
        if (name && name !== unit.name) {
            const existingName = await Unit.findOne({
                where: { name }
            });

            if (existingName) {
                return res.status(409).json({
                    message: 'Unit name already exists'
                });
            }
        }

        // Check duplicate code
        if (code && code !== unit.code) {
            const existingCode = await Unit.findOne({
                where: { code }
            });

            if (existingCode) {
                return res.status(409).json({
                    message: 'Unit code already exists'
                });
            }
        }

        await unit.update({
            name: name !== undefined ? name : unit.name,
            code: code !== undefined ? code : unit.code,
            description:
                description !== undefined
                    ? description
                    : unit.description,
            is_active:
                is_active !== undefined
                    ? is_active
                    : unit.is_active
        });

        return res.status(200).json({
            message: 'Unit updated successfully',
            data: unit
        });
    } catch (error) {
        console.error('Update unit error:', error);

        return res.status(500).json({
            message: 'Failed to update unit'
        });
    }
};

// DELETE / DEACTIVATE UNIT
const deleteUnit = async (req, res) => {
    try {
        const { id } = req.params;

        const unit = await Unit.findByPk(id);

        if (!unit) {
            return res.status(404).json({
                message: 'Unit not found'
            });
        }

        await unit.update({
            is_active: false
        });

        return res.status(200).json({
            message: 'Unit deactivated successfully'
        });
    } catch (error) {
        console.error('Delete unit error:', error);

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
