'use strict';

const { Op } = require('sequelize');
const db = require('../models');

const {
    DiscountCampaign,
    DiscountCampaignItem,
    DiscountCampaignCategory,
    DiscountCampaignBrand,
    CampaignFrame
} = db;

/**
 * Return all campaigns that are active at the supplied time.
 */
async function getActiveCampaigns(now = new Date(), transaction = undefined) {
    return DiscountCampaign.findAll({
        where: {
            status: 'active',
            start_date: { [Op.lte]: now },
            end_date: { [Op.gte]: now }
        },
        include: [
            {
                model: DiscountCampaignItem,
                as: 'campaignItems',
                attributes: ['item_id'],
                required: false
            },
            {
                model: DiscountCampaignCategory,
                as: 'campaignCategories',
                attributes: ['category_id'],
                required: false
            },
            {
                model: DiscountCampaignBrand,
                as: 'campaignBrands',
                attributes: ['brand_id'],
                required: false
            },
            {
                model: CampaignFrame,
                as: 'visualFrame',
                required: false
            }
        ],
        transaction
    });
}

/**
 * Determine whether a campaign targets a particular item.
 *
 * item must contain:
 *   id, category_id, brand_id
 */
function campaignTargetsItem(campaign, item) {
    const itemId = String(item.id);
    const categoryId = item.category_id == null
        ? null
        : String(item.category_id);
    const brandId = item.brand_id == null
        ? null
        : String(item.brand_id);

    switch (campaign.target_type) {
        case 'all_products':
            return true;

        case 'selected_products':
            return (campaign.campaignItems || []).some(
                entry => String(entry.item_id) === itemId
            );

        case 'category':
            return categoryId !== null &&
                (campaign.campaignCategories || []).some(
                    entry => String(entry.category_id) === categoryId
                );

        case 'brand':
            return brandId !== null &&
                (campaign.campaignBrands || []).some(
                    entry => String(entry.brand_id) === brandId
                );

        default:
            return false;
    }
}

/**
 * Calculate a discount against the supplied base price.
 * The base price is never updated in the database.
 */
function calculateDiscount(campaign, basePrice) {
    const price = Number(basePrice);
    const value = Number(campaign.discount_value);

    if (!Number.isFinite(price) || price < 0) {
        throw new Error('Base price must be a valid non-negative number.');
    }

    if (!Number.isFinite(value) || value <= 0) {
        throw new Error('Campaign discount value must be greater than zero.');
    }

    let discountAmount;

    if (campaign.discount_type === 'percentage') {
        if (value > 100) {
            throw new Error('Percentage discount cannot exceed 100%.');
        }

        discountAmount = price * value / 100;
    } else if (campaign.discount_type === 'fixed_amount') {
        discountAmount = value;
    } else {
        throw new Error('Unsupported campaign discount type.');
    }

    // Never discount more than the original price.
    discountAmount = Math.min(price, discountAmount);

    // Round monetary values to two decimal places.
    discountAmount = Math.round((discountAmount + Number.EPSILON) * 100) / 100;

    const discountedPrice = Math.round(
        (Math.max(0, price - discountAmount) + Number.EPSILON) * 100
    ) / 100;

    return {
        original_price: Number(price.toFixed(2)),
        discount_amount: discountAmount,
        discounted_price: discountedPrice,
        discount_percentage: price > 0
            ? Number(((discountAmount / price) * 100).toFixed(2))
            : 0
    };
}

/**
 * Find the best eligible automatic campaign for an item.
 *
 * Returns null if no campaign applies.
 * If campaigns overlap, the largest monetary discount wins.
 *
 * item: { id, category_id, brand_id }
 * basePrice: the currently applicable selling price
 */
async function getBestDiscountForItem(
    item,
    basePrice,
    options = {}
) {
    if (!item || item.id == null) {
        throw new Error('A valid item is required to calculate discounts.');
    }

    const now = options.now || new Date();

    const campaigns = await getActiveCampaigns(
        now,
        options.transaction
    );

    let bestResult = null;

    for (const campaign of campaigns) {
        if (!campaignTargetsItem(campaign, item)) {
            continue;
        }

        const pricing = calculateDiscount(campaign, basePrice);

        // A campaign with no monetary benefit should not be displayed.
        if (pricing.discount_amount <= 0) {
            continue;
        }

        if (
            !bestResult ||
            pricing.discount_amount > bestResult.discount_amount
        ) {
            bestResult = {
                campaign_id: campaign.id,
                campaign_name: campaign.campaign_name,
                discount_type: campaign.discount_type,
                discount_value: Number(campaign.discount_value),
                start_date: campaign.start_date,
                end_date: campaign.end_date,
                ...pricing
            };
        }
    }

    return bestResult;
}


/**
 * Select an active campaign visual independently from discount pricing.
 */
function getBestVisualCampaignForItem(item, campaigns = []) {
    if (!item || item.id == null) return null;

    const eligible = campaigns.filter(campaign => {
        if (!campaign.visual_frame_enabled) {
            return false;
        }

        const frame = campaign.visualFrame;

        if (
            !frame ||
            !frame.is_active ||
            !frame.image_path
        ) {
            return false;
        }

        return campaignTargetsItem(campaign, item);
    });

    eligible.sort((a, b) => {
        const priorityDifference =
            Number(b.visual_priority || 0) -
            Number(a.visual_priority || 0);

        if (priorityDifference !== 0) return priorityDifference;

        const dateDifference =
            new Date(b.start_date).getTime() -
            new Date(a.start_date).getTime();

        if (dateDifference !== 0) return dateDifference;

        return Number(b.id) - Number(a.id);
    });

    const selected = eligible[0];

    if (!selected) return null;

    return {
        campaign_id: selected.id,
        campaign_name: selected.campaign_name,
        frame_id: selected.visualFrame.id,
        frame_name: selected.visualFrame.name,
        frame_path: selected.visualFrame.image_path,
    };
}

module.exports = {
    getActiveCampaigns,
    campaignTargetsItem,
    calculateDiscount,
    getBestDiscountForItem,
    getBestVisualCampaignForItem
};
