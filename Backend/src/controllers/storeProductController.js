
'use strict';

const { Op } = require('sequelize');
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
    calculateDiscount
} = require('../services/discountCampaignService');

async function getStoreProducts(req, res) {
    try {
        const now = new Date();

        const campaigns = await getActiveCampaigns(now);

        // Only active products are publicly visible.
        const items = await Item.findAll({
            where: { is_active: true },
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


        const ids = items.map(item => item.id);

        if (!ids.length) {
            return res.status(200).json({
                success: true,
                message: 'Store products retrieved successfully',
                data: [],
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

        const prices = await ItemPrice.findAll({
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

        const stocks = await InventoryStock.findAll({
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
        const reviews = await ProductReview.findAll({
            where: {
                item_id: { [Op.in]: ids },
                status: 'approved',
            },
            attributes: ['item_id', 'rating'],
        });

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

        const data = items
            .map(item => {
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

                const images = (product.images || []).sort(
                    (a, b) =>
                        Number(b.is_primary) - Number(a.is_primary) ||
                        a.sort_order - b.sort_order
                );

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
            })
            // Never advertise products without a valid selling price.
            .filter(product => product.price !== null);

        return res.status(200).json({
            success: true,
            message: 'Store products retrieved successfully',
            data,
        });
    } catch (error) {
        console.error('Get store products failed:', {
            name: error.name,
            code: error.original?.code || error.parent?.code,
        });

        return res.status(500).json({
            success: false,
            message: 'Unable to retrieve store products',
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
    getStoreProductVariants,
};
