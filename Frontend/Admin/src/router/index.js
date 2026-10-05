import { createRouter, createWebHistory } from 'vue-router'

import Login from '../pages/auth/Login.vue'
import AccessDenied from '../pages/auth/AccessDenied.vue'
import Dashboard from '../pages/dashboard/Dashboard.vue'
import AdminLayout from '../components/layout/AdminLayout.vue'
import Customer from '../pages/customers/CustomerList.vue'
import Address from '../pages/customers/CustomerAddresses.vue'
import Reviews from '../pages/customers/CustomerReviews.vue'
import CustomerCreate from '../pages/customers/CustomerCreate.vue'
import CustomerAddressCreate from '../pages/customers/CustomerAddressCreate.vue'
import CustomerView from '../pages/customers/CustomerView.vue'
import CustomerEdit from '../pages/customers/CustomerEdit.vue'
import CustomerAddressEdit from '../pages/customers/CustomerAddressEdit.vue'
import Items from '../pages/products/ItemList.vue'
import ItemCreate from '../pages/products/ItemCreate.vue'
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
                path: 'access-denied',
                name: 'AccessDenied',
                component: AccessDenied
            },
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
                component: CustomerEdit,
                meta: { permission: 'customers.update' }
            },
            {
                path: 'customers/:customerId/addresses/:addressId/edit',
                name: 'customer-address-edit',
                component: CustomerAddressEdit,
                meta: { permission: 'customers.update' }
            },
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
                component: UserRoles,
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
            return { name: 'Dashboard' }
        } catch {
            clearAuthentication()
        }
    }

    return true
})

export default router
