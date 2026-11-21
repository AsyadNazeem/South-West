export const informationRoutes = [
    {
        path: '/contact',
        name: 'info-contact',
        component: () => import('@/pages/ContactUs.vue'),
        meta: { title: 'Contact South West | Sri Lanka', description: 'Find support information for South West orders and products.', index: true },
    },
    {
        path: '/faq',
        name: 'info-faq',
        component: () => import('@/pages/Faq.vue'),
        meta: { title: 'FAQs | South West Sri Lanka', description: 'Answers to common questions about shopping with South West.', index: true },
    },
    {
        path: '/shipping',
        name: 'info-shipping',
        component: () => import('@/pages/ShippingInformation.vue'),
        meta: { title: 'Shipping information | South West', description: 'Read delivery information for orders from South West.', index: true },
    },
    {
        path: '/returns',
        name: 'info-returns',
        component: () => import('@/pages/ReturnsRefunds.vue'),
        meta: { title: 'Returns and refunds | South West', description: 'Information about returns and refunds at South West.', index: true },
    },
    {
        path: '/about',
        name: 'info-about',
        component: () => import('@/pages/AboutUs.vue'),
        meta: { title: 'About South West | Sri Lanka', description: 'Learn about the South West online store in Sri Lanka.', index: true },
    },
    {
        path: '/privacy-policy',
        name: 'info-privacy-policy',
        component: () => import('@/pages/PrivacyPolicy.vue'),
        meta: { title: 'Privacy policy | South West', description: 'Read the South West website privacy policy.', index: true },
    },
    {
        path: '/terms',
        name: 'info-terms',
        component: () => import('@/pages/TermsConditions.vue'),
        meta: { title: 'Terms and conditions | South West', description: 'Read the South West website terms and conditions.', index: true },
    },
]
