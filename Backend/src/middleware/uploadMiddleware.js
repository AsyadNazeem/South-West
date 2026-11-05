'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFile } = require('child_process');
const { promisify } = require('util');
const multer = require('multer');
const sharp = require('sharp');
const pLimit = require('p-limit').default;

const execFileAsync = promisify(execFile);
const limitVideoConversion = pLimit(1);
const FFMPEG_PATH = process.env.FFMPEG_PATH || 'ffmpeg';

const { UPLOAD_ROOT, removeStoredImage } = require('../utils/fileStorage');

const detectFileType = async (filePath) => {
    const { fileTypeFromFile } = await import('file-type');
    return fileTypeFromFile(filePath);
};

class UploadError extends Error {}

const MB = 1024 * 1024;
const RESPONSIVE_WIDTHS = Object.freeze({
    products: [320, 640, 1200],
    square: [160, 320, 640],
    banners: [640, 960, 1440, 1800]
});

async function generateResponsiveWebpVariants(sourcePath, fallbackPath, widths, generatedPaths) {
    if (!/\.webp$/i.test(fallbackPath)) {
        throw new Error('Responsive variant fallback path must be WebP');
    }

    const metadata = await sharp(sourcePath).metadata();
    const rotated = [5, 6, 7, 8].includes(metadata.orientation);
    const sourceWidth = rotated ? metadata.height : metadata.width;

    if (!sourceWidth) {
        throw new Error('Unable to determine uploaded image dimensions');
    }

    const generated = [];

    try {
        for (const width of [...new Set(widths)].sort((a, b) => a - b)) {
            if (!Number.isInteger(width) || width < 1) {
                throw new Error('Responsive image widths must be positive integers');
            }
            if (width >= sourceWidth) continue;

            const variantPath = fallbackPath.replace(/\.webp$/i, `-${width}.webp`);
            generatedPaths.add(variantPath);
            generated.push(variantPath);

            await sharp(sourcePath)
                .rotate()
                .resize({ width, withoutEnlargement: true })
                .webp({ quality: 85, effort: 4 })
                .toFile(variantPath);
        }

        return generated;
    } catch (error) {
        await Promise.all(generated.map((variantPath) =>
            fs.promises.unlink(variantPath).catch(() => {})
        ));
        for (const variantPath of generated) generatedPaths.delete(variantPath);
        throw error;
    }
}

function removeFailedImageUploadOnResponse(res, relativePaths) {
    if (!relativePaths.length) return;

    res.once('finish', () => {
        if (res.statusCode < 400) return;

        void Promise.all(relativePaths.map((relativePath) =>
            removeStoredImage(relativePath)
        )).then((results) => {
            if (results.some((result) => result.status === 'failed')) {
                console.error('Image upload cleanup requires follow-up.');
            }
        }).catch((error) => {
            console.error('Failed to clean up rejected image upload:', error.message);
        });
    });
}

const convertVideoToWebm = async (file, directory, folder) => {
    return limitVideoConversion(async () => {
        const filename = `${crypto.randomUUID()}.webm`;
        const outputPath = path.join(directory, filename);

        const args = [
            '-hide_banner',
            '-loglevel', 'error',
            '-y',
            '-i', file.path,
            '-map', '0:v:0',
            '-map', '0:a:0?',
            '-sn',
            '-dn',
            '-vf',
            "scale='min(1920,iw)':'min(1920,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2",
            '-c:v', 'libvpx-vp9',
            '-deadline', 'realtime',
            '-cpu-used', '8',
            '-row-mt', '1',
            '-threads', '2',
            '-crf', '34',
            '-b:v', '0',
            '-pix_fmt', 'yuv420p',
            '-c:a', 'libopus',
            '-b:a', '96k',
            '-f', 'webm',
            outputPath
        ];

        try {
            await execFileAsync(FFMPEG_PATH, args, {
                timeout: 120000,
                maxBuffer: 10 * MB
            });

            const outputStats = await fs.promises.stat(outputPath);

            if (!outputStats.size) {
                throw new Error('FFmpeg produced an empty output file');
            }

            await fs.promises.unlink(file.path);

            file.path = outputPath;
            file.filename = filename;
            file.mimetype = 'video/webm';
            file.size = outputStats.size;
            file.relativePath = path.posix.join(folder, filename);

            return file;
        } catch (error) {
            await fs.promises.unlink(outputPath).catch(() => {});
            throw error;
        }
    });
};

const createUploader = ({
                            field,
                            folder,
                            allowedTypes,
                            allowedExtensions,
                            maxSize,
                            typeMessage,
                            sizeMessage,
                            convertToWebp = false,
                            convertToWebm = false,
                            responsiveWidths = []
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
                let convertedPath = null;
                const generatedPaths = new Set();

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

                    if (convertToWebp) {
                        const filename = `${crypto.randomUUID()}.webp`;
                        const outputPath = path.join(directory, filename);
                        convertedPath = outputPath;
                        generatedPaths.add(outputPath);

                        await sharp(req.file.path)
                            .rotate()
                            .webp({ quality: 85, effort: 4 })
                            .toFile(outputPath);

                        if (responsiveWidths.length) {
                            await generateResponsiveWebpVariants(
                                req.file.path,
                                outputPath,
                                responsiveWidths,
                                generatedPaths
                            );
                        }

                        const outputStats = await fs.promises.stat(outputPath);

                        await fs.promises.unlink(req.file.path);

                        req.file.path = outputPath;
                        req.file.filename = filename;
                        req.file.mimetype = 'image/webp';
                        req.file.size = outputStats.size;
                    }

                    if (convertToWebm) {
                        await convertVideoToWebm(req.file, directory, folder);
                    }

                    req.file.relativePath = path.posix.join(folder, req.file.filename);

                    removeFailedImageUploadOnResponse(
                        res,
                        convertToWebp ? [req.file.relativePath] : []
                    );

                    return next();
                } catch (validationError) {
                    for (const cleanupPath of new Set([
                        req.file.path,
                        convertedPath,
                        ...generatedPaths
                    ])) {
                        if (!cleanupPath) continue;

                        try {
                            await fs.promises.unlink(cleanupPath);
                        } catch (cleanupError) {
                            if (cleanupError.code !== 'ENOENT') {
                                console.error(
                                    'Rejected upload cleanup failed:',
                                    cleanupError.code || cleanupError.message
                                );
                            }
                        }
                    }

                    console.error(
                        'File processing failed:',
                        validationError.message
                    );

                    if (convertToWebm) {
                        return res.status(400).json({
                            message: 'Unable to convert video. Please try another MP4, MOV or WebM file.'
                        });
                    }

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
    sizeMessage,
    convertToWebp = false
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
            const generatedPaths = new Set();

            const cleanupFiles = async () => {
                const paths = new Set([
                    ...uploadedFiles.map((file) => file.path),
                    ...generatedPaths
                ]);

                await Promise.all([...paths].map((filePath) =>
                    fs.promises.unlink(filePath).catch(() => {})
                ));
            };

            if (error) {
                await cleanupFiles();

                if (error instanceof multer.MulterError) {
                    return res.status(400).json({
                        message: error.code === 'LIMIT_FILE_SIZE'
                            ? sizeMessage
                            : error.code === 'LIMIT_UNEXPECTED_FILE'
                                ? 'Unexpected image field.'
                                : error.message
                    });
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
                        throw new UploadError(typeMessage);
                    }

                    if (convertToWebp) {
                        const metadata = await sharp(file.path).metadata();

                        const rotated = [5, 6, 7, 8].includes(metadata.orientation);
                        const actualWidth = rotated ? metadata.height : metadata.width;
                        const actualHeight = rotated ? metadata.width : metadata.height;

                        const isDesktopBanner = file.fieldname === 'image'

                        const hasValidAspectRatio = isDesktopBanner
                            ? actualWidth === actualHeight * 3
                            : actualWidth * 3 === actualHeight * 4

                        if (
                            !actualWidth ||
                            !actualHeight ||
                            !hasValidAspectRatio
                        ) {
                            throw new UploadError(
                                isDesktopBanner
                                    ? 'Desktop banner image must have an exact 3:1 aspect ratio.'
                                    : 'Mobile banner image must have an exact 4:3 aspect ratio.'
                            )
                        }

                        const filename = `${crypto.randomUUID()}.webp`;
                        const outputPath = path.join(directory, filename);

                        generatedPaths.add(outputPath);

                        await sharp(file.path)
                            .rotate()
                            .webp({ quality: 85, effort: 4 })
                            .toFile(outputPath);

                        await generateResponsiveWebpVariants(
                            file.path,
                            outputPath,
                            RESPONSIVE_WIDTHS.banners,
                            generatedPaths
                        );

                        await fs.promises.unlink(file.path);

                        file.path = outputPath;
                        file.filename = filename;
                        file.mimetype = 'image/webp';
                        file.size = (await fs.promises.stat(outputPath)).size;
                    }

                    file.relativePath = path.posix.join(folder, file.filename);
                }

                removeFailedImageUploadOnResponse(
                    res,
                    uploadedFiles.map((file) => file.relativePath).filter(Boolean)
                );

                return next();
            } catch (validationError) {
                await cleanupFiles();

                if (validationError instanceof UploadError) {
                    return res.status(400).json({
                        message: validationError.message
                    });
                }

                console.error('Banner image processing failed:', validationError);
                return res.status(400).json({
                    message: 'Unable to process banner image. Please use a valid JPG or PNG.'
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
    sizeMessage: 'Image must be smaller than 5MB',
    convertToWebp: true,
    responsiveWidths: RESPONSIVE_WIDTHS.products
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
    sizeMessage: 'Video must be smaller than 15MB',
    convertToWebm: true
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
    sizeMessage: 'Each banner image must not exceed 5 MB',
    convertToWebp: true,
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
    convertToWebp: true,
    responsiveWidths: RESPONSIVE_WIDTHS.square
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
    convertToWebp: true,
    responsiveWidths: RESPONSIVE_WIDTHS.square
});

module.exports = {
    uploadItemImage,
    uploadItemVideo,
    uploadCategoryImage,
    uploadBannerImage,
    uploadBrandImage,
    uploadCampaignFrame,
    generateResponsiveWebpVariants,
    RESPONSIVE_WIDTHS,
};
