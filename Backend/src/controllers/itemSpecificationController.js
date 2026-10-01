const {
    ItemSpecification,
    ItemType
} = require('../models');


// GET ALL SPECIFICATIONS
const getItemSpecifications = async (req, res) => {
    try {
        const specifications = await ItemSpecification.findAll({
            include: [
                {
                    model: ItemType,
                    as: 'itemTypes',
                    attributes: [
                        'id',
                        'name',
                        'code'
                    ],
                    through: {
                        attributes: []
                    }
                }
            ],
            order: [['id', 'DESC']]
        });

        return res.status(200).json({
            message: 'Item specifications retrieved successfully',
            data: specifications
        });

    } catch (error) {
        console.error('Get item specifications error:', error);

        return res.status(500).json({
            message: 'Failed to retrieve item specifications'
        });
    }
};


// GET SPECIFICATION BY ID
const getItemSpecificationById = async (req, res) => {
    try {
        const { id } = req.params;

        const specification = await ItemSpecification.findByPk(id, {
            include: [
                {
                    model: ItemType,
                    as: 'itemTypes',
                    attributes: [
                        'id',
                        'name',
                        'code'
                    ],
                    through: {
                        attributes: []
                    }
                }
            ]
        });

        if (!specification) {
            return res.status(404).json({
                message: 'Item specification not found'
            });
        }

        return res.status(200).json({
            message: 'Item specification retrieved successfully',
            data: specification
        });

    } catch (error) {
        console.error('Get item specification error:', error);

        return res.status(500).json({
            message: 'Failed to retrieve item specification'
        });
    }
};


// CREATE SPECIFICATION
const createItemSpecification = async (req, res) => {
    try {
        const {
            name,
            code,
            data_type,
            unit,
            description,
            is_required,
            is_active
        } = req.body;

        const specification = await ItemSpecification.create({
            name,
            code,
            data_type: data_type || 'text',
            unit,
            description,
            is_required: is_required ?? false,
            is_active: is_active ?? true
        });

        return res.status(201).json({
            message: 'Item specification created successfully',
            data: specification
        });

    } catch (error) {
        console.error('Create item specification error:', error);

        return res.status(500).json({
            message: 'Failed to create item specification'
        });
    }
};


// UPDATE SPECIFICATION
const updateItemSpecification = async (req, res) => {
    try {
        const { id } = req.params;

        const specification = await ItemSpecification.findByPk(id);

        if (!specification) {
            return res.status(404).json({
                message: 'Item specification not found'
            });
        }

        const {
            name,
            code,
            data_type,
            unit,
            description,
            is_required,
            is_active
        } = req.body;

        await specification.update({
            name,
            code,
            data_type,
            unit,
            description,
            is_required,
            is_active
        });

        return res.status(200).json({
            message: 'Item specification updated successfully',
            data: specification
        });

    } catch (error) {
        console.error('Update item specification error:', error);

        return res.status(500).json({
            message: 'Failed to update item specification'
        });
    }
};


// DELETE SPECIFICATION
const deleteItemSpecification = async (req, res) => {
    try {
        const { id } = req.params;

        const specification = await ItemSpecification.findByPk(id);

        if (!specification) {
            return res.status(404).json({
                message: 'Item specification not found'
            });
        }

        await specification.destroy();

        return res.status(200).json({
            message: 'Item specification deleted successfully'
        });

    } catch (error) {
        console.error('Delete item specification error:', error);

        return res.status(500).json({
            message: 'Failed to delete item specification'
        });
    }
};


module.exports = {
    getItemSpecifications,
    getItemSpecificationById,
    createItemSpecification,
    updateItemSpecification,
    deleteItemSpecification
};
