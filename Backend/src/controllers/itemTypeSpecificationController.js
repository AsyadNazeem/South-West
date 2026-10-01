const {
    ItemTypeSpecification,
    ItemType,
    ItemSpecification
} = require('../models');


// GET ALL
const getItemTypeSpecifications = async (req, res) => {
    try {
        const records = await ItemTypeSpecification.findAll({
            include: [
                {
                    model: ItemType,
                    as: 'itemType',
                    attributes: [
                        'id',
                        'name',
                        'code'
                    ]
                },
                {
                    model: ItemSpecification,
                    as: 'specification',
                    attributes: [
                        'id',
                        'name',
                        'code',
                        'data_type',
                        'unit'
                    ]
                }
            ],
            order: [
                ['item_type_id', 'ASC'],
                ['sort_order', 'ASC']
            ]
        });

        return res.status(200).json({
            message: 'Item type specifications retrieved successfully',
            data: records
        });

    } catch (error) {
        console.error('Get item type specifications error:', error);

        return res.status(500).json({
            message: 'Failed to retrieve item type specifications'
        });
    }
};


// GET BY ID
const getItemTypeSpecificationById = async (req, res) => {
    try {
        const { id } = req.params;

        const record = await ItemTypeSpecification.findByPk(id, {
            include: [
                {
                    model: ItemType,
                    as: 'itemType',
                    attributes: [
                        'id',
                        'name',
                        'code'
                    ]
                },
                {
                    model: ItemSpecification,
                    as: 'specification',
                    attributes: [
                        'id',
                        'name',
                        'code',
                        'data_type',
                        'unit'
                    ]
                }
            ]
        });

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
        console.error('Get item type specification error:', error);

        return res.status(500).json({
            message: 'Failed to retrieve item type specification'
        });
    }
};


// CREATE
const createItemTypeSpecification = async (req, res) => {
    try {
        const {
            item_type_id,
            specification_id,
            is_required,
            sort_order
        } = req.body;

        const itemType = await ItemType.findByPk(item_type_id);

        if (!itemType) {
            return res.status(404).json({
                message: 'Item type not found'
            });
        }

        const specification = await ItemSpecification.findByPk(specification_id);

        if (!specification) {
            return res.status(404).json({
                message: 'Item specification not found'
            });
        }

        const existing = await ItemTypeSpecification.findOne({
            where: {
                item_type_id,
                specification_id
            }
        });

        if (existing) {
            return res.status(409).json({
                message: 'Specification is already assigned to this item type'
            });
        }

        const record = await ItemTypeSpecification.create({
            item_type_id,
            specification_id,
            is_required: is_required ?? specification.is_required,
            sort_order: sort_order ?? 0
        });

        const createdRecord = await ItemTypeSpecification.findByPk(
            record.id,
            {
                include: [
                    {
                        model: ItemType,
                        as: 'itemType',
                        attributes: [
                            'id',
                            'name',
                            'code'
                        ]
                    },
                    {
                        model: ItemSpecification,
                        as: 'specification',
                        attributes: [
                            'id',
                            'name',
                            'code',
                            'data_type',
                            'unit'
                        ]
                    }
                ]
            }
        );

        return res.status(201).json({
            message: 'Item type specification created successfully',
            data: createdRecord
        });

    } catch (error) {
        console.error('Create item type specification error:', error);

        return res.status(500).json({
            message: 'Failed to create item type specification'
        });
    }
};


// UPDATE
const updateItemTypeSpecification = async (req, res) => {
    try {
        const { id } = req.params;

        const record = await ItemTypeSpecification.findByPk(id);

        if (!record) {
            return res.status(404).json({
                message: 'Item type specification not found'
            });
        }

        const {
            is_required,
            sort_order
        } = req.body;

        await record.update({
            is_required,
            sort_order
        });

        const updatedRecord = await ItemTypeSpecification.findByPk(
            id,
            {
                include: [
                    {
                        model: ItemType,
                        as: 'itemType',
                        attributes: [
                            'id',
                            'name',
                            'code'
                        ]
                    },
                    {
                        model: ItemSpecification,
                        as: 'specification',
                        attributes: [
                            'id',
                            'name',
                            'code',
                            'data_type',
                            'unit'
                        ]
                    }
                ]
            }
        );

        return res.status(200).json({
            message: 'Item type specification updated successfully',
            data: updatedRecord
        });

    } catch (error) {
        console.error('Update item type specification error:', error);

        return res.status(500).json({
            message: 'Failed to update item type specification'
        });
    }
};


// DELETE
const deleteItemTypeSpecification = async (req, res) => {
    try {
        const { id } = req.params;

        const record = await ItemTypeSpecification.findByPk(id);

        if (!record) {
            return res.status(404).json({
                message: 'Item type specification not found'
            });
        }

        await record.destroy();

        return res.status(200).json({
            message: 'Item type specification deleted successfully'
        });

    } catch (error) {
        console.error('Delete item type specification error:', error);

        return res.status(500).json({
            message: 'Failed to delete item type specification'
        });
    }
};


module.exports = {
    getItemTypeSpecifications,
    getItemTypeSpecificationById,
    createItemTypeSpecification,
    updateItemTypeSpecification,
    deleteItemTypeSpecification
};
