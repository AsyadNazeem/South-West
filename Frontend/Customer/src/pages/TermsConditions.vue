<script setup>
import InformationPageLayout from '@/components/InformationPageLayout.vue'

const page = {
  eyebrow: 'PLEASE READ BEFORE ORDERING',
  title: 'Terms & Conditions',
  intro: 'These terms are a draft overview of matters customers should understand when using the South West online store. They require business and legal review before becoming the final terms of sale.',
  sections: [
    {
      title: 'Using the website',
      text: 'You should use the website lawfully and provide accurate information when creating an account, placing an order, or requesting support.',
    },
    {
      title: 'Product information',
      text: 'Product descriptions, images, specifications, prices, availability, and warranty details are provided to help customers make informed decisions. Review the product information and selected options before confirming an order.',
    },
    {
      title: 'Orders',
      text: 'Submitting an order is a request to purchase the selected products. The store’s final order acceptance, cancellation, and correction process must be stated clearly in the approved terms.',
    },
    {
      title: 'Prices and payments',
      text: 'Review the displayed product prices, discounts, delivery charges, and order total before completing checkout. Available payment methods and payment conditions should be confirmed at checkout.',
    },
    {
      title: 'Delivery',
      text: 'Delivery destinations, charges, estimates, and delivery arrangements are subject to the information confirmed during checkout and the final shipping policy.',
      link: '/shipping',
      linkText: 'Read shipping information',
    },
    {
      title: 'Returns and refunds',
      text: 'Returns, warranty claims, cancellations, and refunds are subject to the store’s final approved policies and applicable law.',
      link: '/returns',
      linkText: 'Read returns information',
    },
    {
      title: 'Changes to these terms',
      text: 'The store should publish the effective date of these terms and explain how material changes will be communicated.',
    },
  ],
  notice: 'Before publication, confirm the legal business name, governing law, order acceptance rules, cancellation rights, liability terms, dispute process, and effective date with a qualified legal adviser.',
}
</script>

<template>
  <InformationPageLayout v-bind="page" />
</template>
