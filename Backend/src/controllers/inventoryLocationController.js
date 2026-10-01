const { InventoryLocation } = require('../models');


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
    try {
        const {
            code,
            name,
            location_type,
            address
        } = req.body;

        if (!code || !name) {
            return res.status(400).json({
                message: 'Code and name are required'
            });
        }

        const existingLocation = await InventoryLocation.findOne({
            where: { code }
        });

        if (existingLocation) {
            return res.status(409).json({
                message: 'Inventory location code already exists'
            });
        }

        const location = await InventoryLocation.create({
            code,
            name,
            location_type: location_type || 'store',
            address,
            is_active: true
        });


        return res.status(201).json({
            message: 'Inventory location created successfully',
            data: location
        });

    } catch (error) {
        console.error('Create inventory location error:', error);

        return res.status(500).json({
            message: 'Failed to create inventory location'
        });
    }
};


// UPDATE INVENTORY LOCATION
const updateInventoryLocation = async (req, res) => {
    try {
        const { id } = req.params;

        const location = await InventoryLocation.findByPk(id);

        if (!location) {
            return res.status(404).json({
                message: 'Inventory location not found'
            });
        }

        const {
            code,
            name,
            location_type,
            address,
            is_active
        } = req.body;

        if (code && code !== location.code) {
            const existingLocation = await InventoryLocation.findOne({
                where: { code }
            });

            if (existingLocation) {
                return res.status(409).json({
                    message: 'Inventory location code already exists'
                });
            }
        }

        await location.update({
            code: code !== undefined ? code : location.code,
            name: name !== undefined ? name : location.name,
            location_type:
                location_type !== undefined
                    ? location_type
                    : location.location_type,
            address:
                address !== undefined
                    ? address
                    : location.address,
            is_active:
                is_active !== undefined
                    ? is_active
                    : location.is_active
        });

        return res.status(200).json({
            message: 'Inventory location updated successfully',
            data: location
        });

    } catch (error) {
        console.error('Update inventory location error:', error);

        return res.status(500).json({
            message: 'Failed to update inventory location'
        });
    }
};


// DELETE INVENTORY LOCATION
const deleteInventoryLocation = async (req, res) => {
    try {
        const { id } = req.params;

        const location = await InventoryLocation.findByPk(id);

        if (!location) {
            return res.status(404).json({
                message: 'Inventory location not found'
            });
        }

        await location.update({
            is_active: false
        });

        return res.status(200).json({
            message: 'Inventory location deactivated successfully'
        });

    } catch (error) {
        console.error('Delete inventory location error:', error);

        return res.status(500).json({
            message: 'Failed to delete inventory location'
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
