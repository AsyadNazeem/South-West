'use strict';

const { Wishlist, Customer, Item } = require('../models');
const { recordAuditLog } = require('../services/auditLogService');

const AUDIT_MODULE = 'WISHLIST';

const getActorId = (req) =>
    req.user?.id ?? req.user?.user_id ?? req.user?.userId ?? null;

const getCustomerIdFromUser = (req) =>
    req.customer?.id ??
    req.customer?.customer_id ??
    req.user?.customer_id ??
    req.user?.customerId ??
    null;

const getWishlistSnapshot = (wishlist) => {
    if (!wishlist) return null;

    const data = wishlist.toJSON ? wishlist.toJSON() : wishlist;

    return {
        id: data.id,
        customer_id: data.customer_id,
        item_id: data.item_id
    };
};

const auditWishlist = async (
    req,
    {
        action,
        entityId = null,
        description = null,
        oldValues = null,
        newValues = null
    }
) => {
    try {
        await recordAuditLog({
            userId: getActorId(req),
            action,
            module: AUDIT_MODULE,
            entityType: 'Wishlist',
            entityId: entityId != null ? String(entityId) : null,
            description,
            oldValues,
            newValues,
            ipAddress: req.ip ?? null,
            userAgent: req.get('user-agent') ?? null,
            requestId: req.id ?? req.requestId ?? null
        });
    } catch (auditError) {
        console.error(
            'Wishlist audit logging failed:',
            auditError.message
        );
    }
};

const isValidId = (value) =>
    value !== undefined &&
    value !== null &&
    String(value).trim() !== '' &&
    Number.isSafeInteger(Number(value)) &&
    Number(value) > 0;

/*
 * Customer ownership:
 * - Staff access should be authorized by route middleware.
 * - For customer requests, req.user.customer_id/customerId must
 *   be populated by trusted authentication middleware.
 * - Never trust a customer ID supplied only by the request body.
 */
const canAccessCustomer = (req, customerId) => {
    // Customer-authenticated requests may access only their own wishlist.
    if (req.customer) {
        const authenticatedCustomerId = String(req.customer.id);

        return authenticatedCustomerId === String(customerId);
    }

    // Staff requests must have passed the staff authentication middleware.
    if (!req.user?.id) {
        return false;
    }

    const roleName = String(
        req.user.role?.name ?? req.user.role ?? ''
    ).toLowerCase();

    const isStaff = ['admin', 'super_admin', 'staff'].includes(roleName);

    if (isStaff) {
        return true;
    }

    const authenticatedCustomerId = getCustomerIdFromUser(req);

    return (
        authenticatedCustomerId != null &&
        String(authenticatedCustomerId) === String(customerId)
    );
};

const rejectCustomerAccess = async (req, res, customerId) => {
    await auditWishlist(req, {
        action: 'WISHLIST_ACCESS_REJECTED',
        description: 'Wishlist access denied by customer ownership check'
    });

    return res.status(403).json({
        message: 'You are not authorized to access this wishlist'
    });
};

const getWishlistIncludes = () => [
    {
        model: Customer,
        as: 'customer',
        attributes: ['id']
    },
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
        ]
    }
];

// GET WISHLIST ITEMS FOR A CUSTOMER
const getCustomerWishlist = async (req, res) => {
    const { customerId } = req.params;

    try {
        if (!isValidId(customerId)) {
            return res.status(400).json({
                message: 'A valid customer ID is required'
            });
        }

        if (!canAccessCustomer(req, customerId)) {
            return rejectCustomerAccess(req, res, customerId);
        }

        const wishlist = await Wishlist.findAll({
            where: { customer_id: customerId },
            include: getWishlistIncludes(),
            order: [['created_at', 'DESC']]
        });

        await auditWishlist(req, {
            action: 'CUSTOMER_WISHLIST_VIEWED',
            description: 'Retrieved customer wishlist'
        });

        return res.status(200).json({
            message: 'Customer wishlist retrieved successfully',
            data: wishlist
        });
    } catch (error) {
        console.error('Get customer wishlist error:', error);

        await auditWishlist(req, {
            action: 'CUSTOMER_WISHLIST_VIEW_FAILED',
            description: 'Failed to retrieve customer wishlist'
        });

        return res.status(500).json({
            message: 'Failed to retrieve customer wishlist'
        });
    }
};

// GET A SPECIFIC WISHLIST ITEM
const getWishlistItem = async (req, res) => {
    const { id } = req.params;

    try {
        if (!isValidId(id)) {
            return res.status(400).json({
                message: 'A valid wishlist item ID is required'
            });
        }

        const wishlistItem = await Wishlist.findByPk(id, {
            include: getWishlistIncludes()
        });

        if (!wishlistItem) {
            await auditWishlist(req, {
                action: 'WISHLIST_ITEM_NOT_FOUND',
                entityId: id,
                description: 'Requested wishlist item was not found'
            });

            return res.status(404).json({
                message: 'Wishlist item not found'
            });
        }

        if (!canAccessCustomer(req, wishlistItem.customer_id)) {
            return rejectCustomerAccess(
                req,
                res,
                wishlistItem.customer_id
            );
        }

        await auditWishlist(req, {
            action: 'WISHLIST_ITEM_VIEWED',
            entityId: wishlistItem.id,
            description: 'Retrieved wishlist item',
            newValues: getWishlistSnapshot(wishlistItem)
        });

        return res.status(200).json({
            message: 'Wishlist item retrieved successfully',
            data: wishlistItem
        });
    } catch (error) {
        console.error('Get wishlist item error:', error);

        await auditWishlist(req, {
            action: 'WISHLIST_ITEM_VIEW_FAILED',
            entityId: id,
            description: 'Failed to retrieve wishlist item'
        });

        return res.status(500).json({
            message: 'Failed to retrieve wishlist item'
        });
    }
};

// ADD ITEM TO WISHLIST USING CUSTOMER ID IN BODY
const addToWishlist = async (req, res) => {
    try {
        const { customer_id, item_id } = req.body;

        if (!isValidId(customer_id) || !isValidId(item_id)) {
            return res.status(400).json({
                message: 'Valid customer_id and item_id are required'
            });
        }

        if (!canAccessCustomer(req, customer_id)) {
            return rejectCustomerAccess(req, res, customer_id);
        }

        const customer = await Customer.findByPk(customer_id);

        if (!customer) {
            return res.status(404).json({
                message: 'Customer not found'
            });
        }

        const item = await Item.findByPk(item_id);

        if (!item) {
            return res.status(404).json({
                message: 'Item not found'
            });
        }

        const existingWishlistItem = await Wishlist.findOne({
            where: {
                customer_id,
                item_id
            }
        });

        if (existingWishlistItem) {
            await auditWishlist(req, {
                action: 'WISHLIST_ITEM_ADD_REJECTED',
                entityId: existingWishlistItem.id,
                description: 'Item already exists in wishlist'
            });

            return res.status(409).json({
                message: 'Item already exists in wishlist'
            });
        }

        const wishlistItem = await Wishlist.create({
            customer_id,
            item_id
        });

        await auditWishlist(req, {
            action: 'WISHLIST_ITEM_ADDED',
            entityId: wishlistItem.id,
            description: 'Item added to customer wishlist',
            newValues: getWishlistSnapshot(wishlistItem)
        });

        return res.status(201).json({
            message: 'Item added to wishlist successfully',
            data: wishlistItem
        });
    } catch (error) {
        console.error('Add to wishlist error:', error);

        await auditWishlist(req, {
            action: 'WISHLIST_ITEM_ADD_FAILED',
            description: 'Failed to add item to wishlist'
        });

        return res.status(500).json({
            message: 'Failed to add item to wishlist'
        });
    }
};

// REMOVE WISHLIST ITEM BY ID
const removeFromWishlist = async (req, res) => {
    const { id } = req.params;

    try {
        if (!isValidId(id)) {
            return res.status(400).json({
                message: 'A valid wishlist item ID is required'
            });
        }

        const wishlistItem = await Wishlist.findByPk(id);

        if (!wishlistItem) {
            await auditWishlist(req, {
                action: 'WISHLIST_ITEM_NOT_FOUND',
                entityId: id,
                description: 'Wishlist removal rejected: item not found'
            });

            return res.status(404).json({
                message: 'Wishlist item not found'
            });
        }

        if (!canAccessCustomer(req, wishlistItem.customer_id)) {
            return rejectCustomerAccess(
                req,
                res,
                wishlistItem.customer_id
            );
        }

        const oldValues = getWishlistSnapshot(wishlistItem);

        await wishlistItem.destroy();

        await auditWishlist(req, {
            action: 'WISHLIST_ITEM_REMOVED',
            entityId: id,
            description: 'Item removed from customer wishlist',
            oldValues
        });

        return res.status(200).json({
            message: 'Item removed from wishlist successfully'
        });
    } catch (error) {
        console.error('Remove wishlist item error:', error);

        await auditWishlist(req, {
            action: 'WISHLIST_ITEM_REMOVE_FAILED',
            entityId: id,
            description: 'Failed to remove wishlist item'
        });

        return res.status(500).json({
            message: 'Failed to remove item from wishlist'
        });
    }
};

// REMOVE ITEM USING CUSTOMER ID AND ITEM ID
const removeItemFromCustomerWishlist = async (req, res) => {
    const { customerId, itemId } = req.params;

    try {
        if (!isValidId(customerId) || !isValidId(itemId)) {
            return res.status(400).json({
                message: 'Valid customerId and itemId are required'
            });
        }

        if (!canAccessCustomer(req, customerId)) {
            return rejectCustomerAccess(req, res, customerId);
        }

        const wishlistItem = await Wishlist.findOne({
            where: {
                customer_id: customerId,
                item_id: itemId
            }
        });

        if (!wishlistItem) {
            await auditWishlist(req, {
                action: 'WISHLIST_ITEM_NOT_FOUND',
                description: 'Item was not found in customer wishlist'
            });

            return res.status(404).json({
                message: 'Item not found in wishlist'
            });
        }

        const oldValues = getWishlistSnapshot(wishlistItem);

        await wishlistItem.destroy();

        await auditWishlist(req, {
            action: 'WISHLIST_ITEM_REMOVED',
            entityId: wishlistItem.id,
            description: 'Item removed using customer and item IDs',
            oldValues
        });

        return res.status(200).json({
            message: 'Item removed from wishlist successfully'
        });
    } catch (error) {
        console.error('Remove customer wishlist item error:', error);

        await auditWishlist(req, {
            action: 'WISHLIST_ITEM_REMOVE_FAILED',
            description: 'Failed to remove item from customer wishlist'
        });

        return res.status(500).json({
            message: 'Failed to remove item from wishlist'
        });
    }
};

// CLEAR ENTIRE CUSTOMER WISHLIST
const clearCustomerWishlist = async (req, res) => {
    const { customerId } = req.params;

    try {
        if (!isValidId(customerId)) {
            return res.status(400).json({
                message: 'A valid customer ID is required'
            });
        }

        if (!canAccessCustomer(req, customerId)) {
            return rejectCustomerAccess(req, res, customerId);
        }

        const existingItems = await Wishlist.findAll({
            where: { customer_id: customerId }
        });

        const oldValues = existingItems.map(getWishlistSnapshot);

        const deletedCount = await Wishlist.destroy({
            where: { customer_id: customerId }
        });

        await auditWishlist(req, {
            action: 'CUSTOMER_WISHLIST_CLEARED',
            description: 'Cleared customer wishlist',
            oldValues: {
                deleted_items: oldValues
            },
            newValues: {
                deleted_count: deletedCount
            }
        });

        return res.status(200).json({
            message: 'Customer wishlist cleared successfully',
            data: {
                deleted_items: deletedCount
            }
        });
    } catch (error) {
        console.error('Clear customer wishlist error:', error);

        await auditWishlist(req, {
            action: 'CUSTOMER_WISHLIST_CLEAR_FAILED',
            description: 'Failed to clear customer wishlist'
        });

        return res.status(500).json({
            message: 'Failed to clear customer wishlist'
        });
    }
};

// CREATE WISHLIST ITEM USING CUSTOMER ID IN URL
const createWishlist = async (req, res) => {
    const { customerId } = req.params;

    try {
        const { item_id } = req.body;

        if (!isValidId(customerId) || !isValidId(item_id)) {
            return res.status(400).json({
                message: 'Valid customerId and item_id are required'
            });
        }

        if (!canAccessCustomer(req, customerId)) {
            return rejectCustomerAccess(req, res, customerId);
        }

        const customer = await Customer.findByPk(customerId);

        if (!customer) {
            return res.status(404).json({
                message: 'Customer not found'
            });
        }

        const item = await Item.findByPk(item_id);

        if (!item) {
            return res.status(404).json({
                message: 'Item not found'
            });
        }

        const existingWishlist = await Wishlist.findOne({
            where: {
                customer_id: customerId,
                item_id
            }
        });

        if (existingWishlist) {
            await auditWishlist(req, {
                action: 'WISHLIST_ITEM_ADD_REJECTED',
                entityId: existingWishlist.id,
                description: 'Item already exists in customer wishlist'
            });

            return res.status(409).json({
                message: 'Item is already in the wishlist'
            });
        }

        const wishlist = await Wishlist.create({
            customer_id: customerId,
            item_id
        });

        await auditWishlist(req, {
            action: 'WISHLIST_ITEM_ADDED',
            entityId: wishlist.id,
            description: 'Item added to customer wishlist',
            newValues: getWishlistSnapshot(wishlist)
        });

        return res.status(201).json({
            message: 'Item added to wishlist successfully',
            data: wishlist
        });
    } catch (error) {
        console.error('Create wishlist item error:', error);

        await auditWishlist(req, {
            action: 'WISHLIST_ITEM_ADD_FAILED',
            description: 'Failed to create wishlist item'
        });

        return res.status(500).json({
            message: 'Failed to add item to wishlist'
        });
    }
};

module.exports = {
    getCustomerWishlist,
    getWishlistItem,
    addToWishlist,
    removeFromWishlist,
    removeItemFromCustomerWishlist,
    clearCustomerWishlist,
    createWishlist
};
