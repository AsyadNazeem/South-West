'use strict';

const crypto = require('crypto');
const {
    sendOrderConfirmationEmail,
    sendAdminNewOrderEmail
} = require('../services/emailService');
const { generateInvoicePdf, invoiceFilename } = require('../services/invoicePdfService');
const { Op } = require('sequelize');
const { notifyAdmins } = require('./adminNotificationController');
const { recordAuditLog } = require('../services/auditLogService');

const {
    calculateDeliveryCharge
} = require('../services/prepaidDeliveryPricingService');

const {
    sequelize,
    GuestCheckoutSession,
    Item,
    ItemVariant,
    ItemPrice,
    ItemImage,
    InventoryStock,
    InventoryLocation,
    DeliveryArea,
    DeliveryDistrict,
    Order,
    OrderItem,
    OrderAddress,
    Delivery,
    Payment,
    Invoice,
    InventoryStockMovement,
    GuestCheckoutIdempotency,
    Promotion,
    PromotionItem,
    PromotionCategory,
    PromotionBrand
} = require('../models');







const {
    getActiveCampaigns,
    campaignTargetsItem,
    calculateDiscount
} = require('../services/discountCampaignService');
const { getResponsiveImageMetadata } = require('../utils/fileStorage');

const CURRENCY = 'LKR';
const PRICE_TYPE = 'selling';
const SESSION_HOURS = 24;
const MAX_CART_ITEMS = 100;

function createToken() {
    return crypto.randomBytes(32).toString('hex');
}

function hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

function isValidId(value) {
    return (
        (typeof value === 'number' || /^\d+$/.test(String(value))) &&
        Number.isSafeInteger(Number(value)) &&
        Number(value) > 0
    );
}

function isValidQuantity(value) {
    return Number.isSafeInteger(Number(value)) && Number(value) > 0;
}

function parseStoredCartItems(items) {
    if (Array.isArray(items)) return items;
    if (typeof items !== 'string') return null;

    try {
        const parsed = JSON.parse(items);
        return Array.isArray(parsed) ? parsed : null;
    } catch {
        return null;
    }
}

function requireStoredCartItems(items) {
    const parsed = parseStoredCartItems(items);
    if (parsed) return parsed;
    throw Object.assign(
        new Error('Cart must contain between 1 and 100 items.'),
        { statusCode: 400 }
    );
}

async function getSession(req, transaction = undefined, lock = false) {
    const token = req.get('x-guest-checkout-token');

    if (
        typeof token !== 'string' ||
        !/^[a-f0-9]{64}$/i.test(token)
    ) {
        return null;
    }

    return GuestCheckoutSession.findOne({
        where: {
            token_hash: hashToken(token),
            expires_at: { [Op.gt]: new Date() },
            consumed_at: null
        },
        transaction,
        ...(lock && transaction
            ? { lock: transaction.LOCK.UPDATE }
            : {})
    });
}

async function getSellingPrice(itemId, variantId, transaction) {
    const now = new Date();

    const commonWhere = {
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
    };

    const variantPrice = await ItemPrice.findOne({
        where: {
            ...commonWhere,
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
            ...commonWhere,
            variant_id: null
        },
        order: [
            ['effective_from', 'DESC'],
            ['id', 'DESC']
        ],
        transaction
    });
}

async function getOnlineStock(variantId, transaction) {
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
        return total + Math.max(
            0,
            Number(stock.quantity_on_hand) -
            Number(stock.quantity_reserved)
        );
    }, 0);
}

async function resolveVariant(itemId, variantId, transaction) {
    let variant;

    if (variantId != null) {
        variant = await ItemVariant.findOne({
            where: {
                id: Number(variantId),
                item_id: itemId,
                is_active: true
            },
            transaction
        });

        if (!variant) {
            return {
                error: 404,
                message: 'Variant not found or unavailable.'
            };
        }
    } else {
        const variants = await ItemVariant.findAll({
            where: {
                item_id: itemId,
                is_active: true
            },
            order: [['is_default', 'DESC'], ['id', 'ASC']],
            transaction
        });

        if (variants.length > 1) {
            return {
                error: 400,
                message: 'Please select a variant.',
                requires_variant_selection: true
            };
        }

        if (variants.length === 1) {
            variant = variants[0];
        }
    }

    if (!variant) {
        return {
            error: 409,
            message: 'This item has no active variant configured.'
        };
    }

    return { variant };
}

async function validateCartItems(items, transaction) {
    items = parseStoredCartItems(items);

    if (
        !Array.isArray(items) ||
        items.length < 1 ||
        items.length > MAX_CART_ITEMS
    ) {
        throw Object.assign(
            new Error('Cart must contain between 1 and 100 items.'),
            { statusCode: 400 }
        );
    }

    const normalizedItems = new Map();

    for (const entry of items) {
        if (
            !isValidId(entry.item_id) ||
            (entry.variant_id != null && !isValidId(entry.variant_id)) ||
            !isValidQuantity(entry.quantity)
        ) {
            throw Object.assign(
                new Error('Invalid item, variant or quantity in cart.'),
                { statusCode: 400 }
            );
        }

        const itemId = Number(entry.item_id);
        const variantId = entry.variant_id == null
            ? null
            : Number(entry.variant_id);
        const key = `${itemId}:${variantId ?? 'null'}`;
        const existing = normalizedItems.get(key);
        const combinedQuantity = Number(entry.quantity) +
            (existing ? existing.quantity : 0);

        if (!Number.isSafeInteger(combinedQuantity)) {
            throw Object.assign(
                new Error('Cart quantity is invalid.'),
                { statusCode: 400 }
            );
        }

        normalizedItems.set(key, {
            item_id: itemId,
            variant_id: variantId,
            quantity: combinedQuantity
        });
    }

    items = Array.from(normalizedItems.values());

    const campaigns = await getActiveCampaigns(new Date(), transaction);
    const result = [];

    for (const entry of items) {
        if (
            !isValidId(entry.item_id) ||
            (entry.variant_id != null && !isValidId(entry.variant_id)) ||
            !isValidQuantity(entry.quantity)
        ) {
            throw Object.assign(
                new Error('Invalid item, variant or quantity in cart.'),
                { statusCode: 400 }
            );
        }

        const item = await Item.findByPk(Number(entry.item_id), {
            include: [{
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
            }],
            transaction
        });

        if (!item || !item.is_active) {
            throw Object.assign(
                new Error('An item in your cart is unavailable.'),
                { statusCode: 409 }
            );
        }

        const resolved = await resolveVariant(
            item.id,
            entry.variant_id,
            transaction
        );

        if (resolved.error) {
            throw Object.assign(
                new Error(resolved.message),
                {
                    statusCode: resolved.error,
                    requires_variant_selection:
                        resolved.requires_variant_selection
                }
            );
        }

        const variant = resolved.variant;
        const price = await getSellingPrice(
            item.id,
            variant.id,
            transaction
        );

        if (!price || Number(price.price) <= 0) {
            throw Object.assign(
                new Error(`No valid selling price is available for ${item.item_name}.`),
                { statusCode: 409 }
            );
        }

        const available = await getOnlineStock(variant.id, transaction);

        if (Number(entry.quantity) > available) {
            throw Object.assign(
                new Error(
                    `Insufficient online stock for ${item.item_name}. Available: ${available}.`
                ),
                { statusCode: 409 }
            );
        }

        const unitPrice = Number(price.price);

        let bestDiscount = null;

        for (const campaign of campaigns) {
            if (!campaignTargetsItem(campaign, item)) continue;

            const discount = calculateDiscount(campaign, unitPrice);

            if (
                discount.discount_amount > 0 &&
                (!bestDiscount ||
                    discount.discount_amount > bestDiscount.discount_amount)
            ) {
                bestDiscount = {
                    campaign_id: campaign.id,
                    campaign_name: campaign.campaign_name,
                    ...discount
                };
            }
        }

        result.push({
            item_id: item.id,
            variant_id: variant.id,
            quantity: Number(entry.quantity),
            unit_price: unitPrice,
            available_quantity: available,
            item_name: item.item_name,
            images: item.images ?? [],
            variant_name: variant.variant_name,
            original_price: unitPrice,
            discount_amount: bestDiscount?.discount_amount || 0,
            discounted_price: bestDiscount?.discounted_price || unitPrice,
            discount_campaign: bestDiscount
                ? {
                    id: bestDiscount.campaign_id,
                    name: bestDiscount.campaign_name
                }
                : null
        });
    }

    return result;
}

async function addResponsiveMetadataToItems(items, responsiveImageCache = new Map()) {
    return Promise.all(items.map(async item => ({
        ...item,
        images: await Promise.all((item.images || []).map(async image => {
            const value = typeof image.toJSON === 'function'
                ? image.toJSON()
                : image;
            return {
                ...value,
                responsive_images: await getResponsiveImageMetadata(
                    value.file_path,
                    'products',
                    responsiveImageCache
                ),
            };
        })),
    })));
}


const IDEMPOTENCY_KEY_MAX_LENGTH = 100;

function money(value) {
    return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function createCheckoutError(message, statusCode = 400) {
    return Object.assign(new Error(message), { statusCode });
}

function getIdempotencyKey(req) {
    const key = req.get('Idempotency-Key');

    if (
        typeof key !== 'string' ||
        key.length === 0 ||
        key.length > IDEMPOTENCY_KEY_MAX_LENGTH ||
        !/^[A-Za-z0-9._:-]+$/.test(key)
    ) {
        return null;
    }

    return key;
}

function hashGuestCheckoutRequest(sessionId, details, items) {
    const payload = {
        sessionId: Number(sessionId),
        items: items.map(item => ({
            item_id: Number(item.item_id),
            variant_id: Number(item.variant_id),
            quantity: Number(item.quantity)
        })),
        customer_email: details.customer_email.trim().toLowerCase(),
        recipient_name: details.recipient_name.trim(),
        phone: details.phone.trim(),
        address_line_1: details.address_line_1.trim(),
        address_line_2: details.address_line_2?.trim() || null,
        city: details.city.trim(),
        state: details.state?.trim() || null,
        postal_code: details.postal_code?.trim() || null,
        country: details.country?.trim() || 'Sri Lanka',
        billing_same_as_shipping: details.billing_same_as_shipping !== false,
        billing_address: details.billing_same_as_shipping === false
            ? {
                recipient_name: details.billing_address?.recipient_name?.trim() || null,
                phone: details.billing_address?.phone?.trim() || null,
                address_line_1: details.billing_address?.address_line_1?.trim() || null,
                address_line_2: details.billing_address?.address_line_2?.trim() || null,
                city: details.billing_address?.city?.trim() || null,
                state: details.billing_address?.state?.trim() || null,
                postal_code: details.billing_address?.postal_code?.trim() || null,
                country: details.billing_address?.country?.trim() || null
            }
            : null,
        district_id: Number(details.district_id),
        area_id: Number(details.area_id),
        payment_method: details.payment_method || 'cash',
        promo_code: details.promo_code?.trim().toUpperCase() || null
    };

    return crypto
        .createHash('sha256')
        .update(JSON.stringify(payload))
        .digest('hex');
}

function generateReference(prefix) {
    return `${prefix}-${Date.now()}-${crypto.randomBytes(5).toString('hex')}`;
}



async function createSession(req, res) {
    try {
        const {
            item_id,
            variant_id,
            quantity = 1,
            items
        } = req.body || {};

        let cartItems;

        if (Array.isArray(items)) {
            cartItems = items;
        } else if (item_id != null) {
            cartItems = [{
                item_id,
                variant_id: variant_id ?? null,
                quantity
            }];
        } else {
            cartItems = [];
        }

        const validated = await sequelize.transaction(async transaction => {
            return validateCartItems(cartItems, transaction);
        });

        const token = createToken();
        const expiresAt = new Date(
            Date.now() + SESSION_HOURS * 60 * 60 * 1000
        );

        await GuestCheckoutSession.create({
            token_hash: hashToken(token),
            cart_items: validated.map(entry => ({
                item_id: entry.item_id,
                variant_id: entry.variant_id,
                quantity: entry.quantity
            })),
            expires_at: expiresAt
        });

        const responseItems = await addResponsiveMetadataToItems(
            validated,
            new Map()
        );

        return res.status(201).json({
            message: 'Guest checkout session created.',
            token,
            expires_at: expiresAt.toISOString(),
            data: {
                items: responseItems,
                currency: CURRENCY
            }
        });
    } catch (error) {
        return res.status(error.statusCode || 500).json({
            message: error.message || 'Unable to create guest checkout session.',
            ...(error.requires_variant_selection
                ? { requires_variant_selection: true }
                : {})
        });
    }
}

async function getGuestCart(req, res) {
    try {
        const session = await getSession(req);

        if (!session) {
            return res.status(401).json({
                message: 'Guest checkout session is invalid or expired.'
            });
        }

        let items;

        const storedItems = parseStoredCartItems(session.cart_items);

        if (Array.isArray(storedItems) && storedItems.length === 0) {
            // An empty cart is valid when retrieving the cart.
            items = [];
        } else {
            // Validate normally when the cart contains items.
            items = await sequelize.transaction(async transaction => {
                return validateCartItems(storedItems, transaction);
            });
        }

        items = await addResponsiveMetadataToItems(items, new Map());

        return res.status(200).json({
            message: 'Guest cart retrieved successfully.',
            data: {
                items,
                currency: CURRENCY
            }
        });
    } catch (error) {
        return res.status(error.statusCode || 500).json({
            message: error.message || 'Unable to retrieve guest cart.',
            ...(error.requires_variant_selection
                ? { requires_variant_selection: true }
                : {})
        });
    }
}

async function addGuestCartItem(req, res) {
    try {
        const {
            item_id,
            variant_id,
            quantity = 1
        } = req.body || {};

        if (
            !isValidId(item_id) ||
            (variant_id != null && !isValidId(variant_id)) ||
            !isValidQuantity(quantity)
        ) {
            return res.status(400).json({
                message: 'A valid item, variant and positive quantity are required.'
            });
        }

        const result = await sequelize.transaction(async transaction => {
            const session = await getSession(req, transaction, true);

            if (!session) {
                return {
                    error: 401,
                    message: 'Guest checkout session is invalid or expired.'
                };
            }

            const currentItems = requireStoredCartItems(session.cart_items);

            const existing = currentItems.find(entry =>
                Number(entry.item_id) === Number(item_id) &&
                Number(entry.variant_id) === Number(variant_id)
            );

            const nextQuantity = Number(quantity) +
                (existing ? Number(existing.quantity) : 0);

            const nextItems = existing
                ? currentItems.map(entry =>
                    entry === existing
                        ? { ...entry, quantity: nextQuantity }
                        : entry
                )
                : [
                    ...currentItems,
                    {
                        item_id: Number(item_id),
                        variant_id: variant_id == null
                            ? null
                            : Number(variant_id),
                        quantity: Number(quantity)
                    }
                ];

            if (nextItems.length > MAX_CART_ITEMS) {
                return {
                    error: 400,
                    message: 'Guest cart item limit reached.'
                };
            }

            const validated = await validateCartItems(
                nextItems,
                transaction
            );

            await session.update({
                cart_items: nextItems
            }, { transaction });

            return { items: validated };
        });

        if (result.error) {
            return res.status(result.error).json({
                message: result.message
            });
        }

        const responseItems = await addResponsiveMetadataToItems(
            result.items,
            new Map()
        );

        return res.status(200).json({
            message: 'Item added to guest cart.',
            data: {
                items: responseItems,
                currency: CURRENCY
            }
        });
    } catch (error) {
        return res.status(error.statusCode || 500).json({
            message: error.message || 'Unable to add item to guest cart.',
            ...(error.requires_variant_selection
                ? { requires_variant_selection: true }
                : {})
        });
    }
}

async function updateGuestCartItem(req, res) {
    try {
        const { item_id, variant_id, quantity } = req.body || {};

        if (
            !isValidId(item_id) ||
            !isValidId(variant_id) ||
            !isValidQuantity(quantity)
        ) {
            return res.status(400).json({
                message: 'A valid item, variant and positive quantity are required.'
            });
        }

        const result = await sequelize.transaction(async transaction => {
            const session = await getSession(req, transaction, true);

            if (!session) {
                return {
                    error: 401,
                    message: 'Guest checkout session is invalid or expired.'
                };
            }

            const items = requireStoredCartItems(session.cart_items);

            const index = items.findIndex(entry =>
                Number(entry.item_id) === Number(item_id) &&
                Number(entry.variant_id) === Number(variant_id)
            );

            if (index < 0) {
                return { error: 404, message: 'Cart item not found.' };
            }

            items[index] = {
                ...items[index],
                quantity: Number(quantity)
            };

            const validated = await validateCartItems(items, transaction);

            await session.update({ cart_items: items }, { transaction });

            return { items: validated };
        });

        if (result.error) {
            return res.status(result.error).json({
                message: result.message
            });
        }

        const responseItems = await addResponsiveMetadataToItems(
            result.items,
            new Map()
        );

        return res.status(200).json({
            message: 'Guest cart updated.',
            data: {
                items: responseItems,
                currency: CURRENCY
            }
        });
    } catch (error) {
        return res.status(error.statusCode || 500).json({
            message: error.message || 'Unable to update guest cart.'
        });
    }
}

async function removeGuestCartItem(req, res) {
    try {
        const { item_id, variant_id } = req.body || {};

        if (!isValidId(item_id) || !isValidId(variant_id)) {
            return res.status(400).json({
                message: 'A valid item_id and variant_id are required.'
            });
        }

        const result = await sequelize.transaction(async transaction => {
            const session = await getSession(req, transaction, true);

            if (!session) {
                return {
                    error: 401,
                    message: 'Guest checkout session is invalid or expired.'
                };
            }

            const items = requireStoredCartItems(session.cart_items);

            const nextItems = items.filter(entry => !(
                Number(entry.item_id) === Number(item_id) &&
                Number(entry.variant_id) === Number(variant_id)
            ));

            if (nextItems.length === items.length) {
                return {
                    error: 404,
                    message: 'Cart item not found.'
                };
            }

            await session.update({
                cart_items: nextItems
            }, { transaction });

            return { success: true };
        });

        if (result.error) {
            return res.status(result.error).json({
                message: result.message
            });
        }

        return res.status(200).json({
            message: 'Item removed from guest cart.'
        });
    } catch (error) {
        return res.status(500).json({
            message: 'Unable to remove item from guest cart.'
        });
    }
}


// GUEST_QUOTE_HANDLER

async function quoteGuestCheckout(req, res) {
    try {
        const session = await getSession(req);

        if (!session) {
            return res.status(401).json({
                message: 'Guest checkout session is invalid or expired.'
            });
        }

        const details = req.body || {};

        const requiredFields = [
            'recipient_name',
            'customer_email',
            'phone',
            'address_line_1',
            'city',
            'district_id',
            'area_id'
        ];

        for (const field of requiredFields) {
            if (
                details[field] == null ||
                String(details[field]).trim() === ''
            ) {
                return res.status(400).json({
                    message: `${field.replace(/_/g, ' ')} is required.`
                });
            }
        }

        const email = String(details.customer_email).trim().toLowerCase();

        if (
            email.length > 255 ||
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
        ) {
            return res.status(400).json({
                message: 'Enter a valid email address.'
            });
        }

        if (
            String(details.recipient_name).trim().length > 150 ||
            String(details.phone).trim().length > 30 ||
            String(details.address_line_1).trim().length > 255 ||
            String(details.city).trim().length > 100
        ) {
            return res.status(400).json({
                message: 'One or more delivery details exceed the allowed length.'
            });
        }

        if (
            !isValidId(details.district_id) ||
            !isValidId(details.area_id)
        ) {
            return res.status(400).json({
                message: 'Select a valid delivery district and area.'
            });
        }

        const requestedPaymentMethod = String(
            details.payment_method || 'cash'
        ).trim().toLowerCase();

        const paymentMethod = requestedPaymentMethod === 'cod'
            ? 'cash'
            : requestedPaymentMethod;

        if (!['cash', 'card', 'koko', 'mintpay'].includes(paymentMethod)) {
            return res.status(400).json({
                message: 'Invalid payment method.'
            });
        }

        const result = await sequelize.transaction(async transaction => {
            const district = await DeliveryDistrict.findOne({
                where: {
                    id: Number(details.district_id),
                    status: 1
                },
                transaction
            });

            if (!district) {
                throw createCheckoutError(
                    'The selected delivery district is unavailable.',
                    400
                );
            }

            const area = await DeliveryArea.findOne({
                where: {
                    id: Number(details.area_id),
                    district_id: district.id,
                    status: 1
                },
                transaction
            });

            if (!area) {
                throw createCheckoutError(
                    'The selected delivery area is invalid or unavailable for this district.',
                    400
                );
            }

            const items = await validateCartItems(
                session.cart_items,
                transaction
            );

            let subtotal = 0;
            let campaignDiscount = 0;
            let totalWeightKg = 0;

            for (const entry of items) {
                const item = await Item.findByPk(entry.item_id, {
                    transaction
                });

                if (
                    !item ||
                    item.shipping_weight == null ||
                    !Number.isFinite(Number(item.shipping_weight)) ||
                    Number(item.shipping_weight) <= 0
                ) {
                    throw createCheckoutError(
                        `A valid shipping weight must be configured for ${entry.item_name}.`,
                        409
                    );
                }

                const quantity = Number(entry.quantity);
                const unitPrice = money(entry.unit_price);
                const unitDiscount = money(entry.discount_amount || 0);

                subtotal = money(subtotal + unitPrice * quantity);
                campaignDiscount = money(
                    campaignDiscount + unitDiscount * quantity
                );

                const weightKg = item.shipping_weight_unit === 'g'
                    ? Number(item.shipping_weight) / 1000
                    : Number(item.shipping_weight);

                totalWeightKg += weightKg * quantity;
            }

            const deliveryPricing = await calculateDeliveryCharge({
                paymentMethod,
                district,
                area,
                totalWeightKg,
                transaction
            });

            const shippingAmount = money(deliveryPricing.deliveryCharge);

            if (
                !Number.isFinite(shippingAmount) ||
                shippingAmount < 0
            ) {
                throw createCheckoutError(
                    'The selected delivery area has invalid delivery charges.',
                    409
                );
            }

            if (
                typeof details.promo_code === 'string' &&
                details.promo_code.trim()
            ) {
                const code = details.promo_code.trim().toUpperCase();
                const now = new Date();

                const promotion = await Promotion.findOne({
                    where: {
                        promotion_code: code,
                        status: 'active',
                        is_active: true,
                        start_date: { [Op.lte]: now },
                        end_date: { [Op.gte]: now }
                    },
                    transaction,
                    lock: transaction.LOCK.UPDATE
                });

                if (!promotion) {
                    throw createCheckoutError(
                        'This promo code is invalid, inactive, or expired.',
                        400
                    );
                }

                if (
                    promotion.usage_limit != null &&
                    Number(promotion.used_count || 0) >=
                        Number(promotion.usage_limit)
                ) {
                    throw createCheckoutError(
                        'This promo code has reached its usage limit.',
                        400
                    );
                }

                if (
                    !['percentage', 'fixed_amount'].includes(
                        promotion.promotion_type
                    ) ||
                    !Number.isFinite(Number(promotion.discount_value)) ||
                    Number(promotion.discount_value) <= 0 ||
                    (
                        promotion.promotion_type === 'percentage' &&
                        Number(promotion.discount_value) > 100
                    )
                ) {
                    throw createCheckoutError(
                        'This promo code is not configured correctly.',
                        400
                    );
                }

                throw createCheckoutError(
                    'This promo code is valid. Register or log in to apply it.',
                    401
                );
            }

            const discountAmount = campaignDiscount;
            const taxAmount = 0;
            const totalAmount = money(
                subtotal - discountAmount + taxAmount + shippingAmount
            );

            return {
                items,
                currency: CURRENCY,
                subtotal,
                campaign_discount: campaignDiscount,
                discount_amount: discountAmount,
                tax_amount: taxAmount,
                shipping_amount: shippingAmount,
                normal_delivery_amount: deliveryPricing.normalDeliveryCharge,
                additional_shipping_amount: deliveryPricing.additionalShippingAmount,
                total_weight_kg: money(totalWeightKg),
                billable_weight_kg: deliveryPricing.billableKg,
                total_amount: totalAmount,
                payment_method: paymentMethod,
                delivery: {
                    district_id: district.id,
                    district_name: district.district_name,
                    area_id: area.id,
                    area_name: area.area_name
                }
            };
        });

        return res.status(200).json({
            message: 'Guest checkout quote calculated successfully.',
            data: {
                ...result,
                items: await addResponsiveMetadataToItems(
                    result.items,
                    new Map()
                ),
            }
        });
    } catch (error) {
        return res.status(error.statusCode || 500).json({
            message: error.message ||
                'Unable to calculate guest checkout quote.',
            ...(error.requires_variant_selection
                ? { requires_variant_selection: true }
                : {})
        });
    }
}


// GUEST_ORDER_CREATION_HANDLER

async function checkoutGuest(req, res) {
    let transaction;

    try {
        const token = req.get('x-guest-checkout-token');
        const idempotencyKey = getIdempotencyKey(req);
        const details = req.body || {};

        if (
            typeof token !== 'string' ||
            !/^[a-f0-9]{64}$/i.test(token)
        ) {
            return res.status(401).json({
                message: 'A valid guest checkout session is required.'
            });
        }

        if (!idempotencyKey) {
            return res.status(400).json({
                message: 'A valid Idempotency-Key header is required.'
            });
        }

        const requiredFields = [
            'recipient_name',
            'customer_email',
            'phone',
            'address_line_1',
            'city',
            'district_id',
            'area_id'
        ];

        for (const field of requiredFields) {
            if (
                details[field] == null ||
                String(details[field]).trim() === ''
            ) {
                return res.status(400).json({
                    message: `${field.replace(/_/g, ' ')} is required.`
                });
            }
        }

        const email = String(details.customer_email)
            .trim()
            .toLowerCase();

        const address = {
            recipient_name: String(details.recipient_name).trim(),
            phone: String(details.phone).trim(),
            address_line_1: String(details.address_line_1).trim(),
            address_line_2: details.address_line_2
                ? String(details.address_line_2).trim()
                : null,
            city: String(details.city).trim(),
            state: details.state ? String(details.state).trim() : null,
            postal_code: details.postal_code
                ? String(details.postal_code).trim()
                : null,
            country: details.country
                ? String(details.country).trim()
                : 'Sri Lanka'
        };

        const useShippingAsBilling =
            details.billing_same_as_shipping !== false;

        let billingAddress = null;

        if (!useShippingAsBilling) {
            const billing = details.billing_address;

            const requiredBillingFields = [
                'recipient_name',
                'phone',
                'address_line_1',
                'city',
                'country'
            ];

            if (
                !billing ||
                typeof billing !== 'object' ||
                requiredBillingFields.some(field =>
                    typeof billing[field] !== 'string' ||
                    !billing[field].trim()
                )
            ) {
                return res.status(400).json({
                    message: 'Please provide all required billing address details.'
                });
            }

            billingAddress = {
                recipient_name: String(billing.recipient_name).trim(),
                phone: String(billing.phone).trim(),
                address_line_1: String(billing.address_line_1).trim(),
                address_line_2: billing.address_line_2
                    ? String(billing.address_line_2).trim()
                    : null,
                city: String(billing.city).trim(),
                state: billing.state ? String(billing.state).trim() : null,
                postal_code: billing.postal_code
                    ? String(billing.postal_code).trim()
                    : null,
                country: String(billing.country).trim()
            };

            const billingLimits = {
                recipient_name: 150,
                phone: 30,
                address_line_1: 255,
                address_line_2: 255,
                city: 100,
                state: 100,
                postal_code: 30,
                country: 100
            };

            for (const [field, maxLength] of Object.entries(billingLimits)) {
                if (
                    billingAddress[field] != null &&
                    billingAddress[field].length > maxLength
                ) {
                    return res.status(400).json({
                        message: `Billing ${field.replace(/_/g, ' ')} is too long.`
                    });
                }
            }
        }

        if (
            email.length > 255 ||
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
        ) {
            return res.status(400).json({
                message: 'Enter a valid email address.'
            });
        }

        if (
            address.recipient_name.length > 150 ||
            address.phone.length > 30 ||
            address.address_line_1.length > 255 ||
            (address.address_line_2 && address.address_line_2.length > 255) ||
            address.city.length > 100 ||
            (address.state && address.state.length > 100) ||
            (address.postal_code && address.postal_code.length > 30) ||
            address.country.length > 100
        ) {
            return res.status(400).json({
                message: 'One or more delivery details exceed the allowed length.'
            });
        }

        if (
            !isValidId(details.district_id) ||
            !isValidId(details.area_id)
        ) {
            return res.status(400).json({
                message: 'Select a valid delivery district and area.'
            });
        }

        const requestedPaymentMethod = String(
            details.payment_method || 'cash'
        ).trim().toLowerCase();

        const paymentMethod = requestedPaymentMethod === 'cod'
            ? 'cash'
            : requestedPaymentMethod;

        if (!['cash', 'card', 'koko', 'mintpay'].includes(paymentMethod)) {
            return res.status(400).json({
                message: 'Invalid payment method.'
            });
        }

        transaction = await sequelize.transaction();

        const session = await GuestCheckoutSession.findOne({
            where: {
                token_hash: hashToken(token)
            },
            transaction,
            lock: transaction.LOCK.UPDATE
        });

        if (!session) {
            throw createCheckoutError(
                'Guest checkout session is invalid or unavailable.',
                401
            );
        }

        const sessionItems = parseStoredCartItems(session.cart_items);

        const requestHash = hashGuestCheckoutRequest(
            session.id,
            {
                ...details,
                customer_email: email,
                country: address.country,
                billing_same_as_shipping: useShippingAsBilling,
                billing_address: billingAddress
            },
            sessionItems ?? session.cart_items
        );

        const existing = await GuestCheckoutIdempotency.findOne({
            where: {
                guest_checkout_session_id: session.id,
                idempotency_key: idempotencyKey
            },
            transaction
        });

        if (existing) {
            if (existing.request_hash !== requestHash) {
                throw createCheckoutError(
                    'This Idempotency-Key was already used with different checkout details.',
                    409
                );
            }

            if (!existing.order_id) {
                throw createCheckoutError(
                    'The original checkout has not been confirmed. Retry using the same key.',
                    409
                );
            }

            const existingOrder = await Order.findByPk(
                existing.order_id,
                { transaction }
            );

            const existingPayment = await Payment.findOne({
                where: { order_id: existing.order_id },
                order: [['id', 'ASC']],
                transaction
            });

            if (!existingOrder || !existingPayment) {
                throw createCheckoutError(
                    'The original order could not be retrieved.',
                    409
                );
            }

            await transaction.commit();
            transaction = null;

            return res.status(200).json({
                message: 'Guest order already created.',
                data: {
                    order: existingOrder,
                    payment: existingPayment,
                    replayed: true
                }
            });
        }

        if (session.consumed_at) {
            throw createCheckoutError(
                'This guest checkout session has already been used.',
                409
            );
        }

        if (new Date(session.expires_at) <= new Date()) {
            throw createCheckoutError(
                'Guest checkout session has expired. Please start checkout again.',
                401
            );
        }

        if (!Array.isArray(sessionItems) || sessionItems.length === 0) {
            throw createCheckoutError(
                'Your guest cart is empty.',
                400
            );
        }

        // A valid promo code is visible to guests but can only be redeemed
        // after registration or login.
        if (
            typeof details.promo_code === 'string' &&
            details.promo_code.trim()
        ) {
            const promotion = await Promotion.findOne({
                where: {
                    promotion_code: details.promo_code.trim().toUpperCase(),
                    status: 'active',
                    is_active: true,
                    start_date: { [Op.lte]: new Date() },
                    end_date: { [Op.gte]: new Date() }
                },
                transaction,
                lock: transaction.LOCK.UPDATE
            });

            if (!promotion) {
                throw createCheckoutError(
                    'This promo code is invalid, inactive, or expired.',
                    400
                );
            }

            if (
                promotion.usage_limit != null &&
                Number(promotion.used_count || 0) >=
                    Number(promotion.usage_limit)
            ) {
                throw createCheckoutError(
                    'This promo code has reached its usage limit.',
                    400
                );
            }

            if (
                !['percentage', 'fixed_amount'].includes(
                    promotion.promotion_type
                ) ||
                !Number.isFinite(Number(promotion.discount_value)) ||
                Number(promotion.discount_value) <= 0 ||
                (
                    promotion.promotion_type === 'percentage' &&
                    Number(promotion.discount_value) > 100
                )
            ) {
                throw createCheckoutError(
                    'This promo code is not configured correctly.',
                    400
                );
            }

            throw createCheckoutError(
                'This promo code is valid. Register or log in to apply it.',
                401
            );
        }

        const district = await DeliveryDistrict.findOne({
            where: {
                id: Number(details.district_id),
                status: 1
            },
            transaction
        });

        if (!district) {
            throw createCheckoutError(
                'The selected delivery district is unavailable.',
                400
            );
        }

        const area = await DeliveryArea.findOne({
            where: {
                id: Number(details.area_id),
                district_id: district.id,
                status: 1
            },
            transaction
        });

        if (!area) {
            throw createCheckoutError(
                'The selected delivery area is invalid or unavailable for this district.',
                400
            );
        }

        const validatedItems = await validateCartItems(
            sessionItems,
            transaction
        );

        let subtotal = 0;
        let campaignDiscount = 0;
        let totalWeightKg = 0;

        const preparedItems = [];

        for (const entry of validatedItems) {
            const item = await Item.findByPk(entry.item_id, {
                transaction
            });

            if (!item) {
                throw createCheckoutError(
                    `Item ${entry.item_id} is no longer available.`,
                    409
                );
            }

            if (
                item.shipping_weight == null ||
                !Number.isFinite(Number(item.shipping_weight)) ||
                Number(item.shipping_weight) <= 0
            ) {
                throw createCheckoutError(
                    `A valid shipping weight must be configured for ${entry.item_name}.`,
                    409
                );
            }

            const quantity = Number(entry.quantity);
            const unitPrice = money(entry.unit_price);
            const unitDiscount = money(entry.discount_amount || 0);
            const lineDiscount = money(unitDiscount * quantity);
            const lineTotal = money(
                (unitPrice - unitDiscount) * quantity
            );

            subtotal = money(subtotal + unitPrice * quantity);
            campaignDiscount = money(
                campaignDiscount + lineDiscount
            );

            const weightKg = item.shipping_weight_unit === 'g'
                ? Number(item.shipping_weight) / 1000
                : Number(item.shipping_weight);

            totalWeightKg += weightKg * quantity;

            preparedItems.push({
                item,
                variantId: Number(entry.variant_id),
                quantity,
                unitPrice,
                lineDiscount,
                lineTotal,
                variantName: entry.variant_name,
                discountPercentage: unitPrice > 0
                    ? money((unitDiscount / unitPrice) * 100)
                    : 0
            });
        }

        const deliveryPricing = await calculateDeliveryCharge({
            paymentMethod,
            district,
            area,
            totalWeightKg,
            transaction
        });

        const shippingAmount = money(deliveryPricing.deliveryCharge);

        if (
            !Number.isFinite(shippingAmount) ||
            shippingAmount < 0
        ) {
            throw createCheckoutError(
                'The selected delivery area has invalid delivery charges.',
                409
            );
        }

        const discountAmount = campaignDiscount;
        const taxAmount = 0;
        const totalAmount = money(
            subtotal - discountAmount + taxAmount + shippingAmount
        );

        // Only active online inventory locations can fulfil online orders.
        const onlineLocations = await InventoryLocation.findAll({
            where: {
                location_type: 'online',
                is_active: true
            },
            order: [['id', 'ASC']],
            transaction
        });

        if (!onlineLocations.length) {
            throw createCheckoutError(
                'Online inventory is not configured.',
                503
            );
        }

        const locationIds = onlineLocations.map(location => location.id);

        const stockRows = await InventoryStock.findAll({
            where: {
                variant_id: preparedItems.map(entry => entry.variantId),
                location_id: locationIds,
                is_active: true
            },
            order: [
                ['variant_id', 'ASC'],
                ['location_id', 'ASC']
            ],
            transaction,
            lock: transaction.LOCK.UPDATE
        });

        const stocksByVariant = new Map();

        for (const stock of stockRows) {
            const key = String(stock.variant_id);

            if (!stocksByVariant.has(key)) {
                stocksByVariant.set(key, []);
            }

            stocksByVariant.get(key).push(stock);
        }

        // Verify stock while holding inventory row locks.
        for (const entry of preparedItems) {
            const stocks =
                stocksByVariant.get(String(entry.variantId)) || [];

            if (!stocks.length) {
                throw createCheckoutError(
                    `No active online stock record exists for ${entry.item.item_name}.`,
                    409
                );
            }

            const available = stocks.reduce((sum, stock) => {
                return sum + Math.max(
                    0,
                    Number(stock.quantity_on_hand) -
                    Number(stock.quantity_reserved)
                );
            }, 0);

            if (available < entry.quantity) {
                throw createCheckoutError(
                    `Insufficient online stock for ${entry.item.item_name}. Available: ${available}.`,
                    409
                );
            }
        }

        // Reserve the idempotency key in the same transaction as the order.
        const idempotencyRecord = await GuestCheckoutIdempotency.create({
            guest_checkout_session_id: session.id,
            idempotency_key: idempotencyKey,
            request_hash: requestHash,
            order_id: null
        }, { transaction });

        const orderNumber = generateReference('SWO');
        const invoiceNumber = generateReference('SWI');
        const paymentReference = generateReference('SWP');

        const order = await Order.create({
            order_number: orderNumber,
            invoice_number: invoiceNumber,
            customer_id: null,
            customer_email: email,
            order_date: new Date(),
            order_type: 'online',
            status: 'pending',
            payment_status: 'unpaid',
            fulfillment_status: 'unfulfilled',
            subtotal,
            discount_amount: discountAmount,
            tax_amount: taxAmount,
            shipping_amount: shippingAmount,
            normal_delivery_amount: deliveryPricing.normalDeliveryCharge,
            additional_shipping_amount: deliveryPricing.additionalShippingAmount,
            total_amount: totalAmount,
            notes: null,
            created_by: null
        }, { transaction });

        await notifyAdmins({ type: 'order', title: 'New customer order', message: `Order ${order.order_number} was placed by a guest customer.`, referenceType: 'order', referenceId: order.id, transaction });

        for (const entry of preparedItems) {
            await OrderItem.create({
                order_id: order.id,
                item_id: entry.item.id,
                variant_id: entry.variantId,
                quantity: entry.quantity,
                unit_price: entry.unitPrice,
                discount_amount: entry.lineDiscount,
                discount_percentage_mode: false,
                discount_percentage: entry.discountPercentage,
                tax_amount: 0,
                line_total: entry.lineTotal
            }, { transaction });
        }

        await OrderAddress.create({
            order_id: order.id,
            address_type: 'shipping',
            recipient_name: address.recipient_name,
            phone: address.phone,
            address_line_1: address.address_line_1,
            address_line_2: address.address_line_2,
            city: address.city,
            state: address.state,
            postal_code: address.postal_code,
            country: address.country
        }, { transaction });

        if (!useShippingAsBilling) {
            await OrderAddress.create({
                order_id: order.id,
                address_type: 'billing',
                recipient_name: billingAddress.recipient_name,
                phone: billingAddress.phone,
                address_line_1: billingAddress.address_line_1,
                address_line_2: billingAddress.address_line_2,
                city: billingAddress.city,
                state: billingAddress.state,
                postal_code: billingAddress.postal_code,
                country: billingAddress.country
            }, { transaction });
        }

        const payment = await Payment.create({
            payment_reference: paymentReference,
            order_id: order.id,
            payment_method: paymentMethod,
            payment_status: 'unpaid',
            amount: totalAmount,
            transaction_reference: null,
            payment_date: null,
            notes: ['card', 'koko', 'mintpay'].includes(paymentMethod)
                ? 'Awaiting payment provider integration and verified confirmation.'
                : 'Cash on delivery. Payment is outstanding.',
            processed_by: null
        }, { transaction });

        await Invoice.create({
            invoice_number: invoiceNumber,
            order_id: order.id,
            customer_id: null,
            invoice_date: new Date(),
            status: 'draft',
            subtotal,
            discount_amount: discountAmount,
            tax_amount: taxAmount,
            shipping_amount: shippingAmount,
            total_amount: totalAmount,
            paid_amount: 0,
            balance_amount: totalAmount,
            created_by: null
        }, { transaction });

        // Deduct online stock and record movements transactionally.
        for (const entry of preparedItems) {
            let remaining = entry.quantity;

            const stocks =
                stocksByVariant.get(String(entry.variantId)) || [];

            for (const stock of stocks) {
                if (remaining <= 0) break;

                const available = Math.max(
                    0,
                    Number(stock.quantity_on_hand) -
                    Number(stock.quantity_reserved)
                );

                const deduction = Math.min(available, remaining);

                if (deduction <= 0) continue;

                await stock.update({
                    quantity_on_hand:
                        Number(stock.quantity_on_hand) - deduction
                }, { transaction });

                await InventoryStockMovement.create({
                    item_id: entry.item.id,
                    variant_id: entry.variantId,
                    location_id: stock.location_id,
                    movement_type: 'sale',
                    quantity: deduction,
                    reference_type: 'order',
                    reference_id: order.id,
                    notes: `Online checkout ${orderNumber}`,
                    created_by: null,
                    created_at: new Date()
                }, { transaction });

                remaining -= deduction;
            }

            if (remaining > 0) {
                throw createCheckoutError(
                    `Stock changed while processing ${entry.item.item_name}. Please try again.`,
                    409
                );
            }
        }

        await session.update({
            consumed_at: new Date()
        }, { transaction });

        await idempotencyRecord.update({
            order_id: order.id
        }, { transaction });

        await recordAuditLog({
            userId: null,
            action: 'GUEST_CHECKOUT_COMPLETED',
            module: 'CHECKOUT',
            entityType: 'Order',
            entityId: String(order.id),
            description: `Guest checkout completed for order ${order.order_number}`,
            newValues: {
                order_id: order.id,
                order_number: order.order_number,
                order_type: order.order_type,
                payment_status: order.payment_status,
                subtotal,
                discount_amount: discountAmount,
                shipping_amount: shippingAmount,
                total_amount: totalAmount,
                item_count: preparedItems.length
            },
            ipAddress: req.ip || null,
            userAgent: req.get('user-agent') || null,
            requestId: req.id || req.requestId || null,
            transaction
        });

        await transaction.commit();
        transaction = null;

        try {
            const emailDetails = {
                orderNumber,
                customerName: address.recipient_name,
                customerEmail: email,
                phone: address.phone,
                address,
                items: preparedItems.map(entry => ({
                    name: entry.item.item_name || entry.item.name || 'Product',
                    variantName: entry.variantName,
                    quantity: entry.quantity,
                    unitPrice: entry.unitPrice,
                    lineTotal: entry.lineTotal
                })),
                subtotal,
                discountAmount,
                shippingAmount,
                normalDeliveryAmount: deliveryPricing.normalDeliveryCharge,
                additionalShippingAmount: deliveryPricing.additionalShippingAmount,
                totalAmount,
                paymentMethod,
                paymentStatus: 'Unpaid',
                invoiceAttachment: paymentMethod === 'cash'
                    ? {
                        filename: invoiceFilename(orderNumber, true),
                        content: await generateInvoicePdf({
                            order_number: orderNumber,
                            invoice_number: invoiceNumber,
                            order_date: order.order_date,
                            payment_status: 'unpaid',
                            subtotal,
                            discount_amount: discountAmount,
                            shipping_amount: shippingAmount,
                            normal_delivery_amount: deliveryPricing.normalDeliveryCharge,
                            additional_shipping_amount: deliveryPricing.additionalShippingAmount,
                            total_amount: totalAmount,
                            customer_email: email,
                            addresses: [{ ...address, address_type: 'shipping' }],
                            payments: [{ payment_method: paymentMethod, payment_status: 'unpaid' }],
                            items: preparedItems.map(entry => ({
                                name: entry.item.item_name,
                                variant_name: entry.variantName,
                                quantity: entry.quantity,
                                unit_price: entry.unitPrice,
                                line_total: entry.lineTotal
                            }))
                        }, { draft: true }),
                        contentType: 'application/pdf'
                    }
                    : null
            };

            const results = await Promise.allSettled([
                sendOrderConfirmationEmail(emailDetails),
                sendAdminNewOrderEmail(emailDetails)
            ]);

            results.forEach((result, index) => {
                if (result.status === 'rejected') {
                    console.error(
                        index === 0
                            ? 'Guest order confirmation email failed:'
                            : 'Admin order notification failed:',
                        result.reason
                    );
                }
            });
        } catch (emailError) {
            console.error('Guest order email processing failed:', emailError);
        }

        return res.status(201).json({
            message: 'Guest order created successfully.',
            data: {
                order,
                payment,
                normal_delivery_amount: deliveryPricing.normalDeliveryCharge,
                additional_shipping_amount: deliveryPricing.additionalShippingAmount,
                replayed: false
            }
        });

    } catch (error) {
        if (transaction) {
            await transaction.rollback();
        }

        return res.status(error.statusCode || 500).json({
            message: error.message ||
                'Unable to complete guest checkout.',
            ...(error.requires_variant_selection
                ? { requires_variant_selection: true }
                : {})
        });
    }
}

module.exports = {
    checkoutGuest,
    quoteGuestCheckout,
    createSession,
    getGuestCart,
    addGuestCartItem,
    updateGuestCartItem,
    removeGuestCartItem
};
