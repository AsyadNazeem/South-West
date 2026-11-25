import { listingMeta } from './listingMeta.js'

import { createRouter, createWebHistory } from 'vue-router'
import { setPageMeta, uniqueCanonical } from '@/composables/usePageMeta'
import { rememberCampaignParams, trackPageView } from '@/services/analytics'
import {
    productPublicId,
    isProductRouteIndexable,
    shouldPreserveStaticProductMeta,
} from '@/utils/productSeo'

const Login = () => import('@/pages/auth/Login.vue')
const Register = () => import('@/pages/auth/Register.vue')
const SetPassword = () => import('@/pages/auth/SetPassword.vue')
const VerifyEmail = () => import('@/pages/auth/VerifyEmail.vue')
const ForgotPassword = () => import('@/pages/auth/ForgotPassword.vue')
const ResetPassword = () => import('@/pages/auth/ResetPassword.vue')
const Home = () => import('@/pages/Home.vue')
import { informationRoutes } from './informationRoutes.js'
const StoreListing = () => import('@/pages/footer/StoreListing.vue')
const Categories = () => import('@/pages/Categories.vue')
const Brands = () => import('@/pages/Brands.vue')
const AccountLayout = () => import('@/layouts/AccountLayout.vue')
const AccountOverview = () => import('@/pages/account/AccountOverview.vue')
const PersonalInformation = () => import('@/pages/account/PersonalInformation.vue')
const AddressBook = () => import('@/pages/account/AddressBook.vue')
const ChangePassword = () => import('@/pages/account/ChangePassword.vue')
const MyOrders = () => import('@/pages/account/MyOrders.vue')
const Notifications = () => import('@/pages/account/Notifications.vue')
const Wishlist = () => import('@/pages/account/Wishlist.vue')
const MyReviews = () => import('@/pages/account/MyReviews.vue')
const ReturnsCancellations = () => import('@/pages/account/ReturnsCancellations.vue')
const ProductDetails = () => import('@/pages/ProductDetails.vue')
const Cart = () => import('@/pages/Cart.vue')
const Checkout = () => import('@/pages/Checkout.vue')
const GuestCheckoutAddress = () => import('@/pages/GuestCheckoutAddress.vue')
const GoogleCallback = () => import('@/pages/auth/GoogleCallback.vue')
const routes = [
    {
        path: '/shop',
        name: 'store-shop',
        component: StoreListing,
        meta: listingMeta['/shop'],
    },
    {
        path: '/offers',
        name: 'store-offers',
        component: StoreListing,
        meta: listingMeta['/offers'],
    },
    {
        path: '/categories',
        name: 'store-categories',
        component: Categories,
        meta: listingMeta['/categories'],
    },
    {
        path: '/brands',
        name: 'store-brands',
        component: Brands,
        meta: listingMeta['/brands'],
    },

    {
        path: '/',
        name: 'home',
        component: Home,
        meta: { title: 'South West | Online shopping in Sri Lanka', description: 'Shop products by category and brand at South West, Sri Lanka.', index: true },
    },
{
    path: '/product/:productSlug',
    name: 'product-details',
    component: ProductDetails,
    meta: { title: 'Product details | South West Sri Lanka', description: 'View product details, price and availability at South West.', index: true },
    props: true,
},
    {
        path: '/cart',
        name: 'customer-cart',
        component: Cart,
        meta: { title: 'Shopping Cart', index: false, noAnalytics: true },
    },
    {
        path: '/checkout/address/:token?',
        name: 'guest-checkout-address',
        component: GuestCheckoutAddress,
        meta: { title: 'Delivery Details', index: false, noAnalytics: true },
    },
    {
        path: '/checkout/:token?',
        name: 'customer-checkout',
        component: Checkout,
        meta: { title: 'Checkout', index: false, noAnalytics: true },
    },

    {
        path: '/login',
        name: 'customer-login',
        component: Login,
    meta: { title: 'Login', index: false, noAnalytics: true },
    },
    {
    path: '/auth/google/callback',
    name: 'customer-google-callback',
    component: GoogleCallback,
    meta: { title: 'Signing In', index: false, noAnalytics: true },
},
    {
        path: '/register',
        name: 'customer-register',
        component: Register,
    meta: { title: 'Create Account', index: false, noAnalytics: true },
    },
    {
        path: '/set-password',
        name: 'customer-set-password',
        component: SetPassword,
    meta: { title: 'Set Password', index: false, noAnalytics: true },
    },
    {
        path: '/verify-email',
        name: 'customer-verify-email',
        component: VerifyEmail,
    meta: { title: 'Verify Email', index: false, noAnalytics: true },
    },
    {
        path: '/forgot-password',
        name: 'customer-forgot-password',
        component: ForgotPassword,
        meta: { title: 'Forgot Password', index: false, noAnalytics: true },
    },
    {
        path: '/reset-password',
        name: 'customer-reset-password',
        component: ResetPassword,
        meta: { title: 'Reset Password', index: false, noAnalytics: true },
    },


    {
        path: '/account',
        component: AccountLayout,
        meta: { requiresCustomerAuth: true, index: false, noAnalytics: true },
        children: [
            {
                path: '',
                component: AccountOverview,
                meta: { title: 'My Account' },
            },
            {
                path: 'personal-information',
                component: PersonalInformation,
                meta: { title: 'Personal Information' },
            },
            {
                path: 'addresses',
                component: AddressBook,
                meta: { title: 'Address Book' },
            },
            {
                path: 'change-password',
                component: ChangePassword,
                meta: { title: 'Change Password' },
            },
            { path: 'warranty-claims/:claim?', component: () => import('@/pages/account/WarrantyClaims.vue'), meta: { title: 'Warranty Claims' } },
            {
                path: 'orders',
                component: MyOrders,
                meta: { title: 'My Orders' },
            },
            {
                path: 'notifications',
                component: Notifications,
                meta: { title: 'Notifications' },
            },
            {
                path: 'wishlist',
                component: Wishlist,
                meta: { title: 'My Wishlist' },
            },
            {
                path: 'reviews',
                component: MyReviews,
                meta: { title: 'My Reviews' },
            },
            {
                path: 'returns',
                component: ReturnsCancellations,
                meta: { title: 'Warranty & Order Support' },
            },
        ],
    },


    ...informationRoutes,
    { path: '/:pathMatch(.*)*', component: () => import('@/pages/NotFound.vue'), meta: { title: 'Page not found | South West', index: false } },
]

const router = createRouter({
    history: createWebHistory(),
    sensitive: true,
    routes,
    scrollBehavior() {
        return { top: 0 }
    },
})

router.beforeEach(to => {
    let path = to.path.replace(/\/+$/, '') || '/'
    const lower = path.toLowerCase()
    if (Object.hasOwn(listingMeta, lower) || informationRoutes.some(route => route.path === lower)) path = lower
    const product = path.match(/^\/product\/([^/]+)$/i)
    if (product && productPublicId(product[1])) path = '/product/' + product[1]
    if (path !== to.path) return { path, query: to.query, hash: to.hash, replace: true }
})

router.afterEach((to, from) => {
    const index = to.meta.index === true && isProductRouteIndexable(to.query)
    const preserveStaticProductMeta = shouldPreserveStaticProductMeta({
        routeName: to.name,
        routePath: to.path,
        hasQuery: !isProductRouteIndexable(to.query),
        canonicalHref: uniqueCanonical()?.href,
        ogType: document.head.querySelector('meta[property="og:type"]')?.content,
        robotsContent: document.head.querySelector('meta[name="robots"]')?.content,
    })

    // ProductDetails owns product metadata after lookup. Query-only navigation
    // keeps that identity and updates the existing indexing policy.
    if (to.name === 'product-details' && from.path === to.path) {
        const robots = document.head.querySelector('meta[name="robots"]')
        if (robots && document.head.querySelector('link[rel="canonical"]')) {
            robots.content = index ? 'index, follow' : 'noindex, nofollow'
        }
    } else if (!preserveStaticProductMeta) {
        setPageMeta({
            title: to.meta.title || 'South West | Online Store',
            description: to.meta.description,
            path: to.path,
            canonicalPath: to.name === 'product-details' || !to.meta.index ? null : to.path,
            index,
            type: to.name === 'product-details' ? 'product' : 'website',
        })
    }
    rememberCampaignParams(to.fullPath.includes('?') ? to.fullPath.slice(to.fullPath.indexOf('?')) : '')
    trackPageView(to)
})

export default router
