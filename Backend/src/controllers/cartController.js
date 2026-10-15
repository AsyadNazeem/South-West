'use strict';

const { Cart, Customer } = require('../models');
const { recordAuditLog } = require('../services/auditLogService');

// =====================================================
// AUDIT HELPER
// =====================================================

const auditCartAction = async ({
                                   req,
                                   action,
                                   cartId = null,
                                   customerId = null,
                                   description,
                                   oldValues = null,
                                   newValues = null
                               }) => {
    try {
        await recordAuditLog({
            userId: req.user?.id ?? req.user?.user_id ?? null,
            action,
            module: 'CART',
            entityType: 'Cart',
            entityId: cartId,
            description,
            oldValues,
            newValues: {
                ...(newValues || {}),
                ...(customerId !== null
                    ? { customer_id: customerId }
                    : {})
            },
            ipAddress: req.ip,
            userAgent: req.get('user-agent'),
            requestId: req.id
        });
    } catch (error) {
        // Audit failures must not break the cart operation.
        console.error('Cart audit logging failed:', error.message);
    }
};

// =====================================================
// GET ALL CARTS
// =====================================================

const getCarts = async (req, res) => {
    try {
        const carts = await Cart.findAll({
            include: [
                {
                    model: Customer,
                    as: 'customer'
                }
            ],
            order: [['id', 'DESC']]
        });

        await auditCartAction({
            req,
            action: 'CART_LIST_VIEWED',
            description: 'Cart list retrieved successfully',
            newValues: {
                result_count: carts.length
            }
        });

        return res.status(200).json({
            message: 'Carts retrieved successfully',
            data: carts
        });
    } catch (error) {
        console.error('Get carts error:', error);

        await auditCartAction({
            req,
            action: 'CART_LIST_VIEW_FAILED',
            description: 'Failed to retrieve carts'
        });

        return res.status(500).json({
            message: 'Failed to retrieve carts'
        });
    }
};

// =====================================================
// GET CART BY ID
// =====================================================

const getCartById = async (req, res) => {
    try {
        const { id } = req.params;

        const cart = await Cart.findByPk(id, {
            include: [
                {
                    model: Customer,
                    as: 'customer'
                }
            ]
        });

        if (!cart) {
            await auditCartAction({
                req,
                action: 'CART_VIEW_FAILED',
                cartId: id,
                description: 'Cart lookup failed because the cart was not found'
            });

            return res.status(404).json({
                message: 'Cart not found'
            });
        }

        await auditCartAction({
            req,
            action: 'CART_VIEWED',
            cartId: cart.id,
            customerId: cart.customer_id,
            description: 'Cart retrieved successfully',
            newValues: {
                status: cart.status
            }
        });

        return res.status(200).json({
            message: 'Cart retrieved successfully',
            data: cart
        });
    } catch (error) {
        console.error('Get cart error:', error);

        await auditCartAction({
            req,
            action: 'CART_VIEW_FAILED',
            cartId: req.params.id,
            description: 'Unexpected error while retrieving cart'
        });

        return res.status(500).json({
            message: 'Failed to retrieve cart'
        });
    }
};

// =====================================================
// CREATE CART
// =====================================================

const createCart = async (req, res) => {
    try {
        const {
            customer_id,
            status,
            expires_at
        } = req.body;

        // Required validation
        if (!customer_id) {
            await auditCartAction({
                req,
                action: 'CART_CREATE_FAILED',
                description: 'Cart creation rejected because customer ID was missing'
            });

            return res.status(400).json({
                message: 'Customer ID is required'
            });
        }

        // Check customer exists
        const customer = await Customer.findByPk(customer_id);

        if (!customer) {
            await auditCartAction({
                req,
                action: 'CART_CREATE_FAILED',
                customerId: customer_id,
                description: 'Cart creation rejected because customer was not found'
            });

            return res.status(404).json({
                message: 'Customer not found'
            });
        }

        // Check if customer already has an active cart
        const existingCart = await Cart.findOne({
            where: {
                customer_id,
                status: 'active'
            }
        });

        if (existingCart) {
            await auditCartAction({
                req,
                action: 'CART_CREATE_FAILED',
                cartId: existingCart.id,
                customerId: customer_id,
                description: 'Cart creation rejected because customer already has an active cart',
                newValues: {
                    status: existingCart.status
                }
            });

            return res.status(409).json({
                message: 'Customer already has an active cart',
                data: existingCart
            });
        }

        const cart = await Cart.create({
            customer_id,
            status: status || 'active',
            expires_at
        });

        await auditCartAction({
            req,
            action: 'CART_CREATED',
            cartId: cart.id,
            customerId: cart.customer_id,
            description: 'Cart created successfully',
            newValues: {
                status: cart.status,
                expires_at: cart.expires_at
            }
        });

        return res.status(201).json({
            message: 'Cart created successfully',
            data: cart
        });
    } catch (error) {
        console.error('Create cart error:', error);

        await auditCartAction({
            req,
            action: 'CART_CREATE_FAILED',
            customerId: req.body?.customer_id ?? null,
            description: 'Unexpected error while creating cart'
        });

        return res.status(500).json({
            message: 'Failed to create cart'
        });
    }
};

// =====================================================
// UPDATE CART
// =====================================================

const updateCart = async (req, res) => {
    try {
        const { id } = req.params;

        const cart = await Cart.findByPk(id);

        if (!cart) {
            await auditCartAction({
                req,
                action: 'CART_UPDATE_FAILED',
                cartId: id,
                description: 'Cart update rejected because cart was not found'
            });

            return res.status(404).json({
                message: 'Cart not found'
            });
        }

        // Capture old values before updating.
        const oldValues = {
            status: cart.status,
            expires_at: cart.expires_at
        };

        // Only update fields intended to be editable here.
        // Keep the existing authorization and validation middleware.
        const allowedUpdates = {};

        if (Object.prototype.hasOwnProperty.call(req.body, 'status')) {
            allowedUpdates.status = req.body.status;
        }

        if (Object.prototype.hasOwnProperty.call(req.body, 'expires_at')) {
            allowedUpdates.expires_at = req.body.expires_at;
        }

        if (Object.keys(allowedUpdates).length === 0) {
            await auditCartAction({
                req,
                action: 'CART_UPDATE_FAILED',
                cartId: cart.id,
                customerId: cart.customer_id,
                description: 'Cart update rejected because no editable fields were supplied'
            });

            return res.status(400).json({
                message: 'No valid fields provided for update'
            });
        }

        await cart.update(allowedUpdates);

        await auditCartAction({
            req,
            action: 'CART_UPDATED',
            cartId: cart.id,
            customerId: cart.customer_id,
            description: 'Cart updated successfully',
            oldValues,
            newValues: {
                status: cart.status,
                expires_at: cart.expires_at
            }
        });

        return res.status(200).json({
            message: 'Cart updated successfully',
            data: cart
        });
    } catch (error) {
        console.error('Update cart error:', error);

        await auditCartAction({
            req,
            action: 'CART_UPDATE_FAILED',
            cartId: req.params.id,
            description: 'Unexpected error while updating cart'
        });

        return res.status(500).json({
            message: 'Failed to update cart'
        });
    }
};

// =====================================================
// DELETE / ABANDON CART
// =====================================================

const deleteCart = async (req, res) => {
    try {
        const { id } = req.params;

        const cart = await Cart.findByPk(id);

        if (!cart) {
            await auditCartAction({
                req,
                action: 'CART_ABANDON_FAILED',
                cartId: id,
                description: 'Cart abandonment rejected because cart was not found'
            });

            return res.status(404).json({
                message: 'Cart not found'
            });
        }

        const oldValues = {
            status: cart.status,
            expires_at: cart.expires_at
        };

        if (cart.status === 'abandoned') {
            return res.status(200).json({
                message: 'Cart is already abandoned'
            });
        }

        await cart.update({
            status: 'abandoned'
        });

        await auditCartAction({
            req,
            action: 'CART_ABANDONED',
            cartId: cart.id,
            customerId: cart.customer_id,
            description: 'Cart abandoned successfully',
            oldValues,
            newValues: {
                status: cart.status,
                expires_at: cart.expires_at
            }
        });

        return res.status(200).json({
            message: 'Cart abandoned successfully'
        });
    } catch (error) {
        console.error('Abandon cart error:', error);

        await auditCartAction({
            req,
            action: 'CART_ABANDON_FAILED',
            cartId: req.params.id,
            description: 'Unexpected error while abandoning cart'
        });

        return res.status(500).json({
            message: 'Failed to abandon cart'
        });
    }
};

// =====================================================
// EXPORTS
// =====================================================

module.exports = {
    getCarts,
    getCartById,
    createCart,
    updateCart,
    deleteCart
};
