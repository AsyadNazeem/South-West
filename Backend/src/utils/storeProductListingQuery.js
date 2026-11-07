'use strict';

const { QueryTypes } = require('sequelize');
const { getShuffleScoreExpression } = require('./storeProductPagination');

function addListCondition(column, values, replacements, key) {
    if (!Array.isArray(values) || !values.length) return '';

    replacements[key] = values;
    return `AND ${column} IN (:${key})`;
}

function buildListingExpressions(campaigns, replacements) {
    const latestVariantPrice = `
        SELECT MIN(selected_prices.price)
        FROM item_variants AS priced_variants
        INNER JOIN item_prices AS selected_prices
            ON selected_prices.id = (
                SELECT candidate.id
                FROM item_prices AS candidate
                WHERE candidate.item_id = items.id
                  AND candidate.variant_id = priced_variants.id
                  AND candidate.price_type = 'selling'
                  AND candidate.currency = 'LKR'
                  AND candidate.is_active = 1
                  AND (candidate.effective_from IS NULL
                       OR candidate.effective_from <= :now)
                  AND (candidate.effective_to IS NULL
                       OR candidate.effective_to >= :now)
                ORDER BY candidate.effective_from DESC, candidate.id DESC
                LIMIT 1
            )
        WHERE priced_variants.item_id = items.id
          AND priced_variants.is_active = 1
    `;

    const parentPrice = `
        SELECT parent_price.price
        FROM item_prices AS parent_price
        WHERE parent_price.item_id = items.id
          AND parent_price.variant_id IS NULL
          AND parent_price.price_type = 'selling'
          AND parent_price.currency = 'LKR'
          AND parent_price.is_active = 1
          AND (parent_price.effective_from IS NULL
               OR parent_price.effective_from <= :now)
          AND (parent_price.effective_to IS NULL
               OR parent_price.effective_to >= :now)
        ORDER BY parent_price.effective_from DESC, parent_price.id DESC
        LIMIT 1
    `;

    const basePrice = `
        CASE
            WHEN EXISTS (
                SELECT 1 FROM item_variants AS active_variants
                WHERE active_variants.item_id = items.id
                  AND active_variants.is_active = 1
            )
            THEN (${latestVariantPrice})
            ELSE (${parentPrice})
        END
    `;

    const campaignDiscounts = [];

    (campaigns || []).forEach((campaign, index) => {
        const key = `campaign_${index}`;
        const target = campaign.target_type;
        let targetCondition = '';

        if (target === 'all_products') {
            targetCondition = '1 = 1';
        } else if (target === 'selected_products') {
            const ids = (campaign.campaignItems || []).map(row => row.item_id);
            if (!ids.length) return;
            replacements[`${key}_ids`] = ids;
            targetCondition = `items.id IN (:${key}_ids)`;
        } else if (target === 'category') {
            const ids = (campaign.campaignCategories || []).map(row => row.category_id);
            if (!ids.length) return;
            replacements[`${key}_ids`] = ids;
            targetCondition = `items.category_id IN (:${key}_ids)`;
        } else if (target === 'brand') {
            const ids = (campaign.campaignBrands || []).map(row => row.brand_id);
            if (!ids.length) return;
            replacements[`${key}_ids`] = ids;
            targetCondition = `items.brand_id IN (:${key}_ids)`;
        } else {
            return;
        }

        const value = Number(campaign.discount_value);
        if (!Number.isFinite(value) || value <= 0) return;

        replacements[`${key}_value`] = value;

        const amount = campaign.discount_type === 'percentage'
            ? `(${basePrice} * :${key}_value / 100)`
            : `:${key}_value`;

        campaignDiscounts.push(`
            CASE WHEN ${targetCondition}
                THEN ROUND(LEAST((${basePrice}), ${amount}), 2)
                ELSE 0
            END
        `);
    });

    const bestDiscount = campaignDiscounts.length
        ? `GREATEST(${campaignDiscounts.join(', ')})`
        : '0';

    const discountedPrice = `
        ROUND(GREATEST(0, (${basePrice}) - (${bestDiscount})), 2)
    `;

    return { basePrice, bestDiscount, discountedPrice };
}

async function getEligibleProductPage({
    sequelize,
    seed,
    limit,
    cursor = null,
    now = new Date(),
    filters = {},
    sort = 'relevance',
    campaigns = [],
}) {
    const topRated = sort === 'top_rated';
    const scoreExpression = getShuffleScoreExpression(seed).val;

    const replacements = {
        now,
        limit: limit + 1,
    };

    const {
        basePrice,
        bestDiscount,
        discountedPrice,
    } = buildListingExpressions(campaigns, replacements);

    const conditions = [];

    const search = String(filters.search || '').trim();

    if (search) {
        replacements.search = `%${search}%`;
        conditions.push(`
            AND (
                items.item_name LIKE :search
                OR items.description LIKE :search
                OR EXISTS (
                    SELECT 1 FROM brands AS search_brand
                    WHERE search_brand.id = items.brand_id
                      AND search_brand.name LIKE :search
                )
            )
        `);
    }

    conditions.push(addListCondition(
        'items.category_id',
        filters.categoryIds,
        replacements,
        'categoryIds'
    ));

    conditions.push(addListCondition(
        'items.brand_id',
        filters.brandIds,
        replacements,
        'brandIds'
    ));

    conditions.push(addListCondition(
        'items.warranty_id',
        filters.warrantyIds,
        replacements,
        'warrantyIds'
    ));

    if (Array.isArray(filters.colors) && filters.colors.length) {
        replacements.colors = filters.colors.map(color =>
            String(color).trim().toLowerCase()
        );

        conditions.push(`
            AND (
                EXISTS (
                    SELECT 1
                    FROM item_colors AS direct_colors
                    WHERE direct_colors.item_id = items.id
                      AND LOWER(TRIM(direct_colors.color_name)) IN (:colors)
                )
                OR EXISTS (
                    SELECT 1
                    FROM item_variants AS color_variants
                    INNER JOIN item_variant_colors AS variant_color_links
                        ON variant_color_links.variant_id = color_variants.id
                    INNER JOIN item_colors AS variant_colors
                        ON variant_colors.id = variant_color_links.color_id
                    WHERE color_variants.item_id = items.id
                      AND LOWER(TRIM(variant_colors.color_name)) IN (:colors)
                )
            )
        `);
    }

    if (filters.minPrice !== null && Number.isFinite(filters.minPrice)) {
        replacements.minPrice = filters.minPrice;
        conditions.push(`AND (${discountedPrice}) >= :minPrice`);
    }

    if (filters.maxPrice !== null && Number.isFinite(filters.maxPrice)) {
        replacements.maxPrice = filters.maxPrice;
        conditions.push(`AND (${discountedPrice}) <= :maxPrice`);
    }

    if (!topRated && filters.minRating !== null && Number.isFinite(filters.minRating)) {
        replacements.minRating = filters.minRating;
        conditions.push(`
            AND (
                SELECT AVG(reviews.rating)
                FROM product_reviews AS reviews
                WHERE reviews.item_id = items.id
                  AND reviews.status = 'approved'
            ) >= :minRating
        `);
    }

    if (filters.inStock) {
        conditions.push(`
            AND (
                CASE
                    WHEN EXISTS (
                        SELECT 1 FROM item_variants AS stock_variants
                        WHERE stock_variants.item_id = items.id
                          AND stock_variants.is_active = 1
                    )
                    THEN EXISTS (
                        SELECT 1
                        FROM inventory_stock AS stock
                        INNER JOIN inventory_locations AS locations
                            ON locations.id = stock.location_id
                            AND locations.location_type = 'online'
                            AND locations.is_active = 1
                        INNER JOIN item_variants AS stock_variants
                            ON stock_variants.id = stock.variant_id
                            AND stock_variants.item_id = items.id
                            AND stock_variants.is_active = 1
                        WHERE stock.item_id = items.id
                          AND stock.is_active = 1
                          AND stock.quantity_on_hand > stock.quantity_reserved
                    )
                    ELSE EXISTS (
                        SELECT 1
                        FROM inventory_stock AS stock
                        INNER JOIN inventory_locations AS locations
                            ON locations.id = stock.location_id
                            AND locations.location_type = 'online'
                            AND locations.is_active = 1
                        WHERE stock.item_id = items.id
                          AND stock.variant_id IS NULL
                          AND stock.is_active = 1
                          AND stock.quantity_on_hand > stock.quantity_reserved
                    )
                END
            ) = 1
        `);
    }

    if (filters.offers) {
        conditions.push(`AND (${bestDiscount}) > 0`);
    }

    const sortOptions = {
        top_rated: {
            expression: 'approved_review_summary.rating',
            direction: 'DESC',
        },
        relevance: {
            expression: 'shuffle_score',
            direction: 'ASC',
        },
        name_asc: {
            expression: 'items.item_name',
            direction: 'ASC',
        },
        price_asc: {
            expression: 'sort_value',
            direction: 'ASC',
        },
        price_desc: {
            expression: 'sort_value',
            direction: 'DESC',
        },
    };

    const selectedSort = sortOptions[sort] || sortOptions.relevance;
    const usesSortValue = sort === 'price_asc' || sort === 'price_desc';
    const usesNameValue = sort === 'name_asc';

    const orderBy = topRated
        ? 'approved_review_summary.rating DESC, approved_review_summary.review_count DESC, items.id ASC'
        : usesSortValue
        ? `sort_value ${selectedSort.direction}, shuffle_score ASC, items.id ASC`
        : usesNameValue
            ? 'items.item_name ASC, shuffle_score ASC, items.id ASC'
            : 'shuffle_score ASC, items.id ASC';

    let cursorCondition = '';

    if (cursor) {
        replacements.cursorScore = cursor.score;
        replacements.cursorId = cursor.id;

        if (usesSortValue) {
            if (cursor.sortValue === undefined) {
                throw new Error('Missing sort value in price cursor.');
            }

            replacements.cursorSortValue = cursor.sortValue;
            const comparison = sort === 'price_desc' ? '<' : '>';

            cursorCondition = `
                AND (
                    (${discountedPrice}) ${comparison} :cursorSortValue
                    OR (
                        (${discountedPrice}) = :cursorSortValue
                        AND (
                            ${scoreExpression} > :cursorScore
                            OR (
                                ${scoreExpression} = :cursorScore
                                AND items.id > :cursorId
                            )
                        )
                    )
                )
            `;
        } else if (usesNameValue) {
            replacements.cursorSortValue = cursor.sortValue;

            cursorCondition = `
                AND (
                    items.item_name > :cursorSortValue
                    OR (
                        items.item_name = :cursorSortValue
                        AND (
                            ${scoreExpression} > :cursorScore
                            OR (
                                ${scoreExpression} = :cursorScore
                                AND items.id > :cursorId
                            )
                        )
                    )
                )
            `;
        } else {
            cursorCondition = `
                AND (
                    ${scoreExpression} > :cursorScore
                    OR (
                        ${scoreExpression} = :cursorScore
                        AND items.id > :cursorId
                    )
                )
            `;
        }
    }

    const approvedReviewJoin = topRated ? `
        INNER JOIN (
            SELECT item_id, AVG(rating) AS rating, COUNT(*) AS review_count
            FROM product_reviews
            WHERE status = 'approved'
            GROUP BY item_id
        ) AS approved_review_summary
            ON approved_review_summary.item_id = items.id
    ` : '';
    const topRatedCondition = topRated
        ? 'AND approved_review_summary.rating >= :minRating'
        : '';
    if (topRated) replacements.minRating = Number.isFinite(filters.minRating) ? filters.minRating : 4;

    const sql = `
        SELECT
            items.id,
            ${topRated ? 'NULL' : scoreExpression} AS shuffle_score,
            ${usesSortValue ? discountedPrice : usesNameValue ? 'items.item_name' : 'NULL'} AS sort_value
            ${topRated ? ', approved_review_summary.rating AS rating, approved_review_summary.review_count AS review_count' : ''}
        FROM items
        ${approvedReviewJoin}
        WHERE
            items.is_active = 1
            AND (${basePrice}) IS NOT NULL
            ${topRatedCondition}
            ${conditions.join('\n')}
            ${cursorCondition}
        ORDER BY ${orderBy}
        LIMIT :limit
    `;

    return sequelize.query(sql, {
        replacements,
        type: QueryTypes.SELECT,
    });
}

async function getEligibleBrandIds({ sequelize, now = new Date() }) {
    const replacements = { now };
    const { basePrice } = buildListingExpressions([], replacements);
    const sql = `
        SELECT DISTINCT items.brand_id
        FROM items
        WHERE items.is_active = 1
          AND items.brand_id IS NOT NULL
          AND (${basePrice}) IS NOT NULL
        ORDER BY items.brand_id ASC
    `;
    const rows = await sequelize.query(sql, {
        replacements,
        type: QueryTypes.SELECT,
    });
    return rows.map(row => row.brand_id).filter(id => id !== null && id !== undefined);
}

module.exports = {
    getEligibleProductPage,
    getEligibleBrandIds,
};
