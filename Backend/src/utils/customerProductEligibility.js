'use strict';

const { Op } = require('sequelize');
const { ItemVariant, ItemPrice } = require('../models');
const { getProductsWithValidImages } = require('./productStockHistory');

async function getEligibleCustomerVariantIds(variantIds, now = new Date()) {
    const ids = [...new Set((variantIds || []).filter(id => id != null).map(String))];
    if (!ids.length) return new Set();
    const [variants, prices] = await Promise.all([
        ItemVariant.findAll({
            where: { id: { [Op.in]: ids }, is_active: true },
            attributes: ['id'],
            raw: true,
        }),
        ItemPrice.findAll({
            where: {
                variant_id: { [Op.in]: ids },
                price_type: 'selling', currency: 'LKR', is_active: true,
                price: { [Op.gt]: 0 },
                [Op.and]: [
                    { [Op.or]: [{ effective_from: null }, { effective_from: { [Op.lte]: now } }] },
                    { [Op.or]: [{ effective_to: null }, { effective_to: { [Op.gte]: now } }] },
                ],
            },
            attributes: ['variant_id'],
            raw: true,
        }),
    ]);
    const activeVariantIds = new Set(variants.map(row => String(row.id)));
    const priced = new Set(prices.map(row => String(row.variant_id)));
    return new Set([...activeVariantIds].filter(id => priced.has(id)));
}

async function hasCustomerVisibleProduct(itemId, now = new Date()) {
    if (!(await getProductsWithValidImages([itemId])).has(String(itemId))) return false;
    const variants = await ItemVariant.findAll({
        where: { item_id: itemId, is_active: true },
        attributes: ['id'],
        raw: true,
    });
    return (await getEligibleCustomerVariantIds(variants.map(row => row.id), now)).size > 0;
}

module.exports = { getEligibleCustomerVariantIds, hasCustomerVisibleProduct };
