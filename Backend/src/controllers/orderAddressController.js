'use strict';

const { OrderAddress, Order } = require('../models');

// Get all order addresses
const getOrderAddresses = async (req, res) => {
    try {
        const addresses = await OrderAddress.findAll({
            include: [
                {
                    model: Order,
                    as: 'order',
                    attributes: [
                        'id',
                        'order_number',
                        'customer_id',
                        'order_date',
                        'status'
                    ]
                }
            ],
            order: [['id', 'ASC']]
        });

        res.status(200).json({
            message: 'Order addresses retrieved successfully',
            data: addresses
        });

    } catch (error) {
        console.error('Get order addresses error:', error);

        res.status(500).json({
            message: 'Failed to retrieve order addresses',
            error: error.message
        });
    }
};


// Get single order address
const getOrderAddressById = async (req, res) => {
    try {
        const { id } = req.params;

        const address = await OrderAddress.findByPk(id, {
            include: [
                {
                    model: Order,
                    as: 'order',
                    attributes: [
                        'id',
                        'order_number',
                        'customer_id',
                        'order_date',
                        'status'
                    ]
                }
            ]
        });

        if (!address) {
            return res.status(404).json({
                message: 'Order address not found'
            });
        }

        res.status(200).json({
            message: 'Order address retrieved successfully',
            data: address
        });

    } catch (error) {
        console.error('Get order address error:', error);

        res.status(500).json({
            message: 'Failed to retrieve order address',
            error: error.message
        });
    }
};


// Create order address
const createOrderAddress = async (req, res) => {
    try {
        const {
            order_id,
            address_type,
            recipient_name,
            phone,
            address_line_1,
            address_line_2,
            city,
            state,
            postal_code,
            country
        } = req.body;

        if (!order_id || !address_type || !recipient_name ||
            !address_line_1 || !city || !country) {
            return res.status(400).json({
                message: 'order_id, address_type, recipient_name, address_line_1, city and country are required'
            });
        }

        if (!['billing', 'shipping'].includes(address_type)) {
            return res.status(400).json({
                message: 'Invalid address_type',
                allowed_types: ['billing', 'shipping']
            });
        }

        const order = await Order.findByPk(order_id);

        if (!order) {
            return res.status(404).json({
                message: 'Order not found'
            });
        }

        const address = await OrderAddress.create({
            order_id,
            address_type,
            recipient_name,
            phone,
            address_line_1,
            address_line_2,
            city,
            state,
            postal_code,
            country
        });

        const createdAddress = await OrderAddress.findByPk(address.id, {
            include: [
                {
                    model: Order,
                    as: 'order',
                    attributes: [
                        'id',
                        'order_number',
                        'customer_id',
                        'order_date',
                        'status'
                    ]
                }
            ]
        });

        res.status(201).json({
            message: 'Order address created successfully',
            data: createdAddress
        });

    } catch (error) {
        console.error('Create order address error:', error);

        res.status(500).json({
            message: 'Failed to create order address',
            error: error.message
        });
    }
};


// Update order address
const updateOrderAddress = async (req, res) => {
    try {
        const { id } = req.params;

        const address = await OrderAddress.findByPk(id);

        if (!address) {
            return res.status(404).json({
                message: 'Order address not found'
            });
        }

        const allowedFields = [
            'address_type',
            'recipient_name',
            'phone',
            'address_line_1',
            'address_line_2',
            'city',
            'state',
            'postal_code',
            'country'
        ];

        const updateData = {};

        allowedFields.forEach(field => {
            if (req.body[field] !== undefined) {
                updateData[field] = req.body[field];
            }
        });

        if (
            updateData.address_type &&
            !['billing', 'shipping'].includes(updateData.address_type)
        ) {
            return res.status(400).json({
                message: 'Invalid address_type',
                allowed_types: ['billing', 'shipping']
            });
        }

        await address.update(updateData);

        const updatedAddress = await OrderAddress.findByPk(id, {
            include: [
                {
                    model: Order,
                    as: 'order',
                    attributes: [
                        'id',
                        'order_number',
                        'customer_id',
                        'order_date',
                        'status'
                    ]
                }
            ]
        });

        res.status(200).json({
            message: 'Order address updated successfully',
            data: updatedAddress
        });

    } catch (error) {
        console.error('Update order address error:', error);

        res.status(500).json({
            message: 'Failed to update order address',
            error: error.message
        });
    }
};


// Delete order address
const deleteOrderAddress = async (req, res) => {
    try {
        const { id } = req.params;

        const address = await OrderAddress.findByPk(id);

        if (!address) {
            return res.status(404).json({
                message: 'Order address not found'
            });
        }

        await address.destroy();

        res.status(200).json({
            message: 'Order address deleted successfully'
        });

    } catch (error) {
        console.error('Delete order address error:', error);

        res.status(500).json({
            message: 'Failed to delete order address',
            error: error.message
        });
    }
};


module.exports = {
    getOrderAddresses,
    getOrderAddressById,
    createOrderAddress,
    updateOrderAddress,
    deleteOrderAddress
};
