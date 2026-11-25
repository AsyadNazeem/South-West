<script setup>
import { onMounted, ref } from 'vue'
import InformationPageLayout from '@/components/InformationPageLayout.vue'

const faqItems = ref([])
const loading = ref(true)
const error = ref('')

const apiBaseUrl = import.meta.env.VITE_API_URL

async function loadFaqs() {
    loading.value = true
    error.value = ''

    try {
        const base = String(apiBaseUrl || '').replace(/\/$/, '')
        const response = await fetch(`${base}/store/faqs`)

        if (!response.ok) {
            throw new Error('Unable to load FAQs.')
        }

        const result = await response.json()

        faqItems.value = (result.data || []).map(faq => ({
            q: faq.question,
            a: faq.answer,
            ...(faq.link_url ? { link: faq.link_url } : {}),
            ...(faq.link_text ? { linkText: faq.link_text } : {}),
        }))
    } catch (err) {
        error.value = 'Unable to load FAQs right now. Please try again later.'
    } finally {
        loading.value = false
    }
}

onMounted(loadFaqs)
</script>

<template>
  <div class="faq-page">
    <InformationPageLayout
      breadcrumb="FAQs"
      eyebrow="HELP CENTRE"
      title="Frequently Asked Questions"
      intro="Quick answers to common questions about shopping and orders at South West."
      :faq-items="faqItems"
    >
      <div v-if="loading" class="faq-state" role="status">
        <div class="faq-spinner" aria-hidden="true"></div>
        <p>Loading frequently asked questions...</p>
      </div>

      <div v-else-if="error" class="faq-state" role="alert">
        <h2>Unable to load FAQs</h2>
        <p>{{ error }}</p>
        <button type="button" class="faq-retry" @click="loadFaqs">
          Try again
        </button>
      </div>
    </InformationPageLayout>
  </div>
</template>

<style scoped>
.faq-state {
  min-height: 320px;
  padding: 72px 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  text-align: center;
  color: #475569;
}

.faq-state h2 {
  margin: 0;
  color: #172033;
  font-size: 24px;
}

.faq-state p {
  margin: 0;
}

.faq-spinner {
  width: 34px;
  height: 34px;
  border: 3px solid #e2e8f0;
  border-top-color: #2563eb;
  border-radius: 50%;
  animation: faq-spin 0.8s linear infinite;
}

.faq-retry {
  padding: 11px 20px;
  border: 0;
  border-radius: 8px;
  background: #2563eb;
  color: white;
  font-weight: 600;
  cursor: pointer;
}

.faq-retry:hover {
  background: #1d4ed8;
}

@keyframes faq-spin {
  to { transform: rotate(360deg); }
}
</style>
