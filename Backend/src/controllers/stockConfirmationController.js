'use strict';

const { StockConfirmationSetting } = require('../models');
const { recordAuditLog } = require('../services/auditLogService');

const {
    SETTING_ID,
    serializeSettings,
    validateSettings,
    getStockConfirmationSettings
} = require('../services/stockConfirmationService');

async function getSettings(req, res) {
    try {
        const data = await getStockConfirmationSettings();

        res.set('Cache-Control', 'no-store');

        return res.json({
            success: true,
            data
        });
    } catch (error) {
        console.error('Load stock confirmation settings:', error);

        return res.status(500).json({
            success: false,
            message: 'Unable to load stock confirmation settings.'
        });
    }
}

async function updateSettings(req, res) {
    let values;

    try {
        values = validateSettings(req.body || {});
    } catch (error) {
        return res.status(400).json({
            success: false,
            message: error.message
        });
    }

    try {
        const settings = await StockConfirmationSetting.findByPk(
            SETTING_ID
        );

        if (!settings) {
            return res.status(404).json({
                success: false,
                message: 'Stock confirmation settings are missing.'
            });
        }

        const oldValues = serializeSettings(settings);

        await settings.update(values);

        const newValues = serializeSettings(settings);

        try {
            await recordAuditLog({
                userId: req.user?.id ?? req.user?.user_id ?? null,
                action: 'STOCK_CONFIRMATION_SETTINGS_UPDATED',
                module: 'STOCK_CONFIRMATION',
                entityType: 'StockConfirmationSetting',
                entityId: String(SETTING_ID),
                description: 'Updated stock confirmation settings',
                oldValues,
                newValues,
                ipAddress: req.ip ?? null,
                userAgent: req.get?.('user-agent') ?? null,
                requestId: req.id ?? req.requestId ?? null
            });
        } catch (auditError) {
            console.error(
                'Stock confirmation audit log failed:',
                auditError.message
            );
        }

        res.set('Cache-Control', 'no-store');

        return res.json({
            success: true,
            message: 'Stock confirmation settings updated.',
            data: newValues
        });

    } catch (error) {
        console.error('Update stock confirmation settings:', error);

        return res.status(500).json({
            success: false,
            message: 'Unable to update stock confirmation settings.'
        });
    }
}

module.exports = {
    getSettings,
    updateSettings
};
