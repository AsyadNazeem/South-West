'use strict';

const { ProductReview, Item, Customer, Order } = require('../models');

// GET all product reviews
exports.getAllProductReviews = async (req, res) => {
    try {
        const reviews = await ProductReview.findAll({
            include: [
                {
                    model: Item,
                    as: 'item'
                },
                {
                    model: Customer,
                    as: 'customer'
                },
                {
                    model: Order,
                    as: 'order'
                }
            ],
            order: [['created_at', 'DESC']]
        });

        res.status(200).json({
            message: 'Product reviews retrieved successfully',
            data: reviews
        });
    } catch (error) {
        console.error('Get product reviews error:', error);

        res.status(500).json({
            message: 'Failed to retrieve product reviews',
            error: error.message
        });
    }
};


// GET product review by ID
exports.getProductReviewById = async (req, res) => {
    try {
        const { id } = req.params;

        const review = await ProductReview.findByPk(id, {
            include: [
                {
                    model: Item,
                    as: 'item'
                },
                {
                    model: Customer,
                    as: 'customer'
                },
                {
                    model: Order,
                    as: 'order'
                }
            ]
        });

        if (!review) {
            return res.status(404).json({
                message: 'Product review not found'
            });
        }

        res.status(200).json({
            message: 'Product review retrieved successfully',
            data: review
        });
    } catch (error) {
        console.error('Get product review error:', error);

        res.status(500).json({
            message: 'Failed to retrieve product review',
            error: error.message
        });
    }
};


// CREATE product review
exports.createProductReview = async (req, res) => {
    try {
        const {
            item_id,
            customer_id,
            order_id,
            rating,
            review_title,
            review_text,
            status,
            is_verified_purchase
        } = req.body;

        // Check item
        const item = await Item.findByPk(item_id);

        if (!item) {
            return res.status(404).json({
                message: 'Item not found'
            });
        }

        // Check customer
        const customer = await Customer.findByPk(customer_id);

        if (!customer) {
            return res.status(404).json({
                message: 'Customer not found'
            });
        }

        // Check order if supplied
        if (order_id) {
            const order = await Order.findByPk(order_id);

            if (!order) {
                return res.status(404).json({
                    message: 'Order not found'
                });
            }
        }

        const review = await ProductReview.create({
            item_id,
            customer_id,
            order_id: order_id || null,
            rating,
            review_title: review_title || null,
            review_text: review_text || null,
            status: status || 'pending',
            is_verified_purchase: is_verified_purchase || false
        });

        const createdReview = await ProductReview.findByPk(review.id, {
            include: [
                {
                    model: Item,
                    as: 'item'
                },
                {
                    model: Customer,
                    as: 'customer'
                },
                {
                    model: Order,
                    as: 'order'
                }
            ]
        });

        res.status(201).json({
            message: 'Product review created successfully',
            data: createdReview
        });
    } catch (error) {
        console.error('Create product review error:', error);

        res.status(500).json({
            message: 'Failed to create product review',
            error: error.message
        });
    }
};


// UPDATE product review
exports.updateProductReview = async (req, res) => {
    try {
        const { id } = req.params;

        const review = await ProductReview.findByPk(id);

        if (!review) {
            return res.status(404).json({
                message: 'Product review not found'
            });
        }

        const {
            rating,
            review_title,
            review_text,
            status,
            is_verified_purchase,
            order_id
        } = req.body;

        await review.update({
            ...(rating !== undefined && { rating }),
            ...(review_title !== undefined && { review_title }),
            ...(review_text !== undefined && { review_text }),
            ...(status !== undefined && { status }),
            ...(is_verified_purchase !== undefined && {
                is_verified_purchase
            }),
            ...(order_id !== undefined && { order_id })
        });

        res.status(200).json({
            message: 'Product review updated successfully',
            data: review
        });
    } catch (error) {
        console.error('Update product review error:', error);

        res.status(500).json({
            message: 'Failed to update product review',
            error: error.message
        });
    }
};


// DELETE product review
exports.deleteProductReview = async (req, res) => {
    try {
        const { id } = req.params;

        const review = await ProductReview.findByPk(id);

        if (!review) {
            return res.status(404).json({
                message: 'Product review not found'
            });
        }

        await review.destroy();

        res.status(200).json({
            message: 'Product review deleted successfully'
        });
    } catch (error) {
        console.error('Delete product review error:', error);

        res.status(500).json({
            message: 'Failed to delete product review',
            error: error.message
        });
    }
};
