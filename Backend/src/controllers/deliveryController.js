'use strict';

const { Delivery, Order, DeliveryStatusHistory } = require('../models');

// Get all deliveries
exports.getAllDeliveries = async (req, res) => {
    try {
        const deliveries = await Delivery.findAll({
            include: [
                {
                    model: Order,
                    as: 'order'
                },
                {
                    model: DeliveryStatusHistory,
                    as: 'statusHistory'
                }
            ],
            order: [['id', 'DESC']]
        });

        return res.status(200).json({
            message: 'Deliveries retrieved successfully',
            data: deliveries
        });

    } catch (error) {
        console.error('Get deliveries error:', error);

        return res.status(500).json({
            message: 'Failed to retrieve deliveries'
        });
    }
};


// Get delivery by ID
exports.getDeliveryById = async (req, res) => {
    try {
        const { id } = req.params;

        const delivery = await Delivery.findByPk(id, {
            include: [
                {
                    model: Order,
                    as: 'order'
                },
                {
                    model: DeliveryStatusHistory,
                    as: 'statusHistory'
                }
            ]
        });

        if (!delivery) {
            return res.status(404).json({
                message: 'Delivery not found'
            });
        }

        return res.status(200).json({
            message: 'Delivery retrieved successfully',
            data: delivery
        });

    } catch (error) {
        console.error('Get delivery error:', error);

        return res.status(500).json({
            message: 'Failed to retrieve delivery'
        });
    }
};


// Create delivery
exports.createDelivery = async (req, res) => {
    try {
        const {
            delivery_reference,
            order_id,
            delivery_method,
            delivery_status,
            recipient_name,
            recipient_phone,
            address_line_1,
            address_line_2,
            city,
            state,
            postal_code,
            country,
            delivery_charge,
            tracking_number,
            courier_name,
            expected_delivery_date,
            dispatched_at,
            delivered_at,
            notes
        } = req.body;

        // Check delivery reference
        const existingReference = await Delivery.findOne({
            where: { delivery_reference }
        });

        if (existingReference) {
            return res.status(409).json({
                message: 'Delivery reference already exists'
            });
        }

        // Check order exists
        const order = await Order.findByPk(order_id);

        if (!order) {
            return res.status(404).json({
                message: 'Order not found'
            });
        }

        const delivery = await Delivery.create({
            delivery_reference,
            order_id,
            delivery_method,
            delivery_status,
            recipient_name,
            recipient_phone,
            address_line_1,
            address_line_2,
            city,
            state,
            postal_code,
            country,
            delivery_charge,
            tracking_number,
            courier_name,
            expected_delivery_date,
            dispatched_at,
            delivered_at,
            notes
        });

        return res.status(201).json({
            message: 'Delivery created successfully',
            data: delivery
        });

    } catch (error) {
        console.error('Create delivery error:', error);

        return res.status(500).json({
            message: 'Failed to create delivery'
        });
    }
};


// Update delivery
exports.updateDelivery = async (req, res) => {
    try {
        const { id } = req.params;

        const delivery = await Delivery.findByPk(id);

        if (!delivery) {
            return res.status(404).json({
                message: 'Delivery not found'
            });
        }

        const {
            delivery_reference,
            order_id,
            delivery_method,
            delivery_status,
            recipient_name,
            recipient_phone,
            address_line_1,
            address_line_2,
            city,
            state,
            postal_code,
            country,
            delivery_charge,
            tracking_number,
            courier_name,
            expected_delivery_date,
            dispatched_at,
            delivered_at,
            notes
        } = req.body;

        // Check duplicate reference
        if (delivery_reference && delivery_reference !== delivery.delivery_reference) {
            const existingReference = await Delivery.findOne({
                where: { delivery_reference }
            });

            if (existingReference) {
                return res.status(409).json({
                    message: 'Delivery reference already exists'
                });
            }
        }

        // Check order if being changed
        if (order_id && order_id !== delivery.order_id) {
            const order = await Order.findByPk(order_id);

            if (!order) {
                return res.status(404).json({
                    message: 'Order not found'
                });
            }
        }

        await delivery.update({
            delivery_reference,
            order_id,
            delivery_method,
            delivery_status,
            recipient_name,
            recipient_phone,
            address_line_1,
            address_line_2,
            city,
            state,
            postal_code,
            country,
            delivery_charge,
            tracking_number,
            courier_name,
            expected_delivery_date,
            dispatched_at,
            delivered_at,
            notes
        });

        return res.status(200).json({
            message: 'Delivery updated successfully',
            data: delivery
        });

    } catch (error) {
        console.error('Update delivery error:', error);

        return res.status(500).json({
            message: 'Failed to update delivery'
        });
    }
};


// Delete delivery
exports.deleteDelivery = async (req, res) => {
    try {
        const { id } = req.params;

        const delivery = await Delivery.findByPk(id);

        if (!delivery) {
            return res.status(404).json({
                message: 'Delivery not found'
            });
        }

        await delivery.destroy();

        return res.status(200).json({
            message: 'Delivery deleted successfully'
        });

    } catch (error) {
        console.error('Delete delivery error:', error);

        return res.status(500).json({
            message: 'Failed to delete delivery'
        });
    }
};
