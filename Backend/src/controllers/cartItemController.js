'use strict';

const {CartItem, Cart, Item} = require('../models');
const {recordAuditLog} = require('../services/auditLogService');

// =====================================================
// AUDIT HELPER
// =====================================================


const auditCartItemAction = async ({
                                       req,
                                       action,
                                       cartItemId = null,
                                       cartId = null,
                                       itemId = null,
                                       description,
                                       oldValues = null,
                                       newValues = null
                                   }) => {
    try {
        await recordAuditLog({
            userId: req.user?.id ?? req.user?.user_id ?? null,
            action,
            module: 'CART_ITEM',
            entityType: 'CartItem',
            entityId: cartItemId,
            description,
            oldValues,
            newValues: {
                ...(newValues || {}),
                ...(cartId !== null ? { cart_id: cartId } : {}),
                ...(itemId !== null ? { item_id: itemId } : {})
            },
            ipAddress: req.ip,
            userAgent: req.get('user-agent'),
            requestId: req.id
        });
    } catch (error) {
        console.error('Cart item audit logging failed:', error.message);
    }
};


// =====================================================
// GET ALL CART ITEMS
// =====================================================

const getCartItems = async (req, res) => {
    try {
        const cartItems = await CartItem.findAll({
            include: [
                {model: Cart, as: 'cart'},
                {model: Item, as: 'item'}
            ],
            order: [['id', 'DESC']]
        });

        await auditCartItemAction({
            req,
            action: 'CART_ITEM_LIST_VIEWED',
            description: 'Cart items retrieved successfully',
            newValues: {
                result_count: cartItems.length
            }
        });

        return res.status(200).json({
            message: 'Cart items retrieved successfully',
            data: cartItems
        });
    } catch (error) {
        console.error('Get cart items error:', error);

        await auditCartItemAction({
            req,
            action: 'CART_ITEM_LIST_VIEW_FAILED',
            description: 'Failed to retrieve cart items'
        });

        return res.status(500).json({
            message: 'Failed to retrieve cart items'
        });
    }
};

// =====================================================
// GET CART ITEM BY ID
// =====================================================

const getCartItemById = async (req, res) => {
    try {
        const {id} = req.params;

        const cartItem = await CartItem.findByPk(id, {
            include: [
                {model: Cart, as: 'cart'},
                {model: Item, as: 'item'}
            ]
        });

        if (!cartItem) {
            await auditCartItemAction({
                req,
                action: 'CART_ITEM_VIEW_FAILED',
                cartItemId: id,
                description: 'Cart item not found'
            });

            return res.status(404).json({
                message: 'Cart item not found'
            });
        }

        await auditCartItemAction({
            req,
            action: 'CART_ITEM_VIEWED',
            cartItemId: cartItem.id,
            cartId: cartItem.cart_id,
            itemId: cartItem.item_id,
            description: 'Cart item retrieved successfully',
            newValues: {
                quantity: cartItem.quantity,
                unit_price: cartItem.unit_price
            }
        });

        return res.status(200).json({
            message: 'Cart item retrieved successfully',
            data: cartItem
        });
    } catch (error) {
        console.error('Get cart item error:', error);

        await auditCartItemAction({
            req,
            action: 'CART_ITEM_VIEW_FAILED',
            cartItemId: req.params.id,
            description: 'Unexpected error while retrieving cart item'
        });

        return res.status(500).json({
            message: 'Failed to retrieve cart item'
        });
    }
};

// =====================================================
// CREATE CART ITEM
// =====================================================

const createCartItem = async (req, res) => {
    try {
        const {
            cart_id,
            item_id,
            quantity,
            unit_price
        } = req.body;

        if (
            cart_id == null ||
            item_id == null ||
            unit_price == null
        ) {
            await auditCartItemAction({
                req,
                action: 'CART_ITEM_CREATE_FAILED',
                description: 'Required cart item fields were missing'
            });

            return res.status(400).json({
                message: 'cart_id, item_id and unit_price are required'
            });
        }

        const parsedQuantity = quantity === undefined ? 1 : Number(quantity);
        const parsedPrice = Number(unit_price);

        if (
            !Number.isSafeInteger(parsedQuantity) ||
            parsedQuantity <= 0 ||
            !Number.isFinite(parsedPrice) ||
            parsedPrice < 0
        ) {
            await auditCartItemAction({
                req,
                action: 'CART_ITEM_CREATE_FAILED',
                cartId: cart_id,
                itemId: item_id,
                description: 'Invalid cart item quantity or unit price'
            });

            return res.status(400).json({
                message: 'Quantity must be a positive integer and unit_price must be a non-negative number'
            });
        }

        const cart = await Cart.findByPk(cart_id);

        if (!cart) {
            await auditCartItemAction({
                req,
                action: 'CART_ITEM_CREATE_FAILED',
                cartId: cart_id,
                itemId: item_id,
                description: 'Cart item creation rejected because cart was not found'
            });

            return res.status(404).json({
                message: 'Cart not found'
            });
        }

        if (cart.status !== 'active') {
            await auditCartItemAction({
                req,
                action: 'CART_ITEM_CREATE_FAILED',
                cartId: cart.id,
                itemId: item_id,
                description: 'Cart item creation rejected because cart is not active',
                newValues: {
                    cart_status: cart.status
                }
            });

            return res.status(400).json({
                message: 'Cart is not active'
            });
        }

        const item = await Item.findByPk(item_id);

        if (!item) {
            await auditCartItemAction({
                req,
                action: 'CART_ITEM_CREATE_FAILED',
                cartId: cart.id,
                itemId: item_id,
                description: 'Cart item creation rejected because item was not found'
            });

            return res.status(404).json({
                message: 'Item not found'
            });
        }

        const existingCartItem = await CartItem.findOne({
            where: {
                cart_id,
                item_id
            }
        });

        if (existingCartItem) {
            await auditCartItemAction({
                req,
                action: 'CART_ITEM_CREATE_FAILED',
                cartItemId: existingCartItem.id,
                cartId: cart.id,
                itemId: item_id,
                description: 'Item already exists in cart'
            });

            return res.status(409).json({
                message: 'Item already exists in cart'
            });
        }

        const cartItem = await CartItem.create({
            cart_id,
            item_id,
            quantity: parsedQuantity,
            unit_price: parsedPrice
        });

        await auditCartItemAction({
            req,
            action: 'CART_ITEM_CREATED',
            cartItemId: cartItem.id,
            cartId: cartItem.cart_id,
            itemId: cartItem.item_id,
            description: 'Cart item created successfully',
            newValues: {
                quantity: cartItem.quantity,
                unit_price: cartItem.unit_price
            }
        });

        return res.status(201).json({
            message: 'Cart item created successfully',
            data: cartItem
        });
    } catch (error) {
        console.error('Create cart item error:', error);

        await auditCartItemAction({
            req,
            action: 'CART_ITEM_CREATE_FAILED',
            cartId: req.body?.cart_id ?? null,
            itemId: req.body?.item_id ?? null,
            description: 'Unexpected error while creating cart item'
        });

        return res.status(500).json({
            message: 'Failed to create cart item'
        });
    }
};

// =====================================================
// UPDATE CART ITEM
// =====================================================

const updateCartItem = async (req, res) => {
    try {
        const {id} = req.params;
        const {quantity, unit_price} = req.body;

        const cartItem = await CartItem.findByPk(id);

        if (!cartItem) {
            await auditCartItemAction({
                req,
                action: 'CART_ITEM_UPDATE_FAILED',
                cartItemId: id,
                description: 'Cart item update rejected because item was not found'
            });

            return res.status(404).json({
                message: 'Cart item not found'
            });
        }

        const cart = await Cart.findByPk(cartItem.cart_id);

        if (!cart) {
            await auditCartItemAction({
                req,
                action: 'CART_ITEM_UPDATE_FAILED',
                cartItemId: cartItem.id,
                cartId: cartItem.cart_id,
                itemId: cartItem.item_id,
                description: 'Cart item update rejected because its cart was not found'
            });

            return res.status(404).json({
                message: 'Cart not found'
            });
        }

        if (cart.status !== 'active') {
            await auditCartItemAction({
                req,
                action: 'CART_ITEM_UPDATE_FAILED',
                cartItemId: cartItem.id,
                cartId: cart.id,
                itemId: cartItem.item_id,
                description: 'Cart item update rejected because cart is not active'
            });

            return res.status(400).json({
                message: 'Cart is not active'
            });
        }

        const updates = {};

        if (quantity !== undefined) {
            const parsedQuantity = Number(quantity);

            if (
                !Number.isSafeInteger(parsedQuantity) ||
                parsedQuantity <= 0
            ) {
                return res.status(400).json({
                    message: 'Quantity must be a positive integer'
                });
            }

            updates.quantity = parsedQuantity;
        }

        if (unit_price !== undefined) {
            const parsedPrice = Number(unit_price);

            if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
                return res.status(400).json({
                    message: 'Unit price must be a non-negative number'
                });
            }

            updates.unit_price = parsedPrice;
        }

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({
                message: 'Provide quantity or unit_price to update'
            });
        }

        const oldValues = {
            quantity: cartItem.quantity,
            unit_price: cartItem.unit_price
        };

        await cartItem.update(updates);

        await auditCartItemAction({
            req,
            action: 'CART_ITEM_UPDATED',
            cartItemId: cartItem.id,
            cartId: cartItem.cart_id,
            itemId: cartItem.item_id,
            description: 'Cart item updated successfully',
            oldValues,
            newValues: {
                quantity: cartItem.quantity,
                unit_price: cartItem.unit_price
            }
        });

        return res.status(200).json({
            message: 'Cart item updated successfully',
            data: cartItem
        });
    } catch (error) {
        console.error('Update cart item error:', error);

        await auditCartItemAction({
            req,
            action: 'CART_ITEM_UPDATE_FAILED',
            cartItemId: req.params.id,
            description: 'Unexpected error while updating cart item'
        });

        return res.status(500).json({
            message: 'Failed to update cart item'
        });
    }
};

// =====================================================
// DELETE CART ITEM
// =====================================================

const deleteCartItem = async (req, res) => {
    try {
        const {id} = req.params;

        const cartItem = await CartItem.findByPk(id);

        if (!cartItem) {
            await auditCartItemAction({
                req,
                action: 'CART_ITEM_DELETE_FAILED',
                cartItemId: id,
                description: 'Cart item deletion rejected because item was not found'
            });

            return res.status(404).json({
                message: 'Cart item not found'
            });
        }

        const cart = await Cart.findByPk(cartItem.cart_id);

        if (!cart) {
            await auditCartItemAction({
                req,
                action: 'CART_ITEM_DELETE_FAILED',
                cartItemId: cartItem.id,
                cartId: cartItem.cart_id,
                itemId: cartItem.item_id,
                description: 'Cart item deletion rejected because its cart was not found'
            });

            return res.status(404).json({
                message: 'Cart not found'
            });
        }

        if (cart.status !== 'active') {
            await auditCartItemAction({
                req,
                action: 'CART_ITEM_DELETE_FAILED',
                cartItemId: cartItem.id,
                cartId: cart.id,
                itemId: cartItem.item_id,
                description: 'Cart item deletion rejected because cart is not active'
            });

            return res.status(400).json({
                message: 'Cart is not active'
            });
        }

        const oldValues = {
            quantity: cartItem.quantity,
            unit_price: cartItem.unit_price
        };

        const deletedCartItemId = cartItem.id;
        const deletedCartId = cartItem.cart_id;
        const deletedItemId = cartItem.item_id;

        await cartItem.destroy();

        await auditCartItemAction({
            req,
            action: 'CART_ITEM_DELETED',
            cartItemId: deletedCartItemId,
            cartId: deletedCartId,
            itemId: deletedItemId,
            description: 'Cart item deleted successfully',
            oldValues
        });

        return res.status(200).json({
            message: 'Cart item deleted successfully'
        });
    } catch (error) {
        console.error('Delete cart item error:', error);

        await auditCartItemAction({
            req,
            action: 'CART_ITEM_DELETE_FAILED',
            cartItemId: req.params.id,
            description: 'Unexpected error while deleting cart item'
        });

        return res.status(500).json({
            message: 'Failed to delete cart item'
        });
    }
};

// =====================================================
// EXPORTS
// =====================================================

module.exports = {
    getCartItems,
    getCartItemById,
    createCartItem,
    updateCartItem,
    deleteCartItem
};
