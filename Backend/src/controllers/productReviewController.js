'use strict';

const { ProductReview, Item, Customer, Order } = require('../models');
const { recordAuditLog } = require('../services/auditLogService');

const AUDIT_MODULE = 'PRODUCT_REVIEW';

const getActorId = (req) =>
    req.user?.id ?? req.user?.user_id ?? null;

const getReviewSnapshot = (review) => {
    if (!review) return null;

    return {
        id: review.id,
        item_id: review.item_id,
        customer_id: review.customer_id,
        order_id: review.order_id ?? null,
        rating: review.rating,
        status: review.status,
        is_verified_purchase: review.is_verified_purchase
    };
};

const auditProductReview = async (
    req,
    {
        action,
        entityId = null,
        description = null,
        oldValues = null,
        newValues = null
    }
) => {
    try {
        await recordAuditLog({
            userId: getActorId(req),
            action,
            module: AUDIT_MODULE,
            entityType: 'ProductReview',
            entityId: entityId != null ? String(entityId) : null,
            description,
            oldValues,
            newValues,
            ipAddress: req.ip ?? null,
            userAgent: req.get('user-agent') ?? null,
            requestId: req.id ?? req.requestId ?? null
        });
    } catch (auditError) {
        console.error(
            'Product review audit logging failed:',
            auditError.message
        );
    }
};

const getReviewIncludes = () => [
    { model: Item, as: 'item' },
    { model: Customer, as: 'customer' },
    { model: Order, as: 'order' }
];

const validRating = (rating) =>
    rating !== undefined &&
    rating !== null &&
    rating !== '' &&
    Number.isInteger(Number(rating)) &&
    Number(rating) >= 1 &&
    Number(rating) <= 5;

const validStatus = (status) =>
    ['pending', 'approved', 'rejected'].includes(status);

// GET all product reviews
exports.getAllProductReviews = async (req, res) => {
    try {
        const reviews = await ProductReview.findAll({
            include: getReviewIncludes(),
            order: [['created_at', 'DESC']]
        });

        await auditProductReview(req, {
            action: 'PRODUCT_REVIEW_LIST_VIEWED',
            description: 'Retrieved product review records'
        });

        return res.status(200).json({
            message: 'Product reviews retrieved successfully',
            data: reviews
        });
    } catch (error) {
        console.error('Get product reviews error:', error);

        await auditProductReview(req, {
            action: 'PRODUCT_REVIEW_LIST_FAILED',
            description: 'Failed to retrieve product reviews'
        });

        return res.status(500).json({
            message: 'Failed to retrieve product reviews'
        });
    }
};

// GET product review by ID
exports.getProductReviewById = async (req, res) => {
    const { id } = req.params;

    try {
        const review = await ProductReview.findByPk(id, {
            include: getReviewIncludes()
        });

        if (!review) {
            await auditProductReview(req, {
                action: 'PRODUCT_REVIEW_NOT_FOUND',
                entityId: id,
                description: 'Requested product review was not found'
            });

            return res.status(404).json({
                message: 'Product review not found'
            });
        }

        await auditProductReview(req, {
            action: 'PRODUCT_REVIEW_VIEWED',
            entityId: review.id,
            description: 'Retrieved a product review'
        });

        return res.status(200).json({
            message: 'Product review retrieved successfully',
            data: review
        });
    } catch (error) {
        console.error('Get product review error:', error);

        await auditProductReview(req, {
            action: 'PRODUCT_REVIEW_VIEW_FAILED',
            entityId: id,
            description: 'Failed to retrieve product review'
        });

        return res.status(500).json({
            message: 'Failed to retrieve product review'
        });
    }
};

// CREATE product review
exports.createProductReview = async (req, res) => {
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

    try {
        if (!item_id || !customer_id || rating === undefined) {
            await auditProductReview(req, {
                action: 'PRODUCT_REVIEW_CREATE_REJECTED',
                description: 'Review creation rejected: required fields missing',
                newValues: {
                    item_id: item_id ?? null,
                    customer_id: customer_id ?? null,
                    rating: rating ?? null
                }
            });

            return res.status(400).json({
                message: 'item_id, customer_id and rating are required'
            });
        }

        if (!validRating(rating)) {
            await auditProductReview(req, {
                action: 'PRODUCT_REVIEW_CREATE_REJECTED',
                description: 'Review creation rejected: invalid rating',
                newValues: { item_id, customer_id }
            });

            return res.status(400).json({
                message: 'Rating must be an integer between 1 and 5'
            });
        }

        if (status !== undefined && !validStatus(status)) {
            await auditProductReview(req, {
                action: 'PRODUCT_REVIEW_CREATE_REJECTED',
                description: 'Review creation rejected: invalid status',
                newValues: { item_id, customer_id }
            });

            return res.status(400).json({
                message: 'Invalid review status'
            });
        }

        const item = await Item.findByPk(item_id);

        if (!item) {
            await auditProductReview(req, {
                action: 'PRODUCT_REVIEW_CREATE_REJECTED',
                description: 'Review creation rejected: item not found',
                newValues: { item_id, customer_id }
            });

            return res.status(404).json({
                message: 'Item not found'
            });
        }

        const customer = await Customer.findByPk(customer_id);

        if (!customer) {
            await auditProductReview(req, {
                action: 'PRODUCT_REVIEW_CREATE_REJECTED',
                description: 'Review creation rejected: customer not found',
                newValues: { item_id, customer_id }
            });

            return res.status(404).json({
                message: 'Customer not found'
            });
        }

        if (order_id) {
            const order = await Order.findByPk(order_id);

            if (!order) {
                await auditProductReview(req, {
                    action: 'PRODUCT_REVIEW_CREATE_REJECTED',
                    description: 'Review creation rejected: order not found',
                    newValues: { item_id, customer_id, order_id }
                });

                return res.status(404).json({
                    message: 'Order not found'
                });
            }
        }

        // Customers must not be allowed to self-verify purchases.
        // Verification should be established by trusted server-side logic.
        const review = await ProductReview.create({
            item_id,
            customer_id,
            order_id: order_id || null,
            rating: Number(rating),
            review_title: review_title || null,
            review_text: review_text || null,
            status: status || 'pending',
            is_verified_purchase: false
        });

        await auditProductReview(req, {
            action: 'PRODUCT_REVIEW_CREATED',
            entityId: review.id,
            description: 'Created a product review',
            newValues: getReviewSnapshot(review)
        });

        const createdReview = await ProductReview.findByPk(review.id, {
            include: getReviewIncludes()
        });

        return res.status(201).json({
            message: 'Product review created successfully',
            data: createdReview
        });
    } catch (error) {
        console.error('Create product review error:', error);

        await auditProductReview(req, {
            action: 'PRODUCT_REVIEW_CREATE_FAILED',
            description: 'Failed to create product review',
            newValues: {
                item_id: item_id ?? null,
                customer_id: customer_id ?? null,
                order_id: order_id ?? null
            }
        });

        return res.status(500).json({
            message: 'Failed to create product review'
        });
    }
};

// UPDATE product review
exports.updateProductReview = async (req, res) => {
    const { id } = req.params;

    try {
        const review = await ProductReview.findByPk(id);

        if (!review) {
            await auditProductReview(req, {
                action: 'PRODUCT_REVIEW_UPDATE_REJECTED',
                entityId: id,
                description: 'Review update rejected: review not found'
            });

            return res.status(404).json({
                message: 'Product review not found'
            });
        }

        const oldValues = getReviewSnapshot(review);

        const {
            rating,
            review_title,
            review_text,
            status,
            is_verified_purchase,
            order_id
        } = req.body;

        const updates = {};

        if (rating !== undefined) {
            if (!validRating(rating)) {
                await auditProductReview(req, {
                    action: 'PRODUCT_REVIEW_UPDATE_REJECTED',
                    entityId: review.id,
                    description: 'Review update rejected: invalid rating',
                    oldValues
                });

                return res.status(400).json({
                    message: 'Rating must be an integer between 1 and 5'
                });
            }

            updates.rating = Number(rating);
        }

        if (review_title !== undefined) {
            updates.review_title = review_title;
        }

        if (review_text !== undefined) {
            updates.review_text = review_text;
        }

        if (status !== undefined) {
            if (!validStatus(status)) {
                await auditProductReview(req, {
                    action: 'PRODUCT_REVIEW_UPDATE_REJECTED',
                    entityId: review.id,
                    description: 'Review update rejected: invalid status',
                    oldValues
                });

                return res.status(400).json({
                    message: 'Invalid review status'
                });
            }

            updates.status = status;
        }

        // Do not allow this endpoint to self-assign purchase verification.
        if (is_verified_purchase !== undefined) {
            await auditProductReview(req, {
                action: 'PRODUCT_REVIEW_UPDATE_REJECTED',
                entityId: review.id,
                description: 'Review update rejected: purchase verification requires trusted server-side logic',
                oldValues
            });

            return res.status(403).json({
                message: 'Purchase verification cannot be changed through this endpoint'
            });
        }

        if (order_id !== undefined) {
            if (order_id !== null) {
                const order = await Order.findByPk(order_id);

                if (!order) {
                    await auditProductReview(req, {
                        action: 'PRODUCT_REVIEW_UPDATE_REJECTED',
                        entityId: review.id,
                        description: 'Review update rejected: order not found',
                        oldValues
                    });

                    return res.status(404).json({
                        message: 'Order not found'
                    });
                }
            }

            updates.order_id = order_id;
        }

        if (Object.keys(updates).length === 0) {
            await auditProductReview(req, {
                action: 'PRODUCT_REVIEW_UPDATE_REJECTED',
                entityId: review.id,
                description: 'Review update rejected: no permitted fields supplied',
                oldValues
            });

            return res.status(400).json({
                message: 'No valid fields provided for update'
            });
        }

        await review.update(updates);

        await auditProductReview(req, {
            action: 'PRODUCT_REVIEW_UPDATED',
            entityId: review.id,
            description: 'Updated a product review',
            oldValues,
            newValues: getReviewSnapshot(review)
        });

        return res.status(200).json({
            message: 'Product review updated successfully',
            data: review
        });
    } catch (error) {
        console.error('Update product review error:', error);

        await auditProductReview(req, {
            action: 'PRODUCT_REVIEW_UPDATE_FAILED',
            entityId: id,
            description: 'Failed to update product review'
        });

        return res.status(500).json({
            message: 'Failed to update product review'
        });
    }
};

// DELETE product review
exports.deleteProductReview = async (req, res) => {
    const { id } = req.params;

    try {
        const review = await ProductReview.findByPk(id);

        if (!review) {
            await auditProductReview(req, {
                action: 'PRODUCT_REVIEW_DELETE_REJECTED',
                entityId: id,
                description: 'Review deletion rejected: review not found'
            });

            return res.status(404).json({
                message: 'Product review not found'
            });
        }

        const oldValues = getReviewSnapshot(review);

        await review.destroy();

        await auditProductReview(req, {
            action: 'PRODUCT_REVIEW_DELETED',
            entityId: id,
            description: 'Deleted a product review',
            oldValues
        });

        return res.status(200).json({
            message: 'Product review deleted successfully'
        });
    } catch (error) {
        console.error('Delete product review error:', error);

        await auditProductReview(req, {
            action: 'PRODUCT_REVIEW_DELETE_FAILED',
            entityId: id,
            description: 'Failed to delete product review'
        });

        return res.status(500).json({
            message: 'Failed to delete product review'
        });
    }
};
