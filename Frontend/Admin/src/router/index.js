import { createRouter, createWebHistory } from 'vue-router'

const Login = () => import('@/pages/auth/Login.vue')
const AccessDenied = () => import('@/pages/auth/AccessDenied.vue')
const Dashboard = () => import('@/pages/dashboard/Dashboard.vue')
const Reports = () => import('@/pages/reports/Reports.vue')
import AdminLayout from '@/components/layout/AdminLayout.vue'
const Customer = () => import('@/pages/customers/CustomerList.vue')
const Address = () => import('@/pages/customers/CustomerAddresses.vue')
const Reviews = () => import('@/pages/customers/CustomerReviews.vue')
const CustomerCreate = () => import('@/pages/customers/CustomerCreate.vue')
const CustomerAddressCreate = () => import('@/pages/customers/CustomerAddressCreate.vue')
const CustomerView = () => import('@/pages/customers/CustomerView.vue')
const Items = () => import('@/pages/products/ItemList.vue')
const ItemCreate = () => import('@/pages/products/ItemCreate.vue')
const ItemVariants = () => import('@/pages/products/ItemVariants.vue')
const ItemVariantsCreate = () => import('@/pages/products/CreateItemVariants.vue')
const ItemView = () => import('@/pages/products/ItemView.vue')
const ProductCategoryCreate = () => import('@/pages/products/ProductCategoryCreate.vue')
const ProductCategory = () => import('@/pages/products/ProductCategory.vue')
const CategoryView = () => import('@/pages/products/CategoryView.vue')
const ProductBrand = () => import('@/pages/products/ProductBrand.vue')
const BrandCreate = () => import('@/pages/products/BrandCreate.vue')
const ProductUnit = () => import('@/pages/products/ProductUnit.vue')
const CreateUnit = () => import('@/pages/products/CreateUnit.vue')
const CreatePrice = () => import('@/pages/products/CreatePrice.vue')
const ProductPrice = () => import('@/pages/products/ProductPrice.vue')
const ProductSpecification = () => import('@/pages/products/ProductSpecification.vue')
const CreateSpecification = () => import('@/pages/products/CreateSpecification.vue')
const ProductImage = () => import('@/pages/products/ProductImage.vue')
const CreateImage = () => import('@/pages/products/CreateImage.vue')
const ItemType = () => import('@/pages/products/ItemType.vue')
const CreateItemType = () => import('@/pages/products/CreateItemType.vue')
const CreateWarranty = () => import('@/pages/products/CreateWarranty.vue')
const Warranty = () => import('@/pages/products/Warranty.vue')
const Users = () => import('@/pages/administration/Users.vue')
const UsersCreate = () => import('@/pages/administration/UsersCreate.vue')
const UserRoles = () => import('@/pages/administration/UserRoles.vue')
const UserPermission = () => import('@/pages/administration/UserPermission.vue')
const CreateRoles = () => import('@/pages/administration/CreateRoles.vue')
const UserSession = () => import('@/pages/administration/UserSession.vue')
const InventoryLocation = () => import('@/pages/inventory/InventoryLocation.vue')
const CreateInventoryLocation = () => import('@/pages/inventory/CreateInventoryLocation.vue')
const InventoryStock = () => import('@/pages/inventory/InventoryStock.vue')
const CreateInventoryStock = () => import('@/pages/inventory/CreateInventoryStock.vue')
const InventoryStockMovement = () => import('@/pages/inventory/InventoryStockMovement.vue')
const CreateInventoryStockMovement = () => import('@/pages/inventory/CreateInventoryStockMovement.vue')
const GoodReceipts = () => import('@/pages/purchasing/GoodReceipts.vue')
const CreateGoodReceipts = () => import('@/pages/purchasing/CreateGoodReceipts.vue')
const PurchaseOrder = () => import('@/pages/purchasing/PurchaseOrder.vue')
const CreatePurchaseOrder = () => import('@/pages/purchasing/CreatePurchaseOrder.vue')
const Suppliers = () => import('@/pages/purchasing/Suppliers.vue')
const CreateSuppliers = () => import('@/pages/purchasing/CreateSuppliers.vue')
const Orders = () => import('@/pages/sales/Orders.vue')
const OrderDetails = () => import('@/pages/sales/OrderDetails.vue')
const Payment = () => import('@/pages/sales/Payment.vue')
const Invoice = () => import('@/pages/sales/Invoice.vue')
const Deliveries = () => import('@/pages/sales/Deliveries.vue')
const DeliveryDetails = () => import('@/pages/sales/DeliveryDetails.vue')
const DeliveryCharges = () => import('@/pages/sales/DeliveryCharges.vue')
const CreateDeliveryCharges = () => import('@/pages/sales/CreateDeliveryCharges.vue')
const Promotions = () => import('@/pages/marketing/Promotions.vue')
const CreatePromotions = () => import('@/pages/marketing/CreatePromotions.vue')
const PromotionCategories = () => import('@/pages/marketing/PromotionCategories.vue')
const CreatePromotionCategories = () => import('@/pages/marketing/CreatePromotionCategories.vue')
const PromotionItems = () => import('@/pages/marketing/PromotionItems.vue')
const CreatePromotionItems = () => import('@/pages/marketing/CreatePromotionItems.vue')
const HomepageBanners = () => import('@/pages/marketing/HomepageBanners.vue')
const DiscountCampaigns = () => import('@/pages/marketing/DiscountCampaigns.vue')
const CreateHomePage = () => import('@/pages/marketing/CreateHomepageBanners.vue')
const CreateDiscountCampaigns = () => import('@/pages/marketing/DiscountCampaignForm.vue')
const CampaignFrames = () => import('@/pages/marketing/CampaignFrames.vue')
const WebsiteThemes = () => import('@/pages/marketing/WebsiteThemes.vue')
const AuditLog = () => import('@/pages/administration/AuditLog.vue')
import {
    clearAuthentication,
    ensureAuthorization,
    getAccessToken,
    hasAllPermissions,
    hasAnyPermission,
    hasPermission
} from '@/auth/authorization'

const routes = [
    {
        path: '/',
        redirect: '/login'
        
    },
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
