
'use strict';

const { Op, QueryTypes } = require('sequelize');
const db = require('../models');

const {
    DEFAULT_LIMIT,
    createSeed,
    parseLimit,
    validateSeed,
    createQueryFingerprint,
    createCursor,
    parseCursor,
} = require('../utils/storeProductPagination');

const {
    getEligibleProductPage,
} = require('../utils/storeProductListingQuery');
const {
    Item,
    ItemVariant,
    ItemPrice,
    ItemPaymentPrice,
    Brand,
    Category,
    Warranty,
    ItemImage,
    ItemSpecificationValue,
    ItemSpecification,
    InventoryStock,
    InventoryLocation,
    ProductReview,
    ItemColor,
} = require('../models');

const {
    getActiveCampaigns,
    campaignTargetsItem,
    calculateDiscount,
    getBestVisualCampaignForItem
} = require('../services/discountCampaignService');

const {
    buildFileUrl,
    getResponsiveImageMetadata,
} = require('../utils/fileStorage');

async function getStoreProducts(req, res) {
    try {
        const now = new Date();

        const campaigns = await getActiveCampaigns(now);

        // Pagination is opt-in until frontend filters and sorting are integrated.
        const paginationEnabled = req.query.paginate === '1';
        const limit = paginationEnabled
            ? parseLimit(req.query.limit)
            : null;

        let pagination = null;
        let selectedIds = Array.isArray(req._storeProductIds)
            ? req._storeProductIds.map(String)
            : null;

        if (paginationEnabled) {
            const seed = req.query.seed || createSeed();

            if (!validateSeed(seed)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid pagination seed',
                });
            }

            const filters = {
                search: String(req.query.search || '').trim(),
                categoryIds: String(req.query.categoryIds || '')
                    .split(',')
                    .map(value => value.trim())
                    .filter(value => /^[1-9]\d*$/.test(value)),
                brandIds: String(req.query.brandIds || '')
                    .split(',')
                    .map(value => value.trim())
                    .filter(value => /^[1-9]\d*$/.test(value)),
                warrantyIds: String(req.query.warrantyIds || '')
                    .split(',')
                    .map(value => value.trim())
                    .filter(value => /^[1-9]\d*$/.test(value)),
                colors: String(req.query.colors || '')
                    .split(',')
                    .map(value => value.trim())
                    .filter(Boolean),
                minPrice: req.query.minPrice === undefined
                    ? null
                    : Number(req.query.minPrice),
                maxPrice: req.query.maxPrice === undefined
                    ? null
                    : Number(req.query.maxPrice),
                minRating: req.query.minRating === undefined
                    ? null
                    : Number(req.query.minRating),
                inStock: req.query.inStock === '1',
                offers: req.query.offers === '1',
            };

            const sort = ['relevance', 'name_asc', 'price_asc', 'price_desc'].includes(req.query.sort)
                ? req.query.sort
                : 'relevance';

            const queryHash = createQueryFingerprint({
                filters,
                sort,
                campaigns,
            });

            const cursor = req.query.cursor
                ? parseCursor(
                    req.query.cursor,
                    seed,
                    queryHash
                )
                : null;

            if (req.query.cursor && !cursor) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid or expired pagination cursor',
                });
            }

            const pageRows = await getEligibleProductPage({
                sequelize: db.sequelize,
                seed,
                limit,
                cursor,
                now,
                filters,
                sort,
                campaigns,
            });

            const hasMore = pageRows.length > limit;
            const currentPage = hasMore
                ? pageRows.slice(0, limit)
                : pageRows;

            selectedIds = currentPage.map(row => String(row.id));

            const lastRow = currentPage[currentPage.length - 1];

            pagination = {
                limit,
                seed,
                hasMore,
                nextCursor: hasMore && lastRow
                    ? createCursor(
                        lastRow.shuffle_score,
                        String(lastRow.id),
                        seed,
                        queryHash,
                        undefined,
                        lastRow.sort_value
                    )
                    : null,
            };
        }

        // Only active products are publicly visible.
        const items = await Item.findAll({
            where: {
                is_active: true,
                ...(typeof req.query.publicId === 'string' && req.query.publicId.trim()
                    ? { public_id: req.query.publicId.trim() }
                    : {}),
                ...(selectedIds
                    ? { id: { [Op.in]: selectedIds } }
                    : {}),
            },
            attributes: [
                'id',
                'public_id',
'slug',
                'item_code',
                'item_name',
                'description',
                'category_id',
                'brand_id',
                'item_type_id',
                'warranty_id',
                'condition',
                'shipping_weight',
                'shipping_weight_unit',
            ],
            include: [
                {
                    model: Brand,
                    as: 'brand',
                    attributes: ['id', 'name'],
                    required: false,
                    where: { is_active: true },
                },
                {
                    model: Category,
                    as: 'category',
                    attributes: ['id', 'name'],
                    required: false,
                    where: { is_active: true },
                },
                {
                    model: Warranty,
                    as: 'warranty',
                    attributes: [
                        'id',
                        'name',
                        'duration_value',
                        'duration_unit',
                    ],
                    required: false,
                    where: { is_active: true },
                },
                {
                    model: ItemImage,
                    as: 'images',
                    attributes: [
                        'id',
                        'file_name',
                        'file_path',
                        'alt_text',
                        'sort_order',
                        'is_primary',
                        'url',
                    ],
                    required: false,
                    where: { is_active: true },
                },
                {
                    model: ItemSpecificationValue,
                    as: 'specificationValues',
                    attributes: ['id', 'value'],
                    required: false,
                    include: [
                        {
                            model: ItemSpecification,
                            as: 'specification',
                            attributes: ['id', 'name', 'code'],
                            required: true,
                            where: { is_active: true },
                        },
                    ],
                },
            ],
            order: [['item_name', 'ASC']],
        });

        // Restore the exact database shuffle order after fetching associations.
        if (selectedIds) {
            const orderIndex = new Map(
                selectedIds.map((id, index) => [id, index])
            );

            items.sort(
                (a, b) =>
                    orderIndex.get(String(a.id)) -
                    orderIndex.get(String(b.id))
            );
        }

        const ids = items.map(item => item.id);

        if (!ids.length) {
            return res.status(200).json({
                success: true,
                message: 'Store products retrieved successfully',
                data: [],
                ...(paginationEnabled ? {
                    pagination: {
                        ...pagination,
                        hasMore: false,
                        nextCursor: null,
                    },
                } : {}),
            });
        }

        const variants = await ItemVariant.findAll({
            where: {
                item_id: { [Op.in]: ids },
                is_active: true,
            },
            attributes: ['id', 'item_id'],
            order: [['id', 'ASC']],
        });

        const variantsByItem = new Map();
        const variantIds = variants.map(variant => variant.id);

        for (const variant of variants) {
            const key = String(variant.item_id);

            if (!variantsByItem.has(key)) {
                variantsByItem.set(key, []);
            }

            variantsByItem.get(key).push(variant);
        }

        const priceWhere = {
            item_id: { [Op.in]: ids },
            price_type: 'selling',
            currency: 'LKR',
            is_active: true,
            [Op.and]: [
                {
                    [Op.or]: [
                        { effective_from: null },
                        { effective_from: { [Op.lte]: now } },
                    ],
                },
                {
                    [Op.or]: [
                        { effective_to: null },
                        { effective_to: { [Op.gte]: now } },
                    ],
                },
            ],
        };

        const priceConditions = variantIds.length
            ? [
                { variant_id: { [Op.in]: variantIds } },
                {
                    variant_id: null,
                    item_id: { [Op.in]: ids },
                },
            ]
            : [{ variant_id: null }];

        const pricesPromise = ItemPrice.findAll({
            where: {
                ...priceWhere,
                [Op.or]: priceConditions,
            },
            attributes: [
                'id',
                'item_id',
                'variant_id',
                'price',
                'currency',
                'effective_from',
                'effective_to',
            ],
            order: [
                ['effective_from', 'DESC'],
                ['id', 'DESC'],
            ],
        });

        const stockWhere = {
            item_id: { [Op.in]: ids },
            is_active: true,
        };

        const stockConditions = variantIds.length
            ? [
                { variant_id: { [Op.in]: variantIds } },
                { variant_id: null },
            ]
            : [{ variant_id: null }];

        const stocksPromise = InventoryStock.findAll({
            where: {
                ...stockWhere,
                [Op.or]: stockConditions,
            },
            attributes: [
                'item_id',
                'variant_id',
                'quantity_on_hand',
                'quantity_reserved',
            ],
            include: [
                {
                    model: InventoryLocation,
                    as: 'location',
                    required: true,
                    attributes: [],
                    where: {
                        location_type: 'online',
                        is_active: true,
                    },
                },
            ],
        });

        const reviewsPromise = ProductReview.findAll({
            where: {
                item_id: { [Op.in]: ids },
                status: 'approved',
            },
            attributes: ['item_id', 'rating'],
        });

        // All three queries use the already-loaded item/variant ids and are
        // independent, so run them together instead of serializing DB latency.
        const [prices, stocks, reviews] = await Promise.all([
            pricesPromise,
            stocksPromise,
            reviewsPromise,
        ]);

        const priceByVariant = new Map();
        const priceByItem = new Map();

        for (const price of prices) {
            if (price.variant_id !== null) {
                const key = String(price.variant_id);

                if (!priceByVariant.has(key)) {
                    priceByVariant.set(key, price);
                }
            } else {
                const key = String(price.item_id);

                if (!priceByItem.has(key)) {
                    priceByItem.set(key, price);
                }
            }
        }

        const stockByVariant = new Map();
        const stockByItem = new Map();

        for (const stock of stocks) {
            const available = Math.max(
                0,
                (Number(stock.quantity_on_hand) || 0) -
                (Number(stock.quantity_reserved) || 0)
            );

            if (stock.variant_id !== null) {
                const key = String(stock.variant_id);
                stockByVariant.set(
                    key,
                    (stockByVariant.get(key) || 0) + available
                );
            } else {
                const key = String(stock.item_id);
                stockByItem.set(
                    key,
                    (stockByItem.get(key) || 0) + available
                );
            }
        }

        const listingByItem = new Map();

        for (const item of items) {
            const itemKey = String(item.id);
            const itemVariants = variantsByItem.get(itemKey) || [];

            if (itemVariants.length) {
                const pricedVariants = itemVariants
                    .map(variant => ({
                        variant,
                        price: priceByVariant.get(String(variant.id)),
                    }))
                    .filter(entry => entry.price);

                const lowest = pricedVariants.reduce(
                    (best, entry) =>
                        !best ||
                        Number(entry.price.price) < Number(best.price.price)
                            ? entry
                            : best,
                    null
                );

                const availableQuantity = itemVariants.reduce(
                    (total, variant) =>
                        total +
                        (stockByVariant.get(String(variant.id)) || 0),
                    0
                );

                listingByItem.set(itemKey, {
                    currentPrice: lowest?.price || null,
                    availableQuantity,
                });
            } else {
                // Legacy products without active variants may use parent-level
                // pricing and stock. Never combine these with variant records.
                listingByItem.set(itemKey, {
                    currentPrice: priceByItem.get(itemKey) || null,
                    availableQuantity: stockByItem.get(itemKey) || 0,
                });
            }
        }

        // Only approved reviews contribute to customer ratings.
        const ratingByItem = new Map();

        for (const review of reviews) {
            const key = String(review.item_id);
            const current = ratingByItem.get(key) || {
                total: 0,
                count: 0,
            };

            current.total += Number(review.rating);
            current.count += 1;
            ratingByItem.set(key, current);
        }

        const responsiveImageCache = new Map();
        const data = (await Promise.all(items.map(async item => {
                const product = item.toJSON();
                const key = String(item.id);
const listing = listingByItem.get(key);
const currentPrice = listing?.currentPrice || null;
const availableQuantity = listing?.availableQuantity || 0;
const rating = ratingByItem.get(key);

                const originalPrice = currentPrice
    ? Number(currentPrice.price)
    : null;

let campaignDiscount = null;

if (originalPrice !== null) {
    for (const campaign of campaigns) {
        if (!campaignTargetsItem(campaign, product)) {
            continue;
        }

        const pricing = calculateDiscount(campaign, originalPrice);

        if (
            pricing.discount_amount > 0 &&
            (
                !campaignDiscount ||
                pricing.discount_amount > campaignDiscount.discount_amount
            )
        ) {
            campaignDiscount = {
                campaign_id: campaign.id,
                campaign_name: campaign.campaign_name,
                ...pricing
            };
        }
    }
}

                const selectedVisual = getBestVisualCampaignForItem(
                    product,
                    campaigns
                );

                const campaignVisual = selectedVisual
                    ? {
                        id: selectedVisual.campaign_id,
                        campaign_name: selectedVisual.campaign_name,
                        frame_id: selectedVisual.frame_id,
                        frame_name: selectedVisual.frame_name,
                        frame_url: selectedVisual.frame_path
                            ? buildFileUrl(selectedVisual.frame_path)
                            : null,
                    }
                    : null;

                const specifications =
                    product.specificationValues || [];

                const colourSpec = specifications.find(value => {
                    const name =
                        value.specification?.name?.toLowerCase() || '';
                    const code =
                        value.specification?.code?.toLowerCase() || '';

                    return (
                        name === 'color' ||
                        name === 'colour' ||
                        code === 'color' ||
                        code === 'colour'
                    );
                });

                const images = await Promise.all((product.images || []).sort(
                    (a, b) =>
                        Number(b.is_primary) - Number(a.is_primary) ||
                        a.sort_order - b.sort_order
                ).map(async image => ({
                    ...image,
                    responsive_images: await getResponsiveImageMetadata(
                        image.file_path,
                        'products',
                        responsiveImageCache
                    ),
                })));

return {
    id: product.id,
    public_id: product.public_id,
    slug: product.slug,
    item_code: product.item_code,
    item_name: product.item_name,
                    description: product.description,
                    category_id: product.category_id,
                    category: product.category?.name || null,
                    brand_id: product.brand_id,
                    brand: product.brand?.name || null,
                    warranty_id: product.warranty_id,
                    warranty: product.warranty?.name || null,
                    condition: product.condition,
                    shipping_weight: product.shipping_weight,
                    shipping_weight_unit: product.shipping_weight_unit,
            price: campaignDiscount
    ? campaignDiscount.discounted_price
    : originalPrice,

original_price: originalPrice,

discount_amount: campaignDiscount
    ? campaignDiscount.discount_amount
    : 0,

discount_percentage: campaignDiscount
    ? campaignDiscount.discount_percentage
    : 0,

discount_campaign: campaignDiscount
    ? {
        id: campaignDiscount.campaign_id,
        campaign_name: campaignDiscount.campaign_name
    }
    : null,

                    campaign_visual: campaignVisual,

currency: currentPrice?.currency || 'LKR',
in_stock: availableQuantity > 0,
available_quantity: availableQuantity,
                    rating: rating
                        ? Number(
                            (rating.total / rating.count).toFixed(2)
                        )
                        : null,
                    review_count: rating?.count || 0,
                    color: colourSpec?.value || null,
                    images,
                    image: images[0]?.url || null,
                };
            })))
            // Never advertise products without a valid selling price.
            .filter(product => product.price !== null);

        return res.status(200).json({
            success: true,
            message: 'Store products retrieved successfully',
            data,
            ...(paginationEnabled ? { pagination } : {}),
        });
    } catch (error) {
       console.error('Get store products failed:', error)
        return res.status(500).json({
            success: false,
            message: 'Unable to retrieve store products',
        });
    }
}



async function getRelatedStoreProducts(req, res) {
    try {
        const { id } = req.params;

        if (!/^[1-9]\d*$/.test(String(id))) {
            return res.status(400).json({
                success: false,
                message: 'Invalid product ID',
            });
        }

        const currentItem = await Item.findOne({
            where: {
                id,
                is_active: true,
            },
            attributes: [
                'id',
                'category_id',
                'brand_id',
                'item_type_id',
            ],
        });

        if (!currentItem) {
            return res.status(404).json({
                success: false,
                message: 'Product not found',
            });
        }

        const conditions = [];

        if (currentItem.category_id) {
            conditions.push({
                category_id: currentItem.category_id,
            });
        }

        if (currentItem.item_type_id) {
            conditions.push({
                item_type_id: currentItem.item_type_id,
            });
        }

        if (!conditions.length) {
            return res.status(200).json({
                success: true,
                message: 'Related products retrieved successfully',
                data: [],
            });
        }

        const candidates = await Item.findAll({
            where: {
                is_active: true,
                id: { [Op.ne]: currentItem.id },
                [Op.or]: conditions,
            },
            attributes: [
                'id',
                'category_id',
                'brand_id',
                'item_type_id',
            ],
            limit: 60,
        });

        const getPriority = item => {
            const sameCategory =
                currentItem.category_id != null &&
                String(item.category_id) === String(currentItem.category_id);

            const sameBrand =
                currentItem.brand_id != null &&
                String(item.brand_id) === String(currentItem.brand_id);

            const sameType =
                currentItem.item_type_id != null &&
                String(item.item_type_id) === String(currentItem.item_type_id);

            if (sameCategory && sameBrand) return 3;
            if (sameCategory) return 2;
            if (sameType) return 1;

            return 0;
        };

        candidates.sort((a, b) =>
            getPriority(b) - getPriority(a) ||
            Number(a.id) - Number(b.id)
        );

        const candidateIds = candidates
            .filter(item => getPriority(item) > 0)
            .map(item => String(item.id));

        if (!candidateIds.length) {
            return res.status(200).json({
                success: true,
                message: 'Related products retrieved successfully',
                data: [],
            });
        }

        // Reuse the existing store product formatter for prices,
        // campaign discounts, images, ratings and stock information.
        let responseStatus = 200;
        let responseBody = null;

        const responseProxy = {
            status(code) {
                responseStatus = code;
                return this;
            },
            json(body) {
                responseBody = body;
                return this;
            },
        };

        await getStoreProducts(
            {
                ...req,
                _storeProductIds: candidateIds,
                query: {},
            },
            responseProxy
        );

        if (responseStatus !== 200 || !responseBody?.success) {
            return res.status(responseStatus).json(
                responseBody || {
                    success: false,
                    message: 'Unable to retrieve related products',
                }
            );
        }

        return res.status(200).json({
            success: true,
            message: 'Related products retrieved successfully',
            data: (responseBody.data || []).slice(0, 8),
        });
    } catch (error) {
        console.error('Get related store products failed:', error);

        return res.status(500).json({
            success: false,
            message: 'Unable to retrieve related products',
        });
    }
}

async function getStoreProductFilters(req, res) {
    try {
        const [brands, warranties, itemColors, specificationColors] =
            await Promise.all([
                Brand.findAll({
                    where: { is_active: true },
                    attributes: ['id', 'name'],
                    order: [['name', 'ASC']],
                }),
                Warranty.findAll({
                    where: { is_active: true },
                    attributes: ['id', 'name'],
                    order: [['name', 'ASC']],
                }),
                ItemColor.findAll({
                    attributes: ['color_name', 'hex_code'],
                    order: [['color_name', 'ASC']],
                }),
                db.sequelize.query(`
                    SELECT DISTINCT TRIM(color_values.value) AS name
                    FROM item_specification_values AS color_values
                    INNER JOIN item_specifications AS color_specs
                        ON color_specs.id = color_values.specification_id
                    WHERE color_specs.is_active = 1
                      AND LOWER(color_specs.name) IN ('color', 'colour')
                      AND TRIM(color_values.value) <> ''
                    ORDER BY name ASC
                `, { type: QueryTypes.SELECT }),
            ]);

        const colorMap = new Map();

        for (const color of itemColors) {
            const name = String(color.color_name || '').trim();
            if (!name) continue;

            colorMap.set(name.toLowerCase(), {
                name,
                hex: color.hex_code || null,
            });
        }

        for (const color of specificationColors) {
            const name = String(color.name || '').trim();
            if (!name) continue;

            const key = name.toLowerCase();
            if (!colorMap.has(key)) {
                colorMap.set(key, { name, hex: null });
            }
        }

        const uniqueColors = [...colorMap.values()]
            .sort((a, b) => a.name.localeCompare(b.name));

        return res.status(200).json({
            success: true,
            data: {
                brands,
                warranties,
                colors: uniqueColors,
            },
        });
    } catch (error) {
        console.error('Get store product filters failed:', error);

        return res.status(500).json({
            success: false,
            message: 'Unable to retrieve product filters',
        });
    }
}

async function getStoreProductVariants(req, res) {
    try {
        const { id } = req.params;

        if (!/^[1-9]\d*$/.test(String(id))) {
            return res.status(400).json({
                success: false,
                message: 'Invalid product ID',
            });
        }

        // Only expose variants belonging to active storefront products.
        const item = await Item.findOne({
            where: {
                id,
                is_active: true,
            },
            attributes: ['id', 'item_code', 'category_id', 'brand_id'],
        });

        if (!item) {
            return res.status(404).json({
                success: false,
                message: 'Product not found',
            });
        }

        const variants = await require('../models').ItemVariant.findAll({
            where: {
                item_id: item.id,
                is_active: true,
            },
            attributes: [
                'id',
                'item_id',
                'variant_sku',
                'variant_name',
                'attributes',
                'is_default',
                'is_active',
            ],
            order: [
                ['is_default', 'DESC'],
                ['id', 'ASC'],
            ],
        });

        const now = new Date();
        const campaigns = await getActiveCampaigns(now);

        const data = await Promise.all(
            variants.map(async variant => {
                const paymentPrices = await ItemPaymentPrice.findAll({
    where: {
        item_id: item.id,
        variant_id: variant.id,
        is_active: true,
    },
    attributes: [
        'payment_method',
        'price',
        'currency',
    ],
});

const paymentPricesByMethod = {};

for (const paymentPrice of paymentPrices) {
    paymentPricesByMethod[
        String(paymentPrice.payment_method).toLowerCase()
    ] = Number(paymentPrice.price);
}

const payment_prices = {
    cash: paymentPricesByMethod.cash ?? null,
    card: paymentPricesByMethod.card ?? null,
    koko: paymentPricesByMethod.koko ?? null,
    mintpay: paymentPricesByMethod.mintpay ?? null,
};

                // Current effective LKR selling price for this variant.
                const currentPrice = await ItemPrice.findOne({
                    where: {
                        variant_id: variant.id,
                        price_type: 'selling',
                        currency: 'LKR',
                        is_active: true,
                        [Op.and]: [
                            {
                                [Op.or]: [
                                    { effective_from: null },
                                    { effective_from: { [Op.lte]: now } },
                                ],
                            },
                            {
                                [Op.or]: [
                                    { effective_to: null },
                                    { effective_to: { [Op.gte]: now } },
                                ],
                            },
                        ],
                    },
                    attributes: ['id', 'price', 'currency'],
                    order: [
                        ['effective_from', 'DESC'],
                        ['id', 'DESC'],
                    ],
                });

                const originalPrice = currentPrice
                    ? Number(currentPrice.price)
                    : null;

                let campaignDiscount = null;

                if (originalPrice !== null) {
                    for (const campaign of campaigns) {
                        if (!campaignTargetsItem(campaign, item)) {
                            continue;
                        }

                        const pricing = calculateDiscount(
                            campaign,
                            originalPrice
                        );

                        if (
                            pricing.discount_amount > 0 &&
                            (
                                !campaignDiscount ||
                                pricing.discount_amount >
                                    campaignDiscount.discount_amount
                            )
                        ) {
                            campaignDiscount = {
                                campaign_id: campaign.id,
                                campaign_name: campaign.campaign_name,
                                ...pricing,
                            };
                        }
                    }
                }

                // Only count active stock at active online locations.
                const stocks = await InventoryStock.findAll({
                    where: {
                        item_id: item.id,
                        variant_id: variant.id,
                        is_active: true,
                    },
                    attributes: [
                        'quantity_on_hand',
                        'quantity_reserved',
                    ],
                    include: [
                        {
                            model: InventoryLocation,
                            as: 'location',
                            required: true,
                            attributes: [],
                            where: {
                                location_type: 'online',
                                is_active: true,
                            },
                        },
                    ],
                });

                const availableQuantity = stocks.reduce(
                    (total, stock) => {
                        const onHand = Number(stock.quantity_on_hand) || 0;
                        const reserved = Number(stock.quantity_reserved) || 0;

                        return total + Math.max(0, onHand - reserved);
                    },
                    0
                );

                // ItemVariant belongs to many ItemColor records.
                const variantWithColors =
                    await require('../models').ItemVariant.findByPk(
                        variant.id,
                        {
                            attributes: ['id'],
                            include: [
                                {
                                    model: ItemColor,
                                    as: 'colors',
                                    attributes: [
                                        'id',
                                        'color_name',
                                        'hex_code',
                                    ],
                                    through: {
                                        attributes: [],
                                    },
                                    required: false,
                                },
                            ],
                        }
                    );

                const colors = variantWithColors?.colors || [];

                return {
                    id: variant.id,
                    item_id: variant.item_id,
                    variant_sku: variant.variant_sku,
                    variant_name: variant.variant_name,
                    attributes: variant.attributes,
                    is_default: variant.is_default,
                    is_active: variant.is_active,

                    // Prices are calculated on the backend.
                    selling_price: campaignDiscount
                        ? campaignDiscount.discounted_price
                        : originalPrice,
                    original_price: originalPrice,
                    discount_amount: campaignDiscount
                        ? campaignDiscount.discount_amount
                        : 0,
                    discount_percentage: campaignDiscount
                        ? campaignDiscount.discount_percentage
                        : 0,
                    discount_campaign: campaignDiscount
                        ? {
                            id: campaignDiscount.campaign_id,
                            campaign_name: campaignDiscount.campaign_name,
                        }
                        : null,
currency: currentPrice?.currency || 'LKR',
payment_prices,
available_quantity: availableQuantity,
in_stock: availableQuantity > 0,

// Multiple colours can belong to the same variant.
colors,
color: colors[0] || null,
                };
            })
        );

        return res.status(200).json({
            success: true,
            message: 'Store product variants retrieved successfully',
            data,
        });
    } catch (error) {
        console.error('Get store product variants failed:', {
            name: error.name,
            code: error.original?.code || error.parent?.code,
        });

        return res.status(500).json({
            success: false,
            message: 'Unable to retrieve product variants',
        });
    }
}


module.exports = {
    getStoreProducts,
    getRelatedStoreProducts,
    getStoreProductFilters,
    getStoreProductVariants,
};
