
'use strict';

const { Item, ItemColor, sequelize } = require('../models');

const isValidId = value =>
    (typeof value === 'string' || typeof value === 'number') &&
    /^[1-9]\d*$/.test(String(value));

const normalizeColors = colors => {
    if (!Array.isArray(colors)) {
        return { error: 'colors must be an array' };
    }

    if (colors.length > 50) {
        return { error: 'A maximum of 50 colors is allowed per item' };
    }

    const normalized = [];
    const seen = new Set();

    for (const color of colors) {
        if (!color || typeof color !== 'object' || Array.isArray(color)) {
            return { error: 'Each color must be an object' };
        }

        if (
            typeof color.color_name !== 'string' ||
            !color.color_name.trim() ||
            color.color_name.trim().length > 50
        ) {
            return {
                error: 'Each color needs a name of 1–50 characters'
            };
        }

        if (
            typeof color.hex_code !== 'string' ||
            !/^#[0-9A-Fa-f]{6}$/.test(color.hex_code)
        ) {
            return {
                error: 'Each color needs a valid hex code, e.g. #1976D2'
            };
        }

        const colorName = color.color_name.trim();
        const hexCode = color.hex_code.toUpperCase();

        if (seen.has(hexCode)) {
            return {
                error: `Duplicate color code: ${hexCode}`
            };
        }

        seen.add(hexCode);
        normalized.push({
            color_name: colorName,
            hex_code: hexCode
        });
    }

    return { colors: normalized };
};

const getItemColors = async (req, res) => {
    try {
        const { id } = req.params;

        if (!isValidId(id)) {
            return res.status(400).json({ message: 'Invalid item ID' });
        }

        const item = await Item.findByPk(id);

        if (!item) {
            return res.status(404).json({ message: 'Item not found' });
        }

        const colors = await ItemColor.findAll({
            where: { item_id: id },
            order: [['id', 'ASC']]
        });

        return res.status(200).json({
            message: 'Item colors retrieved successfully',
            data: colors
        });
    } catch (error) {
        console.error('Get item colors error:', error);

        return res.status(500).json({
            message: 'Failed to retrieve item colors'
        });
    }
};

const replaceItemColors = async (req, res) => {
    const { id } = req.params;
    let transaction;

    try {
        if (!isValidId(id)) {
            return res.status(400).json({ message: 'Invalid item ID' });
        }

        const result = normalizeColors(req.body?.colors);

        if (result.error) {
            return res.status(400).json({ message: result.error });
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

        await ItemColor.destroy({
            where: { item_id: id },
            transaction
        });

        if (result.colors.length) {
           const now = new Date();

await ItemColor.bulkCreate(
    result.colors.map(color => ({
        ...color,
        item_id: id,
        created_at: now,
        updated_at: now
    })),
    {
        transaction,
        validate: true
    }
);
        }

        const colors = await ItemColor.findAll({
            where: { item_id: id },
            order: [['id', 'ASC']],
            transaction
        });

        await transaction.commit();

        return res.status(200).json({
            message: 'Item colors saved successfully',
            data: colors
        });
    } catch (error) {
        if (transaction && !transaction.finished) {
            await transaction.rollback();
        }

        console.error('Replace item colors error:', error);

        return res.status(500).json({
            message: 'Failed to save item colors'
        });
    }
};

const createItemColor = async (req, res) => {
    try {
        const itemId = req.params.id;
        const { color_name, hex_code } = req.body;

        if (!color_name || typeof color_name !== 'string') {
            return res.status(400).json({
                success: false,
                message: 'Colour name is required.'
            });
        }

        const colorName = color_name.trim();
        const hexCode = String(hex_code || '').toUpperCase();

        if (!colorName || colorName.length > 50) {
            return res.status(400).json({
                success: false,
                message: 'Colour name must contain between 1 and 50 characters.'
            });
        }

        if (!/^#[0-9A-F]{6}$/.test(hexCode)) {
            return res.status(400).json({
                success: false,
                message: 'Enter a valid HEX colour, for example #000000.'
            });
        }

        const item = await Item.findByPk(itemId);

        if (!item) {
            return res.status(404).json({
                success: false,
                message: 'Item not found.'
            });
        }

        const existingColor = await ItemColor.findOne({
            where: {
                item_id: itemId,
                color_name: colorName
            }
        });

        if (existingColor) {
            return res.status(409).json({
                success: false,
                message: 'This colour name already exists for this item.'
            });
        }

        const color = await ItemColor.create({
            item_id: itemId,
            color_name: colorName,
            hex_code: hexCode
        });

        return res.status(201).json({
            success: true,
            message: 'Colour created successfully.',
            data: color
        });
    } catch (error) {
        console.error('Create item colour error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to create colour.'
        });
    }
};

module.exports = {
    createItemColor,
    getItemColors,
    replaceItemColors
};
