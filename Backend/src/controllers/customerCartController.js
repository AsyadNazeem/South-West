
'use strict';

const { Op } = require('sequelize');
const {
    Cart,
    CartItem,
    Item,
    ItemVariant,
    ItemPrice,
    ItemImage,
    InventoryStock,
    InventoryLocation
} = require('../models');

const {
    getActiveCampaigns,
    campaignTargetsItem,
    calculateDiscount
} = require('../services/discountCampaignService');

const { recordAuditLog } = require('../services/auditLogService');

const CURRENCY = 'LKR';
const PRICE_TYPE = 'selling';
const AUDIT_MODULE = 'CUSTOMER_CART';

// Best-effort audit logging: audit failures must not break cart operations.
async function auditCartAction(req, {
    action,
    entityType = 'Cart',
    entityId = null,
    description,
    oldValues = null,
    newValues = null
}) {
    try {
        await recordAuditLog({
            userId: req.user?.id ?? req.user?.user_id ?? null,
            action,
            module: AUDIT_MODULE,
            entityType,
            entityId: entityId == null ? null : String(entityId),
            description,
            oldValues,
            newValues,
            ipAddress: req.ip ?? null,
            userAgent: req.get?.('user-agent') ?? null,
            requestId: req.id ?? req.requestId ?? null
        });
    } catch (error) {
        console.error('Customer cart audit logging failed:', error.message);
    }
}

function getCustomerId(req) {
    return req.customer?.id;
}

function validPositiveInteger(value) {
    return Number.isSafeInteger(value) && value > 0;
}

function getCartItemSnapshot(cartItem) {
    if (!cartItem) return null;

    return {
        id: cartItem.id,
        cart_id: cartItem.cart_id,
        item_id: cartItem.item_id,
        variant_id: cartItem.variant_id ?? null,
        quantity: Number(cartItem.quantity),
        unit_price: Number(cartItem.unit_price)
    };
}

async function getCurrentSellingPrice(itemId, variantId, transaction) {
    const now = new Date();

    const effectiveWhere = {
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
    };

    const variantPrice = await ItemPrice.findOne({
        where: {
            ...effectiveWhere,
            item_id: itemId,
            variant_id: variantId
        },
        order: [
            ['effective_from', 'DESC'],
            ['id', 'DESC']
        ],
        transaction
    });

    if (variantPrice) return variantPrice;

    return ItemPrice.findOne({
        where: {
            ...effectiveWhere,
            item_id: itemId,
            variant_id: null
        },
        order: [
            ['effective_from', 'DESC'],
            ['id', 'DESC']
        ],
        transaction
    });
}

async function getOnlineAvailableStock(variantId, transaction) {
    const stocks = await InventoryStock.findAll({
        where: {
            variant_id: variantId,
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
            include: [
{
    model: Item,
    as: 'item',
    attributes: [
        'id',
        'public_id',
        'slug',
        'item_code',
        'item_name',
        'category_id',
        'brand_id',
        'is_active'
    ],
    include: [
        {
            model: ItemImage,
            as: 'images',
            attributes: [
                'id',
                'file_name',
                'file_path',
                'url',
                'alt_text',
                'sort_order',
                'is_primary'
            ],
            where: { is_active: true },
            required: false
        }
    ]
},
    {
        model: ItemVariant,
        as: 'variant',
        attributes: [
            'id',
            'variant_sku',
            'variant_name',
            'attributes',
            'is_default',
            'is_active'
        ]
    }
]
        }]
    });
}

async function applyCampaignPricing(cart) {
    if (!cart || !Array.isArray(cart.items)) {
        return cart;
    }

    const campaigns = await getActiveCampaigns();
    let totalDiscountAmount = 0;
    let discountedSubtotal = 0;

    for (const cartItem of cart.items) {
        const item = cartItem.item;
        const quantity = Number(cartItem.quantity) || 0;
        const originalPrice = Number(cartItem.unit_price) || 0;

        let bestDiscount = null;

        if (item && item.is_active) {
            for (const campaign of campaigns) {
                if (!campaignTargetsItem(campaign, item)) {
                    continue;
                }

                const pricing = calculateDiscount(
                    campaign,
                    originalPrice
                );

                if (
                    pricing.discount_amount > 0 &&
                    (
                        !bestDiscount ||
                        pricing.discount_amount >
                            bestDiscount.discount_amount
                    )
                ) {
                    bestDiscount = {
                        campaign_id: campaign.id,
                        campaign_name: campaign.campaign_name,
                        ...pricing
                    };
                }
            }
        }

        const discountAmount = bestDiscount
            ? bestDiscount.discount_amount
            : 0;

        const discountedPrice = bestDiscount
            ? bestDiscount.discounted_price
            : Number(originalPrice.toFixed(2));

        cartItem.setDataValue('original_price', originalPrice);
        cartItem.setDataValue('discount_amount', discountAmount);
        cartItem.setDataValue('discount_percentage',
            bestDiscount ? bestDiscount.discount_percentage : 0);
        cartItem.setDataValue('discounted_unit_price', discountedPrice);
        cartItem.setDataValue(
            'line_total',
            Number((originalPrice * quantity).toFixed(2))
        );
        cartItem.setDataValue(
            'discounted_line_total',
            Number((discountedPrice * quantity).toFixed(2))
        );
        cartItem.setDataValue(
            'total_discount_amount',
            Number((discountAmount * quantity).toFixed(2))
        );
        cartItem.setDataValue(
            'discount_campaign',
            bestDiscount
                ? {
                    id: bestDiscount.campaign_id,
                    name: bestDiscount.campaign_name
                }
                : null
        );

        totalDiscountAmount += discountAmount * quantity;
        discountedSubtotal += discountedPrice * quantity;
    }

    cart.setDataValue(
        'discount_amount',
        Number(totalDiscountAmount.toFixed(2))
    );
    cart.setDataValue(
        'discounted_subtotal',
        Number(discountedSubtotal.toFixed(2))
    );

    return cart;
}

// GET THE AUTHENTICATED CUSTOMER'S ACTIVE CART
async function getMyCart(req, res) {
    try {
        const customerId = getCustomerId(req);

        if (!customerId) {
            return res.status(401).json({
                message: 'Customer authentication required'
            });
        }

        const cart = await Cart.findOne({
            where: {
                customer_id: customerId,
                status: 'active'
            },
          include: [
    {
        model: CartItem,
        as: 'items',
        include: [
          {
    model: Item,
    as: 'item',
    attributes: [
        'id',
        'public_id',
        'slug',
        'item_code',
        'item_name',
        'category_id',
        'brand_id',
        'is_active'
    ],
    include: [
        {
            model: ItemImage,
            as: 'images',
            attributes: [
                'id',
                'file_name',
                'file_path',
                'url',
                'alt_text',
                'sort_order',
                'is_primary'
            ],
            where: { is_active: true },
            required: false
        }
    ]
},
            {
                model: ItemVariant,
                as: 'variant',
                attributes: [
                    'id',
                    'variant_sku',
                    'variant_name',
                    'attributes',
                    'is_default',
                    'is_active'
                ]
            }
        ]
    }
],
            order: [['id', 'DESC']]
        });

        await applyCampaignPricing(cart);

        await auditCartAction(req, {
            action: 'CUSTOMER_CART_VIEWED',
            entityType: 'Cart',
            entityId: cart?.id ?? null,
            description: `Customer ${customerId} viewed their active cart`,
            newValues: {
                customer_id: customerId,
                cart_id: cart?.id ?? null,
                item_count: cart?.items?.length ?? 0
            }
        });

        return res.status(200).json({
            message: 'Cart retrieved successfully',
            data: cart
        });
    } catch (error) {
        console.error('Get customer cart error:', error);

        await auditCartAction(req, {
            action: 'CUSTOMER_CART_VIEW_FAILED',
            description: 'Failed to retrieve customer cart'
        });

        return res.status(500).json({
            message: 'Failed to retrieve cart'
        });
    }
}

// ADD AN ITEM. NEVER ACCEPT THE PRICE FROM THE CLIENT.
async function addItem(req, res) {
    const { item_id, variant_id, quantity = 1 } = req.body;

    if (!Number.isSafeInteger(Number(item_id)) || Number(item_id) <= 0) {
        return res.status(400).json({ message: 'A valid item_id is required' });
    }

    if (variant_id !== undefined &&
        (!Number.isSafeInteger(Number(variant_id)) || Number(variant_id) <= 0)) {
        return res.status(400).json({ message: 'A valid variant_id is required' });
    }

    if (!validPositiveInteger(quantity)) {
        return res.status(400).json({ message: 'Quantity must be a positive integer' });
    }

    if (req.body.unit_price !== undefined) {
        return res.status(400).json({ message: 'unit_price must not be provided by the client' });
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

            let variant;

            if (variant_id !== undefined) {
                variant = await ItemVariant.findOne({
                    where: { id: Number(variant_id), item_id: item.id },
                    transaction,
                    lock: transaction.LOCK.UPDATE
                });

                if (!variant) {
                    return { error: 404, message: 'Variant not found for this item' };
                }

                if (!variant.is_active) {
                    return { error: 409, message: 'This variant is unavailable' };
                }
            } else {
                const activeVariants = await ItemVariant.findAll({
                    where: { item_id: item.id, is_active: true },
                    order: [['is_default', 'DESC'], ['id', 'ASC']],
                    transaction,
                    lock: transaction.LOCK.UPDATE
                });

                if (activeVariants.length > 1) {
                    return {
                        error: 400,
                        message: 'Please select a variant',
                        requires_variant_selection: true
                    };
                }

                if (activeVariants.length === 1) {
                    variant = activeVariants[0];
                }
            }

            if (!variant) {
                return {
                    error: 409,
                    message: 'This item has no active variant configured'
                };
            }

            const price = await getCurrentSellingPrice(item.id, variant.id, transaction);

            if (!price || Number(price.price) <= 0) {
                return {
                    error: 409,
                    message: 'No valid selling price is available for this variant'
                };
            }

            const cart = await getOrCreateActiveCart(customerId, transaction);

            const existing = await CartItem.findOne({
                where: { cart_id: cart.id, variant_id: variant.id },
                transaction,
                lock: transaction.LOCK.UPDATE
            });

            const oldValues = getCartItemSnapshot(existing);
            const requestedQuantity =
                Number(quantity) + (existing ? Number(existing.quantity) : 0);

            const availableStock = await getOnlineAvailableStock(variant.id, transaction);

            if (requestedQuantity > availableStock) {
                return {
                    error: 409,
                    message: 'Insufficient online stock',
                    available_quantity: availableStock
                };
            }

            let cartItem;

            if (existing) {
                await existing.update({
                    quantity: requestedQuantity,
                    unit_price: price.price
                }, { transaction });

                cartItem = existing;
            } else {
                cartItem = await CartItem.create({
                    cart_id: cart.id,
                    item_id: item.id,
                    variant_id: variant.id,
                    quantity: Number(quantity),
                    unit_price: price.price
                }, { transaction });
            }

            return {
                cartId: cart.id,
                cartItemId: cartItem.id,
                oldValues,
                newValues: getCartItemSnapshot(cartItem),
                variantId: variant.id
            };
        });

        if (result.error) {
            await auditCartAction(req, {
                action: 'CUSTOMER_CART_ITEM_ADD_REJECTED',
                entityType: 'CartItem',
                description: 'Adding a product variant to the customer cart was rejected',
                newValues: {
                    customer_id: customerId,
                    item_id: Number(item_id),
                    variant_id: variant_id === undefined ? null : Number(variant_id),
                    requested_quantity: Number(quantity),
                    reason: result.message
                }
            });

            return res.status(result.error).json({
                message: result.message,
                ...(result.available_quantity !== undefined
                    ? { available_quantity: result.available_quantity }
                    : {}),
                ...(result.requires_variant_selection
                    ? { requires_variant_selection: true }
                    : {})
            });
        }

        await auditCartAction(req, {
            action: result.oldValues
                ? 'CUSTOMER_CART_ITEM_QUANTITY_INCREASED'
                : 'CUSTOMER_CART_ITEM_ADDED',
            entityType: 'CartItem',
            entityId: result.cartItemId,
            description: `Customer ${customerId} added variant ${result.variantId} to their cart`,
            oldValues: result.oldValues,
            newValues: {
                ...result.newValues,
                customer_id: customerId
            }
        });

        return res.status(200).json({
            message: 'Item added to cart successfully',
data: await applyCampaignPricing(
    await loadCart(result.cartId)
)
        });
    } catch (error) {
        console.error('Add customer cart item error:', error);

        await auditCartAction(req, {
            action: 'CUSTOMER_CART_ITEM_ADD_FAILED',
            entityType: 'CartItem',
            description: 'Failed to add a product variant to the customer cart',
            newValues: {
                customer_id: customerId,
                item_id: Number(item_id),
                variant_id: variant_id === undefined ? null : Number(variant_id)
            }
        });

        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(409).json({
                message: 'This variant was added concurrently. Refresh the cart and try again.'
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

    if (
        req.body.unit_price !== undefined ||
        req.body.cart_id !== undefined ||
        req.body.item_id !== undefined ||
        req.body.variant_id !== undefined ||
        req.body.customer_id !== undefined
    ) {
        return res.status(400).json({ message: 'Only quantity can be updated' });
    }

    try {
        const result = await Cart.sequelize.transaction(async transaction => {
            const cartItem = await findOwnedActiveCartItem(
                customerId,
                cartItemId,
                transaction
            );

            if (!cartItem) {
                return { error: 404, message: 'Cart item not found' };
            }

            const oldValues = getCartItemSnapshot(cartItem);

            const item = await Item.findByPk(cartItem.item_id, {
                transaction,
                lock: transaction.LOCK.UPDATE
            });

            if (!item || !item.is_active) {
                return { error: 409, message: 'This item is no longer available' };
            }

            if (!cartItem.variant_id) {
                return {
                    error: 409,
                    message: 'This cart item has no variant assigned. Remove it and add the product again.'
                };
            }

            const variant = await ItemVariant.findOne({
                where: {
                    id: cartItem.variant_id,
                    item_id: item.id,
                    is_active: true
                },
                transaction,
                lock: transaction.LOCK.UPDATE
            });

            if (!variant) {
                return { error: 409, message: 'This variant is no longer available' };
            }

            const price = await getCurrentSellingPrice(item.id, variant.id, transaction);

            if (!price || Number(price.price) <= 0) {
                return {
                    error: 409,
                    message: 'No valid selling price is available for this variant'
                };
            }

            const availableStock = await getOnlineAvailableStock(variant.id, transaction);

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

            return {
                cartId: cartItem.cart_id,
                cartItemId: cartItem.id,
                oldValues,
                newValues: getCartItemSnapshot(cartItem)
            };
        });

        if (result.error) {
            await auditCartAction(req, {
                action: 'CUSTOMER_CART_ITEM_UPDATE_REJECTED',
                entityType: 'CartItem',
                entityId: cartItemId,
                description: `Updating cart item ${cartItemId} for customer ${customerId} was rejected`,
                newValues: {
                    customer_id: customerId,
                    requested_quantity: Number(quantity),
                    reason: result.message
                }
            });

            return res.status(result.error).json({
                message: result.message,
                ...(result.available_quantity !== undefined
                    ? { available_quantity: result.available_quantity }
                    : {})
            });
        }

        await auditCartAction(req, {
            action: 'CUSTOMER_CART_ITEM_UPDATED',
            entityType: 'CartItem',
            entityId: result.cartItemId,
            description: `Customer ${customerId} updated cart item ${result.cartItemId}`,
            oldValues: result.oldValues,
            newValues: {
                ...result.newValues,
                customer_id: customerId
            }
        });

        return res.status(200).json({
            message: 'Cart item updated successfully',
data: await applyCampaignPricing(
    await loadCart(result.cartId)
)
        });
    } catch (error) {
        console.error('Update customer cart item error:', error);

        await auditCartAction(req, {
            action: 'CUSTOMER_CART_ITEM_UPDATE_FAILED',
            entityType: 'CartItem',
            entityId: cartItemId,
            description: `Failed to update cart item ${cartItemId} for customer ${customerId}`,
            newValues: {
                customer_id: customerId,
                requested_quantity: Number(quantity)
            }
        });

        return res.status(500).json({ message: 'Failed to update cart item' });
    }
}

// REMOVE AN ITEM ONLY FROM THE CUSTOMER'S OWN ACTIVE CART
async function removeItem(req, res) {
    const customerId = getCustomerId(req);
    const cartItemId = req.params.id;

    if (!customerId) {
        return res.status(401).json({
            message: 'Customer authentication required'
        });
    }

    try {
        const result = await Cart.sequelize.transaction(async transaction => {
            const cartItem = await findOwnedActiveCartItem(
                customerId,
                cartItemId,
                transaction
            );

            if (!cartItem) {
                return null;
            }

            const oldValues = getCartItemSnapshot(cartItem);

            await cartItem.destroy({ transaction });

            return {
                cartId: oldValues.cart_id,
                cartItemId: oldValues.id,
                oldValues
            };
        });

        if (!result) {
            await auditCartAction(req, {
                action: 'CUSTOMER_CART_ITEM_REMOVE_REJECTED',
                entityType: 'CartItem',
                entityId: cartItemId,
                description: `Cart item ${cartItemId} was not found in customer ${customerId}'s active cart`,
                newValues: {
                    customer_id: customerId
                }
            });

            return res.status(404).json({
                message: 'Cart item not found'
            });
        }

        await auditCartAction(req, {
            action: 'CUSTOMER_CART_ITEM_REMOVED',
            entityType: 'CartItem',
            entityId: result.cartItemId,
            description: `Customer ${customerId} removed cart item ${result.cartItemId}`,
            oldValues: result.oldValues,
            newValues: {
                customer_id: customerId,
                removed: true
            }
        });

        return res.status(200).json({
            message: 'Item removed from cart successfully'
        });
    } catch (error) {
        console.error('Remove customer cart item error:', error);

        await auditCartAction(req, {
            action: 'CUSTOMER_CART_ITEM_REMOVE_FAILED',
            entityType: 'CartItem',
            entityId: cartItemId,
            description: `Failed to remove cart item ${cartItemId} for customer ${customerId}`,
            newValues: {
                customer_id: customerId
            }
        });

        return res.status(500).json({
            message: 'Failed to remove cart item'
        });
    }
}

module.exports = {
    getMyCart,
    addItem,
    updateItem,
    removeItem
};
