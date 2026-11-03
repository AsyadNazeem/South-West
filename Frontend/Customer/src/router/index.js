
import { createRouter, createWebHistory } from 'vue-router'

import Login from '../pages/auth/Login.vue'
import Register from '../pages/auth/Register.vue'
import SetPassword from '../pages/auth/SetPassword.vue'
import VerifyEmail from '../pages/auth/VerifyEmail.vue'
import Home from '../pages/Home.vue'
import InformationPage from '../pages/InformationPage.vue'
import StoreListing from '../pages/StoreListing.vue'
import Categories from '../pages/Categories.vue'
import Brands from '../pages/Brands.vue'



import AccountLayout from '../layouts/AccountLayout.vue'
import AccountOverview from '../pages/account/AccountOverview.vue'
import PersonalInformation from '../pages/account/PersonalInformation.vue'
import AddressBook from '../pages/account/AddressBook.vue'
import ChangePassword from '../pages/account/ChangePassword.vue'
import MyOrders from '../pages/account/MyOrders.vue'
import Notifications from '../pages/account/Notifications.vue'
import Wishlist from '../pages/account/Wishlist.vue'
import MyReviews from '../pages/account/MyReviews.vue'
import ReturnsCancellations from '../pages/account/ReturnsCancellations.vue'
import ProductDetails from '../pages/ProductDetails.vue'
import Cart from '../pages/Cart.vue'
import Checkout from '../pages/Checkout.vue'
import GuestCheckoutAddress from '../pages/GuestCheckoutAddress.vue'

import GoogleCallback from '../pages/auth/GoogleCallback.vue'


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
