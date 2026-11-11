
import { createRouter, createWebHistory } from 'vue-router'
import { setPageMeta } from '@/composables/usePageMeta'
import { rememberCampaignParams, trackPageView } from '@/services/analytics'

const Login = () => import('@/pages/auth/Login.vue')
const Register = () => import('@/pages/auth/Register.vue')
const SetPassword = () => import('@/pages/auth/SetPassword.vue')
const VerifyEmail = () => import('@/pages/auth/VerifyEmail.vue')
const ForgotPassword = () => import('@/pages/auth/ForgotPassword.vue')
const ResetPassword = () => import('@/pages/auth/ResetPassword.vue')
const Home = () => import('@/pages/Home.vue')
const InformationPage = () => import('@/pages/InformationPage.vue')
const StoreListing = () => import('@/pages/StoreListing.vue')
const Categories = () => import('@/pages/Categories.vue')
const Brands = () => import('@/pages/Brands.vue')
import AccountLayout from '@/layouts/AccountLayout.vue'
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
        meta: { title: 'Shop products | South West Sri Lanka', description: 'Browse products available from South West, Sri Lanka.', index: true },
    },
    {
        path: '/offers',
        name: 'store-offers',
        component: StoreListing,
        meta: { title: 'Special offers | South West Sri Lanka', description: 'Explore current offers and discounted products at South West.', index: true },
    },
    {
        path: '/categories',
        name: 'store-categories',
        component: Categories,
        meta: { title: 'Shop by category | South West Sri Lanka', description: 'Explore product categories available from South West.', index: true },
    },
    {
        path: '/brands',
        name: 'store-brands',
        component: Brands,
        meta: { title: 'Shop by brand | South West Sri Lanka', description: 'Browse brands available at South West online store.', index: true },
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
                meta: { title: 'Returns & Cancellations' },
            },
        ],
    },


    {
        path: '/contact',
        name: 'info-contact',
        component: InformationPage,
        meta: { title: 'Contact South West | Sri Lanka', description: 'Find support information for South West orders and products.', index: true },
    },
    {
        path: '/faq',
        name: 'info-faq',
        component: InformationPage,
        meta: { title: 'FAQs | South West Sri Lanka', description: 'Answers to common questions about shopping with South West.', index: true },
    },
    {
        path: '/shipping',
        name: 'info-shipping',
        component: InformationPage,
        meta: { title: 'Shipping information | South West', description: 'Read delivery information for orders from South West.', index: true },
    },
    {
        path: '/returns',
        name: 'info-returns',
        component: InformationPage,
        meta: { title: 'Returns and refunds | South West', description: 'Information about returns and refunds at South West.', index: true },
    },
    {
        path: '/about',
        name: 'info-about',
        component: InformationPage,
        meta: { title: 'About South West | Sri Lanka', description: 'Learn about the South West online store in Sri Lanka.', index: true },
    },
    {
        path: '/privacy-policy',
        name: 'info-privacy-policy',
        component: InformationPage,
        meta: { title: 'Privacy policy | South West', description: 'Read the South West website privacy policy.', index: true },
    },
    {
        path: '/terms',
        name: 'info-terms',
        component: InformationPage,
        meta: { title: 'Terms and conditions | South West', description: 'Read the South West website terms and conditions.', index: true },
    },
]

const router = createRouter({
    history: createWebHistory(),
    routes,
    scrollBehavior() {
        return { top: 0 }
    },
})

router.afterEach((to) => {
    const index = to.meta.index === true && !Object.keys(to.query || {}).length
    setPageMeta({
        title: to.meta.title || 'South West | Online Store',
        description: to.meta.description,
        path: to.path,
        index,
    })
    rememberCampaignParams(to.fullPath.includes('?') ? to.fullPath.slice(to.fullPath.indexOf('?')) : '')
    trackPageView(to)
})

export default router
