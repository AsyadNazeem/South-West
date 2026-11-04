'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');

const { UPLOAD_ROOT } = require('../utils/fileStorage');

const detectFileType = async (filePath) => {
    const { fileTypeFromFile } = await import('file-type');
    return fileTypeFromFile(filePath);
};

class UploadError extends Error {}

const MB = 1024 * 1024;

const createUploader = ({
                            field,
                            folder,
                            allowedTypes,
                            allowedExtensions,
                            maxSize,
                            typeMessage,
                            sizeMessage
                        }) => {
    const directory = path.join(UPLOAD_ROOT, folder);

    fs.mkdirSync(directory, { recursive: true });

    const upload = multer({
        storage: multer.diskStorage({
            destination: (req, file, cb) => cb(null, directory),

            // Never trust the original name: random name + extension from MIME type
            filename: (req, file, cb) =>
                cb(null, `${crypto.randomUUID()}${allowedTypes[file.mimetype]}`)
        }),

        fileFilter: (req, file, cb) => {
            if (allowedTypes[file.mimetype]) return cb(null, true);

            cb(new UploadError(typeMessage));
        },

        limits: {
            fileSize: maxSize,
            files: 1
        }
    }).single(field);

    return (req, res, next) => {
        upload(req, res, (error) => {
            if (error) {
                if (error instanceof multer.MulterError) {
                    if (error.storageErrors?.length) {
                        for (const cleanupError of error.storageErrors) {
                            console.error('Upload cleanup failed:', {
                                code: cleanupError.code,
                                field: cleanupError.field,
                                message: cleanupError.message
                            });
                        }
                    }

                    const message =
                        error.code === 'LIMIT_FILE_SIZE'
                            ? sizeMessage
                            : error.code === 'LIMIT_UNEXPECTED_FILE'
                                ? `Unexpected file field. Use "${field}".`
                                : error.message;

                    return res.status(400).json({ message });
                }

                if (error instanceof UploadError) {
                    return res.status(400).json({ message: error.message });
                }

                console.error('Upload error:', error);

                return res.status(500).json({ message: 'File upload failed' });
            }

            if (!req.file) {
                return next();
            }

            req.file.relativePath = path.posix.join(folder, req.file.filename);

            (async () => {
                try {
                    const detected = await detectFileType(req.file.path);

                    if (
                        !detected ||
                        detected.ext !== allowedExtensions[req.file.mimetype] ||
                        detected.mime !== req.file.mimetype
                    ) {
                        await fs.promises.unlink(req.file.path).catch(() => {});

                        return res.status(400).json({
                            message: typeMessage
                        });
                    }

                    return next();
                } catch (validationError) {
                    try {
                        await fs.promises.unlink(req.file.path);
                    } catch (cleanupError) {
                        if (cleanupError.code !== 'ENOENT') {
                            console.error(
                                'Rejected upload cleanup failed:',
                                cleanupError.code || cleanupError.message
                            );
                        }
                    }

                    console.error(
                        'File content validation failed:',
                        validationError.message
                    );

                    return res.status(500).json({
                        message: 'File validation failed'
                    });
                }
            })();
        });
    };
};

const createMultiUploader = ({
    fields,
    folder,
    allowedTypes,
    allowedExtensions,
    maxSize,
    typeMessage,
    sizeMessage
}) => {
    const directory = path.join(UPLOAD_ROOT, folder);

    fs.mkdirSync(directory, { recursive: true });

    const upload = multer({
        storage: multer.diskStorage({
            destination: (req, file, cb) => cb(null, directory),
            filename: (req, file, cb) =>
                cb(null, `${crypto.randomUUID()}${allowedTypes[file.mimetype]}`)
        }),

        fileFilter: (req, file, cb) => {
            if (allowedTypes[file.mimetype]) return cb(null, true);
            cb(new UploadError(typeMessage));
        },

        limits: {
            fileSize: maxSize,
            files: fields.length
        }
    }).fields(fields.map((field) => ({
        name: field,
        maxCount: 1
    })));

    return (req, res, next) => {
        upload(req, res, async (error) => {
            const uploadedFiles = Object.values(req.files || {}).flat();

            const cleanupFiles = async () => {
                await Promise.all(
                    uploadedFiles.map((file) =>
                        fs.promises.unlink(file.path).catch(() => {})
                    )
                );
            };

            if (error) {
                await cleanupFiles();

                if (error instanceof multer.MulterError) {
                    const message =
                        error.code === 'LIMIT_FILE_SIZE'
                            ? sizeMessage
                            : error.code === 'LIMIT_UNEXPECTED_FILE'
                                ? 'Unexpected image field.'
                                : error.message;

                    return res.status(400).json({ message });
                }

                if (error instanceof UploadError) {
                    return res.status(400).json({ message: error.message });
                }

                console.error('Banner upload error:', error);
                return res.status(500).json({ message: 'File upload failed' });
            }

            try {
                for (const file of uploadedFiles) {
                    const detected = await detectFileType(file.path);

                    if (
                        !detected ||
                        detected.ext !== allowedExtensions[file.mimetype] ||
                        detected.mime !== file.mimetype
                    ) {
                        await cleanupFiles();
                        return res.status(400).json({ message: typeMessage });
                    }

                    file.relativePath = path.posix.join(folder, file.filename);
                }

                next();
            } catch (validationError) {
                await cleanupFiles();
                console.error('Banner file validation failed:', validationError);

                return res.status(500).json({
                    message: 'File validation failed'
                });
            }
        });
    };
};

const uploadItemImage = createUploader({
    field: 'image',
    folder: 'items/images',
    allowedTypes: {
        'image/jpeg': '.jpg',
        'image/png': '.png'
    },
    allowedExtensions: {
        'image/jpeg': 'jpg',
        'image/png': 'png'
    },
    maxSize: 5 * MB,
    typeMessage: 'Only PNG and JPG images are allowed',
    sizeMessage: 'Image must be smaller than 5MB'
});

const uploadItemVideo = createUploader({
    field: 'video',
    folder: 'items/videos',
    allowedTypes: {
        'video/mp4': '.mp4',
        'video/webm': '.webm',
        'video/quicktime': '.mov'
    },
    allowedExtensions: {
        'video/mp4': 'mp4',
        'video/webm': 'webm',
        'video/quicktime': 'mov'
    },
    maxSize: 15 * MB,
    typeMessage: 'Only MP4, WebM or MOV videos are allowed',
    sizeMessage: 'Video must be smaller than 15MB'
});


const uploadBannerImage = createMultiUploader({
    fields: ['image', 'mobile_image'],
    folder: 'homepage/banners',
    allowedTypes: {
        'image/jpeg': '.jpg',
        'image/png': '.png',
    },
    allowedExtensions: {
        'image/jpeg': 'jpg',
        'image/png': 'png',
    },
    maxSize: 5 * MB,
    typeMessage: 'Only PNG and JPG banner images are allowed',
    sizeMessage: 'Each banner image must be smaller than 5MB',
});


const uploadCategoryImage = createUploader({
    field: 'image',
    folder: 'categories/images',
    allowedTypes: {
        'image/jpeg': '.jpg',
        'image/png': '.png',
    },
    allowedExtensions: {
        'image/jpeg': 'jpg',
        'image/png': 'png',
    },
    maxSize: 5 * MB,
    typeMessage: 'Only PNG and JPG category images are allowed',
    sizeMessage: 'Category image must be smaller than 5MB',
});

const uploadCampaignFrame = createUploader({
    field: 'frame',
    folder: 'campaigns/frames',
    allowedTypes: {
        'image/png': '.png',
        'image/webp': '.webp',
    },
    allowedExtensions: {
        'image/png': 'png',
        'image/webp': 'webp',
    },
    maxSize: 2 * MB,
    typeMessage: 'Only transparent PNG and WebP campaign frames are allowed',
    sizeMessage: 'Campaign frame must be smaller than 2MB',
});

const uploadBrandImage = createUploader({
    field: 'image',
    folder: 'brands/images',
    allowedTypes: {
        'image/jpeg': '.jpg',
        'image/png': '.png',
    },
    allowedExtensions: {
        'image/jpeg': 'jpg',
        'image/png': 'png',
    },
    maxSize: 5 * MB,
    typeMessage: 'Only PNG and JPG brand images are allowed',
    sizeMessage: 'Brand image must be smaller than 5MB',
});

module.exports = {
    uploadItemImage,
    uploadItemVideo,
    uploadCategoryImage,
    uploadBannerImage,
    uploadBrandImage,
    uploadCampaignFrame,
};
