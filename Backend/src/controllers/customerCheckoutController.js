'use strict';

const crypto = require('crypto');
const { Op } = require('sequelize');
const db = require('../models');
const { recordAuditLog } = require('../services/auditLogService');
const {
    sequelize,
    CheckoutIdempotency,
    Cart,
    CartItem,
    Item,
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
    Invoice
} = db;

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

function hashCheckoutRequest(cartId, addressId, paymentMethod) {
    return crypto
        .createHash('sha256')
        .update(JSON.stringify({
            cart_id: Number(cartId),
            address_id: Number(addressId),
            payment_method: paymentMethod
        }))
        .digest('hex');
}

function generateReference(prefix) {
    return `${prefix}-${Date.now()}-${crypto.randomBytes(5).toString('hex')}`;
}

function money(value) {
    return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
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

async function getSellingPrice(itemId, transaction) {
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

async function checkout(req, res) {
    const customerId = req.customer?.id;
    const { cart_id, address_id, payment_method } = req.body || {};
    const idempotencyKey = getIdempotencyKey(req);

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

    if (!positiveId(cart_id)) {
        return res.status(400).json({
            message: 'A valid cart ID is required.'
        });
    }

    if (!positiveId(address_id)) {
        return res.status(400).json({
            message: 'A valid saved delivery address ID is required.'
        });
    }

    if (!['cash', 'online'].includes(payment_method)) {
        return res.status(400).json({
            message: 'Payment method must be cash or online.'
        });
    }

    const requestHash = hashCheckoutRequest(
        cart_id,
        address_id,
        payment_method
    );

    let transaction;

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

        // Lock the customer's active cart.
        const cart = await Cart.findOne({
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

        const cartItems = await CartItem.findAll({
            where: { cart_id: cart.id },
            order: [['item_id', 'ASC']],
            transaction,
            lock: transaction.LOCK.UPDATE
        });

        if (!cartItems.length) {
            throw createCheckoutError('Your cart is empty.', 400);
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

        // Recalculate item prices and shipping weights on the server.
        const preparedItems = [];
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

            const priceRecord = await getSellingPrice(item.id, transaction);

            if (
                !priceRecord ||
                !Number.isFinite(Number(priceRecord.price)) ||
                Number(priceRecord.price) < 0
            ) {
                throw createCheckoutError(
                    `No valid selling price is available for ${item.item_name}.`,
                    409
                );
            }

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

            const unitPrice = money(priceRecord.price);
            const lineTotal = money(unitPrice * quantity);

            subtotal = money(subtotal + lineTotal);
            totalWeightKg += weightKg * quantity;

            preparedItems.push({
                item,
                quantity,
                unitPrice,
                lineTotal
            });
        }

        /*
         * Delivery charge:
         * first_kg_charge + additional_kg_charge for every extra billable kg.
         */
        const billableKg = Math.max(1, Math.ceil(totalWeightKg));

        const shippingAmount = money(
            Number(area.first_kg_charge) +
            (billableKg - 1) * Number(area.additional_kg_charge)
        );

        // Discounts and taxes remain zero until approved rules are implemented.
        const discountAmount = 0;
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

        // Lock relevant stock rows in a consistent order.
        const stockRows = await InventoryStock.findAll({
            where: {
                item_id: preparedItems.map(entry => entry.item.id),
                location_id: locationIds,
                is_active: true
            },
            order: [
                ['item_id', 'ASC'],
                ['location_id', 'ASC']
            ],
            transaction,
            lock: transaction.LOCK.UPDATE
        });

        const stocksByItem = new Map();

        for (const stock of stockRows) {
            const key = String(stock.item_id);

            if (!stocksByItem.has(key)) {
                stocksByItem.set(key, []);
            }

            stocksByItem.get(key).push(stock);
        }

        // Verify stock while holding the inventory row locks.
        for (const entry of preparedItems) {
            const stocks = stocksByItem.get(String(entry.item.id)) || [];

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
        const deliveryReference = generateReference('SWD');
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
                quantity: entry.quantity,
                unit_price: entry.unitPrice,
                discount_amount: 0,
                discount_percentage_mode: false,
                discount_percentage: 0,
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

        await Delivery.create({
            delivery_reference: deliveryReference,
            order_id: order.id,
            delivery_method: 'standard',
            delivery_status: 'pending',
            recipient_name: address.recipient_name,
            recipient_phone: address.phone,
            address_line_1: address.address_line_1,
            address_line_2: address.address_line_2,
            city: address.city,
            state: address.state,
            postal_code: address.postal_code,
            country: address.country,
            delivery_charge: shippingAmount
        }, { transaction });

        // Neither COD nor online payment is marked paid at checkout.
        await Payment.create({
            payment_reference: paymentReference,
            order_id: order.id,
            payment_method,
            payment_status: 'unpaid',
            amount: totalAmount,
            transaction_reference: null,
            payment_date: null,
            notes: payment_method === 'online'
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
            const stocks = stocksByItem.get(String(entry.item.id)) || [];

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

        // Link the idempotency record to the new order.
        await idempotencyRecord.update({
            order_id: order.id
        }, { transaction });

        // Convert the cart only after all checkout operations succeed.

        await cart.update({
            status: 'converted'
        }, { transaction });

// Record the audit event in the same transaction as the order.
        await auditCheckout(req, {
            action: 'CUSTOMER_CHECKOUT_COMPLETED',
            customerId,
            orderId: order.id,
            description: `Customer ${customerId} completed checkout`,
            newValues: {
                order_id: order.id,
                order_number: orderNumber,
                cart_id: cart.id,
                payment_method,
                payment_status: 'unpaid',
                subtotal,
                shipping_amount: shippingAmount,
                total_amount: totalAmount,
                currency: CURRENCY,
                item_count: preparedItems.length
            },
            transaction
        });

        await transaction.commit();

        return res.status(201).json({
            message: 'Order created successfully.',
            order: {
                id: order.id,
                order_number: orderNumber,
                status: order.status,
                payment_status: order.payment_status,
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
                    payment_method: ['cash', 'online'].includes(payment_method)
                        ? payment_method
                        : null,
                    failure_reason: error.statusCode
                        ? 'Checkout validation or business rule rejected the request'
                        : 'Unexpected checkout processing error',
                    status_code: error.statusCode ?? 500
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

        console.error('Customer checkout failed:', error.message);

        return res.status(500).json({
            message: 'Checkout could not be completed. No order changes were saved.'
        });
    }
}

module.exports = { checkout };
