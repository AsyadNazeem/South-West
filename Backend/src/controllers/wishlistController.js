'use strict';

const { Wishlist, Customer, Item } = require('../models');

/**
 * Get wishlist items for a customer
 */
const getCustomerWishlist = async (req, res) => {
    try {
        const { customerId } = req.params;

        const wishlist = await Wishlist.findAll({
            where: {
                customer_id: customerId
            },
            include: [
                {
                    model: Customer,
                    as: 'customer',
                    attributes: ['id']
                },
                {
                    model: Item,
                    as: 'item'
                }
            ],
            order: [['created_at', 'DESC']]
        });

        return res.status(200).json({
            message: 'Customer wishlist retrieved successfully',
            data: wishlist
        });

    } catch (error) {
        console.error(error);

        return res.status(500).json({
            message: 'Failed to retrieve customer wishlist'
        });
    }
};


/**
 * Get a specific wishlist item
 */
const getWishlistItem = async (req, res) => {
    try {
        const { id } = req.params;

        const wishlistItem = await Wishlist.findByPk(id, {
            include: [
                {
                    model: Customer,
                    as: 'customer',
                    attributes: ['id']
                },
                {
                    model: Item,
                    as: 'item'
                }
            ]
        });

        if (!wishlistItem) {
            return res.status(404).json({
                message: 'Wishlist item not found'
            });
        }

        return res.status(200).json({
            message: 'Wishlist item retrieved successfully',
            data: wishlistItem
        });

    } catch (error) {
        console.error(error);

        return res.status(500).json({
            message: 'Failed to retrieve wishlist item'
        });
    }
};


/**
 * Add an item to wishlist
 */
const addToWishlist = async (req, res) => {
    try {
        const { customer_id, item_id } = req.body;

        if (!customer_id || !item_id) {
            return res.status(400).json({
                message: 'customer_id and item_id are required'
            });
        }

        const existingWishlistItem = await Wishlist.findOne({
            where: {
                customer_id,
                item_id
            }
        });

        if (existingWishlistItem) {
            return res.status(409).json({
                message: 'Item already exists in wishlist'
            });
        }

        const wishlistItem = await Wishlist.create({
            customer_id,
            item_id
        });

        return res.status(201).json({
            message: 'Item added to wishlist successfully',
            data: wishlistItem
        });

    } catch (error) {
        console.error(error);

        return res.status(500).json({
            message: 'Failed to add item to wishlist'
        });
    }
};


/**
 * Remove an item from wishlist
 */
const removeFromWishlist = async (req, res) => {
    try {
        const { id } = req.params;

        const wishlistItem = await Wishlist.findByPk(id);

        if (!wishlistItem) {
            return res.status(404).json({
                message: 'Wishlist item not found'
            });
        }

        await wishlistItem.destroy();

        return res.status(200).json({
            message: 'Item removed from wishlist successfully'
        });

    } catch (error) {
        console.error(error);

        return res.status(500).json({
            message: 'Failed to remove item from wishlist'
        });
    }
};


/**
 * Remove an item from wishlist using customer_id and item_id
 */
const removeItemFromCustomerWishlist = async (req, res) => {
    try {
        const { customerId, itemId } = req.params;

        const wishlistItem = await Wishlist.findOne({
            where: {
                customer_id: customerId,
                item_id: itemId
            }
        });

        if (!wishlistItem) {
            return res.status(404).json({
                message: 'Item not found in wishlist'
            });
        }

        await wishlistItem.destroy();

        return res.status(200).json({
            message: 'Item removed from wishlist successfully'
        });

    } catch (error) {
        console.error(error);

        return res.status(500).json({
            message: 'Failed to remove item from wishlist'
        });
    }
};


/**
 * Clear entire wishlist for a customer
 */
const clearCustomerWishlist = async (req, res) => {
    try {
        const { customerId } = req.params;

        const deletedCount = await Wishlist.destroy({
            where: {
                customer_id: customerId
            }
        });

        return res.status(200).json({
            message: 'Customer wishlist cleared successfully',
            data: {
                deleted_items: deletedCount
            }
        });

    } catch (error) {
        console.error(error);

        return res.status(500).json({
            message: 'Failed to clear customer wishlist'
        });
    }
};

const createWishlist = async (req, res) => {
    try {
        const { customerId } = req.params;
        const { item_id } = req.body;

        if (!item_id) {
            return res.status(400).json({
                message: 'item_id is required'
            });
        }

        const existingWishlist = await Wishlist.findOne({
            where: {
                customer_id: customerId,
                item_id: item_id
            }
        });

        if (existingWishlist) {
            return res.status(409).json({
                message: 'Item is already in the wishlist'
            });
        }

        const wishlist = await Wishlist.create({
            customer_id: customerId,
            item_id: item_id
        });

        return res.status(201).json({
            message: 'Item added to wishlist successfully',
            data: wishlist
        });

    } catch (error) {
        console.error(error);

        return res.status(500).json({
            message: 'Failed to add item to wishlist'
        });
    }
};


module.exports = {
    getCustomerWishlist,
    getWishlistItem,
    addToWishlist,
    removeFromWishlist,
    removeItemFromCustomerWishlist,
    clearCustomerWishlist,
    createWishlist
};
