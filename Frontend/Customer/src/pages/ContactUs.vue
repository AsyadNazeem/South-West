<script setup>
import InformationPageLayout from '@/components/InformationPageLayout.vue'

const page = {
  eyebrow: 'WE ARE HERE TO HELP',
  title: 'Contact Us',
  intro: 'Need help with a product, an order, or shopping on South West? This page is your starting point for customer support.',
  sections: [
    {
      title: 'Order assistance',
      text: 'For questions about an order you have already placed, keep your order details available so the relevant information can be checked.',
      link: '/account/orders',
      linkText: 'View your orders',
    },
    {
      title: 'Product enquiries',
      text: 'Review the product description, available specifications, warranty information, and stock details on the relevant product page before ordering.',
      link: '/shop',
      linkText: 'Browse products',
    },
    {
      title: 'Contact details',
      text: 'South West customer support email, telephone number, business address, and operating hours are being finalised. Confirmed contact details will be published here.',
      note: 'Contact details to be added by the store administrator.',
    },
  ],
}
</script>

<template>
  <InformationPageLayout v-bind="page" />
</template>
