'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { EventEmitter } = require('events');
const { Readable } = require('stream');
const proxyquire = require('proxyquire').noCallThru();
const sharp = require('sharp');

const uploadRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'southwest-banner-commit-test-'));
process.env.UPLOAD_ROOT = uploadRoot;

const cleanupTasks = [];
let committed = false;
const variantWidths = [160, 320, 640, 960, 1200, 1440, 1800];

async function mockedRemoveStoredImage(relativePath) {
    const cleanup = (async () => {
        if (committed) return { status: 'referenced' };

        const absolutePath = path.join(uploadRoot, relativePath);
        const extension = path.extname(absolutePath);
        const basePath = absolutePath.slice(0, -extension.length);
        await Promise.all([
            absolutePath,
            ...variantWidths.map((width) => `${basePath}-${width}.webp`)
        ].map((filePath) => fs.promises.unlink(filePath).catch((error) => {
            if (error.code !== 'ENOENT') throw error;
        })));

        return { status: 'deleted' };
    })();

    cleanupTasks.push(cleanup);
    return cleanup;
}

const { uploadBannerImage } = proxyquire('../middleware/uploadMiddleware', {
    'p-limit': { default: () => (callback) => callback() },
    '../utils/fileStorage': {
        UPLOAD_ROOT: uploadRoot,
        removeStoredImage: mockedRemoveStoredImage
    }
});

async function imageBuffer(width, height) {
    const svg = Buffer.from(
        `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#174875"/></svg>`
    );
    return sharp(svg).png().toBuffer();
}

function createMultipartRequest(files) {
    const boundary = '----southwest-banner-commit-regression';
    const chunks = [];

    for (const { field, buffer } of files) {
        chunks.push(Buffer.from(
            `--${boundary}\r\nContent-Disposition: form-data; name="${field}"; filename="banner.png"\r\nContent-Type: image/png\r\n\r\n`
        ));
        chunks.push(buffer, Buffer.from('\r\n'));
    }
    chunks.push(Buffer.from(`--${boundary}--\r\n`));
    const body = Buffer.concat(chunks);
    const req = Readable.from([body]);
    req.headers = {
        'content-type': `multipart/form-data; boundary=${boundary}`,
        'content-length': String(body.length)
    };
    req.method = 'POST';
    req.url = '/';
    req.ip = '127.0.0.1';
    req.get = () => 'regression-test';
    return req;
}

function createResponse() {
    const res = new EventEmitter();
    res.statusCode = 200;
    res.status = function (code) {
        this.statusCode = code;
        return this;
    };
    res.json = function (body) {
        this.body = body;
        if (this.statusCode === 201) {
            throw new Error('Simulated success response construction failure');
        }
        this.emit('finish');
        return this;
    };
    return res;
}

async function uploadTestBanners() {
    const req = createMultipartRequest([
        { field: 'image', buffer: await imageBuffer(1800, 600) },
        { field: 'mobile_image', buffer: await imageBuffer(1200, 900) }
    ]);
    const res = createResponse();

    await new Promise((resolve, reject) => {
        uploadBannerImage(req, res, (error) => error ? reject(error) : resolve());
    });

    return { req, res };
}

function createController({ failBeforeCommit = false } = {}) {
    const bannerModel = {
        async count() {
            return 0;
        },
        async create(values) {
            if (failBeforeCommit) throw new Error('Simulated pre-commit database failure');

            let serializationCount = 0;
            return {
                ...values,
                id: 42,
                toJSON() {
                    serializationCount++;
                    if (serializationCount === 2) {
                        throw new Error('Simulated response serialization failure');
                    }
                    return { ...values, id: 42 };
                }
            };
        }
    };

    const sequelize = {
        async query() {
            return [{ id: 1 }];
        },
        async transaction(callback) {
            const result = await callback({});
            committed = true;
            return result;
        }
    };

    return proxyquire('../controllers/homepageBannerController', {
        '../models': { HomepageBanner: bannerModel, sequelize },
        '../utils/fileStorage': {
            UPLOAD_ROOT: uploadRoot,
            buildFileUrl: (filePath) => filePath ? `/uploads/${filePath}` : null,
            removeStoredImage: mockedRemoveStoredImage
        },
        '../services/auditLogService': { recordAuditLog: async () => {} }
    });
}

function uploadedImagePaths(req) {
    return ['image', 'mobile_image'].flatMap((field) => {
        const file = req.files[field][0];
        const base = path.join(uploadRoot, file.relativePath);
        const stem = base.slice(0, -path.extname(base).length);
        return [base, ...variantWidths.map((width) => `${stem}-${width}.webp`)]
            .filter((filePath) => fs.existsSync(filePath));
    });
}

test('keeps committed banner originals and variants after success response failure', async () => {
    committed = false;
    cleanupTasks.length = 0;
    const { req, res } = await uploadTestBanners();
    const before = uploadedImagePaths(req);
    assert.equal(before.length > 2, true);

    await createController().createBanner(req, res);
    await Promise.all(cleanupTasks);

    assert.equal(committed, true);
    assert.equal(res.statusCode, 500);
    for (const filePath of before) assert.equal(fs.existsSync(filePath), true, filePath);
});

test('cleans uploaded banner originals and variants when creation fails before commit', async () => {
    committed = false;
    cleanupTasks.length = 0;
    const { req, res } = await uploadTestBanners();
    const before = uploadedImagePaths(req);
    assert.equal(before.length > 2, true);

    await createController({ failBeforeCommit: true }).createBanner(req, res);
    await Promise.all(cleanupTasks);

    assert.equal(committed, false);
    assert.equal(res.statusCode, 500);
    for (const filePath of before) assert.equal(fs.existsSync(filePath), false, filePath);
});

test('cleans temporary test files', () => {
    fs.rmSync(uploadRoot, { recursive: true, force: true });
    assert.equal(fs.existsSync(uploadRoot), false);
});
