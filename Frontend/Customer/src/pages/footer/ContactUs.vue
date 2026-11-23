<script setup>
import { computed, onMounted, ref } from 'vue'
import {
  ArrowRight, ArrowUpRight, Clock3, ExternalLink,
  Facebook, Instagram, Mail, MapPin, MessageCircle,
  Package, Phone, RefreshCw, ShoppingBag
} from 'lucide-vue-next'
import api from '@/services/api'

const contact = ref({})
const loading = ref(true)
const error = ref('')

const hasValue = value =>
  typeof value === 'string' && value.trim().length > 0

const safeUrl = value => {
  if (!hasValue(value)) return null
  try {
    const url = new URL(value)
    return ['https:', 'http:'].includes(url.protocol) ? url.href : null
  } catch {
    return null
  }
}

const phoneLink = computed(() => {
  const value = contact.value.support_phone
  return hasValue(value) ? `tel:${value.replace(/[^\d+]/g, '')}` : null
})

const emailLink = computed(() =>
  hasValue(contact.value.support_email)
    ? `mailto:${contact.value.support_email}`
    : null
)

const whatsappLink = computed(() => {
  const value = contact.value.whatsapp_number
  if (!hasValue(value)) return null
  const digits = value.replace(/\D/g, '')
  return digits ? `https://wa.me/${digits}` : null
})

const mapsLink = computed(() => safeUrl(contact.value.google_maps_url))

const socialLinks = computed(() => [
  { label: 'Facebook', href: safeUrl(contact.value.facebook_url), icon: Facebook },
  { label: 'Instagram', href: safeUrl(contact.value.instagram_url), icon: Instagram },
  { label: 'TikTok', href: safeUrl(contact.value.tiktok_url), icon: ExternalLink },
].filter(item => item.href))

const hasBusinessInfo = computed(() =>
  hasValue(contact.value.business_address) ||
  hasValue(contact.value.support_hours) ||
  hasValue(contact.value.response_time) ||
  Boolean(mapsLink.value)
)

const hasAnyContact = computed(() =>
  Boolean(phoneLink.value || emailLink.value || whatsappLink.value) ||
  hasBusinessInfo.value ||
  socialLinks.value.length > 0
)

async function loadContactInformation() {
  loading.value = true
  error.value = ''

  try {
    const response = await api.get('/store/contact-information')
    contact.value = response.data?.data || {}
  } catch {
    error.value = 'We could not load our contact details right now.'
  } finally {
    loading.value = false
  }
}

onMounted(loadContactInformation)
</script>

<template>
  <main class="contact-page">
    <div class="contact-shell">
      <header class="contact-hero">
        <span class="hero-eyebrow">WE ARE HERE TO HELP</span>
        <h1>Contact Us</h1>
        <p class="hero-description">
          Need help with a product, an order, or shopping on South West?
          This page is your starting point for customer support.
        </p>
      </header>

      <section class="support-section" aria-labelledby="support-title">
        <div class="section-intro">
          <h2 id="support-title">Get in touch</h2>
          <p>Choose the most convenient way to reach us.</p>
        </div>

        <div v-if="loading" class="status-panel" role="status">
          <div class="loading-spinner"></div>
          <p>Loading contact information...</p>
        </div>

        <div v-else-if="error" class="status-panel" role="alert">
          <p>{{ error }}</p>
          <button type="button" class="retry-button" @click="loadContactInformation">
            <RefreshCw :size="16" />
            Try again
          </button>
        </div>

        <div v-else-if="!hasAnyContact" class="status-panel">
          <p>
            South West customer support email, telephone number, business address,
            and operating hours are being finalised. Confirmed contact details
            will be published here.
          </p>
        </div>

        <template v-else>
          <div
            v-if="phoneLink || emailLink || whatsappLink"
            class="method-grid"
          >
            <a v-if="phoneLink" :href="phoneLink" class="method-card">
              <div class="method-icon">
                <Phone :size="22" />
              </div>
              <div class="method-content">
                <h3>Call our team</h3>
                <p>Speak with customer support</p>
                <strong>{{ contact.support_phone }}</strong>
              </div>
              <ArrowUpRight :size="18" class="method-arrow" />
            </a>

            <a v-if="emailLink" :href="emailLink" class="method-card">
              <div class="method-icon">
                <Mail :size="22" />
              </div>
              <div class="method-content">
                <h3>Send an email</h3>
                <p>Write to our support team</p>
                <strong>{{ contact.support_email }}</strong>
              </div>
              <ArrowUpRight :size="18" class="method-arrow" />
            </a>

            <a
              v-if="whatsappLink"
              :href="whatsappLink"
              target="_blank"
              rel="noopener noreferrer"
              class="method-card"
            >
              <div class="method-icon">
                <MessageCircle :size="22" />
              </div>
              <div class="method-content">
                <h3>WhatsApp support</h3>
                <p>Message us directly</p>
                <strong>{{ contact.whatsapp_number }}</strong>
              </div>
              <ArrowUpRight :size="18" class="method-arrow" />
            </a>
          </div>

          <div
            v-if="hasBusinessInfo || socialLinks.length"
            class="details-grid"
          >
            <article v-if="hasBusinessInfo" class="details-card">
              <div class="card-heading">
                <div class="card-heading-icon">
                  <Clock3 :size="19" />
                </div>
                <div>
                  <h3>Business &amp; support information</h3>
                  <p>Helpful details before you contact us</p>
                </div>
              </div>

              <div class="details-list">
                <div v-if="hasValue(contact.support_hours)" class="detail-item">
                  <Clock3 :size="18" />
                  <div>
                    <span>Support hours</span>
                    <strong class="multiline">{{ contact.support_hours }}</strong>
                  </div>
                </div>

                <div v-if="hasValue(contact.response_time)" class="detail-item">
                  <MessageCircle :size="18" />
                  <div>
                    <span>Expected response time</span>
                    <strong>{{ contact.response_time }}</strong>
                  </div>
                </div>

                <div v-if="hasValue(contact.business_address)" class="detail-item detail-item-wide">
                  <MapPin :size="18" />
                  <div>
                    <span>Business address</span>
                    <strong class="multiline">{{ contact.business_address }}</strong>
                    <small class="visit-note">
                      {{ contact.allow_customer_visits
                        ? 'Customer visits are permitted.'
                        : 'Online shopping only. Customer visits are not available.' }}
                    </small>
                  </div>
                </div>
              </div>

              <a
                v-if="mapsLink"
                :href="mapsLink"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-link"
              >
                View location on Google Maps
                <ArrowUpRight :size="16" />
              </a>
            </article>

            <article v-if="socialLinks.length" class="details-card social-card">
              <div class="card-heading">
                <div class="card-heading-icon">
                  <MessageCircle :size="19" />
                </div>
                <div>
                  <h3>Stay connected</h3>
                  <p>Follow South West on social media</p>
                </div>
              </div>

              <div class="social-list">
                <a
                  v-for="social in socialLinks"
                  :key="social.label"
                  :href="social.href"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="social-item"
                >
                  <span class="social-icon">
                    <component :is="social.icon" :size="18" />
                  </span>
                  <span>{{ social.label }}</span>
                  <ArrowUpRight :size="17" />
                </a>
              </div>
            </article>
          </div>
        </template>
      </section>

      <section class="help-section" aria-labelledby="help-title">
        <div class="section-intro">
          <h2 id="help-title">How else can we help?</h2>
          <p>Find answers and manage your shopping experience.</p>
        </div>

        <div class="help-grid">
          <RouterLink to="/account/orders" class="help-card">
            <span class="help-icon">
              <Package :size="22" />
            </span>
            <div>
              <h3>Order assistance</h3>
              <p>
                For questions about an order you have already placed, keep your
                order details available so the relevant information can be checked.
              </p>
              <span class="help-action">
                View your orders <ArrowRight :size="16" />
              </span>
            </div>
          </RouterLink>

          <RouterLink to="/shop" class="help-card">
            <span class="help-icon">
              <ShoppingBag :size="22" />
            </span>
            <div>
              <h3>Product enquiries</h3>
              <p>
                Review the product description, available specifications, warranty
                information, and stock details on the relevant product page before ordering.
              </p>
              <span class="help-action">
                Browse products <ArrowRight :size="16" />
              </span>
            </div>
          </RouterLink>
        </div>

        <div class="faq-strip">
          <div>
            <h3>Need more help?</h3>
            <p>Explore our products or review the frequently asked questions.</p>
          </div>
          <div class="faq-actions">
            <RouterLink to="/shop" class="faq-button faq-button-primary">
              Shop products
            </RouterLink>
            <RouterLink to="/faq" class="faq-button faq-button-secondary">
              Visit FAQs
            </RouterLink>
          </div>
        </div>
      </section>
    </div>
  </main>
</template>

<style scoped>
.contact-page {
  /* Theme tokens from style.css, with base-theme fallbacks */
  --cp-text: var(--color-text, #0b1220);
  --cp-label: var(--color-text-label, var(--color-text, #0b1220));
  --cp-muted: var(--color-text-muted, #5b6677);
  --cp-surface: var(--color-surface, #fff);
  --cp-surface-muted: var(--color-surface-muted, #eef1f6);
  --cp-border: var(--color-border, #d5dbe3);
  --cp-border-soft: var(--color-border-soft, #e6eaf0);
  --cp-border-strong: var(--color-border-strong, #0f2038);
  --cp-primary: var(--color-primary, #0b1a2e);
  --cp-primary-hover: var(--color-primary-hover, #14304f);
  --cp-on-primary: var(--color-on-primary, #fff);
  --cp-gradient: var(--gradient-button, #0b1a2e);
  --cp-shadow: var(--shadow-md, 0 10px 24px #0b122012);
  --cp-focus: var(--color-focus-outline, var(--color-focus, #0b1a2e));
  --cp-bg: var(--color-store-bg, #f7f9fb);

  min-height: 70vh;
  padding: 20px 0 80px;
    background: var(--cp-bg);
  color: var(--cp-text);
}

.contact-shell {
  width: min(1040px, calc(100% - 48px));
  margin: 0 auto;
}

/* Header */
.contact-hero {
  padding-bottom: 28px;
}

.hero-eyebrow {
  display: block;
  margin-bottom: 14px;
  color: var(--cp-label);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: .2em;
}

.contact-hero h1 {
  color: var(--cp-text);
  font-size: clamp(34px, 5vw, 46px);
  font-weight: 750;
  letter-spacing: -.025em;
  line-height: 1.15;
}

.hero-description {
  max-width: 760px;
  margin-top: 18px;
  color: var(--cp-muted);
  font-size: 15px;
  line-height: 1.8;
}

/* Sections */
.support-section,
.help-section {
  margin-top: 36px;
}

.section-intro {
  margin-bottom: 18px;
}

.section-intro h2 {
  margin-bottom: 6px;
  color: var(--cp-text);
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -.01em;
}

.section-intro p {
  color: var(--cp-muted);
  font-size: 14px;
}

/* Shared card look */
.method-card,
.details-card,
.help-card,
.faq-strip,
.status-panel {
  border: 1px solid var(--cp-border);
  border-radius: 12px;
  background: var(--cp-surface);
}

/* Contact methods, side by side */
.method-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 14px;
}

.method-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 18px;
  min-width: 0;
  padding: 24px;
  color: inherit;
  text-decoration: none;
  transition: transform .2s, border-color .2s, box-shadow .2s;
}

.method-card:hover,
.help-card:hover {
  transform: translateY(-2px);
  border-color: var(--cp-border-strong);
  box-shadow: var(--cp-shadow);
}

.method-icon,
.card-heading-icon,
.help-icon,
.social-icon {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  background: var(--cp-surface-muted);
  color: var(--cp-primary);
}

.method-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
}

.method-content h3 {
  margin-bottom: 6px;
  color: var(--cp-text);
  font-size: 17px;
  font-weight: 700;
}

.method-content p {
  margin-bottom: 14px;
  color: var(--cp-muted);
  font-size: 13px;
}

.method-content strong {
  display: block;
  overflow-wrap: anywhere;
  color: var(--cp-text);
  font-size: 14px;
  font-weight: 650;
  line-height: 1.6;
}

.method-arrow {
  position: absolute;
  top: 24px;
  right: 22px;
  color: var(--cp-muted);
  transition: color .2s;
}

.method-card:hover .method-arrow {
  color: var(--cp-primary);
}

/* Business info and social, side by side */
.details-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 14px;
  margin-top: 14px;
}

.details-card {
  min-width: 0;
  padding: 26px;
}

.card-heading {
  display: flex;
  align-items: center;
  gap: 14px;
  padding-bottom: 20px;
  border-bottom: 1px solid var(--cp-border-soft);
}

.card-heading-icon {
  width: 42px;
  height: 42px;
  border-radius: 11px;
}

.card-heading h3 {
  margin-bottom: 4px;
  color: var(--cp-text);
  font-size: 16px;
  font-weight: 700;
}

.card-heading p {
  color: var(--cp-muted);
  font-size: 13px;
}

.details-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 22px 20px;
  margin-top: 22px;
}

.detail-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  color: var(--cp-primary);
}

.detail-item svg {
  flex-shrink: 0;
  margin-top: 2px;
}

.detail-item-wide {
  grid-column: 1 / -1;
}

.detail-item > div {
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 0;
}

.detail-item span {
  color: var(--cp-muted);
  font-size: 12px;
}

.detail-item strong {
  color: var(--cp-text);
  font-size: 14px;
  font-weight: 650;
  line-height: 1.6;
  overflow-wrap: anywhere;
}

.multiline {
  white-space: pre-line;
}

.visit-note {
  color: var(--cp-muted);
  font-size: 12px;
  line-height: 1.6;
}

.inline-link {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  margin-top: 22px;
  color: var(--cp-primary);
  font-size: 13px;
  font-weight: 700;
  text-decoration: none;
}

.inline-link:hover {
  text-decoration: underline;
}

.social-list {
  display: grid;
  gap: 10px;
  margin-top: 22px;
}

.social-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 11px 14px;
  border: 1px solid var(--cp-border-soft);
  border-radius: 10px;
  color: var(--cp-text);
  font-size: 14px;
  font-weight: 650;
  text-decoration: none;
  transition: background .2s, border-color .2s;
}

.social-item:hover {
  background: var(--cp-surface-muted);
  border-color: var(--cp-border-strong);
}

.social-icon {
  width: 36px;
  height: 36px;
  border-radius: 9px;
}

.social-item > svg:last-child {
  margin-left: auto;
  color: var(--cp-muted);
}

/* Help cards, side by side */
.help-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 14px;
}

.help-card {
  display: flex;
  align-items: flex-start;
  gap: 18px;
  padding: 26px;
  color: inherit;
  text-decoration: none;
  transition: transform .2s, border-color .2s, box-shadow .2s;
}

.help-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
}

.help-card h3 {
  margin: 2px 0 8px;
  color: var(--cp-text);
  font-size: 17px;
  font-weight: 700;
}

.help-card p {
  margin-bottom: 16px;
  color: var(--cp-muted);
  font-size: 14px;
  line-height: 1.7;
}

.help-action {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: var(--cp-primary);
  font-size: 13px;
  font-weight: 700;
}

.help-action svg {
  transition: transform .2s;
}

.help-card:hover .help-action svg {
  transform: translateX(3px);
}

/* Need more help strip */
.faq-strip {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 20px;
  margin-top: 14px;
  padding: 26px 28px;
}

.faq-strip h3 {
  margin-bottom: 6px;
  color: var(--cp-text);
  font-size: 18px;
  font-weight: 700;
}

.faq-strip p {
  color: var(--cp-muted);
  font-size: 13px;
}

.faq-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.faq-button,
.retry-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  min-height: 42px;
  padding: 0 18px;
  border: 1px solid var(--cp-primary);
  border-radius: 8px;
  font-size: 13px;
  font-weight: 700;
  text-decoration: none;
  cursor: pointer;
  transition: background .2s, color .2s, border-color .2s;
}

.faq-button-primary,
.retry-button {
  background: var(--cp-gradient);
  color: var(--cp-on-primary);
}

.faq-button-primary:hover,
.retry-button:hover {
  background: var(--cp-primary-hover);
  border-color: var(--cp-primary-hover);
}

.faq-button-secondary {
  background: var(--cp-surface);
  color: var(--cp-primary);
}

.faq-button-secondary:hover {
  background: var(--cp-primary);
  color: var(--cp-on-primary);
}

/* States */
.status-panel {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  min-height: 170px;
  padding: 30px;
  color: var(--cp-muted);
  text-align: center;
}

.status-panel p {
  max-width: 560px;
  font-size: 14px;
  line-height: 1.7;
}

.loading-spinner {
  width: 30px;
  height: 30px;
  border: 3px solid var(--cp-border);
  border-top-color: var(--cp-primary);
  border-radius: 50%;
  animation: spin .8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.method-card:focus-visible,
.help-card:focus-visible,
.social-item:focus-visible,
.faq-button:focus-visible,
.retry-button:focus-visible,
.inline-link:focus-visible {
  outline: 2px solid var(--cp-focus);
  outline-offset: 2px;
}

/* Responsive */
@media (max-width: 700px) {
  .contact-shell { width: min(100% - 28px, 1040px); }
  .contact-page { padding-bottom: 56px; }
  .details-card, .help-card, .method-card { padding: 22px; }
  .faq-strip { flex-direction: column; align-items: flex-start; padding: 22px; }
  .faq-actions { width: 100%; }
  .faq-button { flex: 1; }
}

@media (prefers-reduced-motion: reduce) {
  .loading-spinner { animation: none; }
  .method-card, .help-card, .help-action svg { transition: none; }
}
</style>