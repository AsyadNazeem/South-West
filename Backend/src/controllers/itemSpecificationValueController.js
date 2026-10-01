const {
    ItemSpecificationValue,
    Item,
    ItemSpecification
} = require('../models');


// GET ALL
const getItemSpecificationValues = async (req, res) => {
    try {

        const records = await ItemSpecificationValue.findAll({
            include: [
                {
                    model: Item,
                    as: 'item',
                    attributes: [
                        'id',
                        'item_code',
                        'item_name'
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
            order: [['id', 'DESC']]
        });

        return res.status(200).json({
            message: 'Item specification values retrieved successfully',
            data: records
        });

    } catch (error) {

        console.error(
            'Get item specification values error:',
            error
        );

        return res.status(500).json({
            message: 'Failed to retrieve item specification values'
        });
    }
};


// GET BY ID
const getItemSpecificationValueById = async (req, res) => {
    try {

        const { id } = req.params;

        const record = await ItemSpecificationValue.findByPk(id, {
            include: [
                {
                    model: Item,
                    as: 'item',
                    attributes: [
                        'id',
                        'item_code',
                        'item_name'
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
                message: 'Item specification value not found'
            });
        }

        return res.status(200).json({
            message: 'Item specification value retrieved successfully',
            data: record
        });

    } catch (error) {

        console.error(
            'Get item specification value error:',
            error
        );

        return res.status(500).json({
            message: 'Failed to retrieve item specification value'
        });
    }
};


// CREATE
const createItemSpecificationValue = async (req, res) => {
    try {

        const {
            item_id,
            specification_id,
            value
        } = req.body;


        const item = await Item.findByPk(item_id);

        if (!item) {
            return res.status(404).json({
                message: 'Item not found'
            });
        }


        const specification = await ItemSpecification.findByPk(
            specification_id
        );

        if (!specification) {
            return res.status(404).json({
                message: 'Item specification not found'
            });
        }


        const existing = await ItemSpecificationValue.findOne({
            where: {
                item_id,
                specification_id
            }
        });

        if (existing) {
            return res.status(409).json({
                message: 'Specification value already exists for this item'
            });
        }


        const record = await ItemSpecificationValue.create({
            item_id,
            specification_id,
            value
        });


        const createdRecord =
            await ItemSpecificationValue.findByPk(
                record.id,
                {
                    include: [
                        {
                            model: Item,
                            as: 'item',
                            attributes: [
                                'id',
                                'item_code',
                                'item_name'
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
            message: 'Item specification value created successfully',
            data: createdRecord
        });

    } catch (error) {

        console.error(
            'Create item specification value error:',
            error
        );

        return res.status(500).json({
            message: 'Failed to create item specification value'
        });
    }
};


// UPDATE
const updateItemSpecificationValue = async (req, res) => {
    try {

        const { id } = req.params;

        const record = await ItemSpecificationValue.findByPk(id);

        if (!record) {
            return res.status(404).json({
                message: 'Item specification value not found'
            });
        }


        const { value } = req.body;

        await record.update({
            value
        });


        const updatedRecord =
            await ItemSpecificationValue.findByPk(
                id,
                {
                    include: [
                        {
                            model: Item,
                            as: 'item',
                            attributes: [
                                'id',
                                'item_code',
                                'item_name'
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
            message: 'Item specification value updated successfully',
            data: updatedRecord
        });

    } catch (error) {

        console.error(
            'Update item specification value error:',
            error
        );

        return res.status(500).json({
            message: 'Failed to update item specification value'
        });
    }
};


// DELETE
const deleteItemSpecificationValue = async (req, res) => {
    try {

        const { id } = req.params;

        const record = await ItemSpecificationValue.findByPk(id);

        if (!record) {
            return res.status(404).json({
                message: 'Item specification value not found'
            });
        }


        await record.destroy();

        return res.status(200).json({
            message: 'Item specification value deleted successfully'
        });

    } catch (error) {

        console.error(
            'Delete item specification value error:',
            error
        );

        return res.status(500).json({
            message: 'Failed to delete item specification value'
        });
    }
};


module.exports = {
    getItemSpecificationValues,
    getItemSpecificationValueById,
    createItemSpecificationValue,
    updateItemSpecificationValue,
    deleteItemSpecificationValue
};
