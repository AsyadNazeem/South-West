
'use strict';

const { NotificationPreference, Customer, sequelize } = require('../models');
const { recordAuditLog } = require('../services/auditLogService');

const PREFERENCE_FIELDS = [
    'order_updates',
    'payment_updates',
    'delivery_updates',
    'promotional_notifications',
    'product_updates'
];

const CUSTOMER_ATTRIBUTES = [
    'id',
    'customer_code',
    'first_name',
    'last_name',
    'email'
];

const isValidId = (value) => {
    if (
        value === undefined ||
        value === null ||
        !/^[1-9]\d*$/.test(String(value))
    ) {
        return false;
    }

    try {
        return BigInt(value) <= 18446744073709551615n;
    } catch {
        return false;
    }
};

const validatePreferenceBody = (body, { allowCustomerId = false } = {}) => {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return { error: 'A valid JSON object is required.' };
    }

    const allowedFields = allowCustomerId
        ? [...PREFERENCE_FIELDS, 'customer_id']
        : PREFERENCE_FIELDS;

    const unknownFields = Object.keys(body).filter(
        (key) => !allowedFields.includes(key)
    );

    if (unknownFields.length) {
        return { error: 'Request contains unsupported fields.' };
    }

    if (!Object.keys(body).length) {
        return { error: 'At least one field is required.' };
    }

    if (
        Object.keys(body).some(
            (key) =>
                key !== 'customer_id' &&
                typeof body[key] !== 'boolean'
        )
    ) {
        return { error: 'Preference values must be true or false.' };
    }

    return { data: body };
};


const isUniqueConstraintError = error =>
    error?.name === 'SequelizeUniqueConstraintError' ||
    error?.original?.code === 'ER_DUP_ENTRY' ||
    error?.parent?.code === 'ER_DUP_ENTRY';




const isCustomerPreferenceDuplicate = (error, customerId) => {
    if (!isUniqueConstraintError(error)) {
        return false;
    }

    const fields = error.fields;
    const duplicateKeyMessage =
        error.original?.sqlMessage ??
        error.parent?.sqlMessage ??
        error.sqlMessage ??
        '';

    const fieldCustomerId =
        fields &&
        Object.prototype.hasOwnProperty.call(fields, 'customer_id')
            ? fields.customer_id
            : undefined;

    // Prefer structured field information when Sequelize provides it.
    if (fieldCustomerId !== undefined) {
        return String(fieldCustomerId) === String(customerId);
    }

    // Otherwise, match the exact unique-index name.
    return duplicateKeyMessage.includes(
        'notification_preferences_customer_id'
    );
};



const handleError = (res, message, error) => {
    console.error(message, error);

    if (error?.name === 'SequelizeUniqueConstraintError') {
        return res.status(409).json({
            message: 'Notification preferences already exist for this customer.'
        });
    }

    return res.status(500).json({
        message: 'An unexpected error occurred.'
    });
};


const writeAuditLog = async ({
                                 req,
                                 transaction,
                                 action,
                                 entityId,
                                 description,
                                 oldValues = null,
                                 newValues = null,
                                 customerId = null
                             }) => {
    const isCustomerAction = customerId !== null;

    await recordAuditLog({
        userId: isCustomerAction ? null : (req.user?.id ?? null),
        action,
        module: 'notification_preferences',
        entityType: 'NotificationPreference',
        entityId,
        description: isCustomerAction
            ? `${description} Customer ID: ${customerId}.`
            : description,
        oldValues: isCustomerAction
            ? { customer_id: String(customerId), ...(oldValues || {}) }
            : oldValues,
        newValues: isCustomerAction
            ? { customer_id: String(customerId), ...(newValues || {}) }
            : newValues,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        requestId: req.id ?? null,
        transaction
    });
};


// STAFF: GET /api/notification-preferences
const getNotificationPreferences = async (req, res) => {
    try {
        const preferences = await NotificationPreference.findAll({
            include: [{
                model: Customer,
                as: 'customer',
                attributes: CUSTOMER_ATTRIBUTES
            }],
            order: [['id', 'ASC']]
        });

        return res.status(200).json({
            message: 'Notification preferences retrieved successfully.',
            data: preferences
        });
    } catch (error) {
        return handleError(
            res,
            'Get notification preferences error:',
            error
        );
    }
};

// STAFF: GET /api/notification-preferences/:id
const getNotificationPreferenceById = async (req, res) => {
    if (!isValidId(req.params.id)) {
        return res.status(400).json({ message: 'Invalid preference ID.' });
    }

    try {
        const preference = await NotificationPreference.findByPk(
            req.params.id,
            {
                include: [{
                    model: Customer,
                    as: 'customer',
                    attributes: CUSTOMER_ATTRIBUTES
                }]
            }
        );

        if (!preference) {
            return res.status(404).json({
                message: 'Notification preference not found.'
            });
        }

        return res.status(200).json({
            message: 'Notification preference retrieved successfully.',
            data: preference
        });
    } catch (error) {
        return handleError(
            res,
            'Get notification preference error:',
            error
        );
    }
};

// STAFF: POST /api/notification-preferences
const createNotificationPreference = async (req, res) => {
    const validation = validatePreferenceBody(req.body, {
        allowCustomerId: true
    });

    if (validation.error) {
        return res.status(400).json({ message: validation.error });
    }

    const { customer_id, ...providedPreferences } = validation.data;

    if (!isValidId(customer_id)) {
        return res.status(400).json({
            message: 'A valid customer ID is required.'
        });
    }

    try {
        const result = await sequelize.transaction(async (transaction) => {
            const customer = await Customer.findByPk(customer_id, {
                transaction,
                lock: transaction.LOCK.UPDATE
            });

            if (!customer) {
                const error = new Error('CUSTOMER_NOT_FOUND');
                error.code = 'CUSTOMER_NOT_FOUND';
                throw error;
            }

            const preference = await NotificationPreference.create(
                { customer_id, ...providedPreferences },
                { transaction }
            );

            await writeAuditLog({
                req,
                transaction,
                action: 'CREATE',
                entityId: preference.id,
                description: 'Created customer notification preferences.',
                newValues: {
                    customer_id,
                    ...providedPreferences
                }
            });

            return preference;
        });

        return res.status(201).json({
            message: 'Notification preferences created successfully.',
            data: result
        });
    } catch (error) {
        if (error.code === 'CUSTOMER_NOT_FOUND') {
            return res.status(404).json({ message: 'Customer not found.' });
        }

        return handleError(
            res,
            'Create notification preference error:',
            error
        );
    }
};

// STAFF: PUT /api/notification-preferences/:id
const updateNotificationPreference = async (req, res) => {
    if (!isValidId(req.params.id)) {
        return res.status(400).json({ message: 'Invalid preference ID.' });
    }

    const validation = validatePreferenceBody(req.body);

    if (validation.error) {
        return res.status(400).json({ message: validation.error });
    }

    try {
        const result = await sequelize.transaction(async (transaction) => {
            const preference = await NotificationPreference.findByPk(
                req.params.id,
                {
                    transaction,
                    lock: transaction.LOCK.UPDATE
                }
            );

            if (!preference) {
                const error = new Error('PREFERENCE_NOT_FOUND');
                error.code = 'PREFERENCE_NOT_FOUND';
                throw error;
            }

            const oldValues = {};
            for (const field of Object.keys(validation.data)) {
                oldValues[field] = preference.get(field);
            }

            await preference.update(validation.data, { transaction });

            await writeAuditLog({
                req,
                transaction,
                action: 'UPDATE',
                entityId: preference.id,
                description: 'Updated customer notification preferences.',
                oldValues,
                newValues: validation.data
            });

            return preference;
        });

        return res.status(200).json({
            message: 'Notification preferences updated successfully.',
            data: result
        });
    } catch (error) {
        if (error.code === 'PREFERENCE_NOT_FOUND') {
            return res.status(404).json({
                message: 'Notification preference not found.'
            });
        }

        return handleError(
            res,
            'Update notification preference error:',
            error
        );
    }
};

// STAFF: DELETE /api/notification-preferences/:id
const deleteNotificationPreference = async (req, res) => {
    if (!isValidId(req.params.id)) {
        return res.status(400).json({ message: 'Invalid preference ID.' });
    }

    try {
        await sequelize.transaction(async (transaction) => {
            const preference = await NotificationPreference.findByPk(
                req.params.id,
                {
                    transaction,
                    lock: transaction.LOCK.UPDATE
                }
            );

            if (!preference) {
                const error = new Error('PREFERENCE_NOT_FOUND');
                error.code = 'PREFERENCE_NOT_FOUND';
                throw error;
            }

            const oldValues = {
                customer_id: preference.customer_id
            };

            for (const field of PREFERENCE_FIELDS) {
                oldValues[field] = preference.get(field);
            }

            await writeAuditLog({
                req,
                transaction,
                action: 'DELETE',
                entityId: preference.id,
                description: 'Deleted customer notification preferences.',
                oldValues
            });

            await preference.destroy({ transaction });
        });

        return res.status(200).json({
            message: 'Notification preferences deleted successfully.'
        });
    } catch (error) {
        if (error.code === 'PREFERENCE_NOT_FOUND') {
            return res.status(404).json({
                message: 'Notification preference not found.'
            });
        }

        return handleError(
            res,
            'Delete notification preference error:',
            error
        );
    }
};

// CUSTOMER: GET /api/my/notification-preferences
const getMyNotificationPreferences = async (req, res) => {
    try {
        const preference = await NotificationPreference.findOne({
            where: { customer_id: req.customer.id }
        });

        return res.status(200).json({
            message: 'Your notification preferences retrieved successfully.',
            data: preference
        });
    } catch (error) {
        return handleError(
            res,
            'Get customer notification preferences error:',
            error
        );
    }
};

// CUSTOMER: PUT /api/my/notification-preferences
// Creates the record if absent, otherwise updates the supplied flags.

const saveMyNotificationPreferences = async (req, res) => {
    const validation = validatePreferenceBody(req.body);

    if (validation.error) {
        return res.status(400).json({ message: validation.error });
    }

    const customerId = req.customer.id;

    const savePreferences = async () =>
        sequelize.transaction(async (transaction) => {
            let preference = await NotificationPreference.findOne({
                where: { customer_id: customerId },
                transaction,
                lock: transaction.LOCK.UPDATE
            });

            if (!preference) {
                preference = await NotificationPreference.create(
                    { customer_id: customerId, ...validation.data },
                    { transaction }
                );

                await writeAuditLog({
                    req,
                    transaction,
                    action: 'CUSTOMER_CREATE',
                    entityId: preference.id,
                    customerId,
                    description:
                        'Customer created notification preferences.',
                    newValues: validation.data
                });

                return { preference, created: true };
            }

            const oldValues = {};

            for (const field of Object.keys(validation.data)) {
                oldValues[field] = preference.get(field);
            }

            await preference.update(validation.data, { transaction });

            await writeAuditLog({
                req,
                transaction,
                action: 'CUSTOMER_UPDATE',
                entityId: preference.id,
                customerId,
                description:
                    'Customer updated notification preferences.',
                oldValues,
                newValues: validation.data
            });

            return { preference, created: false };
        });

    try {
        let result;

        try {
            result = await savePreferences();
        } catch (error) {
            // Another request may have created the unique customer record
            // after our initial lookup. Retry in a fresh transaction.
            if (!isCustomerPreferenceDuplicate(error, customerId)) {
                throw error;
            }

            result = await sequelize.transaction(async (transaction) => {
                const preference = await NotificationPreference.findOne({
                    where: { customer_id: customerId },
                    transaction,
                    lock: transaction.LOCK.UPDATE
                });

                // If no record exists, this was not the expected race.
                if (!preference) {
                    throw error;
                }

                const oldValues = {};

                for (const field of Object.keys(validation.data)) {
                    oldValues[field] = preference.get(field);
                }

                await preference.update(validation.data, { transaction });

                await writeAuditLog({
                    req,
                    transaction,
                    action: 'CUSTOMER_UPDATE',
                    entityId: preference.id,
                    customerId,
                    description:
                        'Customer updated notification preferences after a concurrent creation.',
                    oldValues,
                    newValues: validation.data
                });

                return { preference, created: false };
            });
        }

        return res.status(result.created ? 201 : 200).json({
            message: result.created
                ? 'Your notification preferences were created successfully.'
                : 'Your notification preferences were updated successfully.',
            data: result.preference
        });
    } catch (error) {
        return handleError(
            res,
            'Save customer notification preferences error:',
            error
        );
    }
};


module.exports = {
    getNotificationPreferences,
    getNotificationPreferenceById,
    createNotificationPreference,
    updateNotificationPreference,
    deleteNotificationPreference,
    getMyNotificationPreferences,
    saveMyNotificationPreferences
};
