
'use strict';

const { Op } = require('sequelize');
const {
    Cart,
    CartItem,
    Item,
    ItemPrice,
    InventoryStock,
    InventoryLocation
} = require('../models');

const CURRENCY = 'LKR';
const PRICE_TYPE = 'selling';

function getCustomerId(req) {
    return req.customer?.id;
}

function validPositiveInteger(value) {
    return Number.isSafeInteger(value) && value > 0;
}

async function getCurrentSellingPrice(itemId, transaction) {
    const now = new Date();

    return ItemPrice.findOne({
        where: {
            item_id: itemId,
            price_type: PRICE_TYPE,
            currency: CURRENCY,
            is_active: true,
            [Op.and]: [
                {
                    [Op.or]: [
                        { effective_from: null },
                        { effective_from: { [Op.lte]: now } }
                    ]
                },
                {
                    [Op.or]: [
                        { effective_to: null },
                        { effective_to: { [Op.gte]: now } }
                    ]
                }
            ]
        },
        order: [
            ['effective_from', 'DESC'],
            ['id', 'DESC']
        ],
        transaction
    });
}

async function getOnlineAvailableStock(itemId, transaction) {
    const stocks = await InventoryStock.findAll({
        where: {
            item_id: itemId,
            is_active: true
        },
        include: [{
            model: InventoryLocation,
            as: 'location',
            required: true,
            where: {
                location_type: 'online',
                is_active: true
            },
            attributes: []
        }],
        transaction
    });

    return stocks.reduce((total, stock) => {
        const onHand = Number(stock.quantity_on_hand);
        const reserved = Number(stock.quantity_reserved);
        return total + Math.max(0, onHand - reserved);
    }, 0);
}

async function getOrCreateActiveCart(customerId, transaction) {
    let cart = await Cart.findOne({
        where: {
            customer_id: customerId,
            status: 'active'
        },
        order: [['id', 'DESC']],
        transaction,
        lock: transaction.LOCK.UPDATE
    });

    if (!cart) {
        cart = await Cart.create({
            customer_id: customerId,
            status: 'active'
        }, { transaction });
    }

    return cart;
}

async function findOwnedActiveCartItem(customerId, cartItemId, transaction) {
    const cartItem = await CartItem.findByPk(cartItemId, {
        include: [{
            model: Cart,
            as: 'cart',
            required: true,
            where: {
                customer_id: customerId,
                status: 'active'
            }
        }],
        transaction,
        lock: transaction.LOCK.UPDATE
    });

    return cartItem;
}

async function loadCart(cartId) {
    return Cart.findByPk(cartId, {
        include: [{
            model: CartItem,
            as: 'items',
            include: [{
                model: Item,
                as: 'item',
                attributes: ['id', 'item_code', 'item_name', 'is_active']
            }]
        }]
    });
}

// GET THE AUTHENTICATED CUSTOMER'S ACTIVE CART
async function getMyCart(req, res) {
    try {
        const customerId = getCustomerId(req);

        if (!customerId) {
            return res.status(401).json({ message: 'Customer authentication required' });
        }

        const cart = await Cart.findOne({
            where: { customer_id: customerId, status: 'active' },
            include: [{
                model: CartItem,
                as: 'items',
                include: [{
                    model: Item,
                    as: 'item',
                    attributes: ['id', 'item_code', 'item_name', 'is_active']
                }]
            }],
            order: [['id', 'DESC']]
        });

        return res.status(200).json({
            message: 'Cart retrieved successfully',
            data: cart
        });
    } catch (error) {
        console.error('Get customer cart error:', error);
        return res.status(500).json({ message: 'Failed to retrieve cart' });
    }
}

// ADD AN ITEM. NEVER ACCEPT THE PRICE FROM THE CLIENT.
async function addItem(req, res) {
    const { item_id, quantity = 1 } = req.body;

    if (!Number.isSafeInteger(Number(item_id)) || Number(item_id) <= 0) {
        return res.status(400).json({ message: 'A valid item_id is required' });
    }

    if (!validPositiveInteger(quantity)) {
        return res.status(400).json({ message: 'Quantity must be a positive integer' });
    }

    if (req.body.unit_price !== undefined) {
        return res.status(400).json({
            message: 'unit_price must not be provided by the client'
        });
    }

    const customerId = getCustomerId(req);
    if (!customerId) {
        return res.status(401).json({ message: 'Customer authentication required' });
    }

    try {
        const result = await Cart.sequelize.transaction(async transaction => {
            const item = await Item.findByPk(item_id, {
                transaction,
                lock: transaction.LOCK.UPDATE
            });

            if (!item || !item.is_active) {
                return { error: 404, message: 'Item not found or unavailable' };
            }

            const price = await getCurrentSellingPrice(item.id, transaction);
            if (!price || Number(price.price) <= 0) {
                return { error: 409, message: 'No valid selling price is available for this item' };
            }

            const cart = await getOrCreateActiveCart(customerId, transaction);
            const existing = await CartItem.findOne({
                where: { cart_id: cart.id, item_id: item.id },
                transaction,
                lock: transaction.LOCK.UPDATE
            });

            const requestedQuantity =
                Number(quantity) + (existing ? Number(existing.quantity) : 0);

            const availableStock = await getOnlineAvailableStock(item.id, transaction);

            if (requestedQuantity > availableStock) {
                return {
                    error: 409,
                    message: 'Insufficient online stock',
                    available_quantity: availableStock
                };
            }

            if (existing) {
                await existing.update({
                    quantity: requestedQuantity,
                    unit_price: price.price
                }, { transaction });
            } else {
                await CartItem.create({
                    cart_id: cart.id,
                    item_id: item.id,
                    quantity: Number(quantity),
                    unit_price: price.price
                }, { transaction });
            }

            return { cartId: cart.id };
        });

        if (result.error) {
            return res.status(result.error).json({
                message: result.message,
                ...(result.available_quantity !== undefined
                    ? { available_quantity: result.available_quantity }
                    : {})
            });
        }

        const cart = await loadCart(result.cartId);
        return res.status(200).json({
            message: 'Item added to cart successfully',
            data: cart
        });
    } catch (error) {
        console.error('Add customer cart item error:', error);

        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(409).json({
                message: 'This item was added concurrently. Refresh the cart and try again.'
            });
        }

        return res.status(500).json({ message: 'Failed to add item to cart' });
    }
}

// UPDATE QUANTITY. CART OWNERSHIP IS CHECKED ON THE SERVER.
async function updateItem(req, res) {
    const { quantity } = req.body;
    const cartItemId = req.params.id;
    const customerId = getCustomerId(req);

    if (!customerId) {
        return res.status(401).json({ message: 'Customer authentication required' });
    }

    if (!validPositiveInteger(quantity)) {
        return res.status(400).json({ message: 'Quantity must be a positive integer' });
    }

    if (req.body.unit_price !== undefined || req.body.cart_id !== undefined ||
        req.body.item_id !== undefined || req.body.customer_id !== undefined) {
        return res.status(400).json({
            message: 'Only quantity can be updated'
        });
    }

    try {
        const result = await Cart.sequelize.transaction(async transaction => {
            const cartItem = await findOwnedActiveCartItem(
                customerId, cartItemId, transaction
            );

            if (!cartItem) {
                return { error: 404, message: 'Cart item not found' };
            }

            const item = await Item.findByPk(cartItem.item_id, {
                transaction,
                lock: transaction.LOCK.UPDATE
            });

            if (!item || !item.is_active) {
                return { error: 409, message: 'This item is no longer available' };
            }

            const price = await getCurrentSellingPrice(item.id, transaction);
            if (!price || Number(price.price) <= 0) {
                return { error: 409, message: 'No valid selling price is available for this item' };
            }

            const availableStock = await getOnlineAvailableStock(item.id, transaction);
            if (Number(quantity) > availableStock) {
                return {
                    error: 409,
                    message: 'Insufficient online stock',
                    available_quantity: availableStock
                };
            }

            await cartItem.update({
                quantity: Number(quantity),
                unit_price: price.price
            }, { transaction });

            return { cartId: cartItem.cart_id };
        });

        if (result.error) {
            return res.status(result.error).json({
                message: result.message,
                ...(result.available_quantity !== undefined
                    ? { available_quantity: result.available_quantity }
                    : {})
            });
        }

        return res.status(200).json({
            message: 'Cart item updated successfully',
            data: await loadCart(result.cartId)
        });
    } catch (error) {
        console.error('Update customer cart item error:', error);
        return res.status(500).json({ message: 'Failed to update cart item' });
    }
}

// REMOVE AN ITEM ONLY FROM THE CUSTOMER'S OWN ACTIVE CART
async function removeItem(req, res) {
    const customerId = getCustomerId(req);

    if (!customerId) {
        return res.status(401).json({ message: 'Customer authentication required' });
    }

    try {
        const deleted = await Cart.sequelize.transaction(async transaction => {
            const cartItem = await findOwnedActiveCartItem(
                customerId, req.params.id, transaction
            );

            if (!cartItem) return false;

            await cartItem.destroy({ transaction });
            return true;
        });

        if (!deleted) {
            return res.status(404).json({ message: 'Cart item not found' });
        }

        return res.status(200).json({ message: 'Item removed from cart successfully' });
    } catch (error) {
        console.error('Remove customer cart item error:', error);
        return res.status(500).json({ message: 'Failed to remove cart item' });
    }
}

module.exports = {
    getMyCart,
    addItem,
    updateItem,
    removeItem
};
