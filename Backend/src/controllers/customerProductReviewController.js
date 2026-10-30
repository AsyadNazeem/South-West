
'use strict';

const {
    ProductReview,
    Item,
    Customer,
    Order,
    OrderItem,
} = require('../models');

const { Op, fn, col } = require('sequelize');

// Public: approved reviews and summary for one product.
exports.getProductReviews = async (req, res) => {
    try {
        const { itemId } = req.params;

        if (!/^\d+$/.test(String(itemId))) {
            return res.status(400).json({ message: 'Invalid product ID.' });
        }

        const item = await Item.findByPk(itemId, {
            attributes: ['id'],
        });

        if (!item) {
            return res.status(404).json({ message: 'Product not found.' });
        }

        const reviews = await ProductReview.findAll({
            where: {
                item_id: itemId,
                status: 'approved',
            },
            attributes: [
                'id',
                'rating',
                'review_title',
                'review_text',
                'is_verified_purchase',
                'created_at',
            ],
            include: [{
                model: Customer,
                as: 'customer',
                attributes: ['first_name', 'last_name'],
            }],
            order: [['created_at', 'DESC']],
        });

        const summary = await ProductReview.findOne({
            where: {
                item_id: itemId,
                status: 'approved',
            },
            attributes: [
                [fn('AVG', col('rating')), 'averageRating'],
                [fn('COUNT', col('id')), 'reviewCount'],
            ],
            raw: true,
        });

        return res.json({
            data: {
                reviews,
                averageRating: Number(summary?.averageRating || 0),
                reviewCount: Number(summary?.reviewCount || 0),
            },
        });
    } catch (error) {
        console.error('Get customer product reviews error:', error);
        return res.status(500).json({
            message: 'Unable to load product reviews.',
        });
    }
};

// Authenticated customer: submit a review.
// The customer ID, status and purchase verification are server-controlled.
exports.createCustomerReview = async (req, res) => {
    try {
        const customerId = req.customer?.id;
        const { item_id, rating, review_title, review_text } = req.body;

        if (!customerId) {
            return res.status(401).json({
                message: 'Please sign in to submit a review.',
            });
        }

        if (!/^\d+$/.test(String(item_id ?? ''))) {
            return res.status(400).json({
                message: 'A valid product is required.',
            });
        }

        if (
            !Number.isInteger(Number(rating)) ||
            Number(rating) < 1 ||
            Number(rating) > 5
        ) {
            return res.status(400).json({
                message: 'Rating must be between 1 and 5.',
            });
        }

        const title = String(review_title ?? '').trim();
        const reviewText = String(review_text ?? '').trim();

        if (title.length > 200 || reviewText.length > 5000) {
            return res.status(400).json({
                message: 'The review title or text is too long.',
            });
        }

        if (!title && !reviewText) {
            return res.status(400).json({
                message: 'Please enter a review title or review text.',
            });
        }

        const item = await Item.findByPk(item_id);

        if (!item) {
            return res.status(404).json({ message: 'Product not found.' });
        }

        const existingReview = await ProductReview.findOne({
            where: {
                item_id,
                customer_id: customerId,
            },
        });

        if (existingReview) {
            return res.status(409).json({
                message: 'You have already reviewed this product.',
            });
        }

        // Only a delivered order belonging to this customer qualifies.
        const purchasedOrderItem = await OrderItem.findOne({
            where: { item_id },
            include: [{
                model: Order,
                as: 'order',
                required: true,
                where: {
                    customer_id: customerId,
                    status: 'delivered',
                },
                attributes: ['id'],
            }],
            order: [['id', 'DESC']],
        });

        const review = await ProductReview.create({
            item_id,
            customer_id: customerId,
            order_id: purchasedOrderItem?.order_id ?? null,
            rating: Number(rating),
            review_title: title || null,
            review_text: reviewText || null,
            status: 'pending',
            is_verified_purchase: Boolean(purchasedOrderItem),
        });

        return res.status(201).json({
            message: 'Review submitted and awaiting approval.',
            data: {
                id: review.id,
                item_id: review.item_id,
                rating: review.rating,
                review_title: review.review_title,
                review_text: review.review_text,
                status: review.status,
                is_verified_purchase: review.is_verified_purchase,
                created_at: review.created_at,
            },
        });
    } catch (error) {
        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(409).json({
                message: 'You have already reviewed this product.',
            });
        }

        console.error('Create customer review error:', error);
        return res.status(500).json({
            message: 'Unable to submit your review.',
        });
    }
};

// Authenticated customer: see only their own reviews.
exports.getMyReviews = async (req, res) => {
    try {
        const reviews = await ProductReview.findAll({
            where: {
                customer_id: req.customer.id,
            },
            include: [{
                model: Item,
                as: 'item',
            }],
            order: [['created_at', 'DESC']],
        });

        return res.json({ data: reviews });
    } catch (error) {
        console.error('Get my reviews error:', error);
        return res.status(500).json({
            message: 'Unable to load your reviews.',
        });
    }
};
