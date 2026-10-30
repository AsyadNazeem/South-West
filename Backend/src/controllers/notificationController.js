'use strict';

const { sequelize, Notification, Customer } = require('../models');
const { recordAuditLog } = require('../services/auditLogService');

const isValidId = (value) =>
    (typeof value === 'string' || typeof value === 'number') &&
    /^\d+$/.test(String(value)) &&
    BigInt(value) > 0n &&
    BigInt(value) <= 18446744073709551615n;

const hasOwn = (object, key) =>
    Object.prototype.hasOwnProperty.call(object, key);

const allowedStaffFields = [
    'customer_id',
    'type',
    'title',
    'message',
    'reference_type',
    'reference_id',
    'is_read',
    'read_at'
];

const validateNotificationBody = (body, fields) => {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return 'Request body must be an object';
    }

    const unknown = Object.keys(body).filter(
        (key) => !fields.includes(key)
    );

    if (unknown.length) {
        return `Unsupported fields: ${unknown.join(', ')}`;
    }

    return null;
};

const validateFields = (body, isCreate = false) => {
    if (isCreate) {
        for (const field of ['customer_id', 'type', 'title', 'message']) {
            if (!hasOwn(body, field)) {
                return `${field} is required`;
            }
        }
    }

    if (hasOwn(body, 'customer_id') && !isValidId(body.customer_id)) {
        return 'customer_id must be a valid ID';
    }

    for (const [field, maxLength] of [
        ['type', 100],
        ['title', 200],
        ['reference_type', 100]
    ]) {
        if (hasOwn(body, field)) {
            const value = body[field];

            if (
                typeof value !== 'string' ||
                !value.trim() ||
                value.length > maxLength
            ) {
                return `${field} must be a non-empty string of at most ${maxLength} characters`;
            }
        }
    }

    if (hasOwn(body, 'message')) {
        if (
            typeof body.message !== 'string' ||
            !body.message.trim()
        ) {
            return 'message must be a non-empty string';
        }
    }

    if (
        hasOwn(body, 'reference_id') &&
        body.reference_id !== null &&
        !isValidId(body.reference_id)
    ) {
        return 'reference_id must be a valid ID or null';
    }

    if (
        hasOwn(body, 'is_read') &&
        typeof body.is_read !== 'boolean' &&
        body.is_read !== 0 &&
        body.is_read !== 1
    ) {
        return 'is_read must be a boolean';
    }

    if (hasOwn(body, 'read_at')) {
        if (
            body.read_at !== null &&
            (
                typeof body.read_at !== 'string' ||
                Number.isNaN(Date.parse(body.read_at))
            )
        ) {
            return 'read_at must be a valid date or null';
        }
    }

    return null;
};

const normaliseReadState = (data, current = {}) => {
    const result = { ...data };

    if (hasOwn(data, 'is_read')) {
        const isRead = data.is_read === true || data.is_read === 1;

        result.is_read = isRead;

        if (!isRead) {
            result.read_at = null;
        } else if (!hasOwn(data, 'read_at')) {
            result.read_at = current.read_at || new Date();
        }
    } else if (hasOwn(data, 'read_at')) {
        result.is_read = data.read_at !== null;
    }

    return result;
};

const snapshot = (notification) => {
    if (!notification) return null;

    const value = notification.get({ plain: true });

    return {
        id: value.id,
        customer_id: value.customer_id,
        type: value.type,
        title: value.title,
        message: value.message,
        reference_type: value.reference_type,
        reference_id: value.reference_id,
        is_read: value.is_read,
        read_at: value.read_at
    };
};

const auditNotification = async ({
                                     req,
                                     notification,
                                     action,
                                     description,
                                     oldValues = null,
                                     newValues = null,
                                     transaction
                                 }) => {
    await recordAuditLog({
        userId: req.user?.id ?? null,
        action,
        module: 'notifications',
        entityType: 'notification',
        entityId: notification.id,
        description,
        oldValues,
        newValues,
        ipAddress: req.ip,
        userAgent: req.get('user-agent') || null,
        requestId: req.id || null,
        transaction
    });
};

const includeCustomer = [
    {
        model: Customer,
        as: 'customer',
        attributes: [
            'id',
            'customer_code',
            'first_name',
            'last_name',
            'email'
        ]
    }
];

const handleError = (res, error, operation) => {
    if (error.name === 'SequelizeForeignKeyConstraintError') {
        return res.status(400).json({
            message: 'A referenced record does not exist'
        });
    }

    console.error(`${operation} error:`, error);

    return res.status(500).json({
        message: `Failed to ${operation.toLowerCase()}`
    });
};

// =====================================================
// STAFF: GET ALL NOTIFICATIONS
// =====================================================
const getNotifications = async (req, res) => {
    try {
        const notifications = await Notification.findAll({
            include: includeCustomer,
            order: [['created_at', 'DESC']]
        });

        return res.status(200).json({
            message: 'Notifications retrieved successfully',
            data: notifications
        });
    } catch (error) {
        return handleError(res, error, 'Retrieve notifications');
    }
};

// =====================================================
// STAFF: GET NOTIFICATION BY ID
// =====================================================
const getNotificationById = async (req, res) => {
    if (!isValidId(req.params.id)) {
        return res.status(400).json({
            message: 'A valid notification ID is required'
        });
    }

    try {
        const notification = await Notification.findByPk(req.params.id, {
            include: includeCustomer
        });

        if (!notification) {
            return res.status(404).json({
                message: 'Notification not found'
            });
        }

        return res.status(200).json({
            message: 'Notification retrieved successfully',
            data: notification
        });
    } catch (error) {
        return handleError(res, error, 'Retrieve notification');
    }
};

// =====================================================
// STAFF: CREATE NOTIFICATION
// =====================================================
const createNotification = async (req, res) => {
    const bodyError = validateNotificationBody(
        req.body,
        allowedStaffFields
    );

    if (bodyError) {
        return res.status(400).json({ message: bodyError });
    }

    const fieldError = validateFields(req.body, true);

    if (fieldError) {
        return res.status(400).json({ message: fieldError });
    }

    try {
        const customer = await Customer.findByPk(req.body.customer_id);

        if (!customer) {
            return res.status(404).json({
                message: 'Customer not found'
            });
        }

        const data = normaliseReadState({
            customer_id: req.body.customer_id,
            type: req.body.type.trim(),
            title: req.body.title.trim(),
            message: req.body.message.trim(),
            reference_type: req.body.reference_type ?? null,
            reference_id: req.body.reference_id ?? null,
            is_read: req.body.is_read ?? false,
            read_at: req.body.read_at ?? null
        });

        // A new unread notification must not have read_at set.
        if (!data.is_read) {
            data.read_at = null;
        } else if (!data.read_at) {
            data.read_at = new Date();
        }

        const notification = await sequelize.transaction(
            async (transaction) => {
                const created = await Notification.create(data, {
                    transaction
                });

                await auditNotification({
                    req,
                    notification: created,
                    action: 'NOTIFICATION_CREATED',
                    description: 'Notification created',
                    newValues: snapshot(created),
                    transaction
                });

                return created;
            }
        );

        const result = await Notification.findByPk(notification.id, {
            include: includeCustomer
        });

        return res.status(201).json({
            message: 'Notification created successfully',
            data: result
        });
    } catch (error) {
        return handleError(res, error, 'Create notification');
    }
};

// =====================================================
// STAFF: UPDATE NOTIFICATION
// =====================================================
const updateNotification = async (req, res) => {
    if (!isValidId(req.params.id)) {
        return res.status(400).json({
            message: 'A valid notification ID is required'
        });
    }

    const bodyError = validateNotificationBody(
        req.body,
        allowedStaffFields
    );

    if (bodyError) {
        return res.status(400).json({ message: bodyError });
    }

    const fieldError = validateFields(req.body);

    if (fieldError) {
        return res.status(400).json({ message: fieldError });
    }

    if (Object.keys(req.body).length === 0) {
        return res.status(400).json({
            message: 'At least one field must be provided'
        });
    }

    try {
        const updatedId = await sequelize.transaction(
            async (transaction) => {
                const notification = await Notification.findByPk(
                    req.params.id,
                    {
                        transaction,
                        lock: transaction.LOCK.UPDATE
                    }
                );

                if (!notification) {
                    const error = new Error('NOTIFICATION_NOT_FOUND');
                    throw error;
                }

                if (hasOwn(req.body, 'customer_id')) {
                    const customer = await Customer.findByPk(
                        req.body.customer_id,
                        { transaction }
                    );

                    if (!customer) {
                        const error = new Error('CUSTOMER_NOT_FOUND');
                        throw error;
                    }
                }

                const oldValues = snapshot(notification);

                const data = {
                    ...req.body,
                    ...(hasOwn(req.body, 'type')
                        ? { type: req.body.type.trim() }
                        : {}),
                    ...(hasOwn(req.body, 'title')
                        ? { title: req.body.title.trim() }
                        : {}),
                    ...(hasOwn(req.body, 'message')
                        ? { message: req.body.message.trim() }
                        : {})
                };

                await notification.update(
                    normaliseReadState(data, notification),
                    { transaction }
                );

                await auditNotification({
                    req,
                    notification,
                    action: 'NOTIFICATION_UPDATED',
                    description: 'Notification updated',
                    oldValues,
                    newValues: snapshot(notification),
                    transaction
                });

                return notification.id;
            }
        );

        const result = await Notification.findByPk(updatedId, {
            include: includeCustomer
        });

        return res.status(200).json({
            message: 'Notification updated successfully',
            data: result
        });
    } catch (error) {
        if (error.message === 'NOTIFICATION_NOT_FOUND') {
            return res.status(404).json({
                message: 'Notification not found'
            });
        }

        if (error.message === 'CUSTOMER_NOT_FOUND') {
            return res.status(404).json({
                message: 'Customer not found'
            });
        }

        return handleError(res, error, 'Update notification');
    }
};

// =====================================================
// STAFF: DELETE NOTIFICATION
// =====================================================
const deleteNotification = async (req, res) => {
    if (!isValidId(req.params.id)) {
        return res.status(400).json({
            message: 'A valid notification ID is required'
        });
    }

    try {
        await sequelize.transaction(async (transaction) => {
            const notification = await Notification.findByPk(
                req.params.id,
                {
                    transaction,
                    lock: transaction.LOCK.UPDATE
                }
            );

            if (!notification) {
                const error = new Error('NOTIFICATION_NOT_FOUND');
                throw error;
            }

            await auditNotification({
                req,
                notification,
                action: 'NOTIFICATION_DELETED',
                description: 'Notification deleted',
                oldValues: snapshot(notification),
                transaction
            });

            await notification.destroy({ transaction });
        });

        return res.status(200).json({
            message: 'Notification deleted successfully'
        });
    } catch (error) {
        if (error.message === 'NOTIFICATION_NOT_FOUND') {
            return res.status(404).json({
                message: 'Notification not found'
            });
        }

        return handleError(res, error, 'Delete notification');
    }
};

// =====================================================
// CUSTOMER: GET OWN NOTIFICATIONS
// =====================================================
const getMyNotifications = async (req, res) => {
    if (!req.customer?.id) {
        return res.status(401).json({
            message: 'Customer authentication required'
        });
    }

    try {
        const notifications = await Notification.findAll({
            where: {
                customer_id: req.customer.id
            },
            order: [['created_at', 'DESC']]
        });

        return res.status(200).json({
            message: 'Your notifications retrieved successfully',
            data: notifications
        });
    } catch (error) {
        return handleError(res, error, 'Retrieve customer notifications');
    }
};

// =====================================================
// CUSTOMER: GET ONE OWN NOTIFICATION
// =====================================================
const getMyNotificationById = async (req, res) => {
    if (!req.customer?.id) {
        return res.status(401).json({
            message: 'Customer authentication required'
        });
    }

    if (!isValidId(req.params.id)) {
        return res.status(400).json({
            message: 'A valid notification ID is required'
        });
    }

    try {
        const notification = await Notification.findOne({
            where: {
                id: req.params.id,
                customer_id: req.customer.id
            }
        });

        if (!notification) {
            return res.status(404).json({
                message: 'Notification not found'
            });
        }

        return res.status(200).json({
            message: 'Notification retrieved successfully',
            data: notification
        });
    } catch (error) {
        return handleError(res, error, 'Retrieve customer notification');
    }
};

// =====================================================
// CUSTOMER: MARK OWN NOTIFICATION AS READ
// =====================================================
const markMyNotificationRead = async (req, res) => {
    if (!req.customer?.id) {
        return res.status(401).json({
            message: 'Customer authentication required'
        });
    }

    if (!isValidId(req.params.id)) {
        return res.status(400).json({
            message: 'A valid notification ID is required'
        });
    }

    try {
        const [affectedRows] = await Notification.update(
            {
                is_read: true,
                read_at: sequelize.literal(
                    'COALESCE(read_at, CURRENT_TIMESTAMP)'
                )
            },
            {
                where: {
                    id: req.params.id,
                    customer_id: req.customer.id
                }
            }
        );

        if (affectedRows === 0) {
            const notification = await Notification.findOne({
                where: {
                    id: req.params.id,
                    customer_id: req.customer.id
                },
                attributes: ['id']
            });

            if (!notification) {
                return res.status(404).json({
                    message: 'Notification not found'
                });
            }
        }

        const notification = await Notification.findOne({
            where: {
                id: req.params.id,
                customer_id: req.customer.id
            }
        });

        return res.status(200).json({
            message: 'Notification marked as read',
            data: notification
        });
    } catch (error) {
        return handleError(res, error, 'Mark notification as read');
    }
};

module.exports = {
    getNotifications,
    getNotificationById,
    createNotification,
    updateNotification,
    deleteNotification,
    getMyNotifications,
    getMyNotificationById,
    markMyNotificationRead
};
