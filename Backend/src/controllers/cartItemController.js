'use strict';

const { CartItem, Cart, Item } = require('../models');

const getCartItems = async (req, res) => {
    try {
        const cartItems = await CartItem.findAll({
            include: [
                {
                    model: Cart,
                    as: 'cart'
                },
                {
                    model: Item,
                    as: 'item'
                }
            ],
            order: [['id', 'DESC']]
        });

        return res.status(200).json({
            message: 'Cart items retrieved successfully',
            data: cartItems
        });
    } catch (error) {
        console.error('Get cart items error:', error);

        return res.status(500).json({
            message: 'Failed to retrieve cart items'
        });
    }
};


const getCartItemById = async (req, res) => {
    try {
        const { id } = req.params;

        const cartItem = await CartItem.findByPk(id, {
            include: [
                {
                    model: Cart,
                    as: 'cart'
                },
                {
                    model: Item,
                    as: 'item'
                }
            ]
        });

        if (!cartItem) {
            return res.status(404).json({
                message: 'Cart item not found'
            });
        }

        return res.status(200).json({
            message: 'Cart item retrieved successfully',
            data: cartItem
        });
    } catch (error) {
        console.error('Get cart item error:', error);

        return res.status(500).json({
            message: 'Failed to retrieve cart item'
        });
    }
};


const createCartItem = async (req, res) => {
    try {
        const {
            cart_id,
            item_id,
            quantity,
            unit_price
        } = req.body;

        if (!cart_id || !item_id || !unit_price) {
            return res.status(400).json({
                message: 'cart_id, item_id and unit_price are required'
            });
        }

        const cart = await Cart.findByPk(cart_id);

        if (!cart) {
            return res.status(404).json({
                message: 'Cart not found'
            });
        }

        if (cart.status !== 'active') {
            return res.status(400).json({
                message: 'Cart is not active'
            });
        }

        const item = await Item.findByPk(item_id);

        if (!item) {
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
            return res.status(409).json({
                message: 'Item already exists in cart'
            });
        }

        const cartItem = await CartItem.create({
            cart_id,
            item_id,
            quantity: quantity || 1,
            unit_price
        });

        return res.status(201).json({
            message: 'Cart item created successfully',
            data: cartItem
        });
    } catch (error) {
        console.error('Create cart item error:', error);

        return res.status(500).json({
            message: 'Failed to create cart item'
        });
    }
};


const updateCartItem = async (req, res) => {
    try {
        const { id } = req.params;

        const {
            quantity,
            unit_price
        } = req.body;

        const cartItem = await CartItem.findByPk(id);

        if (!cartItem) {
            return res.status(404).json({
                message: 'Cart item not found'
            });
        }

        const cart = await Cart.findByPk(cartItem.cart_id);

        if (!cart) {
            return res.status(404).json({
                message: 'Cart not found'
            });
        }

        if (cart.status !== 'active') {
            return res.status(400).json({
                message: 'Cart is not active'
            });
        }

        await cartItem.update({
            quantity: quantity !== undefined ? quantity : cartItem.quantity,
            unit_price: unit_price !== undefined ? unit_price : cartItem.unit_price
        });

        return res.status(200).json({
            message: 'Cart item updated successfully',
            data: cartItem
        });
    } catch (error) {
        console.error('Update cart item error:', error);

        return res.status(500).json({
            message: 'Failed to update cart item'
        });
    }
};


const deleteCartItem = async (req, res) => {
    try {
        const { id } = req.params;

        const cartItem = await CartItem.findByPk(id);

        if (!cartItem) {
            return res.status(404).json({
                message: 'Cart item not found'
            });
        }

        const cart = await Cart.findByPk(cartItem.cart_id);

        if (!cart) {
            return res.status(404).json({
                message: 'Cart not found'
            });
        }

        if (cart.status !== 'active') {
            return res.status(400).json({
                message: 'Cart is not active'
            });
        }

        await cartItem.destroy();

        return res.status(200).json({
            message: 'Cart item deleted successfully'
        });
    } catch (error) {
        console.error('Delete cart item error:', error);

        return res.status(500).json({
            message: 'Failed to delete cart item'
        });
    }
};


module.exports = {
    getCartItems,
    getCartItemById,
    createCartItem,
    updateCartItem,
    deleteCartItem
};
