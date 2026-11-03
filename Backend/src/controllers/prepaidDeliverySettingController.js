'use strict';

const { PrepaidDeliverySetting } = require('../models');
const { recordAuditLog } = require('../services/auditLogService');

const SETTING_ID = 1;

const getPrepaidDeliveryPricing = async (req, res) => {
    try {
        const settings = await PrepaidDeliverySetting.findByPk(SETTING_ID);

        if (!settings) {
            return res.status(404).json({
                success: false,
                message: 'Prepaid delivery pricing settings have not been configured.'
            });
        }

        return res.json({
            success: true,
            data: {
                colombo_first_kg_charge: Number(settings.colombo_first_kg_charge),
                outside_colombo_first_kg_charge: Number(settings.outside_colombo_first_kg_charge),
                additional_kg_charge: Number(settings.additional_kg_charge)
            }
        });
    } catch (error) {
        console.error('Get prepaid delivery pricing error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to load prepaid delivery pricing.'
        });
    }
};

const updatePrepaidDeliveryPricing = async (req, res) => {
    try {
        const fields = [
            'colombo_first_kg_charge',
            'outside_colombo_first_kg_charge',
            'additional_kg_charge'
        ];

        const values = {};

        for (const field of fields) {
            const rawValue = req.body?.[field];

            if (
                rawValue === undefined ||
                rawValue === null ||
                String(rawValue).trim() === ''
            ) {
                return res.status(400).json({
                    success: false,
                    message: `A valid ${field.replaceAll('_', ' ')} is required.`
                });
            }

            const value = Number(rawValue);

            if (
                !Number.isFinite(value) ||
                value < 0 ||
                value > 9999999999.99 ||
                !/^\d{1,10}(\.\d{1,2})?$/.test(String(rawValue).trim())
            ) {
                return res.status(400).json({
                    success: false,
                    message: `${field.replaceAll('_', ' ')} must be a non-negative amount with up to two decimal places.`
                });
            }

            values[field] = value;
        }

        const settings = await PrepaidDeliverySetting.findByPk(SETTING_ID);

        if (!settings) {
            return res.status(404).json({
                success: false,
                message: 'Prepaid delivery pricing settings have not been configured.'
            });
        }

        const oldValues = {
            colombo_first_kg_charge: Number(settings.colombo_first_kg_charge),
            outside_colombo_first_kg_charge: Number(settings.outside_colombo_first_kg_charge),
            additional_kg_charge: Number(settings.additional_kg_charge)
        };

        await settings.update(values);

        try {
            await recordAuditLog({
                userId: req.user?.id ?? req.user?.user_id ?? null,
                action: 'PREPAID_DELIVERY_PRICING_UPDATED',
                module: 'DELIVERY',
                entityType: 'PrepaidDeliverySetting',
                entityId: String(SETTING_ID),
                description: 'Updated prepaid delivery pricing settings',
                oldValues,
                newValues: values,
                ipAddress: req.ip ?? null,
                userAgent: req.get?.('user-agent') ?? null,
                requestId: req.id ?? req.requestId ?? null
            });
        } catch (auditError) {
            console.error('Prepaid delivery pricing audit log failed:', auditError.message);
        }

        return res.json({
            success: true,
            message: 'Prepaid delivery pricing updated successfully.',
            data: {
                colombo_first_kg_charge: Number(settings.colombo_first_kg_charge),
                outside_colombo_first_kg_charge: Number(settings.outside_colombo_first_kg_charge),
                additional_kg_charge: Number(settings.additional_kg_charge)
            }
        });
    } catch (error) {
        console.error('Update prepaid delivery pricing error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to update prepaid delivery pricing.'
        });
    }
};

module.exports = {
    getPrepaidDeliveryPricing,
    updatePrepaidDeliveryPricing
};
