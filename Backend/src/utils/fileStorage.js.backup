'use strict';

const fs = require('fs');
const path = require('path');

// <project root>/uploads  (served at /uploads)
const UPLOAD_ROOT = path.resolve(__dirname, '..', 'uploads');

// file_path is stored relative to UPLOAD_ROOT, e.g. "items/images/<uuid>.jpg"
const buildFileUrl = (filePath) => {
    if (!filePath) return null;

    // Legacy rows may hold a full URL or an absolute path
    if (/^https?:\/\//i.test(filePath)) return filePath;

    const base = (process.env.FILE_BASE_URL || '').replace(/\/$/, '');

    if (filePath.startsWith('/')) return `${base}${filePath}`;

    return `${base}/uploads/${filePath}`;
};

// Deletes a stored file. Silently ignores missing files and anything
// outside UPLOAD_ROOT (legacy URLs, unsafe paths).
const removeStoredFile = async (filePath) => {
    if (!filePath) return;

    const absolute = path.resolve(UPLOAD_ROOT, filePath);

    if (!absolute.startsWith(UPLOAD_ROOT + path.sep)) return;

    try {
        await fs.promises.unlink(absolute);
    } catch (error) {
        if (error.code !== 'ENOENT') {
            console.error('Failed to remove file:', absolute, error);
        }
    }
};

module.exports = {
    UPLOAD_ROOT,
    buildFileUrl,
    removeStoredFile
};
