
'use strict';

const {
    ItemPaymentPrice,
    Item,
    ItemVariant,
    sequelize
} = require('../models');

const PAYMENT_METHODS = ['cash', 'card', 'koko', 'mintpay'];

const getItemPaymentPrices = async (req, res) => {
    try {
        const { item_id, variant_id } = req.query;

        if (!item_id || !Number.isInteger(Number(item_id))) {
            return res.status(400).json({
                message: 'A valid item_id is required.'
            });
        }

        const where = {
            item_id: Number(item_id),
            variant_id: variant_id ? Number(variant_id) : null
        };

        if (variant_id && !Number.isInteger(Number(variant_id))) {
            return res.status(400).json({
                message: 'Invalid variant_id.'
            });
        }

        const prices = await ItemPaymentPrice.findAll({
            where,
            order: [['payment_method', 'ASC']]
        });

        return res.status(200).json({
            message: 'Payment prices retrieved successfully.',
            data: prices
        });
    } catch (error) {
        console.error('Get item payment prices error:', error);
        return res.status(500).json({
            message: 'Failed to retrieve payment prices.'
        });
    }
};

const saveItemPaymentPrices = async (req, res) => {
    const transaction = await sequelize.transaction();

    try {
        const { item_id, variant_id = null, currency = 'LKR', prices } = req.body;

        if (!Number.isInteger(Number(item_id)) || Number(item_id) <= 0) {
            await transaction.rollback();
            return res.status(400).json({
                message: 'A valid item_id is required.'
            });
        }

        if (
            variant_id !== null &&
            (!Number.isInteger(Number(variant_id)) || Number(variant_id) <= 0)
        ) {
            await transaction.rollback();
            return res.status(400).json({
                message: 'Invalid variant_id.'
            });
        }

        if (!Array.isArray(prices)) {
            await transaction.rollback();
            return res.status(400).json({
                message: 'prices must be an array.'
            });
        }

        const item = await Item.findByPk(Number(item_id), { transaction });

        if (!item) {
            await transaction.rollback();
            return res.status(404).json({
                message: 'Item not found.'
            });
        }

        if (variant_id !== null) {
            const variant = await ItemVariant.findOne({
                where: {
                    id: Number(variant_id),
                    item_id: Number(item_id)
                },
                transaction
            });

            if (!variant) {
                await transaction.rollback();
                return res.status(400).json({
                    message: 'The selected variant does not belong to this item.'
                });
            }
        }

        for (const entry of prices) {
            const method = String(entry.payment_method || '').toLowerCase();
            const amount = Number(entry.price);

            if (!PAYMENT_METHODS.includes(method)) {
                await transaction.rollback();
                return res.status(400).json({
                    message: `Invalid payment method: ${method}`
                });
            }

            if (!Number.isFinite(amount) || amount <= 0) {
                await transaction.rollback();
                return res.status(400).json({
                    message: `A price greater than zero is required for ${method}.`
                });
            }

            const where = {
                item_id: Number(item_id),
                variant_id: variant_id === null ? null : Number(variant_id),
                payment_method: method
            };

            const existing = await ItemPaymentPrice.findOne({
                where,
                transaction
            });

            if (existing) {
                await existing.update({
                    price: amount,
                    currency,
                    is_active: entry.is_active !== false
                }, { transaction });
            } else {
                await ItemPaymentPrice.create({
                    ...where,
                    price: amount,
                    currency,
                    is_active: entry.is_active !== false
                }, { transaction });
            }
        }

        await transaction.commit();

        const savedPrices = await ItemPaymentPrice.findAll({
            where: {
                item_id: Number(item_id),
                variant_id: variant_id === null ? null : Number(variant_id)
            },
            order: [['payment_method', 'ASC']]
        });

        return res.status(200).json({
            message: 'Payment prices saved successfully.',
            data: savedPrices
        });
    } catch (error) {
        if (!transaction.finished) {
            await transaction.rollback();
        }

        console.error('Save item payment prices error:', error);

        return res.status(500).json({
            message: 'Failed to save payment prices.'
        });
    }
};

module.exports = {
    getItemPaymentPrices,
    saveItemPaymentPrices
};
