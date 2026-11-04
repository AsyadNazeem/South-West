'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const proxyquire = require('proxyquire').noCallThru();

const uploadRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), 'southwest-item-video-test-')
);

process.env.UPLOAD_ROOT = uploadRoot;

const calls = {
    rollback: 0,
    commit: 0,
    create: 0,
    audit: 0
};

const transaction = {
    finished: false,
    LOCK: { UPDATE: 'UPDATE' },

    async rollback() {
        calls.rollback++;
        this.finished = 'rollback';
    },

    async commit() {
        calls.commit++;
        this.finished = 'commit';
    }
};

const databaseError = new Error('Simulated database insert failure');

const controller = proxyquire(
    '../controllers/itemVideoController',
    {
        '../models': {
            Item: {
                async findByPk() {
                    return { id: 12 };
                }
            },
            ItemVideo: {
                async findOne() {
                    return null;
                },
                async create() {
                    calls.create++;
                    throw databaseError;
                }
            },
            sequelize: {
                async transaction() {
                    return transaction;
                }
            }
        },
        '../services/auditLogService': {
            async recordAuditLog() {
                calls.audit++;
            }
        }
    }
);

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

test('removes converted WebM when database insert fails', async () => {
    const relativePath = 'items/videos/database-failure-test.webm';
    const absolutePath = path.join(uploadRoot, relativePath);

    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, 'temporary converted WebM');

    assert.equal(fs.existsSync(absolutePath), true);

    const req = {
        file: {
            filename: 'database-failure-test.webm',
            relativePath,
            mimetype: 'video/webm',
            size: fs.statSync(absolutePath).size
        },
        body: {
            item_id: '12',
            is_active: 'true'
        },
        user: { id: 1 },
        ip: '127.0.0.1',
        id: 'video-upload-test',
        get() {
            return 'video-upload-test';
        }
    };

    const res = responseMock();

    await controller.createItemVideo(req, res);

    assert.equal(res.statusCode, 500);
    assert.equal(res.body.message, 'Failed to create item video');

    assert.equal(calls.create, 1);
    assert.equal(calls.rollback, 1);
    assert.equal(calls.commit, 0);
    assert.equal(calls.audit, 0);

    assert.equal(transaction.finished, 'rollback');
    assert.equal(fs.existsSync(absolutePath), false);

    console.log('PASS: Database insert failure returned HTTP 500.');
    console.log('PASS: Database transaction rolled back.');
    console.log('PASS: Converted WebM file was deleted.');
});

test('cleans up temporary test files', () => {
    fs.rmSync(uploadRoot, { recursive: true, force: true });
    assert.equal(fs.existsSync(uploadRoot), false);
});
