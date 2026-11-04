'use strict';

const crypto = require('crypto');
const { Op } = require('sequelize');
const db = require('../models');
const { recordAuditLog } = require('../services/auditLogService');
const {
    sendOrderConfirmationEmail,
    sendAdminNewOrderEmail
} = require('../services/emailService');
const {
    sequelize,
    CheckoutIdempotency,
        CustomerCheckoutSession,
    Cart,
    CartItem,
    Item,
    ItemVariant,
    ItemPrice,
    CustomerAddress,
    DeliveryArea,
    DeliveryDistrict,
    InventoryLocation,
    InventoryStock,
    InventoryStockMovement,
    Order,
    OrderItem,
    OrderAddress,
    Delivery,
    Payment,
    Invoice,
        Promotion,
    OrderPromotion
} = db;

const {
    getActiveCampaigns,
    campaignTargetsItem,
    calculateDiscount
} = require('../services/discountCampaignService');

const {
    loadValidPromotion,
    calculatePromotionDiscount
} = require('../services/promotionService');

const {
    calculateDeliveryCharge
} = require('../services/prepaidDeliveryPricingService');

const CURRENCY = 'LKR';
const PRICE_TYPE = 'selling';
const IDEMPOTENCY_KEY_MAX_LENGTH = 100;

const AUDIT_MODULE = 'CHECKOUT';

async function auditCheckout(req, {
    action,
    customerId = null,
    orderId = null,
    description,
    oldValues = null,
    newValues = null,
    transaction = undefined
}) {
    return recordAuditLog({
        userId: req.user?.id ?? req.user?.user_id ?? null,
        action,
        module: AUDIT_MODULE,
        entityType: 'Order',
        entityId: orderId == null ? null : String(orderId),
        description,
        oldValues,
        newValues,
        ipAddress: req.ip ?? null,
        userAgent: req.get?.('user-agent') ?? null,
        requestId: req.id ?? req.requestId ?? null,
        transaction
    });
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

function hashCheckoutRequest({
    mode,
    cartId,
    itemId,
    variantId,
    quantity,
    addressId,
    paymentMethod,
    checkoutTokenHash = null,
    promoCode = null,
    billingSameAsShipping = true,
    billingAddress = null
}) {
    const payload = {
        mode,
        cartId: positiveId(cartId) ? Number(cartId) : null,
        itemId: positiveId(itemId) ? Number(itemId) : null,
        variantId: positiveId(variantId) ? Number(variantId) : null,
        quantity: positiveId(quantity) ? Number(quantity) : null,
        addressId: positiveId(addressId) ? Number(addressId) : null,
        paymentMethod,
        checkoutTokenHash,
        promoCode: typeof promoCode === 'string'
            ? promoCode.trim().toUpperCase()
            : null,
            billingSameAsShipping: billingSameAsShipping !== false,
billingAddress: billingSameAsShipping === false
    ? {
        recipient_name: billingAddress?.recipient_name?.trim() || null,
        phone: billingAddress?.phone?.trim() || null,
        address_line_1: billingAddress?.address_line_1?.trim() || null,
        address_line_2: billingAddress?.address_line_2?.trim() || null,
        city: billingAddress?.city?.trim() || null,
        state: billingAddress?.state?.trim() || null,
        postal_code: billingAddress?.postal_code?.trim() || null,
        country: billingAddress?.country?.trim() || null
    }
    : null,
    };

    return crypto
        .createHash('sha256')
        .update(JSON.stringify(payload))
        .digest('hex');
}

function generateReference(prefix) {
    return `${prefix}-${Date.now()}-${crypto.randomBytes(5).toString('hex')}`;
}

function money(value) {
    return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function calculateBestCampaignDiscount(campaigns, item, unitPrice) {
    let best = null;

    for (const campaign of campaigns) {
        if (!campaignTargetsItem(campaign, item)) {
            continue;
        }

        const pricing = calculateDiscount(campaign, unitPrice);

        if (
            pricing.discount_amount > 0 &&
            (!best || pricing.discount_amount > best.discount_amount)
        ) {
            best = {
                campaign_id: campaign.id,
                campaign_name: campaign.campaign_name,
                allow_promo_code:
                    campaign.allow_promo_code === true ||
                    campaign.allow_promo_code === 1,
                ...pricing
            };
        }
    }

    return best;
}

function positiveId(value) {
    return (
        (typeof value === 'number' ||
            (typeof value === 'string' && /^\d+$/.test(value))) &&
        Number.isSafeInteger(Number(value)) &&
        Number(value) > 0
    );
}

function createCheckoutError(message, statusCode) {
    return Object.assign(new Error(message), { statusCode });
}

async function getValidCheckoutSession({
    token,
    customerId,
    transaction,
    lock = false
}) {
    if (
        typeof token !== 'string' ||
        !/^[a-f0-9]{64}$/i.test(token)
    ) {
        throw createCheckoutError(
            'This checkout link is invalid or has expired. Please start checkout again.',
            400
        );
    }

    const tokenHash = crypto
        .createHash('sha256')
        .update(token)
        .digest('hex');

    const session = await CustomerCheckoutSession.findOne({
        where: {
            customer_id: customerId,
            token_hash: tokenHash,
            expires_at: { [Op.gt]: new Date() },
            consumed_at: null
        },
        transaction,
        ...(lock && transaction
            ? { lock: transaction.LOCK.UPDATE }
            : {})
    });

    if (!session) {
        throw createCheckoutError(
            'This checkout link is invalid, expired, or already used. Please start checkout again.',
            410
        );
    }

    return session;
}


async function createCheckoutSession(req, res) {
    const customerId = req.customer?.id;
    const { item_id, variant_id, quantity } = req.body || {};

    if (!customerId) {
        return res.status(401).json({
            message: 'Customer authentication required.',
        });
    }

    if (
        !positiveId(item_id) ||
        !positiveId(quantity) ||
        Number(quantity) > 1000
    ) {
        return res.status(400).json({
            message: 'A valid item and quantity are required.',
        });
    }

    // If supplied, variant_id must be a valid positive ID.
    const variantWasProvided =
        variant_id !== undefined &&
        variant_id !== null &&
        variant_id !== '';

    if (variantWasProvided && !positiveId(variant_id)) {
        return res.status(400).json({
            message: 'The selected product variant is invalid.',
        });
    }

    try {
        const item = await Item.findOne({
            where: {
                id: Number(item_id),
                is_active: true,
            },
        });

        if (!item) {
            return res.status(404).json({
                message: 'This product is unavailable.',
            });
        }

        let selectedVariantId = null;

        if (variantWasProvided) {
            const variant = await ItemVariant.findOne({
                where: {
                    id: Number(variant_id),
                    item_id: Number(item_id),
                    is_active: true,
                },
            });

            if (!variant) {
                return res.status(400).json({
                    message:
                        'The selected product variant is invalid or unavailable.',
                });
            }

            selectedVariantId = Number(variant.id);
        } else {
            const activeVariants = await ItemVariant.findAll({
                where: {
                    item_id: Number(item_id),
                    is_active: true,
                },
                attributes: ['id', 'is_default'],
                order: [
                    ['is_default', 'DESC'],
                    ['id', 'ASC'],
                ],
            });

            if (activeVariants.length > 1) {
                return res.status(400).json({
                    message: 'Please select a product variant.',
                    requires_variant_selection: true,
                });
            }

            // Preserve existing behaviour for products with one variant.
            // Products with no active variants keep variant_id = null.
            if (activeVariants.length === 1) {
                selectedVariantId = Number(activeVariants[0].id);
            }
        }

        const token = crypto.randomBytes(32).toString('hex');

        const tokenHash = crypto
            .createHash('sha256')
            .update(token)
            .digest('hex');

        const expiresAt = new Date(
            Date.now() + 30 * 60 * 1000
        );

        await CustomerCheckoutSession.create({
            customer_id: customerId,
            token_hash: tokenHash,
            item_id: Number(item_id),
            variant_id: selectedVariantId,
            quantity: Number(quantity),
            expires_at: expiresAt,
            consumed_at: null,
        });

        return res.status(201).json({
            message: 'Checkout session created.',
            checkout_url: `/checkout/${token}`,
            expires_at: expiresAt.toISOString(),
        });
    } catch (error) {
        console.error(
            'Failed to create checkout session:',
            error
        );

        return res.status(500).json({
            message: 'Unable to start checkout. Please try again.',
        });
    }
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

    if (variantPrice) {
        return variantPrice;
    }

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


async function getPaymentMethodPrice(
    itemId,
    variantId,
    paymentMethod,
    transaction
) {
    const { ItemPaymentPrice } = require('../models');

    const commonWhere = {
        item_id: itemId,
        payment_method: paymentMethod,
        currency: CURRENCY,
        is_active: true
    };

    // Prefer a price configured for this exact variant.
    if (variantId != null) {
        const variantPrice = await ItemPaymentPrice.findOne({
            where: {
                ...commonWhere,
                variant_id: variantId
            },
            order: [['id', 'DESC']],
            transaction
        });

        if (variantPrice) {
            return variantPrice;
        }
    }

    // If no variant price exists, try the item-level price.
    const itemPrice = await ItemPaymentPrice.findOne({
        where: {
            ...commonWhere,
            variant_id: null
        },
        order: [['id', 'DESC']],
        transaction
    });

    if (itemPrice) {
        return itemPrice;
    }

    // Backwards compatibility for existing COD products only.
    if (paymentMethod === 'cash') {
        return getSellingPrice(itemId, variantId, transaction);
    }

    throw createCheckoutError(
        `No ${paymentMethod} price is configured for item ${itemId}` +
        (variantId != null ? `, variant ${variantId}` : '') +
        '. Please contact the store.',
        400
    );
}


async function getExistingCheckout(customerId, idempotencyKey, requestHash) {
    const existing = await CheckoutIdempotency.findOne({
        where: {
            customer_id: customerId,
            idempotency_key: idempotencyKey
        }
    });

    if (!existing) {
        return {
            status: 409,
            body: {
                message: 'Checkout could not be confirmed. Retry using the same Idempotency-Key.'
            }
        };
    }

    if (existing.request_hash !== requestHash) {
        return {
            status: 409,
            body: {
                message: 'This Idempotency-Key was already used with different checkout details.'
            }
        };
    }

    if (!existing.order_id) {
        return {
            status: 409,
            body: {
                message: 'The original checkout has not been confirmed as complete. Retry using the same key.'
            }
        };
    }

    const existingOrder = await Order.findOne({
        where: {
            id: existing.order_id,
            customer_id: customerId
        }
    });

    const existingPayment = await Payment.findOne({
        where: {
            order_id: existing.order_id
        },
        order: [['id', 'ASC']]
    });

    if (!existingOrder || !existingPayment) {
        return {
            status: 409,
            body: {
                message: 'The existing checkout requires reconciliation.'
            }
        };
    }

    return {
        status: 200,
        body: {
            message: 'Checkout already completed.',
            order: {
                id: existingOrder.id,
                order_number: existingOrder.order_number,
                status: existingOrder.status,
                payment_status: existingOrder.payment_status,
subtotal: Number(existingOrder.subtotal),
discount_amount: Number(existingOrder.discount_amount || 0),
shipping_amount: Number(existingOrder.shipping_amount),
total_amount: Number(existingOrder.total_amount),
                currency: CURRENCY
            },
            payment: {
                method: existingPayment.payment_method,
                status: existingPayment.payment_status,
                reference: existingPayment.payment_reference
            }
        }
    };
}


async function quote(req, res) {
    const customerId = req.customer?.id;
const {
    cart_id,
    checkout_token,
    address_id,
    promo_code,
    payment_method: requestedPaymentMethod
} = req.body || {};

const payment_method =
    requestedPaymentMethod === 'cod'
        ? 'cash'
        : requestedPaymentMethod || 'cash';

if (!['cash', 'card', 'koko', 'mintpay'].includes(payment_method)) {
    return res.status(400).json({
        message: 'Invalid payment method.'
    });
}

    if (!customerId) {
        return res.status(401).json({
            message: 'Customer authentication required.'
        });
    }

    const directPurchase = cart_id == null;

if (!positiveId(address_id)) {
    return res.status(400).json({
        message: 'A valid saved delivery address ID is required.'
    });
}

if (directPurchase) {
    if (
        typeof checkout_token !== 'string' ||
        !/^[a-f0-9]{64}$/i.test(checkout_token)
    ) {
        return res.status(400).json({
            message: 'A valid checkout token is required.'
        });
    }
} else if (!positiveId(cart_id)) {
    return res.status(400).json({
        message: 'A valid cart ID is required.'
    });
}

if (
    promo_code != null &&
    typeof promo_code !== 'string'
) {
    return res.status(400).json({
        message: 'Only one promo code can be applied per checkout.'
    });
}

if (
    typeof promo_code === 'string' &&
    promo_code.trim().length > 100
) {
    return res.status(400).json({
        message: 'Promo code cannot exceed 100 characters.'
    });
}

    let transaction;

    try {
        transaction = await sequelize.transaction();

        let cart = null;
        let cartItems = [];

if (directPurchase) {
    const checkoutSession = await getValidCheckoutSession({
        token: checkout_token,
        customerId,
        transaction
    });

    cartItems = [{
        item_id: checkoutSession.item_id,
        variant_id: checkoutSession.variant_id,
        quantity: checkoutSession.quantity
    }];
} else {
            cart = await Cart.findOne({
                where: {
                    id: Number(cart_id),
                    customer_id: customerId,
                    status: 'active'
                },
                transaction
            });

            if (!cart) {
                throw createCheckoutError(
                    'Your active cart could not be found.',
                    400
                );
            }

            cartItems = await CartItem.findAll({
                where: { cart_id: cart.id },
                order: [['item_id', 'ASC']],
                transaction
            });

            if (!cartItems.length) {
                throw createCheckoutError('Your cart is empty.', 400);
            }
        }

        const address = await CustomerAddress.findOne({
            where: {
                id: Number(address_id),
                customer_id: customerId,
                address_type: 'shipping'
            },
            transaction
        });

        if (!address) {
            throw createCheckoutError(
                'The selected shipping address is invalid.',
                400
            );
        }

        const area = await DeliveryArea.findOne({
            where: {
                id: address.area_id,
                district_id: address.district_id,
                status: 1
            },
            transaction
        });

        const district = await DeliveryDistrict.findOne({
            where: {
                id: address.district_id,
                status: 1
            },
            transaction
        });

        if (!area || !district) {
            throw createCheckoutError(
                'Delivery is not available for this address.',
                400
            );
        }

        const activeCampaigns = await getActiveCampaigns(
    new Date(),
    transaction
);

let totalDiscountAmount = 0;

let subtotal = 0;
let totalWeightKg = 0;
const items = [];
const promotionItems = [];

        for (const cartItem of cartItems) {
            const item = await Item.findByPk(cartItem.item_id, {
                transaction
            });

            if (!item || !item.is_active) {
                throw createCheckoutError(
                    'A product is no longer available.',
                    409
                );
            }

            const itemQuantity = Number(cartItem.quantity);

            if (
                !Number.isSafeInteger(itemQuantity) ||
                itemQuantity <= 0
            ) {
                throw createCheckoutError(
                    'A product quantity is invalid.',
                    400
                );
            }

            const variantId = Number(cartItem.variant_id);

            if (!Number.isSafeInteger(variantId) || variantId <= 0) {
                throw createCheckoutError(
                    `Select a valid variant for ${item.item_name}.`,
                    409
                );
            }

            const variant = await ItemVariant.findOne({
                where: {
                    id: variantId,
                    item_id: item.id,
                    is_active: true
                },
                transaction
            });

            if (!variant) {
                throw createCheckoutError(
                    `The selected variant for ${item.item_name} is unavailable.`,
                    409
                );
            }
const priceRecord = await getPaymentMethodPrice(
    item.id,
    variant.id,
    payment_method,
    transaction
);

if (
    !priceRecord ||
    !Number.isFinite(Number(priceRecord.price)) ||
    Number(priceRecord.price) < 0
) {
    throw createCheckoutError(
        `No valid price is available for ${item.item_name}.`,
        409
    );
}

const unitPrice = money(priceRecord.price);

            if (
                item.shipping_weight == null ||
                !Number.isFinite(Number(item.shipping_weight)) ||
                Number(item.shipping_weight) <= 0
            ) {
                throw createCheckoutError(
                    `A valid shipping weight is not configured for ${item.item_name}.`,
                    409
                );
            }

            const weightKg = item.shipping_weight_unit === 'g'
                ? Number(item.shipping_weight) / 1000
                : Number(item.shipping_weight);


const campaignDiscount = calculateBestCampaignDiscount(
    activeCampaigns,
    item,
    unitPrice
);

const unitDiscount = campaignDiscount
    ? campaignDiscount.discount_amount
    : 0;

const lineDiscount = money(unitDiscount * itemQuantity);
const lineTotal = money((unitPrice - unitDiscount) * itemQuantity);

promotionItems.push({
    item,
    quantity: itemQuantity,
    unitPrice,
    unitDiscount,
    lineTotal,
    discountCampaign: campaignDiscount
        ? {
            allow_promo_code:
                campaignDiscount.allow_promo_code === true ||
                campaignDiscount.allow_promo_code === 1
        }
        : null
});

subtotal = money(subtotal + money(unitPrice * itemQuantity));
totalDiscountAmount = money(totalDiscountAmount + lineDiscount);
totalWeightKg += weightKg * itemQuantity;

items.push({
    item_id: item.id,
    variant_id: variant.id,
    item_name: item.item_name,
    quantity: itemQuantity,
    unit_price: unitPrice,
    original_line_total: money(unitPrice * itemQuantity),
    discount_amount: lineDiscount,
    discount_percentage: campaignDiscount
        ? campaignDiscount.discount_percentage
        : 0,
    line_total: lineTotal,
    discount_campaign: campaignDiscount
        ? {
            id: campaignDiscount.campaign_id,
            campaign_name: campaignDiscount.campaign_name
        }
        : null
});
        }


      // Validate available online stock before returning a checkout quote.
      const onlineLocations = await InventoryLocation.findAll({
        where: {
          location_type: 'online',
          is_active: true
        },
        attributes: ['id'],
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
          variant_id: items.map(entry => entry.variant_id),
          location_id: locationIds,
          is_active: true
        },
        attributes: [
          'variant_id',
          'quantity_on_hand',
          'quantity_reserved'
        ],
        transaction
      });

      const availableByVariant = new Map();

      for (const stock of stockRows) {
        const key = String(stock.variant_id);

        const available = Math.max(
          0,
          Number(stock.quantity_on_hand) -
            Number(stock.quantity_reserved)
        );

        availableByVariant.set(
          key,
          (availableByVariant.get(key) || 0) + available
        );
      }

      for (const entry of items) {
        const available =
          availableByVariant.get(String(entry.variant_id)) || 0;

        if (entry.quantity > available) {
          throw createCheckoutError(
            `Only ${available} unit(s) of ${entry.item_name} are available.`,
            409
          );
        }
      }


        const deliveryPricing = await calculateDeliveryCharge({
            paymentMethod: payment_method,
            district,
            area,
            totalWeightKg,
            transaction
        });

        const shippingAmount = money(deliveryPricing.deliveryCharge);

let promotion = null;
let promoDiscount = null;
let promoDiscountAmount = 0;

if (typeof promo_code === 'string' && promo_code.trim()) {
    promotion = await loadValidPromotion({
        code: promo_code,
        customerId,
        transaction
    });

    promoDiscount = calculatePromotionDiscount(
        promotion,
        promotionItems
    );

    promoDiscountAmount = promoDiscount.discount_amount;
}

const combinedDiscountAmount = money(
    totalDiscountAmount + promoDiscountAmount
);

const totalAmount = money(
    subtotal - combinedDiscountAmount + shippingAmount
);

        await transaction.commit();

        return res.status(200).json({
            message: 'Checkout quote calculated.',
            quote: {
                currency: CURRENCY,
                address_id: Number(address_id),
                area_id: area.id,
                subtotal,
                shipping_amount: shippingAmount,
                total_amount: totalAmount,
                total_weight_kg: money(totalWeightKg),
discount_amount: combinedDiscountAmount,
promo_code: promotion ? promotion.promotion_code : null,
promo_discount_amount: promoDiscountAmount,
                billable_weight_kg: deliveryPricing.billableKg,
                items
            }
        });
    } catch (error) {
        if (transaction && !transaction.finished) {
            await transaction.rollback();
        }

        if (error.statusCode) {
            return res.status(error.statusCode).json({
                message: error.message
            });
        }

        console.error('Checkout quote failed:', error.message);

        return res.status(500).json({
            message: 'Unable to calculate the checkout quote.'
        });
    }
}


async function checkout(req, res) {
    const customerId = req.customer?.id;
const {
    cart_id,
    checkout_token,
    address_id,
    promo_code,
    billing_same_as_shipping = true,
    billing_address = null
} = req.body || {};
    const requestedPaymentMethod = req.body?.payment_method;
    const idempotencyKey = getIdempotencyKey(req);

    // Backward-compatible mapping: COD is stored as "cash"
    // until the database enum migration is implemented.
    const payment_method =
        requestedPaymentMethod === 'cod'
            ? 'cash'
            : requestedPaymentMethod;

    if (!customerId) {
        return res.status(401).json({
            message: 'Customer authentication required.'
        });
    }

    if (!idempotencyKey) {
        return res.status(400).json({
            message: 'A valid Idempotency-Key header is required.'
        });
    }
const directPurchase = cart_id == null;

if (directPurchase) {
    if (
        typeof checkout_token !== 'string' ||
        !/^[a-f0-9]{64}$/i.test(checkout_token)
    ) {
        return res.status(400).json({
            message: 'A valid checkout token is required.'
        });
    }
} else if (!positiveId(cart_id)) {
    return res.status(400).json({
        message: 'A valid cart ID is required.'
    });
}

    if (!positiveId(address_id)) {
        return res.status(400).json({
            message: 'A valid saved delivery address ID is required.'
        });
    }

if (!['cash', 'card', 'koko', 'mintpay'].includes(payment_method)) {
    return res.status(400).json({
        message: 'Invalid payment method.'
    });
}

    if (
    promo_code != null &&
    typeof promo_code !== 'string'
) {
    return res.status(400).json({
        message: 'Only one promo code can be applied per checkout.'
    });
}

if (
    typeof promo_code === 'string' &&
    promo_code.trim().length > 100
) {
    return res.status(400).json({
        message: 'Promo code cannot exceed 100 characters.'
    });
}


const checkoutTokenHash = directPurchase
    ? crypto.createHash('sha256')
        .update(checkout_token)
        .digest('hex')
    : null;

const useShippingAsBilling = billing_same_as_shipping !== false;

if (!useShippingAsBilling) {
    const requiredBillingFields = [
        'recipient_name',
        'phone',
        'address_line_1',
        'city',
        'country'
    ];

    if (
        !billing_address ||
        typeof billing_address !== 'object' ||
        requiredBillingFields.some(field =>
            typeof billing_address[field] !== 'string' ||
            !billing_address[field].trim()
        )
    ) {
        return res.status(400).json({
            message: 'Please provide all required billing address details.'
        });
    }

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
            billing_address[field] != null &&
            String(billing_address[field]).trim().length > maxLength
        ) {
            return res.status(400).json({
                message: `Billing ${field.replace(/_/g, ' ')} is too long.`
            });
        }
    }
}

const requestHash = hashCheckoutRequest({
    mode: directPurchase ? 'direct' : 'cart',
    cartId: cart_id,
    itemId: null,
    variantId: null,
    quantity: null,
    addressId: address_id,
    paymentMethod: payment_method,
    promoCode: promo_code,
    checkoutTokenHash,
    billingSameAsShipping: useShippingAsBilling,
    billingAddress: useShippingAsBilling ? null : billing_address
});

    let transaction;
    let checkoutSession = null;

    try {
        transaction = await sequelize.transaction();

        /*
         * Claim the idempotency key inside the same transaction as the order.
         * The unique database constraint prevents two committed orders for
         * the same customer and key.
         */
        const idempotencyRecord = await CheckoutIdempotency.create({
            customer_id: customerId,
            idempotency_key: idempotencyKey,
            request_hash: requestHash,
            order_id: null
        }, { transaction });

let cart = null;
let cartItems = [];

if (directPurchase) {
    checkoutSession = await getValidCheckoutSession({
        token: checkout_token,
        customerId,
        transaction,
        lock: true
    });

    cartItems = [{
        item_id: checkoutSession.item_id,
        variant_id: checkoutSession.variant_id,
        quantity: checkoutSession.quantity
    }];
} else {
    // Normal checkout: lock and load the customer's active cart.
    cart = await Cart.findOne({
        where: {
            id: Number(cart_id),
            customer_id: customerId,
            status: 'active'
        },
        transaction,
        lock: transaction.LOCK.UPDATE
    });

    if (!cart) {
        throw createCheckoutError('Your cart is empty.', 400);
    }

    cartItems = await CartItem.findAll({
        where: { cart_id: cart.id },
        order: [['item_id', 'ASC']],
        transaction,
        lock: transaction.LOCK.UPDATE
    });

    if (!cartItems.length) {
        throw createCheckoutError('Your cart is empty.', 400);
    }
}
        // The address must belong to the authenticated customer.
        const address = await CustomerAddress.findOne({
            where: {
                id: address_id,
                customer_id: customerId,
                address_type: 'shipping'
            },
            transaction
        });

        if (!address) {
            throw createCheckoutError(
                'The selected delivery address is invalid.',
                400
            );
        }

        // Confirm that the customer's delivery area and district are active.
        const area = await DeliveryArea.findOne({
            where: {
                id: address.area_id,
                district_id: address.district_id,
                status: 1
            },
            transaction
        });

        const district = await DeliveryDistrict.findOne({
            where: {
                id: address.district_id,
                status: 1
            },
            transaction
        });

        if (!area || !district) {
            throw createCheckoutError(
                'Delivery is not available for this address.',
                400
            );
        }

const activeCampaigns = await getActiveCampaigns(
    new Date(),
    transaction
);

let totalDiscountAmount = 0;

        // Recalculate item prices and shipping weights on the server.
const preparedItems = [];
const promotionItems = [];

let subtotal = 0;
let totalWeightKg = 0;

        for (const cartItem of cartItems) {
            const item = await Item.findByPk(cartItem.item_id, {
                transaction
            });

            if (!item || !item.is_active) {
                throw createCheckoutError(
                    'A product in your cart is no longer available.',
                    409
                );
            }

            const quantity = Number(cartItem.quantity);

            if (!Number.isSafeInteger(quantity) || quantity <= 0) {
                throw createCheckoutError(
                    'A cart item has an invalid quantity.',
                    400
                );
            }

const variantId = Number(cartItem.variant_id);

if (!Number.isSafeInteger(variantId) || variantId <= 0) {
    throw createCheckoutError(
        `A variant must be selected for ${item.item_name}. Please update your cart.`,
        409
    );
}

const variant = await ItemVariant.findOne({
    where: {
        id: variantId,
        item_id: item.id,
        is_active: true
    },
    transaction
});

if (!variant) {
    throw createCheckoutError(
        `The selected variant for ${item.item_name} is no longer available.`,
        409
    );
}

const priceRecord = await getPaymentMethodPrice(
    item.id,
    variant.id,
    payment_method,
    transaction
);

if (
    !priceRecord ||
    !Number.isFinite(Number(priceRecord.price)) ||
    Number(priceRecord.price) < 0
) {
    throw createCheckoutError(
        `No valid price is available for ${item.item_name}.`,
        409
    );
}

const unitPrice = money(priceRecord.price);

            if (
                item.shipping_weight == null ||
                !Number.isFinite(Number(item.shipping_weight)) ||
                Number(item.shipping_weight) <= 0
            ) {
                throw createCheckoutError(
                    `A valid shipping weight must be configured for ${item.item_name}.`,
                    409
                );
            }

            const weightKg = item.shipping_weight_unit === 'g'
                ? Number(item.shipping_weight) / 1000
                : Number(item.shipping_weight);



const campaignDiscount = calculateBestCampaignDiscount(
    activeCampaigns,
    item,
    unitPrice
);

const unitDiscount = campaignDiscount
    ? campaignDiscount.discount_amount
    : 0;

const lineDiscount = money(unitDiscount * quantity);
const lineTotal = money((unitPrice - unitDiscount) * quantity);

promotionItems.push({
    item,
quantity,
    unitPrice,
    unitDiscount,
    lineTotal,
    discountCampaign: campaignDiscount
        ? {
            allow_promo_code:
                campaignDiscount.allow_promo_code === true ||
                campaignDiscount.allow_promo_code === 1
        }
        : null
});

subtotal = money(subtotal + money(unitPrice * quantity));
totalDiscountAmount = money(totalDiscountAmount + lineDiscount);
totalWeightKg += weightKg * quantity;

preparedItems.push({
    item,
    variant,
    variantId: variant.id,
    quantity,
    unitPrice,
    unitDiscount,
    lineDiscount,
    discountPercentage: campaignDiscount
        ? campaignDiscount.discount_percentage
        : 0,
discountCampaign: campaignDiscount
    ? {
        id: campaignDiscount.campaign_id,
        campaign_name: campaignDiscount.campaign_name,
        allow_promo_code: campaignDiscount.allow_promo_code === true ||
            campaignDiscount.allow_promo_code === 1
    }
    : null,
    lineTotal
});

        }

        /*
         * Delivery charge:
         * first_kg_charge + additional_kg_charge for every extra billable kg.
         */
        const deliveryPricing = await calculateDeliveryCharge({
            paymentMethod: payment_method,
            district,
            area,
            totalWeightKg,
            transaction
        });

        const shippingAmount = money(deliveryPricing.deliveryCharge);

        // Discounts and taxes remain zero until approved rules are implemented.

let promotion = null;
let promoDiscount = null;
let promoDiscountAmount = 0;

if (typeof promo_code === 'string' && promo_code.trim()) {
    promotion = await loadValidPromotion({
        code: promo_code,
        customerId,
        transaction,
        lock: true
    });

    promoDiscount = calculatePromotionDiscount(
        promotion,
        promotionItems
    );

    promoDiscountAmount = promoDiscount.discount_amount;
}

const discountAmount = money(
    totalDiscountAmount + promoDiscountAmount
);

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
        // Verify stock while holding the inventory row locks.
        for (const entry of preparedItems) {
const stocks = stocksByVariant.get(String(entry.variantId)) || [];

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

        const orderNumber = generateReference('SWO');
        const invoiceNumber = generateReference('SWI');
        const paymentReference = generateReference('SWP');

        // Create the order.
        const order = await Order.create({
            order_number: orderNumber,
            invoice_number: invoiceNumber,
            customer_id: customerId,
            order_date: new Date(),
            order_type: 'online',
            status: 'pending',
            payment_status: 'unpaid',
            fulfillment_status: 'unfulfilled',
            subtotal,
            discount_amount: discountAmount,
            tax_amount: taxAmount,
            shipping_amount: shippingAmount,
            total_amount: totalAmount,
            notes: null,
            created_by: null
        }, { transaction });

        // Save order line items using the server-calculated prices.
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

        // Snapshot the shipping address so later edits do not change the order.
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
                recipient_name: String(billing_address.recipient_name).trim(),
                phone: String(billing_address.phone).trim(),
                address_line_1: String(billing_address.address_line_1).trim(),
                address_line_2: billing_address.address_line_2
                    ? String(billing_address.address_line_2).trim()
                    : null,
                city: String(billing_address.city).trim(),
                state: billing_address.state
                    ? String(billing_address.state).trim()
                    : null,
                postal_code: billing_address.postal_code
                    ? String(billing_address.postal_code).trim()
                    : null,
                country: String(billing_address.country).trim()
            }, { transaction });
        }

        // Neither COD nor online payment is marked paid at checkout.
        await Payment.create({
            payment_reference: paymentReference,
            order_id: order.id,
            payment_method,
            payment_status: 'unpaid',
            amount: totalAmount,
            transaction_reference: null,
            payment_date: null,
            notes: ['card', 'koko', 'mintpay'].includes(payment_method)
                ? 'Awaiting payment provider integration and verified confirmation.'
                : 'Cash on delivery. Payment is outstanding.',
            processed_by: null
        }, { transaction });

        await Invoice.create({
            invoice_number: invoiceNumber,
            order_id: order.id,
            customer_id: customerId,
            invoice_date: new Date(),
            status: 'issued',
            subtotal,
            discount_amount: discountAmount,
            tax_amount: taxAmount,
            shipping_amount: shippingAmount,
            total_amount: totalAmount,
            paid_amount: 0,
            balance_amount: totalAmount,
            created_by: null
        }, { transaction });

        // Deduct online stock and record stock movements transactionally.
        for (const entry of preparedItems) {
            let remaining = entry.quantity;
const stocks = stocksByVariant.get(String(entry.variantId)) || [];

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
// Consume the direct-purchase session inside the same transaction.
// If anything fails later, the transaction rollback restores the session.
if (directPurchase && checkoutSession) {
    await checkoutSession.update({
        consumed_at: new Date()
    }, { transaction });
}

// Link the idempotency record to the new order.
await idempotencyRecord.update({
    order_id: order.id
}, { transaction });
        // Convert the cart only after all checkout operations succeed.
if (!directPurchase) {
    await cart.update({
        status: 'converted'
    }, { transaction });
}

// Record the audit event in the same transaction as the order.
        await auditCheckout(req, {
            action: 'CUSTOMER_CHECKOUT_COMPLETED',
            customerId,
            orderId: order.id,
            description: `Customer ${customerId} completed checkout`,
            newValues: {
                order_id: order.id,
                order_number: orderNumber,
checkout_mode: directPurchase ? 'direct' : 'cart',
cart_id: cart?.id ?? null,
                payment_method,
                payment_status: 'unpaid',
               subtotal,
discount_amount: discountAmount,
shipping_amount: shippingAmount,
total_amount: totalAmount,
                currency: CURRENCY,
                item_count: preparedItems.length
            },
            transaction
        });

if (promotion && promoDiscount) {
await OrderPromotion.create({
    order_id: order.id,
    promotion_id: promotion.id,
    customer_id: customerId,
    promotion_code: promotion.promotion_code,
    discount_amount: promoDiscount.discount_amount
}, { transaction });

    await promotion.update({
        used_count: Number(promotion.used_count || 0) + 1
    }, { transaction });
}

        await transaction.commit();

        try {
            const customer = db.Customer?.findByPk
                ? await db.Customer.findByPk(customerId)
                : null;

            const emailDetails = {
                orderNumber,
                customerName: customer
                    ? `${customer.first_name} ${customer.last_name}`.trim()
                    : address.recipient_name,
                customerEmail: customer?.email,
                phone: address.phone,
                address,
                items: preparedItems.map(entry => ({
                    name: entry.item.item_name || entry.item.name || 'Product',
                    quantity: entry.quantity,
                    unitPrice: entry.unitPrice,
                    lineTotal: entry.lineTotal
                })),
                subtotal,
                discountAmount,
                shippingAmount,
                totalAmount,
                paymentMethod: payment_method,
                paymentStatus: 'Unpaid'
            };

            const results = await Promise.allSettled([
                emailDetails.customerEmail
                    ? sendOrderConfirmationEmail(emailDetails)
                    : Promise.resolve(),
                sendAdminNewOrderEmail(emailDetails)
            ]);

            results.forEach((result, index) => {
                if (result.status === 'rejected') {
                    console.error(
                        index === 0
                            ? 'Customer order email failed:'
                            : 'Admin order notification failed:',
                        result.reason
                    );
                }
            });
        } catch (emailError) {
            console.error('Order email processing failed:', emailError);
        }

        return res.status(201).json({
            message: 'Order created successfully.',
            order: {
                id: order.id,
                order_number: orderNumber,
                status: order.status,
                payment_status: order.payment_status,
                discount_amount: discountAmount,
                subtotal,
                shipping_amount: shippingAmount,
                total_amount: totalAmount,
                currency: CURRENCY
            },
            payment: {
                method: payment_method,
                status: 'unpaid',
                reference: paymentReference
            }
        });

    
    } catch (error) {
        if (transaction && !transaction.finished) {
            try {
                await transaction.rollback();
            } catch (rollbackError) {
                console.error(
                    'Checkout transaction rollback failed:',
                    rollbackError.message
                );
            }
        }

        const duplicateKeyError =
            error.original?.code === 'ER_DUP_ENTRY' ||
            error.parent?.code === 'ER_DUP_ENTRY';

        if (duplicateKeyError && customerId && idempotencyKey) {
            try {
                const replay = await getExistingCheckout(
                    customerId,
                    idempotencyKey,
                    requestHash
                );

                return res.status(replay.status).json(replay.body);
            } catch (replayError) {
                console.error(
                    'Checkout idempotency replay failed:',
                    replayError.message
                );

                return res.status(500).json({
                    message: 'Unable to verify the existing checkout.'
                });
            }
        }

        // Record a failed checkout after its main transaction has rolled back.
        try {
            await auditCheckout(req, {
                action: 'CUSTOMER_CHECKOUT_FAILED',
                customerId,
                description: `Checkout failed for customer ${customerId}`,
                newValues: {
                    customer_id: customerId,
                    cart_id: positiveId(cart_id) ? Number(cart_id) : null,
                    address_id: positiveId(address_id) ? Number(address_id) : null,
payment_method: ['cash', 'card', 'koko', 'mintpay'].includes(payment_method)
    ? payment_method
    : null,
                    failure_reason: error.statusCode
                        ? 'Checkout validation or business rule rejected the request'
                        : 'Unexpected checkout processing error',
                    status_code: error.statusCode ?? 500,
                    checkout_mode: directPurchase ? 'direct' : 'cart',
item_id: directPurchase && checkoutSession
    ? Number(checkoutSession.item_id)
    : null,
variant_id: directPurchase && checkoutSession
    ? Number(checkoutSession.variant_id)
    : null,
quantity: directPurchase && checkoutSession
    ? Number(checkoutSession.quantity)
    : null
                }
            });
        } catch (auditError) {
            console.error(
                'Failed to record checkout failure audit:',
                auditError.message
            );
        }

        if (error.statusCode) {
            return res.status(error.statusCode).json({
                message: error.message
            });
        }

console.error('Customer checkout failed:', error.stack || error);

        return res.status(500).json({
            message: 'Checkout could not be completed. No order changes were saved.'
        });
    }
}
module.exports = {
    checkout,
    quote,
    createCheckoutSession,
};
