'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');

const { UPLOAD_ROOT } = require('../utils/fileStorage');

class UploadError extends Error {}

const MB = 1024 * 1024;

const createUploader = ({
                            field,
                            folder,
                            allowedTypes, // { mimeType: extension }
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

            if (req.file) {
                // Path relative to UPLOAD_ROOT, saved in the database
                req.file.relativePath = path.posix.join(folder, req.file.filename);
            }

            next();
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
    maxSize: 15 * MB,
    typeMessage: 'Only MP4, WebM or MOV videos are allowed',
    sizeMessage: 'Video must be smaller than 15MB'
});

module.exports = {
    uploadItemImage,
    uploadItemVideo
};
