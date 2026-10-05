'use strict';

const { ItemImage, Item, sequelize } = require('../models');
const { removeStoredFile } = require('../utils/fileStorage');
const { HttpError, toBool, toInt } = require('../utils/requestHelpers');

const MAX_IMAGES_PER_ITEM = 10;

const itemInclude = [
    {
        model: Item,
        as: 'item',
        attributes: ['id', 'item_code', 'item_name']
    }
];

const rollbackQuietly = async (transaction) => {
    if (!transaction.finished) {
        await transaction.rollback();
    }
};

const sendError = (res, error, label, fallbackMessage) => {
    if (error instanceof HttpError) {
        return res.status(error.status).json({ message: error.message });
    }

    console.error(`${label}:`, error);

    return res.status(500).json({ message: fallbackMessage });
};


// GET /api/item-images  (optional ?item_id=)
const getItemImages = async (req, res) => {
    try {
        const where = {};

        if (req.query.item_id) {
            where.item_id = req.query.item_id;
        }

        const images = await ItemImage.findAll({
            where,
            include: itemInclude,
            order: [
                ['item_id', 'ASC'],
                ['sort_order', 'ASC'],
                ['id', 'ASC']
            ]
        });

        return res.status(200).json({
            message: 'Item images retrieved successfully',
            data: images
        });
    } catch (error) {
        return sendError(
            res, error,
            'Get item images error',
            'Failed to retrieve item images'
        );
    }
};


// GET /api/item-images/:id
const getItemImageById = async (req, res) => {
    try {
        const image = await ItemImage.findByPk(req.params.id, {
            include: itemInclude
        });

        if (!image) {
            return res.status(404).json({
                message: 'Item image not found'
            });
        }

        return res.status(200).json({
            message: 'Item image retrieved successfully',
            data: image
        });
    } catch (error) {
        return sendError(
            res, error,
            'Get item image error',
            'Failed to retrieve item image'
        );
    }
};


// POST /api/item-images   (multipart: image, item_id, alt_text, sort_order, is_primary, is_active)
const createItemImage = async (req, res) => {
    const file = req.file;

    if (!file) {
        return res.status(400).json({
            message: 'Image file is required'
        });
    }

    const transaction = await sequelize.transaction();

    try {
        const { item_id, alt_text, sort_order, is_primary, is_active } = req.body;

        if (!item_id) {
            throw new HttpError(400, 'Item ID is required');
        }

        // Lock the item row so concurrent uploads can't exceed the limit
        const item = await Item.findByPk(item_id, {
            transaction,
            lock: transaction.LOCK.UPDATE
        });

        if (!item) {
            throw new HttpError(404, 'Item not found');
        }

        const existingCount = await ItemImage.count({
            where: { item_id },
            transaction
        });

        if (existingCount >= MAX_IMAGES_PER_ITEM) {
            throw new HttpError(
                409,
                `An item can have a maximum of ${MAX_IMAGES_PER_ITEM} images`
            );
        }

        // The first image of an item is always the primary one
        const makePrimary =
            existingCount === 0 ? true : toBool(is_primary, false);

        if (makePrimary) {
            await ItemImage.update(
                { is_primary: false },
                { where: { item_id }, transaction }
            );
        }

        const image = await ItemImage.create(
            {
                item_id,
                file_name: file.originalname.slice(0, 255),
                file_path: file.relativePath,
                mime_type: file.mimetype,
                file_size: file.size,
                alt_text: alt_text ? String(alt_text).trim() || null : null,
                sort_order: toInt(sort_order, 0),
                is_primary: makePrimary,
                is_active: toBool(is_active, true)
            },
            { transaction }
        );

        await transaction.commit();

        return res.status(201).json({
            message: 'Item image created successfully',
            data: image
        });
    } catch (error) {
        await rollbackQuietly(transaction);
        await removeStoredFile(file.relativePath);

        return sendError(
            res, error,
            'Create item image error',
            'Failed to create item image'
        );
    }
};


// PUT /api/item-images/:id   (JSON: alt_text, sort_order, is_primary, is_active)
const updateItemImage = async (req, res) => {
    const transaction = await sequelize.transaction();

    try {
        const image = await ItemImage.findByPk(req.params.id, {
            transaction,
            lock: transaction.LOCK.UPDATE
        });

        if (!image) {
            throw new HttpError(404, 'Item image not found');
        }

        const { alt_text, sort_order, is_primary, is_active } = req.body;

        const updates = {};

        if (alt_text !== undefined) {
            updates.alt_text = alt_text ? String(alt_text).trim() || null : null;
        }

        if (sort_order !== undefined) {
            updates.sort_order = toInt(sort_order, image.sort_order);
        }

        if (is_active !== undefined) {
            updates.is_active = toBool(is_active, image.is_active);
        }

        if (is_primary !== undefined) {
            const makePrimary = toBool(is_primary, image.is_primary);

            if (!makePrimary && image.is_primary) {
                throw new HttpError(
                    400,
                    'Set another image as primary instead of unsetting this one'
                );
            }

            if (makePrimary && !image.is_primary) {
                await ItemImage.update(
                    { is_primary: false },
                    { where: { item_id: image.item_id }, transaction }
                );

                updates.is_primary = true;
            }
        }

        await image.update(updates, { transaction });

        await transaction.commit();

        const updated = await ItemImage.findByPk(image.id, {
            include: itemInclude
        });

        return res.status(200).json({
            message: 'Item image updated successfully',
            data: updated
        });
    } catch (error) {
        await rollbackQuietly(transaction);

        return sendError(
            res, error,
            'Update item image error',
            'Failed to update item image'
        );
    }
};


// DELETE /api/item-images/:id
const deleteItemImage = async (req, res) => {
    const transaction = await sequelize.transaction();

    try {
        const image = await ItemImage.findByPk(req.params.id, {
            transaction,
            lock: transaction.LOCK.UPDATE
        });

        if (!image) {
            throw new HttpError(404, 'Item image not found');
        }

        const { item_id, file_path, is_primary } = image;

        await image.destroy({ transaction });

        // Keep one primary image: promote the next one in order
        if (is_primary) {
            const next = await ItemImage.findOne({
                where: { item_id },
                order: [
                    ['sort_order', 'ASC'],
                    ['id', 'ASC']
                ],
                transaction
            });

            if (next) {
                await next.update({ is_primary: true }, { transaction });
            }
        }

        await transaction.commit();

        await removeStoredFile(file_path);

        return res.status(200).json({
            message: 'Item image deleted successfully'
        });
    } catch (error) {
        await rollbackQuietly(transaction);

        return sendError(
            res, error,
            'Delete item image error',
            'Failed to delete item image'
        );
    }
};


module.exports = {
    getItemImages,
    getItemImageById,
    createItemImage,
    updateItemImage,
    deleteItemImage
};
