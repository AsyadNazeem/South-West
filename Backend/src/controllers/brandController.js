const { Brand } = require('../models');

// GET ALL BRANDS
const getBrands = async (req, res) => {
    try {
        const brands = await Brand.findAll({
            order: [['id', 'DESC']]
        });

        return res.status(200).json({
            message: 'Brands retrieved successfully',
            data: brands
        });
    } catch (error) {
        console.error('Get brands error:', error);

        return res.status(500).json({
            message: 'Failed to retrieve brands'
        });
    }
};

// GET BRAND BY ID
const getBrandById = async (req, res) => {
    try {
        const { id } = req.params;

        const brand = await Brand.findByPk(id);

        if (!brand) {
            return res.status(404).json({
                message: 'Brand not found'
            });
        }

        return res.status(200).json({
            message: 'Brand retrieved successfully',
            data: brand
        });
    } catch (error) {
        console.error('Get brand error:', error);

        return res.status(500).json({
            message: 'Failed to retrieve brand'
        });
    }
};

// CREATE BRAND
const createBrand = async (req, res) => {
    try {
        const {
            name,
            code,
            description,
            website
        } = req.body;

        // Required validation
        if (!name) {
            return res.status(400).json({
                message: 'Brand name is required'
            });
        }

        if (!code) {
            return res.status(400).json({
                message: 'Brand code is required'
            });
        }

        // Check duplicate name
        const existingName = await Brand.findOne({
            where: { name }
        });

        if (existingName) {
            return res.status(409).json({
                message: 'Brand name already exists'
            });
        }

        // Check duplicate code
        const existingCode = await Brand.findOne({
            where: { code }
        });

        if (existingCode) {
            return res.status(409).json({
                message: 'Brand code already exists'
            });
        }

        const brand = await Brand.create({
            name,
            code,
            description,
            website,
            is_active: true
        });

        return res.status(201).json({
            message: 'Brand created successfully',
            data: brand
        });
    } catch (error) {
        console.error('Create brand error:', error);

        return res.status(500).json({
            message: 'Failed to create brand'
        });
    }
};

// UPDATE BRAND
const updateBrand = async (req, res) => {
    try {
        const { id } = req.params;

        const brand = await Brand.findByPk(id);

        if (!brand) {
            return res.status(404).json({
                message: 'Brand not found'
            });
        }

        const {
            name,
            code,
            description,
            website,
            is_active
        } = req.body;

        // Check duplicate name
        if (name && name !== brand.name) {
            const existingName = await Brand.findOne({
                where: { name }
            });

            if (existingName) {
                return res.status(409).json({
                    message: 'Brand name already exists'
                });
            }
        }

        // Check duplicate code
        if (code && code !== brand.code) {
            const existingCode = await Brand.findOne({
                where: { code }
            });

            if (existingCode) {
                return res.status(409).json({
                    message: 'Brand code already exists'
                });
            }
        }

        await brand.update({
            name: name !== undefined ? name : brand.name,
            code: code !== undefined ? code : brand.code,
            description:
                description !== undefined
                    ? description
                    : brand.description,
            website:
                website !== undefined
                    ? website
                    : brand.website,
            is_active:
                is_active !== undefined
                    ? is_active
                    : brand.is_active
        });

        return res.status(200).json({
            message: 'Brand updated successfully',
            data: brand
        });
    } catch (error) {
        console.error('Update brand error:', error);

        return res.status(500).json({
            message: 'Failed to update brand'
        });
    }
};

// DELETE / DEACTIVATE BRAND
const deleteBrand = async (req, res) => {
    try {
        const { id } = req.params;

        const brand = await Brand.findByPk(id);

        if (!brand) {
            return res.status(404).json({
                message: 'Brand not found'
            });
        }

        await brand.update({
            is_active: false
        });

        return res.status(200).json({
            message: 'Brand deactivated successfully'
        });
    } catch (error) {
        console.error('Delete brand error:', error);

        return res.status(500).json({
            message: 'Failed to deactivate brand'
        });
    }
};

module.exports = {
    getBrands,
    getBrandById,
    createBrand,
    updateBrand,
    deleteBrand
};
