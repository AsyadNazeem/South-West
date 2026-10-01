const { OrderItem, Order, Item } = require('../models');

// GET all order items
exports.getAllOrderItems = async (req, res) => {
    try {
        const orderItems = await OrderItem.findAll({
            include: [
                {
                    model: Order,
                    as: 'order',
                    attributes: [
                        'id',
                        'order_number',
                        'customer_id',
                        'status'
                    ]
                },
                {
                    model: Item,
                    as: 'item',
                    attributes: [
                        'id',
                        'item_code',
                        'item_name'
                    ]
                }
            ],
            order: [['id', 'ASC']]
        });

        res.status(200).json({
            message: 'Order items retrieved successfully',
            data: orderItems
        });
    } catch (error) {
        console.error('Get order items error:', error);

        res.status(500).json({
            message: 'Failed to retrieve order items',
            error: error.message
        });
    }
};

// GET order item by ID
exports.getOrderItemById = async (req, res) => {
    try {
        const orderItem = await OrderItem.findByPk(req.params.id, {
            include: [
                {
                    model: Order,
                    as: 'order',
                    attributes: [
                        'id',
                        'order_number',
                        'customer_id',
                        'status'
                    ]
                },
                {
                    model: Item,
                    as: 'item',
                    attributes: [
                        'id',
                        'item_code',
                        'item_name'
                    ]
                }
            ]
        });

        if (!orderItem) {
            return res.status(404).json({
                message: 'Order item not found'
            });
        }

        res.status(200).json({
            message: 'Order item retrieved successfully',
            data: orderItem
        });
    } catch (error) {
        console.error('Get order item error:', error);

        res.status(500).json({
            message: 'Failed to retrieve order item',
            error: error.message
        });
    }
};

// CREATE order item
exports.createOrderItem = async (req, res) => {
    try {
        const {
            order_id,
            item_id,
            quantity,
            unit_price,
            discount_amount,
            tax_amount,
            line_total
        } = req.body;

        if (!order_id || !item_id || quantity === undefined || unit_price === undefined) {
            return res.status(400).json({
                message: 'order_id, item_id, quantity and unit_price are required'
            });
        }

        const order = await Order.findByPk(order_id);

        if (!order) {
            return res.status(404).json({
                message: 'Order not found'
            });
        }

        const item = await Item.findByPk(item_id);

        if (!item) {
            return res.status(404).json({
                message: 'Item not found'
            });
        }

        const calculatedLineTotal =
            line_total !== undefined
                ? line_total
                : (
                    Number(quantity) * Number(unit_price)
                    - Number(discount_amount || 0)
                    + Number(tax_amount || 0)
                );

        const orderItem = await OrderItem.create({
            order_id,
            item_id,
            quantity,
            unit_price,
            discount_amount: discount_amount || 0,
            tax_amount: tax_amount || 0,
            line_total: calculatedLineTotal
        });

        res.status(201).json({
            message: 'Order item created successfully',
            data: orderItem
        });
    } catch (error) {
        console.error('Create order item error:', error);

        res.status(500).json({
            message: 'Failed to create order item',
            error: error.message
        });
    }
};

// UPDATE order item
exports.updateOrderItem = async (req, res) => {
    try {
        const orderItem = await OrderItem.findByPk(req.params.id);

        if (!orderItem) {
            return res.status(404).json({
                message: 'Order item not found'
            });
        }

        const {
            quantity,
            unit_price,
            discount_amount,
            tax_amount,
            line_total
        } = req.body;

        const newQuantity =
            quantity !== undefined ? quantity : orderItem.quantity;

        const newUnitPrice =
            unit_price !== undefined ? unit_price : orderItem.unit_price;

        const newDiscount =
            discount_amount !== undefined
                ? discount_amount
                : orderItem.discount_amount;

        const newTax =
            tax_amount !== undefined
                ? tax_amount
                : orderItem.tax_amount;

        const calculatedLineTotal =
            line_total !== undefined
                ? line_total
                : (
                    Number(newQuantity) * Number(newUnitPrice)
                    - Number(newDiscount)
                    + Number(newTax)
                );

        await orderItem.update({
            quantity: newQuantity,
            unit_price: newUnitPrice,
            discount_amount: newDiscount,
            tax_amount: newTax,
            line_total: calculatedLineTotal
        });

        res.status(200).json({
            message: 'Order item updated successfully',
            data: orderItem
        });
    } catch (error) {
        console.error('Update order item error:', error);

        res.status(500).json({
            message: 'Failed to update order item',
            error: error.message
        });
    }
};

// DELETE order item
exports.deleteOrderItem = async (req, res) => {
    try {
        const orderItem = await OrderItem.findByPk(req.params.id);

        if (!orderItem) {
            return res.status(404).json({
                message: 'Order item not found'
            });
        }

        await orderItem.destroy();

        res.status(200).json({
            message: 'Order item deleted successfully'
        });
    } catch (error) {
        console.error('Delete order item error:', error);

        res.status(500).json({
            message: 'Failed to delete order item',
            error: error.message
        });
    }
};
