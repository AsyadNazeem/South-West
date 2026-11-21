<script setup>
import InformationPageLayout from '@/components/InformationPageLayout.vue'

const faqItems = [
  {
    q: 'How do I place an order?',
    a: 'Browse the shop, open a product, select the available options you need, add it to your cart, and follow the checkout steps.',
  },
  {
    q: 'Can I order without creating an account?',
    a: 'The store supports a guest checkout flow. You can follow the guest checkout steps when available instead of signing in.',
  },
  {
    q: 'What payment methods are available?',
    a: 'The store supports Cash on Delivery and online payment options where enabled. The methods available for your order are shown during checkout.',
  },
  {
    q: 'How can I check my order status?',
    a: 'Sign in to your customer account and open My Orders to review your order information and available status updates.',
    link: '/account/orders',
    linkText: 'Open My Orders',
  },
  {
    q: 'How do I know whether a product is in stock?',
    a: 'Check the stock status shown on the product page. For products with variants, select the required specifications and colour to see the relevant availability.',
  },
  {
    q: 'Where can I find warranty information?',
    a: 'Check the warranty information displayed on the relevant product page. Coverage can differ between products.',
  },
  {
    q: 'How much does delivery cost?',
    a: 'Any applicable delivery charge should be displayed in the order summary during checkout. The charge can depend on the delivery destination.',
  },
  {
    q: 'How do I request a return or refund?',
    a: 'Keep your order details and information about the issue. Review the Returns & Refunds page and contact the store through its confirmed support channel before sending an item back.',
    link: '/returns',
    linkText: 'Read Returns & Refunds',
  },
]
</script>

<template>
  <InformationPageLayout
    breadcrumb="FAQs"
    eyebrow="HELP CENTRE"
    title="Frequently Asked Questions"
    intro="Quick answers to common questions about shopping and orders at South West."
    :faq-items="faqItems"
  />
</template>
