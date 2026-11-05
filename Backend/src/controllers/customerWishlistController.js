
'use strict';

const { Wishlist, Item, ItemImage } = require('../models');
const { recordAuditLog } = require('../services/auditLogService');
const { getResponsiveImageMetadata } = require('../utils/fileStorage');

const isValidId = (value) =>
    value !== undefined &&
    value !== null &&
    String(value).trim() !== '' &&
    Number.isSafeInteger(Number(value)) &&
    Number(value) > 0;

const getCustomerId = (req) => req.customer?.id;

const auditWishlist = async (req, action, wishlistItem = null) => {
    try {
        await recordAuditLog({
            userId: null,
            action,
            module: 'WISHLIST',
            entityType: 'Wishlist',
            entityId: wishlistItem?.id != null
                ? String(wishlistItem.id)
                : null,
            description: action.replaceAll('_', ' ').toLowerCase(),
            oldValues: null,
            newValues: wishlistItem
                ? {
                    id: wishlistItem.id,
                    customer_id: wishlistItem.customer_id,
                    item_id: wishlistItem.item_id
                }
                : null,
            ipAddress: req.ip ?? null,
            userAgent: req.get('user-agent') ?? null,
            requestId: req.id ?? req.requestId ?? null
        });
    } catch (error) {
        console.error('Wishlist audit logging failed:', error.message);
    }
};

async function serializeWishlistItem(wishlistItem, responsiveImageCache) {
    const value = typeof wishlistItem.toJSON === 'function'
        ? wishlistItem.toJSON()
        : wishlistItem;
    if (!value.item) return value;

    const images = await Promise.all((value.item.images || []).map(async image => {
        const imageValue = typeof image.toJSON === 'function'
            ? image.toJSON()
            : image;
        return {
            ...imageValue,
            responsive_images: await getResponsiveImageMetadata(
                imageValue.file_path,
                'products',
                responsiveImageCache
            ),
        };
    }));

    return {
        ...value,
        item: {
            ...value.item,
            images,
        },
    };
}

// GET /api/customer-wishlist
const getMyWishlist = async (req, res) => {
    try {
        const customerId = getCustomerId(req);

        if (!customerId) {
            return res.status(401).json({
                message: 'Customer authentication required'
            });
        }

      const wishlist = await Wishlist.findAll({
    where: { customer_id: customerId },
    include: [
        {
            model: Item,
            as: 'item',
            attributes: [
                'id',
                'public_id',
                'slug',
                'item_name',
                'item_code',
                'is_active'
            ],
            include: [
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
                        'url'
                    ],
                    where: { is_active: true },
                    required: false
                }
            ]
        }
    ],
    order: [['created_at', 'DESC']]
});

        await auditWishlist(req, 'CUSTOMER_WISHLIST_VIEWED');

        const responsiveImageCache = new Map();

        return res.status(200).json({
            message: 'Wishlist retrieved successfully',
            data: await Promise.all(wishlist.map(item =>
                serializeWishlistItem(item, responsiveImageCache)
            ))
        });
    } catch (error) {
        console.error('Get customer wishlist error:', error);

        return res.status(500).json({
            message: 'Failed to retrieve wishlist'
        });
    }
};

// POST /api/customer-wishlist/items
// Body: { "item_id": 123 }
const addMyWishlistItem = async (req, res) => {
    try {
        const customerId = getCustomerId(req);
        const { item_id: itemId } = req.body ?? {};

        if (!customerId) {
            return res.status(401).json({
                message: 'Customer authentication required'
            });
        }

        if (!isValidId(itemId)) {
            return res.status(400).json({
                message: 'A valid item_id is required'
            });
        }

        const item = await Item.findByPk(itemId);

        if (!item || item.is_active === false) {
            return res.status(404).json({
                message: 'Item not found or unavailable'
            });
        }

        const existing = await Wishlist.findOne({
            where: {
                customer_id: customerId,
                item_id: itemId
            }
        });

        if (existing) {
            return res.status(409).json({
                message: 'Item is already in your wishlist'
            });
        }

        const wishlistItem = await Wishlist.create({
            customer_id: customerId,
            item_id: itemId
        });

        await auditWishlist(req, 'WISHLIST_ITEM_ADDED', wishlistItem);

        return res.status(201).json({
            message: 'Item added to wishlist',
            data: wishlistItem
        });
    } catch (error) {
        console.error('Add customer wishlist item error:', error);

        return res.status(500).json({
            message: 'Failed to add item to wishlist'
        });
    }
};

// DELETE /api/customer-wishlist/items/:itemId
const removeMyWishlistItem = async (req, res) => {
    try {
        const customerId = getCustomerId(req);
        const { itemId } = req.params;

        if (!customerId) {
            return res.status(401).json({
                message: 'Customer authentication required'
            });
        }

        if (!isValidId(itemId)) {
            return res.status(400).json({
                message: 'A valid item ID is required'
            });
        }

        const wishlistItem = await Wishlist.findOne({
            where: {
                customer_id: customerId,
                item_id: itemId
            }
        });

        if (!wishlistItem) {
            return res.status(404).json({
                message: 'Item not found in your wishlist'
            });
        }

        await wishlistItem.destroy();

        await auditWishlist(req, 'WISHLIST_ITEM_REMOVED', wishlistItem);

        return res.status(200).json({
            message: 'Item removed from wishlist'
        });
    } catch (error) {
        console.error('Remove customer wishlist item error:', error);

        return res.status(500).json({
            message: 'Failed to remove item from wishlist'
        });
    }
};

module.exports = {
    getMyWishlist,
    addMyWishlistItem,
    removeMyWishlistItem
};
