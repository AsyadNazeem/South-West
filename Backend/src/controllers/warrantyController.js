'use strict';

const { Warranty, Item } = require('../models');


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
            countMap[row.warranty_id] = row.count;
        });

        const data = warranties.map((warranty) => ({
            ...warranty.toJSON(),
            product_count: countMap[warranty.id] || 0
        }));

        return res.status(200).json({
            message: 'Warranties retrieved successfully',
            data
        });

    } catch (error) {
        console.error('Get warranties error:', error);

        return res.status(500).json({
            message: 'Failed to retrieve warranties'
        });
    }
};


// GET WARRANTY BY ID
const getWarrantyById = async (req, res) => {
    try {
        const { id } = req.params;

        const warranty = await Warranty.findByPk(id);

        if (!warranty) {
            return res.status(404).json({
                message: 'Warranty not found'
            });
        }

        return res.status(200).json({
            message: 'Warranty retrieved successfully',
            data: warranty
        });

    } catch (error) {
        console.error('Get warranty error:', error);

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
            code,
            duration_value,
            duration_unit,
            description
        } = req.body;


        // Required validation
        if (!name) {
            return res.status(400).json({
                message: 'Warranty name is required'
            });
        }

        if (!code) {
            return res.status(400).json({
                message: 'Warranty code is required'
            });
        }

        if (
            duration_value === undefined ||
            duration_value === null
        ) {
            return res.status(400).json({
                message: 'Warranty duration is required'
            });
        }

        if (!duration_unit) {
            return res.status(400).json({
                message: 'Warranty duration unit is required'
            });
        }


        // Validate duration
        if (Number(duration_value) < 0) {
            return res.status(400).json({
                message: 'Warranty duration cannot be negative'
            });
        }


        // Check duplicate name
        const existingName = await Warranty.findOne({
            where: {
                name
            }
        });

        if (existingName) {
            return res.status(409).json({
                message: 'Warranty name already exists'
            });
        }


        // Check duplicate code
        const existingCode = await Warranty.findOne({
            where: {
                code
            }
        });

        if (existingCode) {
            return res.status(409).json({
                message: 'Warranty code already exists'
            });
        }


        // Create warranty
        const warranty = await Warranty.create({
            name,
            code,
            duration_value,
            duration_unit,
            description,
            is_active: true
        });


        return res.status(201).json({
            message: 'Warranty created successfully',
            data: warranty
        });

    } catch (error) {
        console.error('Create warranty error:', error);

        return res.status(500).json({
            message: 'Failed to create warranty'
        });
    }
};


// UPDATE WARRANTY
const updateWarranty = async (req, res) => {
    try {
        const { id } = req.params;

        const warranty = await Warranty.findByPk(id);

        if (!warranty) {
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


        // Check duplicate name
        if (name && name !== warranty.name) {

            const existingName = await Warranty.findOne({
                where: {
                    name
                }
            });

            if (existingName) {
                return res.status(409).json({
                    message: 'Warranty name already exists'
                });
            }
        }


        // Check duplicate code
        if (code && code !== warranty.code) {

            const existingCode = await Warranty.findOne({
                where: {
                    code
                }
            });

            if (existingCode) {
                return res.status(409).json({
                    message: 'Warranty code already exists'
                });
            }
        }


        // Validate duration
        if (
            duration_value !== undefined &&
            Number(duration_value) < 0
        ) {
            return res.status(400).json({
                message: 'Warranty duration cannot be negative'
            });
        }


        await warranty.update({
            name: name !== undefined
                ? name
                : warranty.name,

            code: code !== undefined
                ? code
                : warranty.code,

            duration_value: duration_value !== undefined
                ? duration_value
                : warranty.duration_value,

            duration_unit: duration_unit !== undefined
                ? duration_unit
                : warranty.duration_unit,

            description: description !== undefined
                ? description
                : warranty.description,

            is_active: is_active !== undefined
                ? is_active
                : warranty.is_active
        });


        return res.status(200).json({
            message: 'Warranty updated successfully',
            data: warranty
        });

    } catch (error) {
        console.error('Update warranty error:', error);

        return res.status(500).json({
            message: 'Failed to update warranty'
        });
    }
};


// DELETE / DEACTIVATE WARRANTY
const deleteWarranty = async (req, res) => {
    try {
        const { id } = req.params;

        const warranty = await Warranty.findByPk(id);

        if (!warranty) {
            return res.status(404).json({
                message: 'Warranty not found'
            });
        }


        await warranty.update({
            is_active: false
        });


        return res.status(200).json({
            message: 'Warranty deactivated successfully'
        });

    } catch (error) {
        console.error('Delete warranty error:', error);

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
