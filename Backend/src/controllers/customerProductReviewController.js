'use strict';

const {
    ProductReview,
    Item,
    Customer,
    Order,
    OrderItem,
} = require('../models');

const { fn, col } = require('sequelize');
const { randomInt } = require('node:crypto');

function maskName(value) {
    const name = String(value || '').trim();
    if (!name) return 'Customer';

    const chars = Array.from(name);
    if (chars.length <= 2) return chars[0] + '*'.repeat(Math.max(1, chars.length - 1));

    return chars[0] + '*'.repeat(chars.length - 2) + chars[chars.length - 1];
}

function publicReviewerName(review) {
    if (!review.customer_id) {
        return `Guest #${review.guest_number}`;
    }

    const firstName = review.customer?.first_name || '';
    const lastName = review.customer?.last_name || '';

    if (review.display_name) {
        return [firstName, lastName].filter(Boolean).join(' ') || 'Customer';
    }

    return [maskName(firstName), maskName(lastName)]
        .filter(Boolean)
        .join(' ') || 'Customer';
}

function generateGuestNumber() {
    return String(randomInt(100000, 1000000));
}

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
                'customer_id',
                'guest_number',
                'display_name',
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

        const publicReviews = reviews.map((review) => {
            const values = review.toJSON ? review.toJSON() : { ...review };
            const displayName = publicReviewerName(values);

            delete values.customer_id;
            delete values.guest_number;
            delete values.display_name;
            delete values.customer;

            return {
                ...values,
                reviewer_name: displayName,
            };
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
                reviews: publicReviews,
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

// Guests and authenticated customers can submit reviews.
// Identity, display preference, approval and purchase verification are server-controlled.
exports.createCustomerReview = async (req, res) => {
    try {
        const customerId = req.customer?.id ?? null;
        const {
            item_id,
            rating,
            review_title,
            review_text,
        } = req.body || {};

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

        if (customerId) {
            const existingReview = await ProductReview.findOne({
                where: { item_id, customer_id: customerId },
                attributes: ['id'],
            });

            if (existingReview) {
                return res.status(409).json({
                    message: 'You have already reviewed this product.',
                });
            }
        }

        // Only a delivered order belonging to this signed-in customer qualifies.
        const purchasedOrderItem = customerId
            ? await OrderItem.findOne({
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
            })
            : null;

        let guestNumber = null;

        if (!customerId) {
            // Retry in the unlikely event of a six-digit collision.
            for (let attempt = 0; attempt < 10; attempt += 1) {
                const candidate = generateGuestNumber();
                const existingGuest = await ProductReview.findOne({
                    where: { guest_number: candidate },
                    attributes: ['id'],
                });

                if (!existingGuest) {
                    guestNumber = candidate;
                    break;
                }
            }

            if (!guestNumber) {
                return res.status(503).json({
                    message: 'Unable to generate a guest review ID. Please try again.',
                });
            }
        }

        const displayName = customerId
            ? req.body?.display_name === true || req.body?.display_name === 'true'
            : false;

        const reviewData = {
            item_id,
            customer_id: customerId,
            guest_number: guestNumber,
            display_name: displayName,
            order_id: purchasedOrderItem?.order_id ?? null,
            rating: Number(rating),
            review_title: title || null,
            review_text: reviewText || null,
            status: 'pending',
            is_verified_purchase: Boolean(purchasedOrderItem),
        };

        let review = null;

        for (let attempt = 0; attempt < (customerId ? 1 : 10); attempt += 1) {
            try {
                review = await ProductReview.create(reviewData);
                break;
            } catch (error) {
                if (
                    !customerId &&
                    error.name === 'SequelizeUniqueConstraintError' &&
                    attempt < 9 &&
                    error.fields &&
                    (error.fields.guest_number || error.errors?.some(
                        (entry) => entry.path === 'guest_number'
                    ))
                ) {
                    guestNumber = generateGuestNumber();
                    reviewData.guest_number = guestNumber;
                    continue;
                }

                throw error;
            }
        }

        if (!review) {
            return res.status(503).json({
                message: 'Unable to generate a guest review ID. Please try again.',
            });
        }

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
                reviewer_name: customerId
                    ? undefined
                    : `Guest #${guestNumber}`,
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
