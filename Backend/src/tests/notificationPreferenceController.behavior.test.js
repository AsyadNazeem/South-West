
'use strict';

const { test, mock } = require('node:test');
const assert = require('node:assert/strict');

const mockState = {
    preferences: null,
    auditError: null,
    createError: null,
    auditCalls: [],
    createCalls: [],
    updateCalls: [],
    findOneCalls: [],
    transactionCalls: 0
};

const mockPreference = (customerId, values = {}) => {
    const record = {
        id: 10,
        customer_id: customerId,
        order_updates: true,
        payment_updates: true,
        delivery_updates: true,
        promotional_notifications: true,
        product_updates: true,
        ...values,

        get(field) {
            return this[field];
        },

        async update(changes, options) {
            mockState.updateCalls.push({ changes, options });
            Object.assign(this, changes);
            return this;
        }
    };

    return record;
};


const mockModels = {
    NotificationPreference: {
        async findOne(options) {
            mockState.findOneCalls.push(options);

            const requestedCustomerId = options?.where?.customer_id;
            const preference = mockState.preferences;

            if (!preference) {
                return null;
            }

            return String(preference.customer_id) === String(requestedCustomerId)
                ? preference
                : null;
        },

        async create(values, options) {
            mockState.createCalls.push({ values, options });

            if (mockState.createError) {
                throw mockState.createError;
            }

            mockState.preferences = mockPreference(
                values.customer_id,
                values
            );

            return mockState.preferences;
        }
    },

    Customer: {},


    sequelize: {
        async transaction(callback) {
            mockState.transactionCalls += 1;

            const originalPreferences = mockState.preferences;
            const originalPreferenceValues = originalPreferences
                ? {
                    ...originalPreferences
                }
                : null;

            const originalCreateCalls = mockState.createCalls.length;
            const originalUpdateCalls = mockState.updateCalls.length;

            try {
                return await callback({
                    LOCK: { UPDATE: 'UPDATE' }
                });
            } catch (error) {
                // Simulate rollback of database changes.
                if (originalPreferences && originalPreferenceValues) {
                    for (const key of Object.keys(originalPreferences)) {
                        if (typeof originalPreferences[key] !== 'function') {
                            delete originalPreferences[key];
                        }
                    }

                    Object.assign(originalPreferences, originalPreferenceValues);
                }

                mockState.preferences = originalPreferences;

                mockState.createCalls.length = originalCreateCalls;
                mockState.updateCalls.length = originalUpdateCalls;

                throw error;
            }
        }
    }

};




const mockAuditService = {
    async recordAuditLog(values) {
        mockState.auditCalls.push(values);

        if (mockState.auditError) {
            throw mockState.auditError;
        }
    }
};
const proxyquire = require('proxyquire').noCallThru();

const controller = proxyquire(
    '../controllers/notificationPreferenceController',
    {
        '../models': mockModels,
        '../services/auditLogService': mockAuditService
    }
);

const makeResponse = () => ({
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
});

const makeRequest = (body = {}, customerId = 7) => ({
    body,
    customer: { id: customerId },
    ip: '127.0.0.1',
    id: 'test-request',
    get(name) {
        return name === 'user-agent' ? 'node-test' : undefined;
    }
});

const resetState = () => {
    mockState.preferences = null;
    mockState.auditError = null;
    mockState.createError = null;
    mockState.auditCalls = [];
    mockState.createCalls = [];
    mockState.updateCalls = [];
    mockState.findOneCalls = [];
    mockState.transactionCalls = 0;
};

test('notification preference controller behaviour', async (t) => {
    await t.test('rejects an empty request body', async () => {
        resetState();

        const res = makeResponse();

        await controller.saveMyNotificationPreferences(
            makeRequest({}),
            res
        );

        assert.equal(res.statusCode, 400);
        assert.equal(mockState.transactionCalls, 0);
    });

    await t.test('rejects unsupported fields', async () => {
        resetState();

        const res = makeResponse();

        await controller.saveMyNotificationPreferences(
            makeRequest({ customer_id: 99, order_updates: true }),
            res
        );

        assert.equal(res.statusCode, 400);
        assert.equal(mockState.transactionCalls, 0);
    });

    await t.test('rejects non-boolean preference values', async () => {
        resetState();

        const res = makeResponse();

        await controller.saveMyNotificationPreferences(
            makeRequest({ order_updates: 'false' }),
            res
        );

        assert.equal(res.statusCode, 400);
        assert.equal(mockState.transactionCalls, 0);
    });

    await t.test('retrieves preferences for the authenticated customer', async () => {
        resetState();

        mockState.preferences = mockPreference(7);

        const res = makeResponse();

        await controller.getMyNotificationPreferences(
            makeRequest({}, 7),
            res
        );

        assert.equal(res.statusCode, 200);
        assert.equal(res.body.data.customer_id, 7);
        assert.equal(mockState.findOneCalls[0].where.customer_id, 7);
    });

    await t.test('creates preferences and records an audit event', async () => {
        resetState();

        const res = makeResponse();

        await controller.saveMyNotificationPreferences(
            makeRequest({ order_updates: false }, 7),
            res
        );

        assert.equal(res.statusCode, 201);
        assert.equal(res.body.data.customer_id, 7);
        assert.equal(mockState.createCalls.length, 1);
        assert.equal(mockState.auditCalls.length, 1);
        assert.equal(mockState.auditCalls[0].userId, null);
        assert.equal(mockState.auditCalls[0].action, 'CUSTOMER_CREATE');
        assert.match(
            mockState.auditCalls[0].description,
            /Customer ID: 7/
        );
        assert.equal(
            mockState.auditCalls[0].newValues.customer_id,
            '7'
        );
    });


    await t.test(
        'rolls back simulated preference changes if audit logging fails',
        async () => {
            resetState();

            mockState.auditError = new Error('Audit unavailable');

            const res = makeResponse();

            await controller.saveMyNotificationPreferences(
                makeRequest({ order_updates: false }, 7),
                res
            );

            assert.equal(res.statusCode, 500);
            assert.equal(mockState.preferences, null);
            assert.equal(mockState.createCalls.length, 0);
            assert.equal(mockState.auditCalls.length, 1);
        }
    );


    await t.test('returns an error if audit logging fails', async () => {
        resetState();

        mockState.auditError = new Error('Audit unavailable');

        const res = makeResponse();

        await controller.saveMyNotificationPreferences(
            makeRequest({ order_updates: false }, 7),
            res
        );

        assert.equal(res.statusCode, 500);
    });


    await t.test(
        'queries preferences using only the authenticated customer ID',
        async () => {
            resetState();

            mockState.preferences = mockPreference(7);

            const res = makeResponse();

            // Customer 8 requests their own preferences.
            await controller.getMyNotificationPreferences(
                makeRequest({}, 8),
                res
            );

            assert.equal(res.statusCode, 200);
            assert.equal(mockState.findOneCalls.length, 1);
            assert.equal(
                mockState.findOneCalls[0].where.customer_id,
                8
            );
        }
    );

    await t.test(
        'does not return another customer preferences',
        async () => {
            resetState();

            mockState.preferences = mockPreference(7);

            const res = makeResponse();

            await controller.getMyNotificationPreferences(
                makeRequest({}, 8),
                res
            );

            assert.equal(res.statusCode, 200);
            assert.equal(res.body.data, null);
        }
    );


    await t.test(
        'recovers when another request creates the preference first',
        async () => {
            resetState();

            const existingPreference = mockPreference(7);
            mockState.createError = Object.assign(
                new Error('Duplicate entry for notification_preferences_customer_id'),
                {
                    name: 'SequelizeUniqueConstraintError',
                    fields: {
                        customer_id: '7'
                    },
                    original: {
                        code: 'ER_DUP_ENTRY',
                        sqlMessage:
                            "Duplicate entry for key 'notification_preferences_customer_id'"
                    }
                }
            );

            // The initial lookup returns null; the retry finds the
            // record created by the competing request.
            mockState.preferences = null;

            const originalFindOne = mockModels.NotificationPreference.findOne;
            let lookupCount = 0;

            mockModels.NotificationPreference.findOne = async (options) => {
                mockState.findOneCalls.push(options);
                lookupCount += 1;

                return lookupCount === 1 ? null : existingPreference;
            };

            const res = makeResponse();

            try {
                await controller.saveMyNotificationPreferences(
                    makeRequest({ order_updates: false }, 7),
                    res
                );
            } finally {
                mockModels.NotificationPreference.findOne = originalFindOne;
            }

            assert.equal(res.statusCode, 200);
            assert.equal(res.body.data, existingPreference);
            assert.equal(mockState.transactionCalls, 2);
            assert.equal(mockState.updateCalls.length, 1);
            assert.equal(
                mockState.updateCalls[0].changes.order_updates,
                false
            );
            assert.equal(mockState.auditCalls.length, 1);
            assert.equal(
                mockState.auditCalls[0].action,
                'CUSTOMER_UPDATE'
            );
        }
    );


    await t.test(
        'rolls back an existing preference update if audit logging fails',
        async () => {
            resetState();

            const preference = mockPreference(7, {
                order_updates: true
            });

            mockState.preferences = preference;
            mockState.auditError = new Error('Audit unavailable');

            const res = makeResponse();

            await controller.saveMyNotificationPreferences(
                makeRequest({ order_updates: false }, 7),
                res
            );

            assert.equal(res.statusCode, 500);

            // The simulated transaction must restore the original value.
            assert.equal(
                mockState.preferences.order_updates,
                true
            );

            assert.equal(mockState.auditCalls.length, 1);
            assert.equal(mockState.transactionCalls, 1);
        }
    );


});
