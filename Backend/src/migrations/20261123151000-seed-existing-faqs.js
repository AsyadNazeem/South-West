'use strict';

const faqItems = [
    {
        question: 'How do I place an order?',
        answer: 'Browse the shop, open a product, select the available options you need, add it to your cart, and follow the checkout steps.',
    },
    {
        question: 'Can I order without creating an account?',
        answer: 'The store supports a guest checkout flow. You can follow the guest checkout steps when available instead of signing in.',
    },
    {
        question: 'What payment methods are available?',
        answer: 'The store supports Cash on Delivery and online payment options where enabled. The methods available for your order are shown during checkout.',
    },
    {
        question: 'How can I check my order status?',
        answer: 'Sign in to your customer account and open My Orders to review your order information and available status updates.',
        link_url: '/account/orders',
        link_text: 'Open My Orders',
    },
    {
        question: 'How do I know whether a product is in stock?',
        answer: 'Check the stock status shown on the product page. For products with variants, select the required specifications and colour to see the relevant availability.',
    },
    {
        question: 'Where can I find warranty information?',
        answer: 'Check the warranty information displayed on the relevant product page. Coverage can differ between products.',
    },
    {
        question: 'How much does delivery cost?',
        answer: 'Any applicable delivery charge should be displayed in the order summary during checkout. The charge can depend on the delivery destination.',
    },
    {
        question: 'How do I request warranty support?',
        answer: 'For an eligible technical fault, keep your invoice and video proof of the issue. Review our Return & Warranty Policy and submit a warranty claim through your account where applicable. Standard returns and refunds are not offered.',
        link_url: '/returns',
        link_text: 'Read Return & Warranty Policy',
    },
];

module.exports = {
    async up(queryInterface) {
        const [existing] = await queryInterface.sequelize.query(
            'SELECT COUNT(*) AS total FROM faqs'
        );

        if (Number(existing[0].total) > 0) {
            console.log('FAQ table already contains data. Skipping initial seed.');
            return;
        }

        const now = new Date();

        await queryInterface.bulkInsert(
            'faqs',
            faqItems.map((item, index) => ({
                question: item.question,
                answer: item.answer,
                category: null,
                link_url: item.link_url || null,
                link_text: item.link_text || null,
                sort_order: index,
                is_active: true,
                created_at: now,
                updated_at: now,
            }))
        );
    },

    async down() {
        // Intentionally preserve FAQs because admins may have edited them.
    },
};
