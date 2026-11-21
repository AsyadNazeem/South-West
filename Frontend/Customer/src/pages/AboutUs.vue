<script setup>
import InformationPageLayout from '@/components/InformationPageLayout.vue'

const page = {
  eyebrow: 'ABOUT SOUTH WEST',
  title: 'Technology Shopping, Made Simple',
  intro: 'South West is an online shopping platform designed to make browsing products, comparing specifications, and placing orders straightforward.',
  sections: [
    {
      title: 'Explore products',
      text: 'Browse the catalogue by category or brand, review product information, and explore available product options before making a choice.',
      link: '/shop',
      linkText: 'Explore the shop',
    },
    {
      title: 'Clear product information',
      text: 'Product pages bring together available descriptions, specifications, pricing, images, stock information, and warranty details where provided.',
    },
    {
      title: 'Convenient online ordering',
      text: 'Customers can place orders through the online store and review their order information through the customer account features.',
    },
    {
      title: 'Our commitment',
      text: 'Our aim is to provide a clear and convenient online shopping experience, with useful product information and accessible order information.',
    },
  ],
}
</script>

<template>
  <InformationPageLayout v-bind="page" />
</template>
