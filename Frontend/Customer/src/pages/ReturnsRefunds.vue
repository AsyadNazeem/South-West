<script setup>
import InformationPageLayout from '@/components/InformationPageLayout.vue'

const page = {
  eyebrow: 'AFTER-SALES SUPPORT',
  title: 'Returns & Refunds',
  intro: 'We want you to have clear information if a product or order does not meet expectations.',
  sections: [
    {
      title: 'Requesting help with an order',
      text: 'Keep your order number, product details, and a clear description of the issue ready when requesting assistance.',
      link: '/account/orders',
      linkText: 'View your orders',
    },
    {
      title: 'Product condition',
      text: 'If a product arrives damaged, incorrect, or incomplete, retain the packaging and any relevant photos or evidence. Avoid disposing of the item or packaging until the issue has been reviewed.',
    },
    {
      title: 'Eligibility and time limits',
      text: 'Return eligibility, acceptable reasons, condition requirements, and request deadlines must be confirmed in the store’s final returns policy. Please contact the store before sending an item back.',
    },
    {
      title: 'Refund processing',
      text: 'Refund approval, method, and processing time depend on the outcome of the return review and the original payment method. A refund should not be considered approved until the store confirms it.',
    },
    {
      title: 'Warranty claims',
      text: 'Warranty coverage can differ by product and manufacturer. Check the warranty information displayed on the product page and retain your order details.',
      link: '/shop',
      linkText: 'Browse product information',
    },
  ],
  notice: 'The store’s return window, eligibility rules, return address, and refund timelines must be confirmed before this page is treated as the final returns policy.',
}
</script>

<template>
  <InformationPageLayout v-bind="page" />
</template>
