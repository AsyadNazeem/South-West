const { Supplier } = require('../models');


// GET ALL SUPPLIERS
const getSuppliers = async (req, res) => {
    try {
        const suppliers = await Supplier.findAll({
            order: [['id', 'DESC']]
        });

        return res.status(200).json({
            message: 'Suppliers retrieved successfully',
            data: suppliers
        });

    } catch (error) {
        console.error(
            'Get suppliers error:',
            error
        );

        return res.status(500).json({
            message: 'Failed to retrieve suppliers'
        });
    }
};


// GET SUPPLIER BY ID
const getSupplierById = async (req, res) => {
    try {
        const { id } = req.params;

        const supplier = await Supplier.findByPk(id);

        if (!supplier) {
            return res.status(404).json({
                message: 'Supplier not found'
            });
        }

        return res.status(200).json({
            message: 'Supplier retrieved successfully',
            data: supplier
        });

    } catch (error) {
        console.error(
            'Get supplier error:',
            error
        );

        return res.status(500).json({
            message: 'Failed to retrieve supplier'
        });
    }
};


// CREATE SUPPLIER
const createSupplier = async (req, res) => {
    try {
        const {
            supplier_code,
            company_name,
            contact_person,
            email,
            phone,
            address_line_1,
            address_line_2,
            city,
            state,
            postal_code,
            country,
            tax_number,
            payment_terms,
            notes
        } = req.body;

        // Required validation
        if (!supplier_code) {
            return res.status(400).json({
                message: 'Supplier code is required'
            });
        }

        if (!company_name) {
            return res.status(400).json({
                message: 'Company name is required'
            });
        }

        // Check duplicate supplier code
        const existingSupplier = await Supplier.findOne({
            where: {
                supplier_code
            }
        });

        if (existingSupplier) {
            return res.status(409).json({
                message: 'Supplier code already exists'
            });
        }

        // Create supplier
        const supplier = await Supplier.create({
            supplier_code,
            company_name,
            contact_person,
            email,
            phone,
            address_line_1,
            address_line_2,
            city,
            state,
            postal_code,
            country,
            tax_number,
            payment_terms,
            notes
        });

        return res.status(201).json({
            message: 'Supplier created successfully',
            data: supplier
        });

    } catch (error) {
        console.error(
            'Create supplier error:',
            error
        );

        return res.status(500).json({
            message: 'Failed to create supplier'
        });
    }
};


// UPDATE SUPPLIER
const updateSupplier = async (req, res) => {
    try {
        const { id } = req.params;

        const supplier = await Supplier.findByPk(id);

        if (!supplier) {
            return res.status(404).json({
                message: 'Supplier not found'
            });
        }

        await supplier.update(req.body);

        return res.status(200).json({
            message: 'Supplier updated successfully',
            data: supplier
        });

    } catch (error) {
        console.error(
            'Update supplier error:',
            error
        );

        return res.status(500).json({
            message: 'Failed to update supplier'
        });
    }
};


// DELETE / DEACTIVATE SUPPLIER
const deleteSupplier = async (req, res) => {
    try {
        const { id } = req.params;

        const supplier = await Supplier.findByPk(id);

        if (!supplier) {
            return res.status(404).json({
                message: 'Supplier not found'
            });
        }

        await supplier.update({
            is_active: false
        });

        return res.status(200).json({
            message: 'Supplier deactivated successfully'
        });

    } catch (error) {
        console.error(
            'Delete supplier error:',
            error
        );

        return res.status(500).json({
            message: 'Failed to deactivate supplier'
        });
    }
};


module.exports = {
    getSuppliers,
    getSupplierById,
    createSupplier,
    updateSupplier,
    deleteSupplier
};
