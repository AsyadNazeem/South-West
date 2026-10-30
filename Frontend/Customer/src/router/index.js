
import { createRouter, createWebHistory } from 'vue-router'

import Login from '../pages/auth/Login.vue'
import Register from '../pages/auth/Register.vue'
import SetPassword from '../pages/auth/SetPassword.vue'
import VerifyEmail from '../pages/auth/VerifyEmail.vue'
import Home from '../pages/Home.vue'


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

import GoogleCallback from '../pages/auth/GoogleCallback.vue'


const routes = [
    {
        path: '/',
        name: 'home',
        component: Home,
    },
{
    path: '/product/:productSlug',
    name: 'product-details',
    component: ProductDetails,
    props: true,
},
    {
        path: '/cart',
        name: 'customer-cart',
        component: Cart,
    },
    {
path: '/checkout/:token?',
    name: 'customer-checkout',
    component: Checkout,
    meta: { requiresCustomerAuth: true },
},
    {
        path: '/login',
        name: 'customer-login',
        component: Login,
    },
    {
    path: '/auth/google/callback',
    name: 'customer-google-callback',
    component: GoogleCallback,
},
    {
        path: '/register',
        name: 'customer-register',
        component: Register,
    },
    {
        path: '/set-password',
        name: 'customer-set-password',
        component: SetPassword,
    },
    {
        path: '/verify-email',
        name: 'customer-verify-email',
        component: VerifyEmail,
    },


    {
        path: '/account',
        component: AccountLayout,
        meta: { requiresCustomerAuth: true },
        children: [
            {
                path: '',
                component: AccountOverview,
            },
            {
                path: 'personal-information',
                component: PersonalInformation,
            },
            {
                path: 'addresses',
                component: AddressBook,
            },
            {
                path: 'change-password',
                component: ChangePassword,
            },
            {
                path: 'orders',
                component: MyOrders,
            },
            {
                path: 'notifications',
                component: Notifications,
            },
            {
                path: 'wishlist',
                component: Wishlist,
            },
            {
                path: 'reviews',
                component: MyReviews,
            },
            {
                path: 'returns',
                component: ReturnsCancellations,
            },
        ],
    }

]

const router = createRouter({
    history: createWebHistory(),
    routes,
    scrollBehavior() {
        return { top: 0 }
    },
})

export default router
