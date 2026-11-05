
import { createRouter, createWebHistory } from 'vue-router'

const Login = () => import('@/pages/auth/Login.vue')
const Register = () => import('@/pages/auth/Register.vue')
const SetPassword = () => import('@/pages/auth/SetPassword.vue')
const VerifyEmail = () => import('@/pages/auth/VerifyEmail.vue')
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
        meta: { title: 'All Products' },
    },
    {
        path: '/offers',
        name: 'store-offers',
        component: StoreListing,
        meta: { title: 'Special Offers' },
    },
    {
        path: '/categories',
        name: 'store-categories',
        component: Categories,
        meta: { title: 'Categories' },
    },
    {
        path: '/brands',
        name: 'store-brands',
        component: Brands,
        meta: { title: 'Brands' },
    },

    {
        path: '/',
        name: 'home',
        component: Home,
        meta: { title: 'Home' },
    },
{
    path: '/product/:productSlug',
    name: 'product-details',
    component: ProductDetails,
    meta: { title: 'Product Details' },
    props: true,
},
    {
        path: '/cart',
        name: 'customer-cart',
        component: Cart,
        meta: { title: 'Shopping Cart' },
    },
    {
        path: '/checkout/address/:token?',
        name: 'guest-checkout-address',
        component: GuestCheckoutAddress,
        meta: { title: 'Delivery Details' },
    },
    {
        path: '/checkout/:token?',
        name: 'customer-checkout',
        component: Checkout,
        meta: { title: 'Checkout' },
    },

    {
        path: '/login',
        name: 'customer-login',
        component: Login,
        meta: { title: 'Login' },
    },
    {
    path: '/auth/google/callback',
    name: 'customer-google-callback',
    component: GoogleCallback,
    meta: { title: 'Signing In' },
},
    {
        path: '/register',
        name: 'customer-register',
        component: Register,
        meta: { title: 'Create Account' },
    },
    {
        path: '/set-password',
        name: 'customer-set-password',
        component: SetPassword,
        meta: { title: 'Set Password' },
    },
    {
        path: '/verify-email',
        name: 'customer-verify-email',
        component: VerifyEmail,
        meta: { title: 'Verify Email' },
    },


    {
        path: '/account',
        component: AccountLayout,
        meta: { requiresCustomerAuth: true },
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
        meta: { title: 'Contact Us' },
    },
    {
        path: '/faq',
        name: 'info-faq',
        component: InformationPage,
        meta: { title: 'FAQs' },
    },
    {
        path: '/shipping',
        name: 'info-shipping',
        component: InformationPage,
        meta: { title: 'Shipping Information' },
    },
    {
        path: '/returns',
        name: 'info-returns',
        component: InformationPage,
        meta: { title: 'Returns & Refunds' },
    },
    {
        path: '/about',
        name: 'info-about',
        component: InformationPage,
        meta: { title: 'About Us' },
    },
    {
        path: '/privacy-policy',
        name: 'info-privacy-policy',
        component: InformationPage,
        meta: { title: 'Privacy Policy' },
    },
    {
        path: '/terms',
        name: 'info-terms',
        component: InformationPage,
        meta: { title: 'Terms & Conditions' },
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
    const pageTitle = to.meta.title || 'South West'
    document.title = `${pageTitle} | South West`
})

export default router
