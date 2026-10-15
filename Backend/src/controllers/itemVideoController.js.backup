'use strict';

const { ItemVideo, Item, sequelize } = require('../models');
const { removeStoredFile } = require('../utils/fileStorage');
const { HttpError, toBool } = require('../utils/requestHelpers');

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


// GET /api/item-videos  (optional ?item_id=)
const getItemVideos = async (req, res) => {
    try {
        const where = {};

        if (req.query.item_id) {
            where.item_id = req.query.item_id;
        }

        const videos = await ItemVideo.findAll({
            where,
            include: itemInclude,
            order: [['item_id', 'ASC']]
        });

        return res.status(200).json({
            message: 'Item videos retrieved successfully',
            data: videos
        });
    } catch (error) {
        return sendError(
            res, error,
            'Get item videos error',
            'Failed to retrieve item videos'
        );
    }
};


// GET /api/item-videos/:id
const getItemVideoById = async (req, res) => {
    try {
        const video = await ItemVideo.findByPk(req.params.id, {
            include: itemInclude
        });

        if (!video) {
            return res.status(404).json({
                message: 'Item video not found'
            });
        }

        return res.status(200).json({
            message: 'Item video retrieved successfully',
            data: video
        });
    } catch (error) {
        return sendError(
            res, error,
            'Get item video error',
            'Failed to retrieve item video'
        );
    }
};


// POST /api/item-videos   (multipart: video, item_id, is_active)
const createItemVideo = async (req, res) => {
    const file = req.file;

    if (!file) {
        return res.status(400).json({
            message: 'Video file is required'
        });
    }

    const transaction = await sequelize.transaction();

    try {
        const { item_id, is_active } = req.body;

        if (!item_id) {
            throw new HttpError(400, 'Item ID is required');
        }

        const item = await Item.findByPk(item_id, {
            transaction,
            lock: transaction.LOCK.UPDATE
        });

        if (!item) {
            throw new HttpError(404, 'Item not found');
        }

        const existing = await ItemVideo.findOne({
            where: { item_id },
            transaction
        });

        if (existing) {
            throw new HttpError(
                409,
                'This item already has a video. Delete it before uploading a new one'
            );
        }

        const video = await ItemVideo.create(
            {
                item_id,
                file_name: file.originalname.slice(0, 255),
                file_path: file.relativePath,
                mime_type: file.mimetype,
                file_size: file.size,
                is_active: toBool(is_active, true)
            },
            { transaction }
        );

        await transaction.commit();

        return res.status(201).json({
            message: 'Item video created successfully',
            data: video
        });
    } catch (error) {
        await rollbackQuietly(transaction);
        await removeStoredFile(file.relativePath);

        // Unique key on item_id (race between two uploads)
        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(409).json({
                message: 'This item already has a video'
            });
        }

        return sendError(
            res, error,
            'Create item video error',
            'Failed to create item video'
        );
    }
};


// PUT /api/item-videos/:id   (JSON: is_active)
const updateItemVideo = async (req, res) => {
    try {
        const video = await ItemVideo.findByPk(req.params.id);

        if (!video) {
            return res.status(404).json({
                message: 'Item video not found'
            });
        }

        if (req.body.is_active !== undefined) {
            await video.update({
                is_active: toBool(req.body.is_active, video.is_active)
            });
        }

        return res.status(200).json({
            message: 'Item video updated successfully',
            data: video
        });
    } catch (error) {
        return sendError(
            res, error,
            'Update item video error',
            'Failed to update item video'
        );
    }
};


// DELETE /api/item-videos/:id
const deleteItemVideo = async (req, res) => {
    try {
        const video = await ItemVideo.findByPk(req.params.id);

        if (!video) {
            return res.status(404).json({
                message: 'Item video not found'
            });
        }

        const filePath = video.file_path;

        await video.destroy();

        await removeStoredFile(filePath);

        return res.status(200).json({
            message: 'Item video deleted successfully'
        });
    } catch (error) {
        return sendError(
            res, error,
            'Delete item video error',
            'Failed to delete item video'
        );
    }
};


module.exports = {
    getItemVideos,
    getItemVideoById,
    createItemVideo,
    updateItemVideo,
    deleteItemVideo
};
