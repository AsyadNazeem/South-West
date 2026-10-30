
'use strict';

const {
    sequelize,
    Item,
    ItemVariant,
    ItemColor,
    ItemVariantColor,
    ItemPaymentPrice
} = require('../models');

const { recordAuditLog } = require('../services/auditLogService');

const VALID_FIELDS = [
    'variant_sku',
    'variant_name',
    'attributes',
    'qb_item_code',
    'is_default',
    'is_active'
];

const isValidId = id => /^[1-9]\d*$/.test(String(id));

const requestMetadata = req => ({
    ipAddress: req.ip || null,
    userAgent: req.get('user-agent') || null,
    requestId: req.id || null
});

const auditUserId = req =>
    req.user?.id ?? req.user?.userId ?? null;

const cleanSkuPart = (value) =>
    String(value || '').replace(/[^a-zA-Z0-9]/g, '');

const generateVariantSku = (itemCode, variantName, colorName = '') => {
    const normalizedItemCode = String(itemCode || '').trim();

    if (!normalizedItemCode) {
        throw new Error('Item code is required to generate a variant SKU');
    }

    // Preserve the current handling of SW-000001 and SW000001.
    // Also support existing item codes such as HEDPANKR209349434.
    const itemIdentifier = /^SW-?/i.test(normalizedItemCode)
        ? normalizedItemCode.replace(/^SW-?/i, '')
        : normalizedItemCode;

    const itemPart = cleanSkuPart(itemIdentifier);
    const namePart = cleanSkuPart(variantName);
    const colorPart = cleanSkuPart(colorName);

    if (!itemPart || !namePart) {
        throw new Error(
            'A valid item code and variant name are required to generate a SKU'
        );
    }

    const sku = `SWV-${itemPart}-${namePart}${colorPart}`;

    if (sku.length > 100) {
        throw new Error('Generated variant SKU exceeds 100 characters');
    }

    return sku;
};

const variantValues = variant => ({
    id: variant.id,
    item_id: variant.item_id,
    variant_sku: variant.variant_sku,
    variant_name: variant.variant_name,
    attributes: variant.attributes,
    qb_item_code: variant.qb_item_code,
    is_default: variant.is_default,
    is_active: variant.is_active
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

    if (creating || body.variant_name !== undefined) {
        if (
            typeof body.variant_name !== 'string' ||
            !body.variant_name.trim() ||
            body.variant_name.trim().length > 255
        ) {
            errors.variant_name = 'Variant name is required and must not exceed 255 characters';
        }
    }

    if (body.attributes !== undefined && body.attributes !== null) {
        if (
            typeof body.attributes !== 'object' ||
            Array.isArray(body.attributes)
        ) {
            errors.attributes = 'Attributes must be a JSON object or null';
        }
    }

    if (
        body.qb_item_code !== undefined &&
        body.qb_item_code !== null &&
        (
            typeof body.qb_item_code !== 'string' ||
            body.qb_item_code.trim().length > 100
        )
    ) {
        errors.qb_item_code = 'QuickBooks item code must be a string of at most 100 characters';
    }

    for (const field of ['is_default', 'is_active']) {
        if (body[field] !== undefined && typeof body[field] !== 'boolean') {
            errors[field] = `${field} must be a boolean`;
        }
    }

    if (!creating && Object.keys(body).length === 0) {
        errors.body = 'Provide at least one field to update';
    }

    return errors;
};

// GET /:id/variants

const getItemVariants = async (req, res) => {
    try {
        const { id } = req.params;

        if (!isValidId(id)) {
            return res.status(400).json({
                message: 'Invalid item ID'
            });
        }

        const item = await Item.findByPk(id);

        if (!item) {
            return res.status(404).json({
                message: 'Item not found'
            });
        }

        const variants = await ItemVariant.findAll({
            where: { item_id: id },
            order: [
                ['is_default', 'DESC'],
                ['id', 'ASC']
            ]
        });

        const variantIds = variants.map(variant => variant.id);

        let paymentPrices = [];

        if (variantIds.length > 0) {
            paymentPrices = await ItemPaymentPrice.findAll({
                where: {
                    item_id: Number(id),
                    variant_id: variantIds,
                    is_active: true
                },
                attributes: [
                    'variant_id',
                    'payment_method',
                    'price',
                    'currency',
                    'is_active'
                ]
            });
        }

        const paymentPricesByVariant = {};

        for (const record of paymentPrices) {
            const variantId = String(record.variant_id);

            if (!paymentPricesByVariant[variantId]) {
                paymentPricesByVariant[variantId] = {};
            }

            paymentPricesByVariant[variantId][record.payment_method] = {
                price: Number(record.price),
                currency: record.currency,
                is_active: Boolean(record.is_active)
            };
        }

        const variantsWithPrices = variants.map(variant => {
            const variantData = variant.toJSON();
            const prices =
                paymentPricesByVariant[String(variant.id)] || {};

            return {
                ...variantData,
                payment_prices: {
                    cash: prices.cash || null,
                    card: prices.card || null,
                    koko: prices.koko || null,
                    mintpay: prices.mintpay || null
                }
            };
        });

        console.log(
    'Variants with payment prices:',
    JSON.stringify(variantsWithPrices, null, 2)
);

        return res.status(200).json({
            message: 'Item variants retrieved successfully',
            data: variantsWithPrices
        });
    } catch (error) {
        console.error('Get item variants error:', error);

        return res.status(500).json({
            message: 'Failed to retrieve item variants'
        });
    }
};


// GET /:id/variants/:variantId
const getItemVariantById = async (req, res) => {
    try {
        const { id, variantId } = req.params;

        if (!isValidId(id) || !isValidId(variantId)) {
            return res.status(400).json({
                message: 'Invalid item or variant ID'
            });
        }

        const variant = await ItemVariant.findOne({
            where: {
                id: variantId,
                item_id: id
            }
        });

        if (!variant) {
            return res.status(404).json({
                message: 'Variant not found for this item'
            });
        }

        return res.status(200).json({
            message: 'Item variant retrieved successfully',
            data: variant
        });
    } catch (error) {
        console.error('Get item variant error:', error);

        return res.status(500).json({
            message: 'Failed to retrieve item variant'
        });
    }
};

// POST /:id/variants
const createItemVariant = async (req, res) => {
    let transaction;

    try {
        const { id } = req.params;

        if (!isValidId(id)) {
            return res.status(400).json({ message: 'Invalid item ID' });
        }

        const errors = validateBody(req.body, true);

        if (Object.keys(errors).length) {
            return res.status(400).json({
                message: 'Invalid variant data',
                errors
            });
        }

        transaction = await sequelize.transaction();

        const item = await Item.findByPk(id, {
            transaction,
            lock: transaction.LOCK.UPDATE
        });

        if (!item) {
            await transaction.rollback();

            return res.status(404).json({ message: 'Item not found' });
        }

        const existingVariant = await ItemVariant.findOne({
            where: {
                item_id: id,
                is_default: true
            },
            transaction,
            lock: transaction.LOCK.UPDATE
        });

        const makeDefault = req.body.is_default === true;

        if (makeDefault && existingVariant) {
            await existingVariant.update(
                { is_default: false },
                { transaction }
            );
        }

const generatedSku = generateVariantSku(
    item.item_code,
    req.body.variant_name
);

const variant = await ItemVariant.create({
    item_id: id,
    variant_sku: generatedSku,
    variant_name: req.body.variant_name.trim(),
    attributes: req.body.attributes ?? null,
    qb_item_code: req.body.qb_item_code?.trim() || null,
    is_default: makeDefault || !existingVariant,
    is_active: req.body.is_active ?? true
}, { transaction });

        await recordAuditLog({
            userId: auditUserId(req),
            action: 'ITEM_VARIANT_CREATED',
            module: 'items',
            entityType: 'item_variant',
            entityId: variant.id,
            description: `Variant ${variant.variant_sku} created for item ${id}`,
            oldValues: null,
            newValues: variantValues(variant),
            ...requestMetadata(req),
            transaction
        });

        await transaction.commit();

        return res.status(201).json({
            message: 'Item variant created successfully',
            data: variant
        });
    } catch (error) {
        if (transaction && !transaction.finished) {
            await transaction.rollback();
        }

        if (
            error?.name === 'SequelizeUniqueConstraintError' ||
            error?.original?.code === 'ER_DUP_ENTRY' ||
            error?.parent?.code === 'ER_DUP_ENTRY'
        ) {
            return res.status(409).json({
                message: 'This variant SKU already exists'
            });
        }

        console.error('Create item variant error:', error);

        return res.status(500).json({
            message: 'Failed to create item variant'
        });
    }
};


const bulkCreateItemVariants = async (req, res) => {
    let transaction;

    try {
        const { id } = req.params;
        const { variants } = req.body || {};

        if (!isValidId(id)) {
            return res.status(400).json({
                message: 'Invalid item ID'
            });
        }

        if (
            !Array.isArray(variants) ||
            variants.length === 0 ||
            variants.length > 100
        ) {
            return res.status(400).json({
                message: 'Provide between 1 and 100 variants'
            });
        }

        const allowedFields = [
            'variant_name',
            'attributes',
            'qb_item_code',
            'is_default',
            'is_active',
            'color_ids'
        ];

        let defaultCount = 0;

        for (let i = 0; i < variants.length; i++) {
            const row = variants[i];

            if (
                !row ||
                typeof row !== 'object' ||
                Array.isArray(row)
            ) {
                return res.status(400).json({
                    message: `Variant ${i + 1} must be an object`
                });
            }

            const unknownFields = Object.keys(row).filter(
                field => !allowedFields.includes(field)
            );

            if (unknownFields.length) {
                return res.status(400).json({
                    message: `Variant ${i + 1} contains unsupported fields`,
                    fields: unknownFields
                });
            }

            if (
                typeof row.variant_name !== 'string' ||
                !row.variant_name.trim() ||
                row.variant_name.trim().length > 255
            ) {
                return res.status(400).json({
                    message: `Variant ${i + 1} needs a name of at most 255 characters`
                });
            }

            if (
                row.attributes !== undefined &&
                row.attributes !== null &&
                (
                    typeof row.attributes !== 'object' ||
                    Array.isArray(row.attributes)
                )
            ) {
                return res.status(400).json({
                    message: `Attributes for variant ${i + 1} must be an object or null`
                });
            }

            if (
                row.qb_item_code !== undefined &&
                row.qb_item_code !== null &&
                (
                    typeof row.qb_item_code !== 'string' ||
                    row.qb_item_code.trim().length > 100
                )
            ) {
                return res.status(400).json({
                    message: `Invalid QuickBooks item code for variant ${i + 1}`
                });
            }

            for (const field of ['is_default', 'is_active']) {
                if (
                    row[field] !== undefined &&
                    typeof row[field] !== 'boolean'
                ) {
                    return res.status(400).json({
                        message: `${field} for variant ${i + 1} must be a boolean`
                    });
                }
            }

            if (row.is_default === true) {
                defaultCount++;
            }

            if (defaultCount > 1) {
                return res.status(400).json({
                    message: 'Only one variant can be the default'
                });
            }

            if (
                row.color_ids !== undefined &&
                !Array.isArray(row.color_ids)
            ) {
                return res.status(400).json({
                    message: `color_ids for variant ${i + 1} must be an array`
                });
            }

            const colorIds = row.color_ids || [];

            if (colorIds.length > 2) {
                return res.status(400).json({
                    message: `Variant ${i + 1} can have a maximum of two colours`
                });
            }

            if (colorIds.some(colorId => !isValidId(colorId))) {
                return res.status(400).json({
                    message: `Invalid colour ID for variant ${i + 1}`
                });
            }

            const normalizedIds = colorIds.map(String);

            if (new Set(normalizedIds).size !== normalizedIds.length) {
                return res.status(400).json({
                    message: `Duplicate colour IDs for variant ${i + 1}`
                });
            }
        }

        transaction = await sequelize.transaction();

        const item = await Item.findByPk(id, {
            transaction,
            lock: transaction.LOCK.UPDATE
        });

        if (!item) {
            await transaction.rollback();
            transaction = null;

            return res.status(404).json({
                message: 'Item not found'
            });
        }

        const existingDefault = await ItemVariant.findOne({
            where: {
                item_id: id,
                is_default: true
            },
            transaction,
            lock: transaction.LOCK.UPDATE
        });

        const allColorIds = [
            ...new Set(
                variants.flatMap(row =>
                    (row.color_ids || []).map(String)
                )
            )
        ];

        const colorById = new Map();

        if (allColorIds.length) {
            const colors = await ItemColor.findAll({
                where: {
                    item_id: id,
                    id: allColorIds
                },
                attributes: [
                    'id',
                    'item_id',
                    'color_name',
                    'hex_code'
                ],
                transaction
            });

            for (const color of colors) {
                colorById.set(String(color.id), color);
            }

            if (allColorIds.some(colorId => !colorById.has(colorId))) {
                await transaction.rollback();
                transaction = null;

                return res.status(400).json({
                    message: 'One or more selected colours do not belong to this item'
                });
            }
        }

        const firstBecomesDefault =
            !existingDefault && defaultCount === 0;

        if (defaultCount === 1 && existingDefault) {
            await existingDefault.update(
                { is_default: false },
                { transaction }
            );
        }

        const createdVariants = [];

        for (let i = 0; i < variants.length; i++) {
            const row = variants[i];

            const colorIds = (row.color_ids || []).map(String);

            const colorNames = colorIds
                .map(colorId => colorById.get(colorId).color_name)
                .filter(Boolean);

            const variantSku = generateVariantSku(
                item.item_code,
                row.variant_name,
                colorNames.join('-')
            );

            const isDefault =
                row.is_default === true ||
                (firstBecomesDefault && i === 0);

            const variant = await ItemVariant.create({
                item_id: id,
                variant_sku: variantSku,
                variant_name: row.variant_name.trim(),
                attributes: row.attributes ?? null,
                qb_item_code: row.qb_item_code?.trim() || null,
                is_default: isDefault,
                is_active: row.is_active ?? true
            }, { transaction });

            if (colorIds.length) {
                await ItemVariantColor.bulkCreate(
                    colorIds.map(colorId => ({
                        variant_id: variant.id,
                        color_id: colorId
                    })),
                    { transaction }
                );
            }

            await recordAuditLog({
                userId: auditUserId(req),
                action: 'ITEM_VARIANT_CREATED',
                module: 'items',
                entityType: 'item_variant',
                entityId: variant.id,
                description: `Variant ${variant.variant_sku} created for item ${id}`,
                oldValues: null,
                newValues: {
                    ...variantValues(variant),
                    color_ids: colorIds
                },
                ...requestMetadata(req),
                transaction
            });

            createdVariants.push({
                ...variant.toJSON(),
                color_ids: colorIds,
                colors: colorIds.map(colorId => colorById.get(colorId))
            });
        }

        await transaction.commit();
        transaction = null;

        return res.status(201).json({
            message: `${createdVariants.length} variants created successfully`,
            data: createdVariants
        });
    } catch (error) {
        if (transaction && !transaction.finished) {
            await transaction.rollback();
        }

        if (
            error?.name === 'SequelizeUniqueConstraintError' ||
            error?.original?.code === 'ER_DUP_ENTRY' ||
            error?.parent?.code === 'ER_DUP_ENTRY'
        ) {
            return res.status(409).json({
                message: 'A generated variant SKU already exists. No variants were created.'
            });
        }

        console.error('Bulk create item variants error:', error);

        return res.status(500).json({
            message: 'Failed to create item variants'
        });
    }
};


// PUT /:id/variants/:variantId
const updateItemVariant = async (req, res) => {
    let transaction;

    try {
        const { id, variantId } = req.params;

        if (!isValidId(id) || !isValidId(variantId)) {
            return res.status(400).json({
                message: 'Invalid item or variant ID'
            });
        }

        const errors = validateBody(req.body);

        if (Object.keys(errors).length) {
            return res.status(400).json({
                message: 'Invalid variant data',
                errors
            });
        }

        transaction = await sequelize.transaction();

        const item = await Item.findByPk(id, {
            transaction,
            lock: transaction.LOCK.UPDATE
        });

        if (!item) {
            await transaction.rollback();

            return res.status(404).json({ message: 'Item not found' });
        }

        const variant = await ItemVariant.findOne({
            where: {
                id: variantId,
                item_id: id
            },
            transaction,
            lock: transaction.LOCK.UPDATE
        });

        if (!variant) {
            await transaction.rollback();

            return res.status(404).json({
                message: 'Variant not found for this item'
            });
        }

        const oldValues = variantValues(variant);
        const changes = {};

        for (const field of VALID_FIELDS) {
            if (req.body[field] !== undefined) {
                changes[field] = req.body[field];
            }
        }

        if (changes.variant_name !== undefined) {
            changes.variant_name = changes.variant_name.trim();
        }

        if (changes.qb_item_code !== undefined) {
            changes.qb_item_code = changes.qb_item_code?.trim() || null;
        }

        if (changes.is_default === true) {
            await ItemVariant.update(
                { is_default: false },
                {
                    where: {
                        item_id: id,
                        is_default: true
                    },
                    transaction
                }
            );
        }

        const variantNameChanged =
    changes.variant_name !== undefined &&
    changes.variant_name !== variant.variant_name;

if (variantNameChanged || !variant.variant_sku) {
    const effectiveVariantName =
        changes.variant_name ?? variant.variant_name;

    const existingAssignment = await ItemVariantColor.findOne({
        where: { variant_id: variant.id },
        transaction
    });

    let colorName = '';

    if (existingAssignment) {
        const assignedColor = await ItemColor.findOne({
            where: {
                id: existingAssignment.color_id,
                item_id: id
            },
            attributes: ['color_name'],
            transaction
        });

        colorName = assignedColor?.color_name || '';
    }

    changes.variant_sku = generateVariantSku(
        item.item_code,
        effectiveVariantName,
        colorName
    );
}

        await variant.update(changes, { transaction });

        const newValues = variantValues(variant);

        const changed = Object.keys(oldValues).some(
            key => JSON.stringify(oldValues[key]) !== JSON.stringify(newValues[key])
        );

        if (changed) {
            await recordAuditLog({
                userId: auditUserId(req),
                action: 'ITEM_VARIANT_UPDATED',
                module: 'items',
                entityType: 'item_variant',
                entityId: variant.id,
                description: `Variant ${variant.variant_sku} updated`,
                oldValues,
                newValues,
                ...requestMetadata(req),
                transaction
            });
        }

        await transaction.commit();

        return res.status(200).json({
            message: 'Item variant updated successfully',
            data: variant
        });
    } catch (error) {
        if (transaction && !transaction.finished) {
            await transaction.rollback();
        }

        if (
            error?.name === 'SequelizeUniqueConstraintError' ||
            error?.original?.code === 'ER_DUP_ENTRY' ||
            error?.parent?.code === 'ER_DUP_ENTRY'
        ) {
            return res.status(409).json({
                message: 'This variant SKU already exists'
            });
        }

        console.error('Update item variant error:', error);

        return res.status(500).json({
            message: 'Failed to update item variant'
        });
    }
};


const getVariantColors = async (req, res) => {
    try {
        const { id, variantId } = req.params;

        if (!isValidId(id) || !isValidId(variantId)) {
            return res.status(400).json({
                message: 'Invalid item or variant ID'
            });
        }

        const variant = await ItemVariant.findOne({
            where: {
                id: variantId,
                item_id: id
            },
            include: [{
                model: ItemColor,
                as: 'colors',
                attributes: ['id', 'item_id', 'color_name', 'hex_code'],
                through: {
                    attributes: []
                }
            }]
        });

        if (!variant) {
            return res.status(404).json({
                message: 'Variant not found for this item'
            });
        }

        return res.status(200).json({
            message: 'Variant colours retrieved successfully',
            data: variant.colors
        });
    } catch (error) {
        console.error('Get variant colours error:', error);

        return res.status(500).json({
            message: 'Failed to retrieve variant colours'
        });
    }
};




const updateVariantColors = async (req, res) => {
  let transaction;

  try {
    const { id, variantId } = req.params;

    if (!isValidId(id) || !isValidId(variantId)) {
      return res.status(400).json({
        message: 'Invalid item or variant ID'
      });
    }

    const body = req.body;

    if (
      !body ||
      typeof body !== 'object' ||
      Array.isArray(body)
    ) {
      return res.status(400).json({
        message: 'Provide color_ids as an array of colour IDs'
      });
    }

    let rawIds;

    // Support the new multiple-colour request and the old single-colour format.
    if (Object.hasOwn(body, 'color_ids') &&
        Object.keys(body).length === 1) {
      rawIds = body.color_ids;

      if (!Array.isArray(rawIds)) {
        return res.status(400).json({
          message: 'color_ids must be an array'
        });
      }
    } else if (
      Object.hasOwn(body, 'color_id') &&
      Object.keys(body).length === 1
    ) {
      rawIds =
        body.color_id === null || body.color_id === ''
          ? []
          : [body.color_id];
    } else {
      return res.status(400).json({
        message: 'Provide either color_ids or color_id'
      });
    }

    if (rawIds.some(value => !isValidId(value))) {
      return res.status(400).json({
        message: 'Every colour ID must be a positive integer'
      });
    }

    const normalizedIds = rawIds.map(String);

    if (new Set(normalizedIds).size !== normalizedIds.length) {
      return res.status(400).json({
        message: 'Duplicate colour IDs are not allowed'
      });
    }

    transaction = await sequelize.transaction();

    const item = await Item.findByPk(id, {
      transaction,
      lock: transaction.LOCK.UPDATE
    });

    if (!item) {
      await transaction.rollback();
      transaction = null;

      return res.status(404).json({ message: 'Item not found' });
    }

    const variant = await ItemVariant.findOne({
      where: { id: variantId, item_id: id },
      transaction,
      lock: transaction.LOCK.UPDATE
    });

    if (!variant) {
      await transaction.rollback();
      transaction = null;

      return res.status(404).json({
        message: 'Variant not found for this item'
      });
    }

    const existingAssignments = await ItemVariantColor.findAll({
      where: { variant_id: variantId },
      transaction
    });

    const oldColorIds = existingAssignments
      .map(row => String(row.color_id))
      .sort();

    let validColors = [];

    if (normalizedIds.length) {
      const foundColors = await ItemColor.findAll({
        where: {
          item_id: id,
          id: normalizedIds
        },
        attributes: ['id', 'item_id', 'color_name', 'hex_code'],
        transaction
      });

      const colorById = new Map(
        foundColors.map(color => [String(color.id), color])
      );

      if (normalizedIds.some(colorId => !colorById.has(colorId))) {
        await transaction.rollback();
        transaction = null;

        return res.status(400).json({
          message: 'One or more selected colours do not belong to this item'
        });
      }

      // Preserve the order selected in the admin interface.
      validColors = normalizedIds.map(colorId => colorById.get(colorId));
    }

    const newColorIds = normalizedIds.slice().sort();

    const changed =
      JSON.stringify(oldColorIds) !== JSON.stringify(newColorIds);

    if (changed) {
      await ItemVariantColor.destroy({
        where: { variant_id: variantId },
        transaction
      });

      if (normalizedIds.length) {
        await ItemVariantColor.bulkCreate(
          normalizedIds.map(colorId => ({
            variant_id: variantId,
            color_id: colorId
          })),
          { transaction }
        );
      }

      await recordAuditLog({
        userId: auditUserId(req),
        action: 'ITEM_VARIANT_COLORS_UPDATED',
        module: 'items',
        entityType: 'item_variant',
        entityId: variant.id,
        description: `Colours updated for variant ${variant.variant_sku}`,
        oldValues: { color_ids: oldColorIds },
        newValues: { color_ids: newColorIds },
        ...requestMetadata(req),
        transaction
      });
    }

    const colourNames = validColors
      .map(color => color.color_name)
      .filter(Boolean);

    const generatedSku = generateVariantSku(
      item.item_code,
      variant.variant_name,
      colourNames.join('-')
    );

    await variant.update(
      { variant_sku: generatedSku },
      { transaction }
    );

    await transaction.commit();
    transaction = null;

    return res.status(200).json({
      message: 'Variant colours and SKU updated successfully',
      data: {
        colors: validColors,
        color: validColors[0] || null,
        variant_sku: variant.variant_sku
      }
    });
  } catch (error) {
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }

    console.error('Update variant colours error:', error);

    if (
      error?.name === 'SequelizeUniqueConstraintError' ||
      error?.original?.code === 'ER_DUP_ENTRY' ||
      error?.parent?.code === 'ER_DUP_ENTRY'
    ) {
      return res.status(409).json({
        message: 'A colour is already assigned to this variant'
      });
    }

    return res.status(500).json({
      message: 'Failed to update variant colours'
    });
  }
};



module.exports = {
    getItemVariants,
    getItemVariantById,
    createItemVariant,
    bulkCreateItemVariants,
    updateItemVariant,
    getVariantColors,
    updateVariantColors
};