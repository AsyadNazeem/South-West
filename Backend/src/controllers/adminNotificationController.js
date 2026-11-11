'use strict';

const { Op } = require('sequelize');
const Sequelize = require('sequelize');
const { User, Role, AdminNotification, AdminNotificationPreference } = require('../models');
const { recordAuditLog } = require('../services/auditLogService');

const TYPES = ['new_orders', 'payments', 'deliveries', 'reviews', 'customer_requests'];
const notificationListAttributes = ['id', 'user_id', 'type', 'title', 'message', 'reference_type', 'reference_id', 'is_read', 'read_at', 'created_at', 'updated_at'];
const notificationDismissalAttributes = [...notificationListAttributes, 'is_dismissed'];

async function auditFeedChange(req, notification, action, wasRead, wasDismissed) {
    try {
        await recordAuditLog({
            userId: req.user.id,
            action,
            module: 'notifications',
            entityType: 'admin_notification',
            entityId: notification.id,
            description: action === 'ADMIN_NOTIFICATION_DISMISSED' ? 'Admin notification dismissed' : 'Admin notification marked as read',
            oldValues: { is_read: wasRead, is_dismissed: wasDismissed },
            newValues: { type: notification.type, reference_type: notification.reference_type, reference_id: notification.reference_id, is_read: notification.is_read, is_dismissed: notification.is_dismissed ?? null },
            ipAddress: req.ip,
            userAgent: req.get?.('user-agent') || null,
            requestId: req.id || null
        });
    } catch (error) {
        console.error('Unable to write admin notification audit event:', error);
    }
}

function isMissingDismissalColumn(error) {
    const databaseError = error?.original || error?.parent || error;
    return databaseError?.code === 'ER_BAD_FIELD_ERROR' && String(databaseError?.message || '').includes('is_dismissed');
}

async function isAdmin(req) {
    const user = await User.findByPk(req.user.id, { include: [{ model: Role, as: 'roles', through: { attributes: [] } }] });
    return (user?.roles || []).some((role) => String(role.name || '').trim().toLowerCase() === 'admin');
}

async function list(req, res) {
    try {
        const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
        const pageSize = Math.min(100, Math.max(1, Number.parseInt(req.query.pageSize, 10) || 25));
        const sortOrder = String(req.query.sortOrder || 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
        const where = { user_id: req.user.id };
        if (req.query.view === 'feed') where.is_dismissed = false;
        let result;
        try {
            result = await AdminNotification.findAndCountAll({ where, order: [['created_at', sortOrder]], limit: pageSize, offset: (page - 1) * pageSize });
        } catch (error) {
            if (!isMissingDismissalColumn(error)) throw error;
            console.warn('Admin notification dismissal migration is pending; returning notifications without dismissal filtering.');
            result = await AdminNotification.findAndCountAll({
                attributes: notificationListAttributes,
                where: { user_id: req.user.id },
                order: [['created_at', sortOrder]],
                limit: pageSize,
                offset: (page - 1) * pageSize
            });
        }
        return res.json({ data: result.rows, pagination: { page, pageSize, total: result.count, totalPages: Math.ceil(result.count / pageSize) } });
    } catch (error) { console.error(error); return res.status(500).json({ message: 'Unable to load admin notifications' }); }
}

async function unreadCount(req, res) {
    try {
        let count;
        try {
            count = await AdminNotification.count({ where: { user_id: req.user.id, is_read: false, is_dismissed: false } });
        } catch (error) {
            if (!isMissingDismissalColumn(error)) throw error;
            count = await AdminNotification.count({ where: { user_id: req.user.id, is_read: false } });
        }
        return res.json({ count });
    } catch (error) {
        console.error('Unable to count unread admin notifications:', error);
        return res.status(500).json({ message: 'Unable to load unread notification count' });
    }
}

async function markRead(req, res) {
    let notification;
    try {
        notification = await AdminNotification.findOne({ attributes: notificationDismissalAttributes, where: { id: req.params.id, user_id: req.user.id } });
    } catch (error) {
        if (!isMissingDismissalColumn(error)) throw error;
        notification = await AdminNotification.findOne({ attributes: notificationListAttributes, where: { id: req.params.id, user_id: req.user.id } });
    }
    if (!notification) return res.status(404).json({ message: 'Notification not found' });
    const previousRead = notification.is_read;
    const previousDismissed = notification.is_dismissed ?? null;
    await notification.update({ is_read: true, read_at: new Date() });
    notification.is_read = true;
    if (previousRead !== true) {
        await auditFeedChange(req, notification, 'ADMIN_NOTIFICATION_MARKED_READ', previousRead, previousDismissed);
    }
    return res.json({ data: notification });
}

async function dismiss(req, res) {
    try {
        let notification;
        try {
            notification = await AdminNotification.findOne({ attributes: notificationDismissalAttributes, where: { id: req.params.id, user_id: req.user.id } });
        } catch (error) {
            if (!isMissingDismissalColumn(error)) throw error;
            notification = await AdminNotification.findOne({ attributes: notificationListAttributes, where: { id: req.params.id, user_id: req.user.id } });
        }
        if (!notification) return res.status(404).json({ message: 'Notification not found' });
        const previousRead = notification.is_read;
        const previousDismissed = notification.is_dismissed ?? null;
        await notification.update({ is_dismissed: true });
        notification.is_dismissed = true;
        if (previousDismissed !== true) {
            await auditFeedChange(req, notification, 'ADMIN_NOTIFICATION_DISMISSED', previousRead, previousDismissed);
        }
        return res.json({ data: notification });
    } catch (error) {
        if (isMissingDismissalColumn(error)) {
            return res.status(503).json({ message: 'Notification dismissal requires the admin notification database migration.' });
        }
        console.error('Unable to dismiss admin notification:', error);
        return res.status(500).json({ message: 'Unable to remove notification from the feed' });
    }
}

async function preferences(req, res) {
    if (!await isAdmin(req)) return res.status(403).json({ message: 'Admin access required' });
    try {
        const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
        const pageSize = Math.min(100, Math.max(1, Number.parseInt(req.query.pageSize, 10) || 25));
        const search = String(req.query.search || '').trim();
        const where = { is_active: true };
        if (search) where.email = { [Op.like]: `%${search}%` };
        const result = await User.findAndCountAll({
            attributes: ['id', 'email'], where,
            include: [{ model: Role, as: 'roles', through: { attributes: [] }, where: Sequelize.where(Sequelize.fn('LOWER', Sequelize.col('roles.name')), 'admin'), required: true }],
            order: [['email', 'ASC']], limit: pageSize, offset: (page - 1) * pageSize, distinct: true,
            // Avoid Sequelize's pagination subquery, where the included role alias
            // can be rewritten to the model name and break the LOWER(roles.name) condition.
            subQuery: false
        });
        const users = result.rows;
        const current = await AdminNotificationPreference.findAll({ where: { user_id: users.map((user) => user.id) } });
        const byId = new Map(current.map((row) => [String(row.user_id), row]));
        return res.json({ data: users.map((user) => ({ user_id: user.id, email: user.email, ...(byId.get(String(user.id))?.get({ plain: true }) || Object.fromEntries(TYPES.map((type) => [type, true]))) })), pagination: { page, pageSize, total: result.count, totalPages: Math.ceil(result.count / pageSize) } });
    } catch (error) { console.error(error); return res.status(500).json({ message: 'Unable to load notification settings' }); }
}

async function updatePreferences(req, res) {
    if (!await isAdmin(req)) return res.status(403).json({ message: 'Admin access required' });
    const body = req.body || {};
    if (!body.user_id || Object.keys(body).some((key) => !['user_id', ...TYPES].includes(key)) || TYPES.some((type) => typeof body[type] !== 'boolean')) {
        return res.status(400).json({ message: 'Provide a user_id and a boolean value for every notification type' });
    }
    const user = await User.findByPk(body.user_id, { include: [{ model: Role, as: 'roles', through: { attributes: [] } }] });
    const isEligibleTarget = user?.is_active !== false && (user?.roles || []).some((role) => String(role.name || '').trim().toLowerCase() === 'admin');
    if (!isEligibleTarget) return res.status(404).json({ message: 'Admin user not found' });
    try {
        const [preference] = await AdminNotificationPreference.findOrCreate({ where: { user_id: user.id }, defaults: { user_id: user.id, ...Object.fromEntries(TYPES.map((type) => [type, true])) } });
        await preference.update(Object.fromEntries(TYPES.map((type) => [type, body[type]])));
        await recordAuditLog({ userId: req.user.id, action: 'ADMIN_NOTIFICATION_PREFERENCES_UPDATED', module: 'notifications', entityType: 'admin_notification_preference', entityId: preference.id, description: `Updated notification preferences for ${user.email}`, newValues: { user_id: user.id, ...Object.fromEntries(TYPES.map((type) => [type, body[type]])), updated_by: req.user.id }, ipAddress: req.ip, userAgent: req.get('user-agent') || null, requestId: req.id || null });
        return res.json({ data: { user_id: user.id, email: user.email, ...preference.get({ plain: true }) } });
    } catch (error) { console.error(error); return res.status(500).json({ message: 'Unable to save notification settings' }); }
}

async function notifyAdmins({ type, title, message, referenceType, referenceId, transaction }) {
    const field = ({ order: 'new_orders', payment: 'payments', delivery: 'deliveries', review: 'reviews' })[type] || 'customer_requests';
    const admins = await User.findAll({
        attributes: ['id'], where: { is_active: true },
        include: [
            { model: Role, as: 'roles', attributes: [], through: { attributes: [] }, where: { name: { [Op.in]: ['Admin', 'Super Admin', 'Manager', 'Staff', 'Sales'] } }, required: true },
            { model: AdminNotificationPreference, as: 'adminNotificationPreference', attributes: [field], required: false }
        ], transaction
    });
    const rows = admins.filter((admin) => admin.adminNotificationPreference?.[field] !== false).map((admin) => ({ user_id: admin.id, type, title, message, reference_type: referenceType || null, reference_id: referenceId || null, is_read: false, read_at: null }));
    if (rows.length) await AdminNotification.bulkCreate(rows, { transaction });
}

module.exports = { list, unreadCount, markRead, dismiss, preferences, updatePreferences, notifyAdmins };
