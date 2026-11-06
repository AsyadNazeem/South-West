
const { Op } = require('sequelize');
const {
    ItemPrice,
    ItemPaymentPrice,
    Item,
    ItemVariant,
    sequelize
} = require('../models');
const { recordAuditLog } = require('../services/auditLogService');

const VALID_FIELDS = [
    'item_id',
    'variant_id',
    'price_type',
    'price',
    'currency',
    'effective_from',
    'effective_to',
    'is_active'
];

const isValidId = id => /^[1-9]\d*$/.test(String(id));

const isValidDate = value => {
    if (value === null || value === undefined || value === '') {
        return true;
    }

    if (typeof value !== 'string') {
        return false;
    }

    const date = new Date(value);
    return !Number.isNaN(date.getTime());
};

const isValidPrice = value => {
    if (
        value === undefined ||
        value === null ||
        value === '' ||
        typeof value === 'boolean'
    ) {
        return false;
    }

    const stringValue = String(value);

    if (!/^\d{1,13}(?:\.\d{1,2})?$/.test(stringValue)) {
        return false;
    }

    const amount = Number(value);

    return Number.isFinite(amount) && amount >= 0 && amount < 1e13;
};

const isUniqueConstraintError = error =>
    error?.name === 'SequelizeUniqueConstraintError' ||
    error?.original?.code === 'ER_DUP_ENTRY' ||
    error?.parent?.code === 'ER_DUP_ENTRY';

const requestMetadata = req => ({
    ipAddress: req.ip || null,
    userAgent: req.get('user-agent') || null,
    requestId: req.id || null
});

const auditUserId = req =>
    req.user?.id ?? req.user?.userId ?? null;

const priceValues = price => ({
    item_id: price.item_id,
    variant_id: price.variant_id,
    price_type: price.price_type,
    price: String(price.price),
    currency: price.currency,
    effective_from: price.effective_from,
    effective_to: price.effective_to,
    is_active: price.is_active
});

const validateBody = (body, creating = false) => {
    const errors = {};

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return { body: 'A valid JSON object is required' };
    }

    const unknownFields = Object.keys(body).filter(
        field => !VALID_FIELDS.includes(field)
    );

    if (unknownFields.length) {
        errors.fields = `Unsupported fields: ${unknownFields.join(', ')}`;
    }

    if (creating || body.item_id !== undefined) {
        if (!isValidId(body.item_id)) {
            errors.item_id = 'A valid item ID is required';
        }
    }

if (creating && (body.variant_id === undefined || body.variant_id === null || body.variant_id === '')) {
    errors.variant_id = 'A variant is required to create an item price';
}

if (
    body.variant_id !== undefined &&
    body.variant_id !== null &&
    body.variant_id !== ''
) {
    if (!isValidId(body.variant_id)) {
        errors.variant_id = 'A valid variant ID is required';
    }
}

    if (creating || body.price_type !== undefined) {
        if (
            typeof body.price_type !== 'string' ||
            !body.price_type.trim() ||
            body.price_type.trim().length > 30
        ) {
            errors.price_type = 'Price type is required and must not exceed 30 characters';
        }
    }

    if (creating || body.price !== undefined) {
        if (!isValidPrice(body.price)) {
            errors.price = 'Price must be a non-negative amount with at most 2 decimal places';
        }
    }

    if (body.currency !== undefined) {
        if (
            typeof body.currency !== 'string' ||
            !/^[A-Za-z]{3}$/.test(body.currency.trim())
        ) {
            errors.currency = 'Currency must be a 3-letter currency code';
        }
    }

    for (const field of ['effective_from', 'effective_to']) {
        if (body[field] !== undefined && !isValidDate(body[field])) {
            errors[field] = `${field} must be a valid date or null`;
        }
    }

    if (body.is_active !== undefined && typeof body.is_active !== 'boolean') {
        errors.is_active = 'is_active must be a boolean';
    }

    if (!creating && Object.keys(body).length === 0) {
        errors.body = 'Provide at least one field to update';
    }

    return errors;
};

const getPriceInclude = () => [
    {
        model: Item,
        as: 'item',
        attributes: ['id', 'item_code', 'item_name']
    },
    {
        model: ItemVariant,
        as: 'variant',
        attributes: [
            'id',
            'item_id',
            'variant_sku',
            'variant_name',
            'attributes',
            'is_default',
            'is_active'
        ]
    }
];

// GET ALL ITEM PRICES
const getItemPrices = async (req, res) => {
    try {
        const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
        const pageSize = Math.min(100, Math.max(1, Number.parseInt(req.query.pageSize ?? req.query.limit, 10) || 25));
        const paginationEnabled = req.query.page !== undefined || req.query.pageSize !== undefined || req.query.limit !== undefined;
        const search = String(req.query.search || '').trim();
        const where = {};
        if (search) where[Op.or] = [
            { '$item.item_name$': { [Op.like]: `%${search}%` } },
            { '$item.item_code$': { [Op.like]: `%${search}%` } },
            { price_type: { [Op.like]: `%${search}%` } },
        ];
        if (req.query.type && req.query.type !== 'all') where.price_type = req.query.type;
        if (req.query.status === 'active') where.is_active = true;
        if (req.query.status === 'inactive') where.is_active = false;
        const result = await ItemPrice.findAndCountAll({
            where,
            include: getPriceInclude(),
            order: [['id', 'DESC']], limit: paginationEnabled ? pageSize : undefined, offset: paginationEnabled ? (page - 1) * pageSize : undefined, distinct: true
        });
        const prices = result.rows;

        return res.status(200).json({
            message: 'Item prices retrieved successfully',
            data: prices,
            pagination: { page, pageSize, total: result.count, totalPages: Math.ceil(result.count / pageSize) }
        });
    } catch (error) {
        console.error('Get item prices error:', error);

        return res.status(500).json({
            message: 'Failed to retrieve item prices'
        });
    }
};

// GET ITEM PRICE BY ID
const getItemPriceById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!isValidId(id)) {
            return res.status(400).json({
                message: 'Invalid item price ID'
            });
        }

        const price = await ItemPrice.findByPk(id, {
            include: getPriceInclude()
        });

        if (!price) {
            return res.status(404).json({
                message: 'Item price not found'
            });
        }

        return res.status(200).json({
            message: 'Item price retrieved successfully',
            data: price
        });
    } catch (error) {
        console.error('Get item price error:', error);

        return res.status(500).json({
            message: 'Failed to retrieve item price'
        });
    }
};

// CREATE ITEM PRICE
const createItemPrice = async (req, res) => {
    let transaction;

    try {
        const errors = validateBody(req.body, true);

        if (Object.keys(errors).length) {
            return res.status(400).json({
                message: 'Invalid item price data',
                errors
            });
        }

        const values = {
            item_id: req.body.item_id,
            variant_id: req.body.variant_id ?? null,
            price_type: req.body.price_type.trim(),
            price: req.body.price,
            currency: req.body.currency?.trim().toUpperCase() || 'LKR',
            effective_from: req.body.effective_from || null,
            effective_to: req.body.effective_to || null,
            is_active: true
        };

        if (
            values.effective_from &&
            values.effective_to &&
            new Date(values.effective_to) < new Date(values.effective_from)
        ) {
            return res.status(400).json({
                message: 'Effective-to date cannot be earlier than effective-from date'
            });
        }

        transaction = await sequelize.transaction();

const item = await Item.findByPk(values.item_id, {
    transaction,
    lock: transaction.LOCK.UPDATE
});

if (!item) {
    await transaction.rollback();

    return res.status(404).json({
        message: 'Item not found'
    });
}

if (values.variant_id != null) {
    const variant = await ItemVariant.findOne({
        where: {
            id: values.variant_id,
            item_id: values.item_id
        },
        transaction,
        lock: transaction.LOCK.UPDATE
    });

    if (!variant) {
        await transaction.rollback();

        return res.status(400).json({
            message: 'The selected variant does not belong to this item.'
        });
    }

    if (!variant.is_active) {
        await transaction.rollback();
        return res.status(409).json({
            message: 'Cannot create a price for an inactive variant.'
        });
    }
}

        if (!item) {
            await transaction.rollback();

            return res.status(404).json({
                message: 'Item not found'
            });
        }

        const itemPrice = await ItemPrice.create(values, { transaction });

        await recordAuditLog({
            userId: auditUserId(req),
            action: 'ITEM_PRICE_CREATED',
            module: 'inventory',
            entityType: 'item_price',
            entityId: itemPrice.id,
            description: `Price created for item ${values.item_id}`,
            oldValues: null,
            newValues: priceValues(itemPrice),
            ...requestMetadata(req),
            transaction
        });

        const createdPrice = await ItemPrice.findByPk(itemPrice.id, {
            include: getPriceInclude(),
            transaction
        });

        await transaction.commit();

        return res.status(201).json({
            message: 'Item price created successfully',
            data: createdPrice
        });
    } catch (error) {
        if (transaction && !transaction.finished) {
            await transaction.rollback();
        }

        if (isUniqueConstraintError(error)) {
            return res.status(409).json({
                message: 'A conflicting item price already exists'
            });
        }

        console.error('Create item price error:', error);

        return res.status(500).json({
            message: 'Failed to create item price'
        });
    }
};

// UPDATE ITEM PRICE
const updateItemPrice = async (req, res) => {
    let transaction;

    try {
        const { id } = req.params;

        if (!isValidId(id)) {
            return res.status(400).json({
                message: 'Invalid item price ID'
            });
        }

        const errors = validateBody(req.body);

        if (Object.keys(errors).length) {
            return res.status(400).json({
                message: 'Invalid item price data',
                errors
            });
        }

        transaction = await sequelize.transaction();

        const itemPrice = await ItemPrice.findByPk(id, {
            transaction,
            lock: transaction.LOCK.UPDATE
        });

        if (!itemPrice) {
            await transaction.rollback();

            return res.status(404).json({
                message: 'Item price not found'
            });
        }

        const changes = {};

        for (const field of VALID_FIELDS) {
            if (req.body[field] !== undefined) {
                changes[field] = req.body[field];
            }
        }

        if (changes.item_id !== undefined) {
            const item = await Item.findByPk(changes.item_id, {
                transaction,
                lock: transaction.LOCK.UPDATE
            });

            if (!item) {
                await transaction.rollback();

                return res.status(404).json({
                    message: 'Item not found'
                });
            }
        }


const resultingItemId = changes.item_id ?? itemPrice.item_id;

const resultingVariantId =
    changes.variant_id !== undefined
        ? changes.variant_id
        : itemPrice.variant_id;

if (
    resultingVariantId === undefined ||
    resultingVariantId === null ||
    resultingVariantId === ''
) {
    await transaction.rollback();

    return res.status(400).json({
        message: 'A variant is required for every item price.'
    });
}

const variant = await ItemVariant.findOne({
    where: {
        id: resultingVariantId,
        item_id: resultingItemId
    },
    transaction,
    lock: transaction.LOCK.UPDATE
});

if (!variant) {
    await transaction.rollback();

    return res.status(400).json({
        message: 'The selected variant does not belong to this item.'
    });
}

if (!variant.is_active) {
    await transaction.rollback();

    return res.status(409).json({
        message: 'Cannot assign a price to an inactive variant.'
    });
}


        if (changes.price_type !== undefined) {
            changes.price_type = changes.price_type.trim();
        }

        if (changes.currency !== undefined) {
            changes.currency = changes.currency.trim().toUpperCase();
        }

        for (const field of ['effective_from', 'effective_to']) {
            if (changes[field] === '') {
                changes[field] = null;
            }
        }

        const effectiveFrom = changes.effective_from !== undefined
            ? changes.effective_from
            : itemPrice.effective_from;

        const effectiveTo = changes.effective_to !== undefined
            ? changes.effective_to
            : itemPrice.effective_to;

        if (
            effectiveFrom &&
            effectiveTo &&
            new Date(effectiveTo) < new Date(effectiveFrom)
        ) {
            await transaction.rollback();

            return res.status(400).json({
                message: 'Effective-to date cannot be earlier than effective-from date'
            });
        }

        const oldValues = priceValues(itemPrice);

        await itemPrice.update(changes, { transaction });

        const newValues = priceValues(itemPrice);

        const changed = Object.keys(oldValues).some(
            key => oldValues[key] !== newValues[key]
        );

        if (changed) {
            await recordAuditLog({
                userId: auditUserId(req),
                action: 'ITEM_PRICE_UPDATED',
                module: 'inventory',
                entityType: 'item_price',
                entityId: itemPrice.id,
                description: `Price updated for item ${itemPrice.item_id}`,
                oldValues,
                newValues,
                ...requestMetadata(req),
                transaction
            });
        }

        const updatedPrice = await ItemPrice.findByPk(id, {
            include: getPriceInclude(),
            transaction
        });

        await transaction.commit();

        return res.status(200).json({
            message: 'Item price updated successfully',
            data: updatedPrice
        });
    } catch (error) {
        if (transaction && !transaction.finished) {
            await transaction.rollback();
        }

        if (isUniqueConstraintError(error)) {
            return res.status(409).json({
                message: 'A conflicting item price already exists'
            });
        }

        console.error('Update item price error:', error);

        return res.status(500).json({
            message: 'Failed to update item price'
        });
    }
};


// BULK UPDATE SELECTED ITEM PRICES
const bulkUpdateItemPrices = async (req, res) => {
    let transaction;

    try {
        const { ids, changes } = req.body || {};

        if (
            !Array.isArray(ids) ||
            ids.length === 0 ||
            ids.length > 500 ||
            ids.some(id => !isValidId(id)) ||
            new Set(ids.map(String)).size !== ids.length
        ) {
            return res.status(400).json({
                message: 'Provide a list of 1–500 unique valid price IDs.'
            });
        }

        if (!changes || typeof changes !== 'object' || Array.isArray(changes)) {
            return res.status(400).json({
                message: 'Provide the fields to update in changes.'
            });
        }

        const allowedFields = [
            'price',
            'currency',
            'price_type',
            'effective_from',
            'effective_to',
            'is_active'
        ];

        const fields = Object.keys(changes);

        if (!fields.length || fields.some(field => !allowedFields.includes(field))) {
            return res.status(400).json({
                message: 'Choose at least one supported field to update.',
                allowed_fields: allowedFields
            });
        }

        const errors = validateBody(changes);

        if (Object.keys(errors).length) {
            return res.status(400).json({
                message: 'Invalid bulk price data.',
                errors
            });
        }

        const normalizedChanges = { ...changes };

        if (normalizedChanges.currency !== undefined) {
            normalizedChanges.currency =
                normalizedChanges.currency.trim().toUpperCase();
        }

        if (normalizedChanges.price_type !== undefined) {
            normalizedChanges.price_type =
                normalizedChanges.price_type.trim();
        }

        for (const field of ['effective_from', 'effective_to']) {
            if (normalizedChanges[field] === '') {
                normalizedChanges[field] = null;
            }
        }

        transaction = await sequelize.transaction();

        const records = await ItemPrice.findAll({
            where: { id: ids },
            order: [['id', 'ASC']],
            transaction,
            lock: transaction.LOCK.UPDATE
        });

        if (records.length !== ids.length) {
            await transaction.rollback();

            return res.status(404).json({
                message: 'One or more selected prices no longer exist. Reload the list and try again.'
            });
        }

        for (const itemPrice of records) {
            const effectiveFrom =
                normalizedChanges.effective_from !== undefined
                    ? normalizedChanges.effective_from
                    : itemPrice.effective_from;

            const effectiveTo =
                normalizedChanges.effective_to !== undefined
                    ? normalizedChanges.effective_to
                    : itemPrice.effective_to;

            if (
                effectiveFrom &&
                effectiveTo &&
                new Date(effectiveTo) < new Date(effectiveFrom)
            ) {
                await transaction.rollback();

                return res.status(400).json({
                    message: `Effective-to date cannot be earlier than effective-from date for price ID ${itemPrice.id}.`
                });
            }

            const oldValues = priceValues(itemPrice);
            await itemPrice.update(normalizedChanges, { transaction });
            const newValues = priceValues(itemPrice);

            const changed = Object.keys(oldValues).some(
                key => oldValues[key] !== newValues[key]
            );

            if (changed) {
                await recordAuditLog({
                    userId: auditUserId(req),
                    action: 'ITEM_PRICE_UPDATED',
                    module: 'inventory',
                    entityType: 'item_price',
                    entityId: itemPrice.id,
                    description: `Bulk price update for item ${itemPrice.item_id}`,
                    oldValues,
                    newValues,
                    ...requestMetadata(req),
                    transaction
                });
            }
        }

        await transaction.commit();

        return res.status(200).json({
            message: `Successfully updated ${records.length} selected price records.`,
            data: {
                updated_count: records.length,
                ids: records.map(record => record.id)
            }
        });
    } catch (error) {
        if (transaction && !transaction.finished) {
            await transaction.rollback();
        }

        if (isUniqueConstraintError(error)) {
            return res.status(409).json({
                message: 'A conflicting price exists. No selected prices were saved.'
            });
        }

        console.error('Bulk update item prices error:', error);

        return res.status(500).json({
            message: 'Failed to update selected prices.'
        });
    }
};

// DEACTIVATE ITEM PRICE (SOFT DELETE)
const deleteItemPrice = async (req, res) => {
    let transaction;

    try {
        const { id } = req.params;

        if (!isValidId(id)) {
            return res.status(400).json({
                message: 'Invalid item price ID'
            });
        }

        transaction = await sequelize.transaction();

        const itemPrice = await ItemPrice.findByPk(id, {
            transaction,
            lock: transaction.LOCK.UPDATE
        });

        if (!itemPrice) {
            await transaction.rollback();

            return res.status(404).json({
                message: 'Item price not found'
            });
        }

        if (!itemPrice.is_active) {
            await transaction.rollback();

            return res.status(200).json({
                message: 'Item price is already inactive'
            });
        }

        const oldValues = priceValues(itemPrice);

        await itemPrice.update({ is_active: false }, { transaction });

        const newValues = priceValues(itemPrice);

        await recordAuditLog({
            userId: auditUserId(req),
            action: 'ITEM_PRICE_DEACTIVATED',
            module: 'inventory',
            entityType: 'item_price',
            entityId: itemPrice.id,
            description: `Price deactivated for item ${itemPrice.item_id}`,
            oldValues,
            newValues,
            ...requestMetadata(req),
            transaction
        });

        await transaction.commit();

        return res.status(200).json({
            message: 'Item price deactivated successfully'
        });
    } catch (error) {
        if (transaction && !transaction.finished) {
            await transaction.rollback();
        }

        console.error('Deactivate item price error:', error);

        return res.status(500).json({
            message: 'Failed to deactivate item price'
        });
    }
};


const bulkSaveItemPrices = async (req, res) => {
    let transaction;

    try {
        const {
            item_id,
            price_type,
            price,
            currency = 'LKR',
            effective_from = null,
            effective_to = null,
            payment_prices = []
        } = req.body;

        // Validate the main price fields.
        if (!isValidId(item_id)) {
            return res.status(400).json({
                message: 'A valid item_id is required.'
            });
        }

        if (
            typeof price_type !== 'string' ||
            !price_type.trim() ||
            price_type.trim().length > 30
        ) {
            return res.status(400).json({
                message: 'A valid price_type is required.'
            });
        }

        if (!isValidPrice(price)) {
            return res.status(400).json({
                message: 'Price must be a non-negative amount with at most 2 decimal places.'
            });
        }

        if (
            typeof currency !== 'string' ||
            !/^[A-Za-z]{3}$/.test(currency.trim())
        ) {
            return res.status(400).json({
                message: 'Currency must be a 3-letter currency code.'
            });
        }

        if (
            !isValidDate(effective_from) ||
            !isValidDate(effective_to)
        ) {
            return res.status(400).json({
                message: 'Effective dates must be valid dates or null.'
            });
        }

        if (
            effective_from &&
            effective_to &&
            new Date(effective_to) < new Date(effective_from)
        ) {
            return res.status(400).json({
                message: 'Effective-to date cannot be earlier than effective-from date.'
            });
        }

        if (!Array.isArray(payment_prices)) {
            return res.status(400).json({
                message: 'payment_prices must be an array.'
            });
        }

        const allowedMethods = ['cash', 'card', 'koko', 'mintpay'];
        const seenMethods = new Set();

        for (const entry of payment_prices) {
            const method = String(entry?.payment_method || '').toLowerCase();

            if (!allowedMethods.includes(method)) {
                return res.status(400).json({
                    message: `Invalid payment method: ${method}`
                });
            }

            if (seenMethods.has(method)) {
                return res.status(400).json({
                    message: `Duplicate payment method: ${method}`
                });
            }

            seenMethods.add(method);

            if (
                !isValidPrice(entry.price) ||
                Number(entry.price) <= 0
            ) {
                return res.status(400).json({
                    message: `A valid price greater than zero is required for ${method}.`
                });
            }

            if (
                entry.is_active !== undefined &&
                typeof entry.is_active !== 'boolean'
            ) {
                return res.status(400).json({
                    message: `is_active must be a boolean for ${method}.`
                });
            }
        }

        transaction = await sequelize.transaction();

        // Lock the item while processing its variant prices.
        const item = await Item.findByPk(item_id, {
            transaction,
            lock: transaction.LOCK.UPDATE
        });

        if (!item) {
            await transaction.rollback();

            return res.status(404).json({
                message: 'Item not found.'
            });
        }

        // Only active variants belonging to this item are affected.
        const variants = await ItemVariant.findAll({
            where: {
                item_id,
                is_active: true
            },
            order: [['id', 'ASC']],
            transaction,
            lock: transaction.LOCK.UPDATE
        });

        if (!variants.length) {
            await transaction.rollback();

            return res.status(409).json({
                message: 'This item has no active variants to price.'
            });
        }

        const normalizedCurrency = currency.trim().toUpperCase();
        const normalizedPriceType = price_type.trim();
        const savedItemPrices = [];
        const savedPaymentPrices = [];

        for (const variant of variants) {
            const where = {
                item_id: Number(item_id),
                variant_id: variant.id,
                price_type: normalizedPriceType,
                is_active: true
            };

            // Update the latest active matching price, or create one.
            const existingPrice = await ItemPrice.findOne({
                where,
                order: [['id', 'DESC']],
                transaction,
                lock: transaction.LOCK.UPDATE
            });

            let itemPrice;

            if (existingPrice) {
                const oldValues = priceValues(existingPrice);

                await existingPrice.update({
                    price,
                    currency: normalizedCurrency,
                    effective_from: effective_from || null,
                    effective_to: effective_to || null
                }, { transaction });

                itemPrice = existingPrice;

                await recordAuditLog({
                    userId: auditUserId(req),
                    action: 'ITEM_PRICE_UPDATED',
                    module: 'inventory',
                    entityType: 'item_price',
                    entityId: itemPrice.id,
                    description:
                        `Bulk price updated for item ${item_id}, variant ${variant.id}`,
                    oldValues,
                    newValues: priceValues(itemPrice),
                    ...requestMetadata(req),
                    transaction
                });
            } else {
                itemPrice = await ItemPrice.create({
                    item_id: Number(item_id),
                    variant_id: variant.id,
                    price_type: normalizedPriceType,
                    price,
                    currency: normalizedCurrency,
                    effective_from: effective_from || null,
                    effective_to: effective_to || null,
                    is_active: true
                }, { transaction });

                await recordAuditLog({
                    userId: auditUserId(req),
                    action: 'ITEM_PRICE_CREATED',
                    module: 'inventory',
                    entityType: 'item_price',
                    entityId: itemPrice.id,
                    description:
                        `Bulk price created for item ${item_id}, variant ${variant.id}`,
                    oldValues: null,
                    newValues: priceValues(itemPrice),
                    ...requestMetadata(req),
                    transaction
                });
            }

            savedItemPrices.push({
                variant_id: variant.id,
                item_price_id: itemPrice.id,
                price: String(itemPrice.price)
            });

            // Save only payment methods explicitly included in the request.
            for (const entry of payment_prices) {
                const method = String(entry.payment_method).toLowerCase();

                const paymentWhere = {
                    item_id: Number(item_id),
                    variant_id: variant.id,
                    payment_method: method
                };

                const existingPaymentPrice =
                    await ItemPaymentPrice.findOne({
                        where: paymentWhere,
                        transaction,
                        lock: transaction.LOCK.UPDATE
                    });

                const paymentValues = {
                    price: entry.price,
                    currency: normalizedCurrency,
                    is_active: entry.is_active !== false
                };

                let paymentPrice;

                if (existingPaymentPrice) {
                    await existingPaymentPrice.update(
                        paymentValues,
                        { transaction }
                    );

                    paymentPrice = existingPaymentPrice;
                } else {
                    paymentPrice = await ItemPaymentPrice.create({
                        ...paymentWhere,
                        ...paymentValues
                    }, { transaction });
                }

                savedPaymentPrices.push({
                    variant_id: variant.id,
                    payment_method: method,
                    price: String(paymentPrice.price),
                    is_active: paymentPrice.is_active
                });
            }
        }

        await transaction.commit();

        return res.status(200).json({
            message: 'Prices saved successfully for all active variants.',
            data: {
                item_id: Number(item_id),
                variants_updated: variants.length,
                item_prices: savedItemPrices,
                payment_prices: savedPaymentPrices
            }
        });
    } catch (error) {
        if (transaction && !transaction.finished) {
            await transaction.rollback();
        }

        if (isUniqueConstraintError(error)) {
            return res.status(409).json({
                message: 'A conflicting price already exists. Please reload and try again.'
            });
        }

        console.error('Bulk save item prices error:', error);

        return res.status(500).json({
            message: 'Failed to save prices for active variants.'
        });
    }
};


module.exports = {
    getItemPrices,
    getItemPriceById,
    createItemPrice,
    updateItemPrice,
    deleteItemPrice,
    bulkUpdateItemPrices,
    bulkSaveItemPrices
};
