'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Readable } = require('stream');
const proxyquire = require('proxyquire').noCallThru();

const uploadRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'southwest-responsive-images-'));
process.env.UPLOAD_ROOT = uploadRoot;

const sharp = require('sharp');
const {
    generateResponsiveWebpVariants,
    RESPONSIVE_WIDTHS,
    uploadItemImage,
    uploadCategoryImage,
    uploadBrandImage,
    uploadBannerImage
} = proxyquire('../middleware/uploadMiddleware', {
    'p-limit': { default: () => (callback) => callback() }
});
const noReferences = { count: async () => 0 };
const fileStorage = proxyquire('../utils/fileStorage', {
    '../models': {
        ItemImage: noReferences,
        Category: noReferences,
        Brand: noReferences,
        HomepageBanner: noReferences,
        Sequelize: { Op: { like: Symbol('like'), or: Symbol('or') } }
    }
});

async function createImage(filePath, width, height) {
    const svg = Buffer.from(
        `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="none"/><circle cx="${width / 2}" cy="${height / 2}" r="${Math.min(width, height) / 3}" fill="#2475c5"/></svg>`
    );
    await sharp(svg).png().toFile(filePath);
}

async function createImageBuffer(width, height) {
    const svg = Buffer.from(
        `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="none"/><circle cx="${width / 2}" cy="${height / 2}" r="${Math.min(width, height) / 3}" fill="#2475c5"/></svg>`
    );
    return sharp(svg).png().toBuffer();
}

function multipartBody(files, fields = []) {
    const boundary = `----southwest-${Math.random().toString(16).slice(2)}`;
    const parts = [];

    for (const [name, value] of fields) {
        parts.push(Buffer.from(
            `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`
        ));
    }

    for (const { field, buffer } of files) {
        parts.push(Buffer.from(
            `--${boundary}\r\nContent-Disposition: form-data; name="${field}"; filename="fixture.png"\r\nContent-Type: image/png\r\n\r\n`
        ));
        parts.push(buffer);
        parts.push(Buffer.from('\r\n'));
    }

    parts.push(Buffer.from(`--${boundary}--\r\n`));
    return { boundary, body: Buffer.concat(parts) };
}

async function invokeUpload(middleware, files) {
    const { boundary, body } = multipartBody(files);
    const req = Readable.from([body]);
    req.headers = {
        'content-type': `multipart/form-data; boundary=${boundary}`,
        'content-length': String(body.length)
    };
    req.method = 'POST';
    req.url = '/';

    const EventEmitter = require('events');
    const res = new EventEmitter();
    res.statusCode = 200;
    res.status = function (code) {
        this.statusCode = code;
        return this;
    };
    return new Promise((resolve, reject) => {
      res.json = function (value) {
        this.body = value;
        resolve({ req, res });
      };

      middleware(req, res, (error) => {
          if (error) reject(error);
          else resolve({ req, res });
      });
    });
}

test('generates responsive variants at requested widths and preserves alpha/aspect ratio', async () => {
    const sourcePath = path.join(uploadRoot, 'transparent-source.png');
    const fallbackPath = path.join(uploadRoot, 'e7da54fa-9b02-4e87-a380-c1c8251e113d.webp');
    const generatedPaths = new Set([fallbackPath]);
    await createImage(sourcePath, 1500, 1000);
    await sharp(sourcePath).rotate().webp({ quality: 85 }).toFile(fallbackPath);

    const variants = await generateResponsiveWebpVariants(
        sourcePath,
        fallbackPath,
        [320, 640, 1200, 1800],
        generatedPaths
    );

    assert.deepEqual(variants.map((filePath) => path.basename(filePath)), [
        'e7da54fa-9b02-4e87-a380-c1c8251e113d-320.webp',
        'e7da54fa-9b02-4e87-a380-c1c8251e113d-640.webp',
        'e7da54fa-9b02-4e87-a380-c1c8251e113d-1200.webp'
    ]);

    for (const [index, expectedWidth] of [320, 640, 1200].entries()) {
        const metadata = await sharp(variants[index]).metadata();
        assert.equal(metadata.width, expectedWidth);
        assert.equal(metadata.height, Math.round(expectedWidth * 2 / 3));
        assert.equal(metadata.format, 'webp');
        assert.equal(metadata.hasAlpha, true);
    }
});

test('upload presets cover product, category, brand and banner targets', () => {
    assert.deepEqual(RESPONSIVE_WIDTHS.products, [320, 640, 1200]);
    assert.deepEqual(RESPONSIVE_WIDTHS.square, [160, 320, 640]);
    assert.deepEqual(RESPONSIVE_WIDTHS.banners, [640, 960, 1440, 1800]);
});

test('product, category and brand uploads retain fallback paths and write variants', async () => {
    const source = await createImageBuffer(1500, 1000);
    const uploadCases = [
        { middleware: uploadItemImage, folder: 'items/images', widths: [320, 640, 1200] },
        { middleware: uploadCategoryImage, folder: 'categories/images', widths: [160, 320, 640] },
        { middleware: uploadBrandImage, folder: 'brands/images', widths: [160, 320, 640] }
    ];

    for (const uploadCase of uploadCases) {
        const { req, res } = await invokeUpload(uploadCase.middleware, [
            { field: 'image', buffer: source }
        ]);
        assert.equal(res.statusCode, 200);
        assert.equal(req.file.relativePath, `${uploadCase.folder}/${req.file.filename}`);
        assert.match(req.file.filename, /^[0-9a-f-]+\.webp$/i);

        const basePath = path.join(uploadRoot, req.file.relativePath);
        assert.equal((await sharp(basePath).metadata()).format, 'webp');
        for (const width of uploadCase.widths.filter((value) => value < 1500)) {
            const variantPath = basePath.replace('.webp', `-${width}.webp`);
            const metadata = await sharp(variantPath).metadata();
            assert.equal(metadata.width, width);
            assert.equal(metadata.height, Math.round(width * 2 / 3));
        }
    }
});

test('homepage desktop and mobile banner uploads create aspect-ratio-preserving variants', async () => {
    const desktop = await createImageBuffer(1800, 600);
    const mobile = await createImageBuffer(1200, 900);
    const { req, res } = await invokeUpload(uploadBannerImage, [
        { field: 'image', buffer: desktop },
        { field: 'mobile_image', buffer: mobile }
    ]);
    assert.equal(res.statusCode, 200);

    for (const field of ['image', 'mobile_image']) {
        const file = req.files[field][0];
        const basePath = path.join(uploadRoot, file.relativePath);
        const base = await sharp(basePath).metadata();
        assert.equal(base.format, 'webp');
        const expectedHeight = field === 'image' ? 600 : 900;
        for (const width of RESPONSIVE_WIDTHS.banners.filter((value) => value < base.width)) {
            const variant = await sharp(basePath.replace('.webp', `-${width}.webp`)).metadata();
            assert.equal(variant.width, width);
            assert.equal(variant.height, Math.round(width * expectedHeight / base.width));
        }
    }
});

test('does not upscale small images and removes partial output after processing failure', async () => {
    const smallPath = path.join(uploadRoot, 'small.png');
    const smallFallback = path.join(uploadRoot, 'b2ab1a8d-b045-4f6c-bc47-8268b5c72d68.webp');
    await createImage(smallPath, 80, 60);
    await sharp(smallPath).webp().toFile(smallFallback);
    const smallVariants = await generateResponsiveWebpVariants(
        smallPath,
        smallFallback,
        [160, 320, 640],
        new Set([smallFallback])
    );
    assert.deepEqual(smallVariants, []);

    const sourcePath = path.join(uploadRoot, 'partial-source.png');
    const fallbackPath = path.join(uploadRoot, 'af0c9a8c-40b6-45a2-bfd4-4510d46601a3.webp');
    await createImage(sourcePath, 1000, 700);
    await sharp(sourcePath).webp().toFile(fallbackPath);
    const blockedVariantPath = fallbackPath.replace('.webp', '-640.webp');
    fs.mkdirSync(blockedVariantPath);
    const generatedPaths = new Set([fallbackPath]);

    await assert.rejects(
        generateResponsiveWebpVariants(sourcePath, fallbackPath, [320, 640], generatedPaths)
    );
    assert.equal(fs.existsSync(fallbackPath.replace('.webp', '-320.webp')), false);
    assert.equal(fs.existsSync(blockedVariantPath), true);
});

test('removing an unreferenced UUID WebP removes its responsive siblings', async () => {
    const relative = 'items/images/da5e6fd1-c033-4d6c-8d4a-bb3fa42d2a5e.webp';
    const directory = path.join(uploadRoot, 'items/images');
    fs.mkdirSync(directory, { recursive: true });
    for (const suffix of ['', '-320', '-640', '-1200']) {
        fs.writeFileSync(path.join(directory, `da5e6fd1-c033-4d6c-8d4a-bb3fa42d2a5e${suffix}.webp`), 'test');
    }

    const result = await fileStorage.removeStoredImage(relative);
    assert.equal(result.status, 'deleted');
    for (const suffix of ['', '-320', '-640', '-1200']) {
        assert.equal(
            fs.existsSync(path.join(directory, `da5e6fd1-c033-4d6c-8d4a-bb3fa42d2a5e${suffix}.webp`)),
            false
        );
    }
});

test('retains a shared image and its variants while another row references it', async () => {
    const sharedPath = 'categories/images/7e7c3542-2caf-4716-8ed6-4f75b621a4af.webp';
    const directory = path.join(uploadRoot, 'categories/images');
    fs.mkdirSync(directory, { recursive: true });
    const basePath = path.join(directory, '7e7c3542-2caf-4716-8ed6-4f75b621a4af.webp');
    const variantPath = path.join(directory, '7e7c3542-2caf-4716-8ed6-4f75b621a4af-320.webp');
    fs.writeFileSync(basePath, 'base');
    fs.writeFileSync(variantPath, 'variant');

    const referencedStorage = proxyquire('../utils/fileStorage', {
        '../models': {
            ItemImage: noReferences,
            Category: { count: async () => 1 },
            Brand: noReferences,
            HomepageBanner: noReferences,
            Sequelize: { Op: { like: Symbol('like'), or: Symbol('or') } }
        }
    });

    const result = await referencedStorage.removeStoredImage(sharedPath);
    assert.equal(result.status, 'referenced');
    assert.equal(fs.existsSync(basePath), true);
    assert.equal(fs.existsSync(variantPath), true);
});

test('cleans temporary test files', () => {
    fs.rmSync(uploadRoot, { recursive: true, force: true });
    assert.equal(fs.existsSync(uploadRoot), false);
});
