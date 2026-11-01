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


module.exports = {
    UPLOAD_ROOT,
    buildFileUrl,
    removeStoredFile
};
