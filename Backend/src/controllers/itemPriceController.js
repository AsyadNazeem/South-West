
const { ItemPrice, Item, sequelize } = require('../models');
const { recordAuditLog } = require('../services/auditLogService');

const VALID_FIELDS = [
    'item_id',
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
    }
];

// GET ALL ITEM PRICES
const getItemPrices = async (req, res) => {
    try {
        const prices = await ItemPrice.findAll({
            include: getPriceInclude(),
            order: [['id', 'DESC']]
        });

        return res.status(200).json({
            message: 'Item prices retrieved successfully',
            data: prices
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

module.exports = {
    getItemPrices,
    getItemPriceById,
    createItemPrice,
    updateItemPrice,
    deleteItemPrice
};
