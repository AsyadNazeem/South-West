
'use strict';

const { Op } = require('sequelize');

const {
    Promotion,
    PromotionItem,
    PromotionCategory,
    PromotionBrand,
    OrderPromotion
} = require('../models');

const money = (value) =>
    Math.round((Number(value) + Number.EPSILON) * 100) / 100;

function promotionError(message, statusCode = 400) {
    return Object.assign(new Error(message), { statusCode });
}

const ELIGIBILITY_TYPES = [
    'all_products',
    'selected_products',
    'selected_categories',
    'selected_brands'
];

async function loadValidPromotion({
    code,
    customerId,
    transaction,
    lock = false
}) {
    if (typeof code !== 'string' || !code.trim()) {
        throw promotionError('Enter a promo code.');
    }

    const now = new Date();

    const promotion = await Promotion.findOne({
        where: {
            promotion_code: code.trim().toUpperCase(),
            status: 'active',
            is_active: true,
            start_date: { [Op.lte]: now },
            end_date: { [Op.gte]: now }
        },
        include: [
            {
                model: PromotionItem,
                as: 'items',
                attributes: ['item_id'],
                required: false
            },
            {
                model: PromotionCategory,
                as: 'categories',
                attributes: ['category_id'],
                required: false
            },
            {
                model: PromotionBrand,
                as: 'brands',
                attributes: ['brand_id'],
                required: false
            }
        ],
        transaction,
        ...(lock && transaction
            ? { lock: transaction.LOCK.UPDATE }
            : {})
    });

    if (!promotion) {
        throw promotionError(
            'This promo code is invalid, inactive, or expired.'
        );
    }

    if (
        promotion.usage_limit != null &&
        Number(promotion.used_count) >= Number(promotion.usage_limit)
    ) {
        throw promotionError(
            'This promo code has reached its usage limit.'
        );
    }

    if (customerId == null) {
        throw promotionError(
            'You must be logged in to use a promo code.',
            401
        );
    }

    const customerUsageCount = await OrderPromotion.count({
        where: {
            promotion_id: promotion.id,
            customer_id: customerId
        },
        transaction
    });

    if (customerUsageCount >= 1) {
        throw promotionError(
            'You have already used this promo code on your account.'
        );
    }

    if (!['percentage', 'fixed_amount'].includes(promotion.promotion_type)) {
        throw promotionError(
            'This promo code type is not supported at checkout.'
        );
    }

    const value = Number(promotion.discount_value);

    if (!Number.isFinite(value) || value <= 0) {
        throw promotionError(
            'This promo code has an invalid discount value.'
        );
    }

    if (promotion.promotion_type === 'percentage' && value > 100) {
        throw promotionError('Promo discount cannot exceed 100%.');
    }

    const eligibilityType = promotion.eligibility_type || 'all_products';

    if (!ELIGIBILITY_TYPES.includes(eligibilityType)) {
        throw promotionError(
            'This promo code has an invalid eligibility configuration.'
        );
    }

    const selectedItems = promotion.items || [];
    const selectedCategories = promotion.categories || [];
    const selectedBrands = promotion.brands || [];

    if (
        eligibilityType === 'selected_products' &&
        selectedItems.length === 0
    ) {
        throw promotionError(
            'This promo code has no selected products configured.'
        );
    }

    if (
        eligibilityType === 'selected_categories' &&
        selectedCategories.length === 0
    ) {
        throw promotionError(
            'This promo code has no selected categories configured.'
        );
    }

    if (
        eligibilityType === 'selected_brands' &&
        selectedBrands.length === 0
    ) {
        throw promotionError(
            'This promo code has no selected brands configured.'
        );
    }

    return promotion;
}

function calculatePromotionDiscount(promotion, preparedItems) {
    const eligibilityType = promotion.eligibility_type || 'all_products';

    const selectedItemIds = new Set(
        (promotion.items || []).map(row => String(row.item_id))
    );

    const selectedCategoryIds = new Set(
        (promotion.categories || []).map(row => String(row.category_id))
    );

    const selectedBrandIds = new Set(
        (promotion.brands || []).map(row => String(row.brand_id))
    );

    const eligibleItems = preparedItems.filter(entry => {
        const item = entry.item;

        let matchesTarget = false;

        switch (eligibilityType) {
            case 'all_products':
                matchesTarget = true;
                break;

            case 'selected_products':
                matchesTarget = selectedItemIds.has(String(item.id));
                break;

            case 'selected_categories':
                matchesTarget =
                    item.category_id != null &&
                    selectedCategoryIds.has(String(item.category_id));
                break;

            case 'selected_brands':
                matchesTarget =
                    item.brand_id != null &&
                    selectedBrandIds.has(String(item.brand_id));
                break;

            default:
                throw promotionError(
                    'This promo code has an invalid eligibility configuration.'
                );
        }

        if (!matchesTarget) return false;

        const campaign = entry.discountCampaign || entry.campaignDiscount;

        if (!campaign) return true;

        return campaign.allow_promo_code === true ||
            campaign.allow_promo_code === 1;
    });

    const eligibleSubtotal = money(
        eligibleItems.reduce((sum, entry) => {
            const unitPrice = Number(entry.unitPrice);
            const unitDiscount = Number(entry.unitDiscount || 0);
            const quantity = Number(entry.quantity);

            if (
                !Number.isFinite(unitPrice) ||
                !Number.isFinite(unitDiscount) ||
                !Number.isFinite(quantity) ||
                quantity <= 0
            ) {
                throw promotionError(
                    'A cart item has invalid pricing information.'
                );
            }

            return sum + money(
                Math.max(0, unitPrice - unitDiscount) * quantity
            );
        }, 0)
    );

    if (eligibleItems.length === 0 || eligibleSubtotal <= 0) {
        throw promotionError(
            'This promo code does not apply to any products in your cart.'
        );
    }

    if (
        eligibleSubtotal < Number(promotion.minimum_order_amount || 0)
    ) {
        throw promotionError(
            `Spend at least ${money(promotion.minimum_order_amount)} on eligible products to use this promo code.`
        );
    }

    let discountAmount;

    if (promotion.promotion_type === 'percentage') {
        discountAmount =
            eligibleSubtotal * Number(promotion.discount_value) / 100;
    } else {
        discountAmount = Number(promotion.discount_value);
    }

    if (promotion.maximum_discount_amount != null) {
        discountAmount = Math.min(
            discountAmount,
            Number(promotion.maximum_discount_amount)
        );
    }

    discountAmount = money(
        Math.min(Math.max(0, discountAmount), eligibleSubtotal)
    );

    return {
        promotion_id: promotion.id,
        promotion_code: promotion.promotion_code,
        promotion_name: promotion.promotion_name,
        discount_amount: discountAmount,
        eligible_subtotal: eligibleSubtotal
    };
}

module.exports = {
    loadValidPromotion,
    calculatePromotionDiscount,
    promotionError
};
