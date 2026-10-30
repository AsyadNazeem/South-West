'use strict';

const { QueryTypes } = require('sequelize');
const { Item } = require('../models');

const TIMEZONE = 'Asia/Colombo';

function parseDateRange(query = {}) {
    const { startDate, endDate } = query;
    const pattern = /^\d{4}-\d{2}-\d{2}$/;

    function valid(value) {
        if (typeof value !== 'string' || !pattern.test(value)) return false;

        const [year, month, day] = value.split('-').map(Number);
        const date = new Date(Date.UTC(year, month - 1, day));

        return date.getUTCFullYear() === year &&
            date.getUTCMonth() === month - 1 &&
            date.getUTCDate() === day;
    }

    if (!valid(startDate) || !valid(endDate) || startDate > endDate) {
        const error = new Error(
            'Valid startDate and endDate are required (YYYY-MM-DD)'
        );
        error.status = 400;
        throw error;
    }

    const next = new Date(`${endDate}T00:00:00.000Z`);
    next.setUTCDate(next.getUTCDate() + 1);

    const nextDate = [
        next.getUTCFullYear(),
        String(next.getUTCMonth() + 1).padStart(2, '0'),
        String(next.getUTCDate()).padStart(2, '0')
    ].join('-');

    return {
        startDate,
        endDate,
        start: `${startDate} 00:00:00`,
        endExclusive: `${nextDate} 00:00:00`
    };
}

function quantity(value) {
    return Number(Number(value || 0).toFixed(3));
}

function metadata(report, filters = {}) {
    return {
        report,
        timezone: TIMEZONE,
        currency: 'LKR',
        filters
    };
}

async function runQuery(sql, replacements = {}) {
    return Item.sequelize.query(sql, {
        replacements,
        type: QueryTypes.SELECT
    });
}

function stockFilters(query = {}) {
    const replacements = {};
    let condition = '';

    if (query.locationId !== undefined && query.locationId !== '') {
        const id = Number(query.locationId);

        if (!Number.isInteger(id) || id <= 0) {
            const error = new Error('locationId must be a positive integer');
            error.status = 400;
            throw error;
        }

        condition += ' AND s.location_id = :locationId';
        replacements.locationId = id;
    }

    if (query.itemId !== undefined && query.itemId !== '') {
        const id = Number(query.itemId);

        if (!Number.isInteger(id) || id <= 0) {
            const error = new Error('itemId must be a positive integer');
            error.status = 400;
            throw error;
        }

        condition += ' AND s.item_id = :itemId';
        replacements.itemId = id;
    }

    return { condition, replacements };
}

const STOCK_SELECT = `
    SELECT
        s.id AS stockId,
        s.item_id AS itemId,
        i.item_code AS itemCode,
        i.item_name AS itemName,
        s.variant_id AS variantId,
        v.variant_sku AS variantSku,
        v.variant_name AS variantName,
        v.attributes AS attributes,
        s.location_id AS locationId,
        l.code AS locationCode,
        l.name AS locationName,
        l.location_type AS locationType,
        s.quantity_on_hand AS quantityOnHand,
        s.quantity_reserved AS quantityReserved,
        GREATEST(s.quantity_on_hand - s.quantity_reserved, 0) AS availableQuantity,
        s.reorder_level AS reorderLevel,
        s.reorder_quantity AS reorderQuantity
    FROM inventory_stock s
    INNER JOIN items i ON i.id = s.item_id
    LEFT JOIN item_variants v ON v.id = s.variant_id
    INNER JOIN inventory_locations l ON l.id = s.location_id
    WHERE s.is_active = 1
`;

function formatStockRows(rows) {
    return rows.map(row => ({
        stockId: String(row.stockId),
        itemId: String(row.itemId),
        itemCode: row.itemCode,
        itemName: row.itemName,
        variantId: row.variantId === null ? null : String(row.variantId),
        variantSku: row.variantSku || null,
        variantName: row.variantName || 'No variant',
        attributes: row.attributes || null,
        locationId: String(row.locationId),
        locationCode: row.locationCode,
        locationName: row.locationName,
        locationType: row.locationType,
        quantityOnHand: quantity(row.quantityOnHand),
        quantityReserved: quantity(row.quantityReserved),
        availableQuantity: quantity(row.availableQuantity),
        reorderLevel: quantity(row.reorderLevel),
        reorderQuantity: quantity(row.reorderQuantity)
    }));
}

function stockTotals(rows) {
    return {
        stockRecordCount: rows.length,
        quantityOnHand: quantity(
            rows.reduce((sum, row) => sum + row.quantityOnHand, 0)
        ),
        quantityReserved: quantity(
            rows.reduce((sum, row) => sum + row.quantityReserved, 0)
        ),
        availableQuantity: quantity(
            rows.reduce((sum, row) => sum + row.availableQuantity, 0)
        )
    };
}

async function getStockSummary(query = {}) {
    const filters = stockFilters(query);

    const rows = await runQuery(
        `${STOCK_SELECT} ${filters.condition}
         ORDER BY i.item_name ASC, v.variant_name ASC, l.name ASC`,
        filters.replacements
    );

    const formatted = formatStockRows(rows);

    return {
        ...metadata('inventory-stock-summary', {
            locationId: query.locationId || null,
            itemId: query.itemId || null
        }),
        totals: stockTotals(formatted),
        rows: formatted
    };
}

async function getLowStock(query = {}) {
    const filters = stockFilters(query);

    const rows = await runQuery(
        `${STOCK_SELECT}
         ${filters.condition}
         AND s.quantity_on_hand <= s.reorder_level
         AND s.reorder_level > 0
         ORDER BY s.quantity_on_hand ASC, i.item_name ASC`,
        filters.replacements
    );

    const formatted = formatStockRows(rows);

    return {
        ...metadata('low-stock', {
            locationId: query.locationId || null,
            itemId: query.itemId || null
        }),
        totals: stockTotals(formatted),
        lowStockCount: formatted.length,
        rows: formatted
    };
}

async function getOutOfStock(query = {}) {
    const filters = stockFilters(query);

    const rows = await runQuery(
        `${STOCK_SELECT}
         ${filters.condition}
         AND (s.quantity_on_hand - s.quantity_reserved) <= 0
         ORDER BY i.item_name ASC, v.variant_name ASC`,
        filters.replacements
    );

    const formatted = formatStockRows(rows);

    return {
        ...metadata('out-of-stock', {
            locationId: query.locationId || null,
            itemId: query.itemId || null
        }),
        totals: stockTotals(formatted),
        outOfStockCount: formatted.length,
        rows: formatted
    };
}

async function getStockByLocation(query = {}) {
    const filters = stockFilters(query);

    const rows = await runQuery(
        `
        SELECT
            l.id AS locationId,
            l.code AS locationCode,
            l.name AS locationName,
            l.location_type AS locationType,
            COUNT(s.id) AS stockRecordCount,
            COALESCE(SUM(s.quantity_on_hand), 0) AS quantityOnHand,
            COALESCE(SUM(s.quantity_reserved), 0) AS quantityReserved,
            COALESCE(SUM(
                GREATEST(s.quantity_on_hand - s.quantity_reserved, 0)
            ), 0) AS availableQuantity
        FROM inventory_locations l
        LEFT JOIN inventory_stock s
            ON s.location_id = l.id
            AND s.is_active = 1
            ${filters.condition.replaceAll('s.', 's.')}
        WHERE l.is_active = 1
        GROUP BY l.id, l.code, l.name, l.location_type
        ORDER BY l.name ASC
        `,
        filters.replacements
    );

    const formatted = rows.map(row => ({
        locationId: String(row.locationId),
        locationCode: row.locationCode,
        locationName: row.locationName,
        locationType: row.locationType,
        stockRecordCount: Number(row.stockRecordCount || 0),
        quantityOnHand: quantity(row.quantityOnHand),
        quantityReserved: quantity(row.quantityReserved),
        availableQuantity: quantity(row.availableQuantity)
    }));

    return {
        ...metadata('stock-by-location', {
            locationId: query.locationId || null,
            itemId: query.itemId || null
        }),
     totals: {
    locationCount: formatted.length,
    stockRecordCount: formatted.reduce(
        (sum, row) => sum + row.stockRecordCount, 0
    ),
    quantityOnHand: quantity(
        formatted.reduce((sum, row) => sum + row.quantityOnHand, 0)
    ),
    quantityReserved: quantity(
        formatted.reduce((sum, row) => sum + row.quantityReserved, 0)
    ),
    availableQuantity: quantity(
        formatted.reduce((sum, row) => sum + row.availableQuantity, 0)
    )
},
        rows: formatted
    };
}

function movementFilters(query = {}) {
    const range = parseDateRange(query);
    const replacements = {
        start: range.start,
        endExclusive: range.endExclusive
    };

    let condition = `
        AND m.created_at >= :start
        AND m.created_at < :endExclusive
    `;

    for (const field of ['itemId', 'variantId', 'locationId']) {
        if (query[field] !== undefined && query[field] !== '') {
            const id = Number(query[field]);

            if (!Number.isInteger(id) || id <= 0) {
                const error = new Error(`${field} must be a positive integer`);
                error.status = 400;
                throw error;
            }

            const column = {
                itemId: 'm.item_id',
                variantId: 'm.variant_id',
                locationId: 'm.location_id'
            }[field];

            condition += ` AND ${column} = :${field}`;
            replacements[field] = id;
        }
    }

    if (query.movementType) {
        const allowed = [
            'purchase',
            'goods_receipt',
            'sale',
            'customer_return',
            'supplier_return',
            'adjustment',
            'transfer_in',
            'transfer_out'
        ];

        if (!allowed.includes(query.movementType)) {
            const error = new Error('Invalid movementType');
            error.status = 400;
            throw error;
        }

        condition += ' AND m.movement_type = :movementType';
        replacements.movementType = query.movementType;
    }

    return { range, condition, replacements };
}

const MOVEMENT_SELECT = `
    SELECT
        m.id AS movementId,
        m.item_id AS itemId,
        i.item_code AS itemCode,
        i.item_name AS itemName,
        m.variant_id AS variantId,
        v.variant_sku AS variantSku,
        v.variant_name AS variantName,
        v.attributes AS attributes,
        m.location_id AS locationId,
        l.code AS locationCode,
        l.name AS locationName,
        m.movement_type AS movementType,
        m.quantity AS quantity,
        m.reference_type AS referenceType,
        m.reference_id AS referenceId,
        m.notes AS notes,
        m.created_by AS createdBy,
        u.email AS createdByEmail,
        m.created_at AS createdAt
    FROM inventory_stock_movements m
    INNER JOIN items i ON i.id = m.item_id
    LEFT JOIN item_variants v ON v.id = m.variant_id
    INNER JOIN inventory_locations l ON l.id = m.location_id
    LEFT JOIN users u ON u.id = m.created_by
`;

function signedAdjustment(notes) {
    if (!notes) return null;

    const match = String(notes).match(
        /Signed difference:\s*([+-]?\d+(?:\.\d+)?)/i
    );

    if (!match) return null;

    const value = Number(match[1]);
    return Number.isFinite(value) ? quantity(value) : null;
}

function formatMovementRows(rows) {
    return rows.map(row => {
        const type = row.movementType;
        const recordedQuantity = quantity(row.quantity);

        let direction = 'unknown';
        let signedQuantity = null;

        if (type === 'adjustment') {
            signedQuantity = signedAdjustment(row.notes);

            if (signedQuantity !== null) {
                direction = signedQuantity > 0
                    ? 'stock_in'
                    : signedQuantity < 0
                        ? 'stock_out'
                        : 'no_change';
            }
        } else if (
            ['purchase', 'goods_receipt', 'customer_return', 'transfer_in']
                .includes(type)
        ) {
            direction = 'stock_in';
            signedQuantity = recordedQuantity;
        } else if (
            ['sale', 'supplier_return', 'transfer_out'].includes(type)
        ) {
            direction = 'stock_out';
            signedQuantity = -recordedQuantity;
        }

        return {
            movementId: String(row.movementId),
            itemId: String(row.itemId),
            itemCode: row.itemCode,
            itemName: row.itemName,
            variantId: row.variantId === null ? null : String(row.variantId),
            variantSku: row.variantSku || null,
            variantName: row.variantName || 'No variant',
            attributes: row.attributes || null,
            locationId: String(row.locationId),
            locationCode: row.locationCode,
            locationName: row.locationName,
            movementType: type,
            direction,
            quantity: recordedQuantity,
            signedQuantity,
            referenceType: row.referenceType,
            referenceId: row.referenceId === null ? null : String(row.referenceId),
            notes: row.notes,
            createdBy: row.createdBy === null ? null : String(row.createdBy),
            createdByEmail: row.createdByEmail || null,
            createdAt: row.createdAt
        };
    });
}

function movementTotals(rows) {
    return {
        movementCount: rows.length,
        stockIn: quantity(rows.reduce(
            (sum, row) => sum + (
                row.direction === 'stock_in' ? row.quantity : 0
            ), 0
        )),
        stockOut: quantity(rows.reduce(
            (sum, row) => sum + (
                row.direction === 'stock_out' ? row.quantity : 0
            ), 0
        )),
        adjustmentIncrease: quantity(rows.reduce(
            (sum, row) => sum + (
                row.direction === 'stock_in' &&
                row.movementType === 'adjustment'
                    ? row.quantity
                    : 0
            ), 0
        )),
        adjustmentDecrease: quantity(rows.reduce(
            (sum, row) => sum + (
                row.direction === 'stock_out' &&
                row.movementType === 'adjustment'
                    ? row.quantity
                    : 0
            ), 0
        )),
        unknownAdjustmentCount: rows.filter(
            row => row.movementType === 'adjustment' &&
                row.direction === 'unknown'
        ).length
    };
}

async function getStockMovements(query = {}) {
    const filters = movementFilters(query);

    const rows = await runQuery(
        `${MOVEMENT_SELECT}
         WHERE 1 = 1 ${filters.condition}
         ORDER BY m.created_at DESC, m.id DESC`,
        filters.replacements
    );

    const formatted = formatMovementRows(rows);

    return {
        ...metadata('stock-movement-history', {
            startDate: filters.range.startDate,
            endDate: filters.range.endDate,
            itemId: query.itemId || null,
            variantId: query.variantId || null,
            locationId: query.locationId || null,
            movementType: query.movementType || null
        }),
        totals: movementTotals(formatted),
        rows: formatted
    };
}

async function getStockAdjustments(query = {}) {
    const filters = movementFilters({
        ...query,
        movementType: 'adjustment'
    });

    const rows = await runQuery(
        `${MOVEMENT_SELECT}
         WHERE 1 = 1 ${filters.condition}
         ORDER BY m.created_at DESC, m.id DESC`,
        filters.replacements
    );

    const formatted = formatMovementRows(rows);

    return {
        ...metadata('stock-adjustments', {
            startDate: filters.range.startDate,
            endDate: filters.range.endDate,
            itemId: query.itemId || null,
            variantId: query.variantId || null,
            locationId: query.locationId || null
        }),
        totals: movementTotals(formatted),
        rows: formatted
    };
}

module.exports = {
    getStockSummary,
    getLowStock,
    getOutOfStock,
    getStockByLocation,
    getStockMovements,
    getStockAdjustments
};
