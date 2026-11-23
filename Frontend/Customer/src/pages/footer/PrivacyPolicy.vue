<script setup>
import InformationPageLayout from '@/components/InformationPageLayout.vue'

const page = {
  eyebrow: 'YOUR PRIVACY',
  title: 'Privacy Policy',
  intro: 'South West respects your privacy and is committed to protecting the personal information you share when using our online store. This policy explains what information we collect, how we use it, when it may be shared, and how you can contact us about your information.',

  sections: [
    {
      title: '1. Information We Collect',
      text: 'We may collect personal information that you provide when creating an account, signing in, placing an order, or contacting us. This may include your first name, last name, email address, telephone number, delivery address, billing address, and information relating to your orders. If you use guest checkout, we collect the information required to process and deliver your order.',
    },
    {
      title: '2. Google Sign-In',
      text: 'If you choose to sign in using Google, we request access to your basic Google account information through the Google sign-in service. This includes your Google account ID, email address, first name, and last name. We use this information to verify your identity, create or access your South West customer account, and provide account authentication. We do not use Google account information for advertising or sell it to third parties. Google handles authentication in accordance with its own privacy policy and terms. Our use and transfer of information received from Google APIs complies with the Google API Services User Data Policy, including its Limited Use requirements.',
    },
    {
      title: '3. How We Use Your Information',
      text: 'We use personal information to create and manage customer accounts, authenticate customers, process and manage orders, arrange deliveries, provide customer support, communicate order updates, maintain website security, prevent fraudulent activity, and improve the operation of our online store.',
    },
    {
      title: '4. Orders and Payments',
      text: 'When you place an order, we use the information you provide to manage the order, prepare invoices, arrange delivery, and maintain order records. Cash on delivery is available where offered at checkout. Other payment methods may be displayed as available options, but their processing depends on the relevant payment service being integrated and enabled. South West does not intentionally collect or store full payment card numbers or card security codes through its customer account system.',
    },
    {
      title: '5. Cookies and Browser Storage',
      text: 'Our website uses browser storage and essential technical mechanisms to support account authentication, customer sessions, guest checkout, and website functionality. For example, session storage may be used to retain a customer authentication token, customer profile information, or a guest checkout token during a browsing session. Google sign-in also uses a temporary security cookie during the authentication process. You can manage cookies and browser storage through your browser settings. Disabling certain storage features may affect website functionality.',
    },
    {
      title: '6. Information Sharing',
      text: 'We do not sell or rent your personal information. We may share relevant information when necessary with service providers involved in operating our website, hosting our systems, providing Google sign-in, communicating with customers, processing payments when an enabled payment service is used, or delivering orders. Information may also be disclosed where required by law or where necessary to protect the rights, security, and property of South West, our customers, or others.',
    },
    {
      title: '7. Data Security',
      text: 'We use technical and organisational measures intended to protect customer information against unauthorised access, disclosure, alteration, or destruction. These measures include protected authentication processes and security controls for customer sessions. However, no method of transmitting or storing information electronically can be guaranteed to be completely secure.',
    },
    {
      title: '8. Data Retention',
      text: 'We retain personal information for as long as reasonably necessary to provide our services, maintain customer accounts, fulfil orders, handle customer enquiries, resolve disputes, maintain business records, and meet applicable legal obligations. Information that is no longer required will be deleted or securely disposed of where reasonably practicable and legally permitted.',
    },
    {
      title: '9. Your Privacy Rights',
      text: 'You may contact us to request access to your personal information, correction of inaccurate information, or deletion of personal information associated with your account. You may also request assistance with your South West account or Google sign-in information. Some information may need to be retained where required for legitimate business purposes or applicable legal obligations. We may need to verify your identity before processing a privacy request.',
    },
    {
      title: '10. Third-Party Services',
      text: 'Our website may use third-party services to support authentication, hosting, communications, payment processing, and delivery operations. These services may process relevant information under their own privacy policies and terms. We encourage you to review the privacy policies of third-party services when using them.',
    },
    {
      title: '11. Changes to This Policy',
      text: 'We may update this Privacy Policy from time to time to reflect changes to our website, services, business practices, or applicable legal requirements. Any updated version will be published on this page. We encourage customers to review this page periodically.',
    },
    {
      title: '12. Contact Us',
      text: 'If you have questions about this Privacy Policy or wish to request access to, correction of, or deletion of your personal information, contact our privacy support team at support@southwest.lk.',
    },
  ],
}
</script>

<template>
  <InformationPageLayout v-bind="page" />
</template>
