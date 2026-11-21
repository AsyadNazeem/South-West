<script setup>
import InformationPageLayout from '@/components/InformationPageLayout.vue'

const page = {
  eyebrow: 'DELIVERY INFORMATION',
  title: 'Shipping Information',
  intro: 'Find out what to consider when placing an order and how to follow its progress.',
  sections: [
    {
      title: 'Delivery availability',
      text: 'Available delivery destinations and service coverage should be confirmed during checkout. Please check that your delivery address is entered correctly before placing an order.',
    },
    {
      title: 'Delivery charges',
      text: 'Any applicable delivery charge should be reviewed in the order summary before you confirm your purchase. Charges may depend on the delivery destination and the configured delivery service.',
    },
    {
      title: 'Delivery time',
      text: 'Delivery estimates can vary depending on the destination, product availability, and courier arrangements. A confirmed delivery timeframe should be communicated with your order.',
    },
    {
      title: 'Track an order',
      text: 'You can use your customer account to review your orders and available order status information.',
      link: '/account/orders',
      linkText: 'Go to My Orders',
    },
    {
      title: 'Before accepting delivery',
      text: 'Where possible, check the package and products when the delivery arrives. If something appears incorrect or damaged, keep the packaging and order details and contact the store using its confirmed support channel.',
    },
  ],
}
</script>

<template>
  <InformationPageLayout v-bind="page" />
</template>
