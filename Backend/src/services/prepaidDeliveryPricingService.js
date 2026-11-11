'use strict';

const { PrepaidDeliverySetting } = require('../models');

const PREPAID_METHODS = new Set(['card', 'koko', 'mintpay']);

function roundMoney(value) {
    return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

async function calculateDeliveryCharge({
    paymentMethod = 'cash',
    district,
    area,
    totalWeightKg,
    transaction
}) {
    const weight = Number(totalWeightKg);

    if (!Number.isFinite(weight) || weight < 0) {
        throw new Error('Invalid total delivery weight.');
    }

    const billableKg = Math.max(1, Math.ceil(weight));
    const normalizedMethod = String(paymentMethod || 'cash')
        .trim()
        .toLowerCase();

    let firstKgCharge;
    let additionalKgCharge;

    if (PREPAID_METHODS.has(normalizedMethod)) {
        const settings = await PrepaidDeliverySetting.findByPk(1, {
            transaction
        });

        if (!settings) {
            throw new Error('Prepaid delivery pricing settings are not configured.');
        }

        const isColombo =
            String(district?.district_name || '').trim().toLowerCase() === 'colombo';

        firstKgCharge = Number(
            isColombo
                ? settings.colombo_first_kg_charge
                : settings.outside_colombo_first_kg_charge
        );

        additionalKgCharge = Number(settings.additional_kg_charge);
    } else if (normalizedMethod === 'cash') {
        if (!area) {
            throw new Error('Delivery area is required for cash on delivery.');
        }

        firstKgCharge = Number(area.first_kg_charge);
        additionalKgCharge = Number(area.additional_kg_charge);
    } else {
        throw new Error('Invalid payment method for delivery calculation.');
    }

    if (
        !Number.isFinite(firstKgCharge) ||
        firstKgCharge < 0 ||
        !Number.isFinite(additionalKgCharge) ||
        additionalKgCharge < 0
    ) {
        throw new Error('Delivery pricing contains invalid charge values.');
    }

    const deliveryCharge = roundMoney(
        firstKgCharge + (billableKg - 1) * additionalKgCharge
    );

    return {
        deliveryCharge,
        normalDeliveryCharge: roundMoney(firstKgCharge),
        additionalShippingAmount: roundMoney(
            (billableKg - 1) * additionalKgCharge
        ),
        billableKg,
        firstKgCharge: roundMoney(firstKgCharge),
        additionalKgCharge: roundMoney(additionalKgCharge)
    };
}

module.exports = {
    calculateDeliveryCharge,
    PREPAID_METHODS
};
