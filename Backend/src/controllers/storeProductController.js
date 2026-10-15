
'use strict';

const { Op } = require('sequelize');
const {
    Item,
    ItemPrice,
    Brand,
    Category,
    Warranty,
    ItemImage,
    ItemSpecificationValue,
    ItemSpecification,
    InventoryStock,
    InventoryLocation,
    ProductReview,
} = require('../models');

async function getStoreProducts(req, res) {
    try {
        const now = new Date();

        // Only active products are publicly visible.
        const items = await Item.findAll({
            where: { is_active: true },
            attributes: [
                'id',
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

        // Retrieve currently valid LKR selling prices.
        const prices = await ItemPrice.findAll({
            where: {
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
            },
            attributes: [
                'id',
                'item_id',
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

        // The first price for each item is the latest valid price.
        const priceByItem = new Map();

        for (const price of prices) {
            const key = String(price.item_id);

            if (!priceByItem.has(key)) {
                priceByItem.set(key, price);
            }
        }

        // Match the stock rules used by the customer cart:
        // active stock at active online locations, less reservations.
        const stocks = await InventoryStock.findAll({
            where: {
                item_id: { [Op.in]: ids },
                is_active: true,
            },
            attributes: [
                'item_id',
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

        const stockByItem = new Map();

        for (const stock of stocks) {
            const key = String(stock.item_id);
            const available = Math.max(
                0,
                Number(stock.quantity_on_hand) -
                Number(stock.quantity_reserved)
            );

            stockByItem.set(
                key,
                (stockByItem.get(key) || 0) + available
            );
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
                const currentPrice = priceByItem.get(key);
                const rating = ratingByItem.get(key);

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
                    price: currentPrice
                        ? Number(currentPrice.price)
                        : null,
                    currency: currentPrice?.currency || 'LKR',
                    in_stock: (stockByItem.get(key) || 0) > 0,
                    available_quantity: stockByItem.get(key) || 0,
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


module.exports = { getStoreProducts };
