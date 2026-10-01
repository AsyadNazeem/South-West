'use strict';

const { Cart, Customer } = require('../models');

// GET ALL CARTS
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

        return res.status(200).json({
            message: 'Carts retrieved successfully',
            data: carts
        });
    } catch (error) {
        console.error('Get carts error:', error);

        return res.status(500).json({
            message: 'Failed to retrieve carts'
        });
    }
};

// GET CART BY ID
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
            return res.status(404).json({
                message: 'Cart not found'
            });
        }

        return res.status(200).json({
            message: 'Cart retrieved successfully',
            data: cart
        });
    } catch (error) {
        console.error('Get cart error:', error);

        return res.status(500).json({
            message: 'Failed to retrieve cart'
        });
    }
};

// CREATE CART
const createCart = async (req, res) => {
    try {
        const {
            customer_id,
            status,
            expires_at
        } = req.body;

        // Required validation
        if (!customer_id) {
            return res.status(400).json({
                message: 'Customer ID is required'
            });
        }

        // Check customer exists
        const customer = await Customer.findByPk(customer_id);

        if (!customer) {
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

        return res.status(201).json({
            message: 'Cart created successfully',
            data: cart
        });
    } catch (error) {
        console.error('Create cart error:', error);

        return res.status(500).json({
            message: 'Failed to create cart'
        });
    }
};

// UPDATE CART
const updateCart = async (req, res) => {
    try {
        const { id } = req.params;

        const cart = await Cart.findByPk(id);

        if (!cart) {
            return res.status(404).json({
                message: 'Cart not found'
            });
        }

        await cart.update(req.body);

        return res.status(200).json({
            message: 'Cart updated successfully',
            data: cart
        });
    } catch (error) {
        console.error('Update cart error:', error);

        return res.status(500).json({
            message: 'Failed to update cart'
        });
    }
};

// DELETE / ABANDON CART
const deleteCart = async (req, res) => {
    try {
        const { id } = req.params;

        const cart = await Cart.findByPk(id);

        if (!cart) {
            return res.status(404).json({
                message: 'Cart not found'
            });
        }

        await cart.update({
            status: 'abandoned'
        });

        return res.status(200).json({
            message: 'Cart abandoned successfully'
        });
    } catch (error) {
        console.error('Delete cart error:', error);

        return res.status(500).json({
            message: 'Failed to abandon cart'
        });
    }
};

module.exports = {
    getCarts,
    getCartById,
    createCart,
    updateCart,
    deleteCart
};
