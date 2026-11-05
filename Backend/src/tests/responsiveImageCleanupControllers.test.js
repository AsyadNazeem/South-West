'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const proxyquire = require('proxyquire').noCallThru();

const uploadRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'southwest-image-cleanup-controller-test-'));
process.env.UPLOAD_ROOT = uploadRoot;

function responseMock() {
    return {
        statusCode: null,
        body: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(body) {
            this.body = body;
            return this;
        }
    };
}

function bannerHarness(initialValues) {
    const cleanupPaths = [];
    const banner = {
        ...initialValues,
        id: 7,
        async update(changes) {
            Object.assign(this, changes);
        },
        async destroy() {
            this.destroyed = true;
        },
        toJSON() {
            return {
                id: this.id,
                image_path: this.image_path,
                mobile_image_path: this.mobile_image_path,
                title: this.title ?? null,
                subtitle: this.subtitle ?? null,
                button_text: this.button_text ?? null,
                link_url: this.link_url ?? null,
                sort_order: this.sort_order ?? 0,
                is_active: this.is_active ?? false,
                start_at: this.start_at ?? null,
                end_at: this.end_at ?? null
            };
        }
    };

    const sequelize = {
        async transaction(callback) {
            return callback({ LOCK: { UPDATE: 'UPDATE' } });
        }
    };
    const controller = proxyquire('../controllers/homepageBannerController', {
        '../models': {
            HomepageBanner: {
                async findByPk() {
                    return banner;
                }
            },
            sequelize
        },
        '../utils/fileStorage': {
            UPLOAD_ROOT: uploadRoot,
            buildFileUrl: (filePath) => filePath ? `/uploads/${filePath}` : null,
            async getResponsiveImageMetadata() { return []; },
            async removeStoredImage(filePath) {
                cleanupPaths.push(filePath);
                return { status: 'referenced' };
            }
        },
        '../services/auditLogService': { recordAuditLog: async () => {} }
    });

    return { controller, banner, cleanupPaths };
}

function bannerRequest(files = {}) {
    return {
        params: { id: '7' },
        body: {},
        files,
        ip: '127.0.0.1',
        get: () => 'test'
    };
}

function uploadedFile(folder, filename) {
    const absolutePath = path.join(uploadRoot, folder, filename);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, 'fixture');
    return { path: absolutePath, filename };
}

test('desktop-only and mobile-only banner replacement preserve the other path', async () => {
    const cases = [
        {
            field: 'image',
            initial: {
                image_path: 'homepage/banners/old-desktop.webp',
                mobile_image_path: 'homepage/banners/old-mobile.webp'
            },
            expected: {
                image_path: 'homepage/banners/new-desktop.webp',
                mobile_image_path: 'homepage/banners/old-mobile.webp'
            },
            removed: 'homepage/banners/old-desktop.webp'
        },
        {
            field: 'mobile_image',
            initial: {
                image_path: 'homepage/banners/old-desktop.webp',
                mobile_image_path: 'homepage/banners/old-mobile.webp'
            },
            expected: {
                image_path: 'homepage/banners/old-desktop.webp',
                mobile_image_path: 'homepage/banners/new-mobile.webp'
            },
            removed: 'homepage/banners/old-mobile.webp'
        }
    ];

    for (const item of cases) {
        const harness = bannerHarness(item.initial);
        const isDesktop = item.field === 'image';
        const file = uploadedFile(
            'homepage/banners',
            isDesktop ? 'new-desktop.webp' : 'new-mobile.webp'
        );
        const req = bannerRequest({ [item.field]: [file] });
        const res = responseMock();

        await harness.controller.updateBanner(req, res);

        assert.equal(res.statusCode, 200);
        assert.equal(harness.banner.image_path, item.expected.image_path);
        assert.equal(harness.banner.mobile_image_path, item.expected.mobile_image_path);
        assert.deepEqual(harness.cleanupPaths, [item.removed]);
    }
});

test('banner deletion delegates path cleanup to reference-aware image storage', async () => {
    const sharedPath = 'homepage/banners/shared.webp';
    const harness = bannerHarness({
        image_path: sharedPath,
        mobile_image_path: sharedPath
    });
    const res = responseMock();

    await harness.controller.deleteBanner(bannerRequest(), res);

    assert.equal(res.statusCode, 200);
    assert.equal(harness.banner.destroyed, true);
    assert.deepEqual(harness.cleanupPaths, [sharedPath]);
});

test('item-image deletion delegates cleanup to reference-aware image storage after commit', async () => {
    const filePath = 'items/images/8c6339fb-2dbd-4900-94fd-74f939a47c8c.webp';
    const cleanupPaths = [];
    const calls = { committed: false };
    const image = {
        id: 12,
        item_id: 31,
        file_path: filePath,
        file_name: 'image.webp',
        mime_type: 'image/webp',
        file_size: 10,
        alt_text: null,
        sort_order: 0,
        is_primary: false,
        is_active: true,
        async destroy() {
            this.destroyed = true;
        }
    };
    const transaction = {
        finished: false,
        LOCK: { UPDATE: 'UPDATE' },
        async commit() {
            calls.committed = true;
            this.finished = 'commit';
        },
        async rollback() {
            this.finished = 'rollback';
        }
    };
    const controller = proxyquire('../controllers/itemImageController', {
        '../models': {
            ItemImage: {
                async findByPk() {
                    return image;
                },
                async findOne() {
                    return null;
                }
            },
            Item: {},
            sequelize: { async transaction() { return transaction; } }
        },
        '../utils/fileStorage': {
            async removeStoredImage(pathname) {
                assert.equal(calls.committed, true);
                cleanupPaths.push(pathname);
                return { status: 'referenced' };
            }
        },
        '../services/auditLogService': { recordAuditLog: async () => {} }
    });
    const res = responseMock();

    await controller.deleteItemImage({
        params: { id: '12' },
        user: { id: 1 },
        ip: '127.0.0.1',
        get: () => 'test'
    }, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(cleanupPaths, [filePath]);
});

test('cleans temporary test files', () => {
    fs.rmSync(uploadRoot, { recursive: true, force: true });
    assert.equal(fs.existsSync(uploadRoot), false);
});
