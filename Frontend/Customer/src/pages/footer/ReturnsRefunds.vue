<script setup>
import InformationPageLayout from '@/components/InformationPageLayout.vue'

const page = {
  eyebrow: 'AFTER-SALES SUPPORT',
  title: 'Return and Warranty Policy',
  intro:
    'Please read our warranty terms, claim requirements, and exclusions before submitting a warranty claim.',

  sections: [
    {
      title: 'Warranty claim requirements',
      text:
        'An invoice and video proof are compulsory for every warranty claim. Products must be submitted with their original accessories, packaging, and relevant documentation.',
    },
    {
      title: 'Memory product warranty claims',
      text:
        'Memory products must be sent to our physical store at Unity Plaza for warranty assessment. Please contact our support team for instructions before sending your product.',
      link: '/contact',
      linkText: 'Contact support',
    },
    {
      title: 'Accessory warranty claims',
      text:
        'Warranty claims for accessories can be submitted through the South West website. Please provide your invoice, video proof, and details of the technical fault.',
      link: '/account/warranty-claims/new',
      linkText: 'Submit a warranty claim',
    },
    {
      title: 'Warranty coverage',
      text:
        'Warranty applies only to technical faults. All claims are subject to the applicable product warranty terms and assessment.',
    },
    {
      title: 'Warranty exclusions',
      text:
        'The following may not be covered, subject to the applicable warranty terms: physical damage, liquid damage, misuse, burn marks, unauthorized repairs, electrical damage caused by improper use, and tampering.',
    },
    {
      title: 'Warranty inspection and assessment',
      text:
        'Products submitted for warranty claims may undergo inspection and technical testing. Submitting a claim does not automatically guarantee warranty approval.',
    },
    {
      title: 'Refunds for unavailable stock',
      text:
        'South West does not offer standard returns or cash refunds. If an ordered product becomes unavailable due to stock unavailability, we will notify the customer and discuss the available options, including a refund of the amount paid for the unavailable product where applicable. Any refund will be processed through an appropriate non-cash payment method, subject to applicable consumer protection laws.',
    },
    {
      title: 'Warranty assistance',
      text:
        'For questions about warranty eligibility or the claim process, contact South West customer support with your invoice and product details.',
      link: '/contact',
      linkText: 'Contact customer support',
    },
  ],

  notice:
    'Important: An invoice and video proof are required for all warranty claims. Warranty applies only to eligible technical faults and is subject to applicable product warranty terms and Sri Lankan consumer protection laws.',
}
</script>

<template>
  <InformationPageLayout v-bind="page" />
</template>
