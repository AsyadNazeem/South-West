'use strict';

const fs = require('fs');
const path = require('path');

const RESPONSIVE_IMAGE_WIDTHS = Object.freeze({
    products: [320, 640, 1200],
    categories: [160, 320, 640],
    brands: [160, 320, 640],
    banners: [640, 960, 1440, 1800],
});

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

// Returns only existing Phase 1 variants. Pass a new Map per request so
// repeated paths share asynchronous directory reads without stale global data.
const getResponsiveImageMetadata = async (
    filePath,
    mediaType,
    directoryCache = new Map()
) => {
    const widths = RESPONSIVE_IMAGE_WIDTHS[mediaType];
    if (!widths || typeof filePath !== 'string' || !filePath.trim()) return [];

    let candidate = filePath.trim();
    if (/^https?:\/\//i.test(candidate)) return [];

    candidate = candidate.replace(/\\/g, '/');
    if (candidate.startsWith('/uploads/')) {
        candidate = candidate.slice('/uploads/'.length);
    } else if (candidate.startsWith('uploads/')) {
        candidate = candidate.slice('uploads/'.length);
    } else if (candidate.startsWith('/')) {
        return [];
    }

    const normalized = path.posix.normalize(candidate);
    if (
        normalized === '.' ||
        normalized === '..' ||
        normalized.startsWith('../') ||
        path.posix.isAbsolute(normalized)
    ) return [];

    const filenameMatch = path.posix.basename(normalized).match(
        /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.webp$/i
    );
    if (!filenameMatch) return [];

    const relativeDirectory = path.posix.dirname(normalized);
    const absoluteDirectory = path.resolve(UPLOAD_ROOT, relativeDirectory);
    if (!absoluteDirectory.startsWith(UPLOAD_ROOT + path.sep)) return [];

    let namesPromise = directoryCache.get(absoluteDirectory);
    if (!namesPromise) {
        namesPromise = fs.promises.readdir(absoluteDirectory, { withFileTypes: true })
            .then(entries => new Set(
                entries.filter(entry => entry.isFile()).map(entry => entry.name)
            ))
            .catch(() => null);
        directoryCache.set(absoluteDirectory, namesPromise);
    }

    const names = await namesPromise;
    const baseName = filenameMatch[0];
    if (!names || !names.has(baseName)) return [];

    const baseUuid = filenameMatch[1];
    return widths
        .filter((width) => names.has(`${baseUuid}-${width}.webp`))
        .map((width) => ({
            width,
            url: buildFileUrl(path.posix.join(
                relativeDirectory,
                `${baseUuid}-${width}.webp`
            )),
        }));
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
    getResponsiveImageMetadata,
    removeStoredFile,
    removeStoredImage
};
