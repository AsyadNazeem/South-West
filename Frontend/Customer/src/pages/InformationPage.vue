<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

const pages = {
  '/contact': {
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
  },
  '/shipping': {
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
  },
  '/returns': {
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
  },
  '/about': {
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
  },
  '/privacy-policy': {
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
  },
  '/terms': {
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
  },
}

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

const isFaq = computed(() => route.path === '/faq')
const page = computed(() => pages[route.path] || pages['/about'])
</script>

<template>
  <main class="information-page">
    <div class="information-container">
      <nav class="information-breadcrumb" aria-label="Breadcrumb">
        <RouterLink to="/">Home</RouterLink>
        <span>/</span>
        <span>{{ isFaq ? 'FAQs' : page.title }}</span>
      </nav>

      <header class="information-heading">
        <p class="information-eyebrow">{{ isFaq ? 'HELP CENTRE' : page.eyebrow }}</p>
        <h1>{{ isFaq ? 'Frequently Asked Questions' : page.title }}</h1>
        <p>{{ isFaq
          ? 'Quick answers to common questions about shopping and orders at South West.'
          : page.intro }}</p>
      </header>

      <section v-if="isFaq" class="faq-list">
        <details v-for="(item, index) in faqItems" :key="item.q" class="faq-item">
          <summary>
            <span class="faq-number">{{ String(index + 1).padStart(2, '0') }}</span>
            <span>{{ item.q }}</span>
            <span class="faq-plus" aria-hidden="true">+</span>
          </summary>
          <div class="faq-answer">
            <p>{{ item.a }}</p>
            <RouterLink v-if="item.link" :to="item.link">{{ item.linkText }} →</RouterLink>
          </div>
        </details>
      </section>

      <template v-else>
        <div class="information-sections">
          <article v-for="(section, index) in page.sections" :key="section.title" class="information-card">
            <span class="section-number">{{ String(index + 1).padStart(2, '0') }}</span>
            <div>
              <h2>{{ section.title }}</h2>
              <p>{{ section.text }}</p>
              <p v-if="section.note" class="section-note">{{ section.note }}</p>
              <RouterLink v-if="section.link" :to="section.link" class="section-link">
                {{ section.linkText }} →
              </RouterLink>
            </div>
          </article>
        </div>

        <aside v-if="page.notice" class="information-notice">
          <strong>Important information</strong>
          <p>{{ page.notice }}</p>
        </aside>
      </template>

      <section class="information-footer">
        <div>
          <h2>Need more help?</h2>
          <p>Explore our products or review the frequently asked questions.</p>
        </div>
        <div class="information-actions">
          <RouterLink to="/shop" class="information-button primary">Shop products</RouterLink>
          <RouterLink to="/faq" class="information-button secondary">Visit FAQs</RouterLink>
        </div>
      </section>
    </div>
  </main>
</template>

<style scoped>
.information-page {
  min-height: 55vh;
  padding: 28px 0 72px;
  background: var(--color-background, #f8f9fb);
}
.information-container {
  width: min(100% - 40px, 1040px);
  margin: 0 auto;
}
.information-breadcrumb {
  display: flex;
  gap: 10px;
  margin-bottom: 30px;
  color: var(--color-text-muted, #777);
  font-size: 13px;
}
.information-breadcrumb a { color: inherit; text-decoration: none; }
.information-heading { max-width: 760px; margin-bottom: 34px; }
.information-eyebrow {
  margin: 0 0 9px;
  color: var(--color-primary, #263b63);
  font-size: 11px;
  font-weight: 750;
  letter-spacing: .15em;
}
.information-heading h1 {
  margin: 0;
  color: var(--color-text, #20242b);
  font-size: clamp(30px, 5vw, 44px);
  line-height: 1.15;
}
.information-heading > p:last-child {
  margin: 13px 0 0;
  color: var(--color-text-muted, #737985);
  font-size: 15px;
  line-height: 1.75;
}
.information-sections { display: grid; gap: 14px; }
.information-card {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr);
  gap: 16px;
  padding: 23px 25px;
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 12px;
  background: var(--color-surface, #fff);
}
.section-number, .faq-number {
  color: var(--color-primary, #263b63);
  font-size: 12px;
  font-weight: 750;
  letter-spacing: .06em;
}
.information-card h2 {
  margin: 0 0 8px;
  color: var(--color-text, #20242b);
  font-size: 18px;
}
.information-card p {
  margin: 0;
  color: var(--color-text-muted, #737985);
  font-size: 14px;
  line-height: 1.75;
}
.information-card .section-note { margin-top: 10px; font-weight: 650; }
.section-link {
  display: inline-block;
  margin-top: 12px;
  color: var(--color-primary, #263b63);
  font-size: 13px;
  font-weight: 700;
  text-decoration: none;
}
.information-notice {
  margin-top: 20px;
  padding: 18px 20px;
  border: 1px solid #e7d6ad;
  border-radius: 10px;
  background: #fffaf0;
  color: #634b1d;
}
.information-notice strong { font-size: 14px; }
.information-notice p { margin: 6px 0 0; font-size: 13px; line-height: 1.7; }
.faq-list { display: grid; gap: 10px; }
.faq-item {
  overflow: hidden;
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 10px;
  background: var(--color-surface, #fff);
}
.faq-item summary {
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr) 22px;
  align-items: center;
  gap: 12px;
  padding: 19px 21px;
  color: var(--color-text, #20242b);
  cursor: pointer;
  font-size: 15px;
  font-weight: 650;
  list-style: none;
}
.faq-item summary::-webkit-details-marker { display: none; }
.faq-plus {
  color: var(--color-primary, #263b63);
  font-size: 22px;
  text-align: center;
  transition: transform .2s;
}
.faq-item[open] .faq-plus { transform: rotate(45deg); }
.faq-answer { padding: 0 21px 20px 67px; }
.faq-answer p {
  margin: 0;
  color: var(--color-text-muted, #737985);
  font-size: 14px;
  line-height: 1.75;
}
.faq-answer a {
  display: inline-block;
  margin-top: 9px;
  color: var(--color-primary, #263b63);
  font-size: 13px;
  font-weight: 700;
  text-decoration: none;
}
.information-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 22px;
  margin-top: 32px;
  padding: 25px;
  border-radius: 12px;
  background: var(--color-surface, #fff);
  border: 1px solid var(--color-border, #e5e7eb);
}
.information-footer h2 { margin: 0; font-size: 18px; }
.information-footer p {
  margin: 7px 0 0;
  color: var(--color-text-muted, #737985);
  font-size: 13px;
}
.information-actions { display: flex; flex-wrap: wrap; gap: 10px; }
.information-button {
  display: inline-flex;
  min-height: 42px;
  align-items: center;
  justify-content: center;
  padding: 0 16px;
  border: 1px solid var(--color-primary, #263b63);
  border-radius: 7px;
  font-size: 13px;
  font-weight: 700;
  text-decoration: none;
}
.information-button.primary { background: var(--color-primary, #263b63); color: #fff; }
.information-button.secondary { background: transparent; color: var(--color-primary, #263b63); }
@media (max-width: 650px) {
  .information-container { width: min(100% - 28px, 1040px); }
  .information-card { grid-template-columns: 30px minmax(0, 1fr); padding: 19px 16px; gap: 10px; }
  .faq-item summary { grid-template-columns: 27px minmax(0, 1fr) 18px; padding: 16px; gap: 8px; }
  .faq-answer { padding: 0 16px 18px 51px; }
  .information-footer { align-items: flex-start; flex-direction: column; padding: 20px; }
}
</style>
