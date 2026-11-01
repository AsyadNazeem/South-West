import { createRouter, createWebHistory } from 'vue-router'

import Login from '../pages/auth/Login.vue'
import AccessDenied from '../pages/auth/AccessDenied.vue'
import Dashboard from '../pages/dashboard/Dashboard.vue'
import Reports from '../pages/reports/Reports.vue'
import AdminLayout from '../components/layout/AdminLayout.vue'
import Customer from '../pages/customers/CustomerList.vue'
import Address from '../pages/customers/CustomerAddresses.vue'
import Reviews from '../pages/customers/CustomerReviews.vue'
import CustomerCreate from '../pages/customers/CustomerCreate.vue'
import CustomerAddressCreate from '../pages/customers/CustomerAddressCreate.vue'
import CustomerView from '../pages/customers/CustomerView.vue'
import Items from '../pages/products/ItemList.vue'
import ItemCreate from '../pages/products/ItemCreate.vue'
import ItemVariants from "../pages/products/ItemVariants.vue"
import ItemVariantsCreate from "../pages/products/CreateItemVariants.vue"
import ItemView from '../pages/products/ItemView.vue'
import ProductCategoryCreate from '../pages/products/ProductCategoryCreate.vue'
import ProductCategory from '../pages/products/ProductCategory.vue'
import CategoryView from '../pages/products/CategoryView.vue'
import ProductBrand from '../pages/products/ProductBrand.vue'
import BrandCreate from '../pages/products/BrandCreate.vue'
import ProductUnit from '../pages/products/ProductUnit.vue'
import CreateUnit from '../pages/products/CreateUnit.vue'
import CreatePrice from '../pages/products/CreatePrice.vue'
import ProductPrice from '../pages/products/ProductPrice.vue'
import ProductSpecification from '../pages/products/ProductSpecification.vue'
import CreateSpecification from '../pages/products/CreateSpecification.vue'
import ProductImage from '../pages/products/ProductImage.vue'
import CreateImage from '../pages/products/CreateImage.vue'
import ItemType from '../pages/products/ItemType.vue'
import CreateItemType from '../pages/products/CreateItemType.vue'
import CreateWarranty from '../pages/products/CreateWarranty.vue'
import Warranty from '../pages/products/Warranty.vue'
import Users from '../pages/administration/Users.vue'
import UsersCreate from '../pages/administration/UsersCreate.vue'
import UserRoles from '../pages/administration/UserRoles.vue'
import UserPermission from '../pages/administration/UserPermission.vue'
import CreateRoles from '../pages/administration/CreateRoles.vue'
import UserSession from '../pages/administration/UserSession.vue'
import InventoryLocation from '../pages/inventory/InventoryLocation.vue'
import CreateInventoryLocation from '../pages/inventory/CreateInventoryLocation.vue'
import InventoryStock from '../pages/inventory/InventoryStock.vue'
import CreateInventoryStock from '../pages/inventory/CreateInventoryStock.vue'
import InventoryStockMovement from '../pages/inventory/InventoryStockMovement.vue'
import CreateInventoryStockMovement from '../pages/inventory/CreateInventoryStockMovement.vue'
import GoodReceipts from '../pages/purchasing/GoodReceipts.vue'
import CreateGoodReceipts from '../pages/purchasing/CreateGoodReceipts.vue'
import PurchaseOrder from '../pages/purchasing/PurchaseOrder.vue'
import CreatePurchaseOrder from '../pages/purchasing/CreatePurchaseOrder.vue'
import Suppliers from '../pages/purchasing/Suppliers.vue'
import CreateSuppliers from '../pages/purchasing/CreateSuppliers.vue'
import Orders from '../pages/sales/Orders.vue'
import OrderDetails from '../pages/sales/OrderDetails.vue'
import Payment from '../pages/sales/Payment.vue'
import Invoice from '../pages/sales/Invoice.vue'
import Deliveries from '../pages/sales/Deliveries.vue'
import DeliveryDetails from '../pages/sales/DeliveryDetails.vue'
import DeliveryCharges from '../pages/sales/DeliveryCharges.vue'
import CreateDeliveryCharges from '../pages/sales/CreateDeliveryCharges.vue'
import Promotions from '../pages/marketing/Promotions.vue'
import CreatePromotions from '../pages/marketing/CreatePromotions.vue'
import PromotionCategories from '../pages/marketing/PromotionCategories.vue'
import CreatePromotionCategories from '../pages/marketing/CreatePromotionCategories.vue'
import PromotionItems from '../pages/marketing/PromotionItems.vue'
import CreatePromotionItems from '../pages/marketing/CreatePromotionItems.vue'
import HomepageBanners from '../pages/marketing/HomepageBanners.vue'
import DiscountCampaigns from '../pages/marketing/DiscountCampaigns.vue'
import CreateHomePage from '../pages/marketing/CreateHomepageBanners.vue'
import CreateDiscountCampaigns from '../pages/marketing/DiscountCampaignForm.vue'
import CampaignFrames from '../pages/marketing/CampaignFrames.vue'
import WebsiteThemes from '../pages/marketing/WebsiteThemes.vue'
import AuditLog from '../pages/administration/AuditLog.vue'

import {
    clearAuthentication,
    ensureAuthorization,
    getAccessToken,
    hasAllPermissions,
    hasAnyPermission,
    hasPermission
} from '../auth/authorization'

const routes = [
    {
        path: '/login',
        name: 'Login',
        component: Login
    },
    {
        path: '/admin',
        component: AdminLayout,
        meta: {
            requiresAuth: true
        },
        children: [
            {
                path: '',
                redirect: '/admin/dashboard'
            },
            {
                path: 'dashboard',
                name: 'Dashboard',
                component: Dashboard,
                meta: { permission: 'dashboard.view' }
            },
            {
                path: 'reports',
                name: 'Reports',
                component: Reports,
                meta: { permission: 'reports.view' }
            },
            {
                path: 'access-denied',
                name: 'AccessDenied',
                component: AccessDenied
            },

            // Customer Management Routes
            {
                path: 'customers/all-customers',
                name: 'customers',
                component: Customer,
                meta: { permission: 'customers.view' }
            },
            {
                path: 'customers/addresses',
                name: 'customerAddresses',
                component: Address,
                meta: { permission: 'customers.view' }
            },
            {
                path: 'customers/reviews',
                name: 'customer-reviews',
                component: Reviews,
                meta: { permission: 'product_reviews.view' }
            },
            {
                path: 'customers/create',
                name: 'customer-create',
                component: CustomerCreate,
                meta: { permission: 'customers.create' }
            },
            {
                path: 'customers/addresses/create',
                name: 'create-address',
                component: CustomerAddressCreate,
                meta: { permission: 'customers.update' }
            },
            {
                path: 'customers/view/:id',
                name: 'customer-view',
                component: CustomerView,
                meta: { permission: 'customers.view' }
            },
            {
                path: 'customers/edit/:id',
                name: 'customer-edit',
                component: CustomerCreate,
                meta: { permission: 'customers.update' }
            },
            {
                path: 'customers/:customerId/addresses/:addressId/edit',
                name: 'customer-address-edit',
                component: CustomerAddressCreate,
                meta: { permission: 'customers.update' }
            },


            // Product Management Routes
            {
                path: 'products/items',
                name: 'items',
                component: Items,
                meta: { permission: 'products.view' }
            },
            {
                path: 'products/items/create',
                name: 'item-create',
                component: ItemCreate,
                meta: { permission: 'products.create' }
            },
            {
                path: 'products/items/view/:id',
                name: 'item-view',
                component: ItemView,
                meta: { permission: 'products.view' }
            },
            {
                path: 'products/items/edit/:id',
                name: 'item-edit',
                component: ItemCreate,
                meta: { permission: 'products.update' }
            },
            {   path: "products/item-variants", 
                name: 'item-variants',
                component: ItemVariants, 
                meta: { permission: 'products.view'} 
            },
            {   path: "products/item-variants/create", 
                name: 'variants-create',
                component: ItemVariantsCreate, 
                meta: { permission: 'products.create'} 
            },
            {   path: "products/item-variants/edit/:id", 
                name: 'variants-edit',
                component: ItemVariantsCreate, 
                meta: { permission: 'products.update'} 
            },
            {
                path: 'products/categories',
                name: 'product-category',
                component: ProductCategory,
                meta: { permission: 'products.view' }
            },
            {
                path: 'products/categories/view/:id',
                name: 'category-view',
                component: CategoryView,
                meta: { permission: 'products.view' }
            },
            {
                path: 'products/categories/create',
                name: 'create-category',
                component: ProductCategoryCreate,
                meta: { permission: 'products.create' }
            },
            {
                path: 'products/categories/edit/:id',
                name: 'edit-category',
                component: ProductCategoryCreate,
                meta: { permission: 'products.update' }
            },
            {
                path: 'products/brands',
                name: 'product-brand',
                component: ProductBrand,
                meta: { permission: 'products.view' }
            },
            {
                path: 'products/brands/create',
                name: 'brand-create',
                component: BrandCreate,
                meta: { permission: 'products.create' }
            },
            {
                path: 'products/brands/edit/:id',
                name: 'brand-edit',
                component: BrandCreate,
                meta: { permission: 'products.update' }
            },
            {
                path: 'products/units',
                name: 'product-unit',
                component: ProductUnit,
                meta: { permission: 'products.view' }
            },
            {
                path: 'products/units/create',
                name: 'unit-create',
                component: CreateUnit,
                meta: { permission: 'products.create' }
            },
            {
                path: 'products/units/edit/:id',
                name: 'unit-edit',
                component: CreateUnit,
                meta: { permission: 'products.update' }
            },
            {
                path: 'products/item-prices',
                name: 'product-price',
                component: ProductPrice,
                meta: { permission: 'products.view' }
            },
            {
                path: 'products/item-prices/create',
                name: 'price-create',
                component: CreatePrice,
                meta: { permission: 'products.create' }
            },
            {
                path: 'products/item-prices/edit/:id',
                name: 'price-edit',
                component: CreatePrice,
                meta: { permission: 'products.update' }
            },
            {
                path: 'products/item-prices/edit-all/:itemId',
                name: 'price-edit-all',
                component: CreatePrice,
                meta: { permission: 'products.update' }
            },
            {
                path: 'products/item-specifications',
                name: 'product-specification',
                component: ProductSpecification,
                meta: { permission: 'products.view' }
            },
            {
                path: 'products/item-specifications/create',
                name: 'specification-create',
                component: CreateSpecification,
                meta: { permission: 'products.create' }
            },
            {
                path: 'products/item-specifications/edit/:id',
                name: 'specification-edit',
                component: CreateSpecification,
                meta: { permission: 'products.update' }
            },
            {
                path: 'products/item-images',
                name: 'product-image',
                component: ProductImage,
                meta: { permission: 'item_images.view' }
            },
            {
                path: 'products/item-images/create',
                name: 'image-create',
                component: CreateImage,
                meta: { permission: 'item_images.create' }
            },
            {
                path: 'products/item-images/edit/:id',
                name: 'image-edit',
                component: CreateImage,
                meta: { permission: 'item_images.update' }
            },
            {
                path: 'products/item-types',
                name: 'item-type',
                component: ItemType,
                meta: { permission: 'products.view' }
            },
            {
                path: 'products/item-types/create',
                name: 'item-type-create',
                component: CreateItemType,
                meta: { permission: 'products.create' }
            },
            {
                path: 'products/item-types/:id/edit',
                name: 'item-type-edit',
                component: CreateItemType,
                meta: { permission: 'products.update' }
            },
            {
                path: 'products/warranty',
                name: 'product-warranty',
                component: Warranty,
                meta: { permission: 'products.view' }
            },
            {
                path: 'products/warranty/create',
                name: 'warranty-create',
                component: CreateWarranty,
                meta: { permission: 'products.create' }
            },
            {
                path: 'products/warranty/edit/:id',
                name: 'warranty-edit',
                component: CreateWarranty,
                meta: { permission: 'products.update' }
            },
            {
                path: 'administration/users',
                name: 'users',
                component: Users,
                meta: { permission: 'users.view' }
            },
            {
                path: 'administration/users/create',
                name: 'create-user',
                component: UsersCreate,
                meta: { permission: 'users.create' }
            },
            {
                path: 'administration/users/edit/:id',
                name: 'edit-user',
                component: UsersCreate,
                meta: { permission: 'users.update' }
            },
            {
                path: 'administration/roles',
                name: 'roles',
                component: UserRoles,
                meta: { permission: 'roles.view' }
            },
            {
                path: 'administration/roles/edit/:id',
                name: 'edit-roles',
                component: CreateRoles,
                meta: { permission: 'roles.manage' }
            },
            {
                path: 'administration/roles/create',
                name: 'create-roles',
                component: CreateRoles,
                meta: { permission: 'roles.manage' }
            },
            {
                path: 'administration/assign-permissions',
                name: 'assign-permission',
                component: UserPermission,
                meta: {
                    allPermissions: [
                        'roles.view',
                        'roles.manage',
                        'permissions.view',
                        'permissions.manage'
                    ]
                }
            },
{
    path: 'administration/user-sessions',
    name: 'user-sessions',
    component: UserSession,
    meta: { permission: 'user_sessions.view' }
},
{
    path: 'administration/users/:userId/sessions',
    name: 'user-sessions-by-user',
    component: UserSession,
    meta: { permission: 'user_sessions.view' }
},

{
    path: 'administration/audit-log',
    name: 'audit-logs',
    component: AuditLog,
    meta: { permission: 'audit_logs.view' }
},


            // Inventory Management Routes
            {
                path: 'inventory/locations',
                name: 'inventory-locations',
                component: InventoryLocation,
                meta: { permission: 'inventory.view' }
            },
            {
                path: 'inventory/locations/create',
                name: 'create-locations',
                component: CreateInventoryLocation,
                meta: { permission: 'inventory.create' }
            },
            {
                path: 'inventory/locations/edit/:id',
                name: 'edit-locations',
                component: CreateInventoryLocation,
                meta: { permission: 'inventory.update' }
            },
            {
                path: 'inventory/stock',
                name: 'stock',
                component: InventoryStock,
                meta: { permission: 'inventory.view' }
            },
            {
                path: 'inventory/stock/create',
                name: 'create-stock',
                component: CreateInventoryStock,
                meta: { permission: 'inventory.create' }
            },
            {
                path: 'inventory/stock/edit/:id',
                name: 'edit-stock',
                component: CreateInventoryStock,
                meta: { permission: 'inventory.update' }
            },

            {
    path: 'inventory/stock/edit-item/:itemId',
    component: CreateInventoryStock,
},
            {
                path: 'inventory/movements',
                name: 'stock-movement',
                component: InventoryStockMovement,
                meta: { permission: 'inventory.view' }
            },
            {
                path: 'inventory/movements/create',
                name: 'create-movement',
                component: CreateInventoryStockMovement,
                meta: { permission: 'inventory.create' }
            },
            {
                path: 'inventory/movements/edit/:id',
                name: 'edit-movement',
                component: CreateInventoryStockMovement,
                meta: { permission: 'inventory.update' }
            },

            // purchasing Routes
            {
                path: 'purchasing/suppliers',
                name: 'suppliers',
                component: Suppliers,
                meta: { permission: 'products.view' }
            },
            {
                path: 'purchasing/suppliers/create',
                name: 'create-suppliers',
                component: CreateSuppliers,
                meta: { permission: 'products.view' }
            },
            {
                path: 'purchasing/suppliers/edit/:id',
                name: 'edit-suppliers',
                component: CreateSuppliers,
                meta: { permission: 'products.view' }
            },
            {
                path: 'purchasing/goods-receipts',
                name: 'goods-receipts',
                component: GoodReceipts,
                meta: { permission: 'products.view' }
            },
            {
                path: 'purchasing/goods-receipts/create',
                name: 'create-goods_receipts',
                component: CreateGoodReceipts,
                meta: { permission: 'products.create' }
            },
            {
                path: 'purchasing/goods-receipts/edit/:id',
                name: 'edit-goods_receipts',
                component: CreateGoodReceipts,
                meta: { permission: 'products.update' }
            },
            {
                path: 'purchasing/purchase-order',
                name: 'purchase-order',
                component: PurchaseOrder,
                meta: { permission: 'products.view' }
            },
            {
                path: 'purchasing/purchase-orders/create',
                name: 'create-purchase_order',
                component: CreatePurchaseOrder,
                meta: { permission: 'products.create' }
            },
            {
                path: 'purchasing/purchase-orders/edit/:id',
                name: 'edit-purchase_order',
                component: CreatePurchaseOrder,
                meta: { permission: 'products.update' }
            },


            //Sales Management Routes
            {
                path: 'sales/orders',
                name: 'orders',
                component: Orders,
                meta: { permission: 'orders.view' }
            },
            {
                path: 'sales/orders/:id',
                name: 'order-details',
                component: OrderDetails,
                meta: { permission: 'orders.view' }
            },
            {
                path: 'sales/payments',
                name: 'Payment',
                component: Payment,
                meta: { permission: 'payments.view' }
            },
            {
                path: 'sales/invoices',
                name: 'Invoice',
                component: Invoice,
                meta: { permission: 'invoices.view' }
            },
            {
                path: 'sales/deliveries',
                name: 'Deliveries',
                component: Deliveries,
                meta: { permission: 'deliveries.view' }
            },
            {
                path: 'sales/deliveries/edit/:id',
                name: 'delivery-edit',
                component: DeliveryDetails,
                meta: { permission: 'deliveries.update' }
            },
            {
                path: 'sales/deliveries/:id',
                name: 'delivery-details',
                component: DeliveryDetails,
                meta: { permission: 'deliveries.view' }
            },
            {
                path: 'sales/delivery-chargers',
                name: 'DeliveryCharges',
                component: DeliveryCharges,
                meta: { permission: 'delivery_charges.view' }
            },
            {
                path: 'sales/delivery-chargers/create',
                name: 'CreateDeliveryCharges',
                component: CreateDeliveryCharges,
                meta: { permission: 'delivery_charges.create' }
            },
            {
                path: 'sales/delivery-chargers/edit/:id',
                name: 'EditDeliveryCharges',
                component: CreateDeliveryCharges,
                meta: { permission: 'delivery_charges.update' }
            },


            //Marketing Management Routes
            {
                path: 'marketing/promotions',
                name: 'Promotions',
                component: Promotions,
                meta: { permission: 'promotions.view' }
            },
            {
                path: 'marketing/promotions/create',
                name: 'CreatePromotions',
                component: CreatePromotions,
                meta: { permission: 'promotions.create' }
            },
            {
                path: 'marketing/promotions/edit/:id',
                name: 'EditPromotions',
                component: CreatePromotions,
                meta: { permission: 'promotions.update' }
            },

            {
                path: 'marketing/promotion-categories',
                name: 'PromotionCategories',
                component: PromotionCategories,
                meta: { permission: 'promotion_categories.view' }
            },
            {
                path: 'marketing/promotion-categories/create',
                name: 'CreatePromotionsCategories',
                component: CreatePromotionCategories,
                meta: { permission: 'promotion_categories.create' }
            },
            {
                path: 'marketing/promotion-categories/edit/:id',
                name: 'EditCategories',
                component: CreatePromotionCategories,
                meta: { permission: 'promotion_categories.update' }
            },

            {
                path: 'marketing/promotion-items',
                name: 'PromotionItems',
                component: PromotionItems,
                meta: { permission: 'promotion_items.view' }
            },
            {
                path: 'marketing/promotion-items/create',
                name: 'CreatePromotionItems',
                component: CreatePromotionItems,
                meta: { permission: 'promotion_items.create' }
            },
            {
                path: 'marketing/promotion-items/edit/:id',
                name: 'EditPromotionItems',
                component: CreatePromotionItems,
                meta: { permission: 'promotion_items.update' }
            },

            {
    path: 'marketing/homepage-banners',
    name: 'HomepageBanners',
    component: HomepageBanners,
    meta: { permission: 'homepage_banners.view' }
},
{
    path: 'marketing/homepage-banners/create',
    name: 'CreateHomepageBanner',
    component: CreateHomePage,
    meta: { permission: 'homepage_banners.create' }
},
{
    path: 'marketing/homepage-banners/edit/:id',
    name: 'EditHomepageBanner',
    component: CreateHomePage,
    meta: { permission: 'homepage_banners.update' }
},
{
    path: 'marketing/discount-campaigns',
    name: 'DiscountCampaigns',
    component: DiscountCampaigns,
    meta: { permission: 'discount_campaigns.view' }
},
{
    path: 'marketing/discount-campaigns/create',
    name: 'CreateDiscountCampaigns',
    component: CreateDiscountCampaigns,
    meta: { permission: 'discount_campaigns.create' }
},
{
    path: 'marketing/discount-campaigns/edit/:id',
    name: 'EditDiscountCampaign',
    component: CreateDiscountCampaigns,
    meta: { permission: 'discount_campaigns.update' }
},
{
    path: 'marketing/campaign-frames',
    name: 'CampaignFrames',
    component: CampaignFrames,
    meta: { permission: 'discount_campaigns.view' }
},
{
    path: 'marketing/website-themes',
    name: 'WebsiteThemes',
    component: WebsiteThemes,
    meta: { permission: 'website_themes.view' }
}


        ]
    }
]

const router = createRouter({
    history: createWebHistory(),
    routes
})

const canAccessRoute = (to) => {
    return to.matched.every((record) => {
        const { permission, allPermissions, anyPermissions } = record.meta

        return (
            (!permission || hasPermission(permission)) &&
            (!allPermissions || hasAllPermissions(allPermissions)) &&
            (!anyPermissions || hasAnyPermission(anyPermissions))
        )
    })
}

router.beforeEach(async (to) => {
    const requiresAuth = to.matched.some((record) => record.meta.requiresAuth)
    const token = getAccessToken()

    if (requiresAuth) {
        if (!token) {
            return {
                name: 'Login',
                query: { redirect: to.fullPath }
            }
        }

        try {
            await ensureAuthorization()
        } catch {
            clearAuthentication()
            return { name: 'Login' }
        }

        if (to.name !== 'AccessDenied' && !canAccessRoute(to)) {
            return {
                name: 'AccessDenied',
                query: { redirect: to.fullPath }
            }
        }
    }

    if (to.name === 'Login' && token) {
        try {
            await ensureAuthorization()

            if (hasPermission('dashboard.view')) {
                return { name: 'Dashboard' }
            }

            return { name: 'AccessDenied' }
        } catch {
            clearAuthentication()
        }
    }
    return true
})


router.afterEach((to) => {
    const rawTitle = to.meta?.title || to.name || to.path

    const pageTitle = String(rawTitle)
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/[-_]+/g, ' ')
        .replace(/\/+/g, ' ')
        .replace(/:[^ ]+/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/\b\w/g, (character) => character.toUpperCase())

    document.title = `${pageTitle || 'Admin'} | South West`
})

export default router
