'use strict';

const fs = require('fs');
const path = require('path');

// <project root>/uploads  (served at /uploads)
const UPLOAD_ROOT = path.resolve(
    process.env.UPLOAD_ROOT || path.resolve(__dirname, '..', 'uploads')
);

// file_path is stored relative to UPLOAD_ROOT, e.g. "items/images/<uuid>.jpg"
const buildFileUrl = (filePath) => {
    if (!filePath) return null;

    // Legacy rows may hold a full URL or an absolute path
    if (/^https?:\/\//i.test(filePath)) return filePath;

    const base = (process.env.FILE_BASE_URL || '').replace(/\/$/, '');

    if (filePath.startsWith('/')) return `${base}${filePath}`;

    return `${base}/uploads/${filePath}`;
};

// Deletes a stored file and returns a status.
// Missing files and invalid paths are reported without throwing.
const removeStoredFile = async (filePath) => {
    if (!filePath || typeof filePath !== 'string') {
        return { status: 'invalid_path' };
    }

    // Only accept paths relative to UPLOAD_ROOT.
    if (path.isAbsolute(filePath) || /^https?:\/\//i.test(filePath)) {
        return { status: 'invalid_path' };
    }

    const absolute = path.resolve(UPLOAD_ROOT, filePath);

    // Prevent path traversal outside the upload directory.
    if (!absolute.startsWith(UPLOAD_ROOT + path.sep)) {
        return { status: 'invalid_path' };
    }

    try {
        await fs.promises.unlink(absolute);
        return { status: 'deleted' };
    } catch (error) {
        if (error.code === 'ENOENT') {
            return { status: 'missing' };
        }

        console.error('Failed to remove stored file:', error.code || error.message);
        return { status: 'failed' };
    }
};

function normalizeUploadPath(filePath) {
    if (typeof filePath !== 'string' || !filePath.trim()) return null;

    let candidate = filePath.trim();

    if (/^https?:\/\//i.test(candidate)) {
        try {
            candidate = new URL(candidate).pathname;
        } catch {
            return null;
        }
    }

    candidate = candidate.replace(/\\/g, '/');
    if (candidate.startsWith('/uploads/')) {
        candidate = candidate.slice('/uploads/'.length);
    } else if (candidate.startsWith('uploads/')) {
        candidate = candidate.slice('uploads/'.length);
    }

    if (path.isAbsolute(candidate)) return null;

    const absolute = path.resolve(UPLOAD_ROOT, candidate);
    if (!absolute.startsWith(UPLOAD_ROOT + path.sep)) return null;

    return candidate;
}

// Removes an uploaded image and its predictable responsive siblings. UUID
// paths are checked against every image-bearing table first so a shared path
// is retained while any record still references it.
const removeStoredImage = async (filePath) => {
    const relativePath = normalizeUploadPath(filePath);
    if (!relativePath) return { status: 'invalid_path' };

    const filename = path.posix.basename(relativePath);
    const match = filename.match(/^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.(webp|png|jpe?g)$/i);

    if (!match) return removeStoredFile(relativePath);

    let references;
    try {
        const { ItemImage, Category, Brand, HomepageBanner, Sequelize } = require('../models');
        const { Op } = Sequelize;
        const referencePattern = `%/${filename}`;
        references = await Promise.all([
            ItemImage.count({ where: { file_path: { [Op.like]: referencePattern } } }),
            Category.count({ where: { image_url: { [Op.like]: referencePattern } } }),
            Brand.count({ where: { image_url: { [Op.like]: referencePattern } } }),
            HomepageBanner.count({
                where: {
                    [Op.or]: [
                        { image_path: { [Op.like]: referencePattern } },
                        { mobile_image_path: { [Op.like]: referencePattern } }
                    ]
                }
            })
        ]);
    } catch (error) {
        console.error('Unable to verify image references before cleanup:', error.message);
        return { status: 'failed' };
    }

    if (references.some((count) => count > 0)) {
        return { status: 'referenced' };
    }

    const baseResult = await removeStoredFile(relativePath);
    if (baseResult.status === 'invalid_path') return baseResult;

    if (match[2].toLowerCase() !== 'webp') return baseResult;

    const variantWidths = [160, 320, 640, 960, 1200, 1440, 1800];
    const variantResults = await Promise.all(variantWidths.map((width) =>
        removeStoredFile(path.posix.join(
            path.posix.dirname(relativePath),
            `${match[1]}-${width}.webp`
        ))
    ));

    return [baseResult, ...variantResults].some((result) => result.status === 'failed')
        ? { status: 'failed' }
        : baseResult;
};


module.exports = {
    UPLOAD_ROOT,
    buildFileUrl,
    removeStoredFile,
    removeStoredImage
};
