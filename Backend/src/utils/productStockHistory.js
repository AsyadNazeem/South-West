'use strict';

const { Op } = require('sequelize');
const { InventoryStock, InventoryStockMovement } = require('../models');

const POSITIVE_MOVEMENT_TYPES = [
    'purchase',
    'goods_receipt',
    'customer_return',
    'transfer_in',
];

function hasPositiveAdjustment(notes) {
    const match = String(notes || '').match(/Signed difference:\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+))/i);
    return Boolean(match && Number(match[1]) > 0);
}

async function getProductsWithStockEvidence(itemIds) {
    const ids = [...new Set((itemIds || []).filter(id => id != null).map(String))];
    if (!ids.length) return new Set();

    const [positiveStocks, movements] = await Promise.all([
        InventoryStock.findAll({
            where: {
                item_id: { [Op.in]: ids },
                variant_id: { [Op.ne]: null },
                quantity_on_hand: { [Op.gt]: 0 },
            },
            attributes: ['item_id', 'quantity_on_hand'],
            raw: true,
        }),
        InventoryStockMovement.findAll({
            where: {
                item_id: { [Op.in]: ids },
                variant_id: { [Op.ne]: null },
                movement_type: { [Op.in]: [...POSITIVE_MOVEMENT_TYPES, 'adjustment'] },
                quantity: { [Op.gt]: 0 },
            },
            attributes: ['item_id', 'movement_type', 'quantity', 'notes'],
            raw: true,
        }),
    ]);

    const visibleIds = new Set(
        positiveStocks
            .filter(row => Number(row.quantity_on_hand) > 0)
            .map(row => String(row.item_id))
    );
    for (const movement of movements) {
        if (!(Number(movement.quantity) > 0)) continue;
        if (
            POSITIVE_MOVEMENT_TYPES.includes(movement.movement_type) ||
            (movement.movement_type === 'adjustment' && hasPositiveAdjustment(movement.notes))
        ) {
            visibleIds.add(String(movement.item_id));
        }
    }

    return visibleIds;
}

async function hasProductStockEvidence(itemId) {
    const ids = await getProductsWithStockEvidence([itemId]);
    return ids.has(String(itemId));
}

async function getVariantsWithStockEvidence(variantIds) {
    const ids = [...new Set((variantIds || []).filter(id => id != null).map(String))];
    if (!ids.length) return new Set();

    const [stocks, movements] = await Promise.all([
        InventoryStock.findAll({
            where: { variant_id: { [Op.in]: ids }, quantity_on_hand: { [Op.gt]: 0 } },
            attributes: ['variant_id', 'quantity_on_hand'],
            raw: true,
        }),
        InventoryStockMovement.findAll({
            where: {
                variant_id: { [Op.in]: ids },
                movement_type: { [Op.in]: [...POSITIVE_MOVEMENT_TYPES, 'adjustment'] },
                quantity: { [Op.gt]: 0 },
            },
            attributes: ['variant_id', 'movement_type', 'quantity', 'notes'],
            raw: true,
        }),
    ]);

    const eligible = new Set(stocks
        .filter(row => Number(row.quantity_on_hand) > 0)
        .map(row => String(row.variant_id)));
    for (const movement of movements) {
        if (Number(movement.quantity) <= 0) continue;
        if (POSITIVE_MOVEMENT_TYPES.includes(movement.movement_type) ||
            (movement.movement_type === 'adjustment' && hasPositiveAdjustment(movement.notes))) {
            eligible.add(String(movement.variant_id));
        }
    }
    return eligible;
}

async function getProductsWithValidImages(itemIds) {
    const ids = [...new Set((itemIds || []).filter(id => id != null).map(String))];
    if (!ids.length) return new Set();
    const { ItemImage } = require('../models');
    const { Op } = require('sequelize');
    const { isValidUploadedImagePath } = require('./fileStorage');
    const images = await ItemImage.findAll({
        where: { item_id: { [Op.in]: ids }, is_active: true },
        attributes: ['item_id', 'file_path'],
        raw: true,
    });
    const valid = new Set();
    await Promise.all(images.map(async image => {
        if (await isValidUploadedImagePath(image.file_path)) valid.add(String(image.item_id));
    }));
    return valid;
}

async function getAllProductsWithValidImages() {
    const { ItemImage } = require('../models');
    const { Op } = require('sequelize');
    const { isValidUploadedImagePath } = require('./fileStorage');
    const images = await ItemImage.findAll({
        where: { is_active: true, file_path: { [Op.ne]: null } },
        attributes: ['item_id', 'file_path'],
        raw: true,
    });
    const valid = new Set();
    await Promise.all(images.map(async image => {
        if (await isValidUploadedImagePath(image.file_path)) valid.add(String(image.item_id));
    }));
    return valid;
}

module.exports = {
    POSITIVE_MOVEMENT_TYPES,
    hasPositiveAdjustment,
    getProductsWithStockEvidence,
    hasProductStockEvidence,
    getVariantsWithStockEvidence,
    getProductsWithValidImages,
    getAllProductsWithValidImages,
};
