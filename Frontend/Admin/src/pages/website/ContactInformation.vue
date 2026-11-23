<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { AlertCircle, CheckCircle2, RefreshCw, Save } from 'lucide-vue-next'
import { hasPermission } from '@/auth/authorization'
import {
  getContactInformation,
  updateContactInformation,
} from '@/api/contactInformationApi'

const fieldGroups = [
  {
    title: 'Customer Support',
    description: 'Contact methods customers can use for assistance.',
    fields: [
      { key: 'support_phone', label: 'Support Phone', type: 'tel', max: 50 },
      { key: 'whatsapp_number', label: 'WhatsApp Number', type: 'tel', max: 50 },
      { key: 'support_email', label: 'Support Email', type: 'email', max: 255 },
      { key: 'response_time', label: 'Expected Response Time', type: 'text', max: 255 },
    ],
  },
  {
    title: 'Business Information',
    description: 'Business address, support hours, and map location.',
    fields: [
      { key: 'business_address', label: 'Business Address', multiline: true, max: 5000 },
      { key: 'support_hours', label: 'Support Hours', multiline: true, max: 2000 },
      { key: 'google_maps_url', label: 'Google Maps URL', type: 'url', max: 1000 },
    ],
  },
  {
    title: 'Social Media',
    description: 'Official social media profile links.',
    fields: [
      { key: 'facebook_url', label: 'Facebook URL', type: 'url', max: 1000 },
      { key: 'instagram_url', label: 'Instagram URL', type: 'url', max: 1000 },
      { key: 'tiktok_url', label: 'TikTok URL', type: 'url', max: 1000 },
    ],
  },
]

const fieldKeys = fieldGroups.flatMap(group =>
  group.fields.map(field => field.key)
)

const form = reactive(
  Object.fromEntries([
    ...fieldKeys.map(key => [key, '']),
    ['allow_customer_visits', false],
  ])
)

const original = ref(JSON.stringify(form))
const loading = ref(false)
const saving = ref(false)
const error = ref('')
const success = ref('')

const canUpdate = computed(() =>
  hasPermission('contact_information.update')
)

const hasChanges = computed(() =>
  JSON.stringify(form) !== original.value
)

function applyData(data) {
  for (const key of fieldKeys) {
    form[key] = data?.[key] ?? ''
  }

  form.allow_customer_visits = Boolean(data?.allow_customer_visits)
  original.value = JSON.stringify(form)
}

async function loadInformation() {
  if (saving.value) return

  if (hasChanges.value &&
      !window.confirm('Discard unsaved changes and reload?')) {
    return
  }

  loading.value = true
  error.value = ''
  success.value = ''

  try {
    const response = await getContactInformation()
    applyData(response.data?.data)
  } catch (err) {
    error.value =
      err.response?.data?.message ||
      'Unable to load contact information.'
  } finally {
    loading.value = false
  }
}

async function saveChanges() {
  if (!canUpdate.value || !hasChanges.value || saving.value || loading.value) {
    return
  }

  error.value = ''
  success.value = ''
  saving.value = true

  try {
    const payload = Object.fromEntries(
      fieldKeys.map(key => [key, form[key].trim() || null])
    )

    payload.allow_customer_visits = form.allow_customer_visits

    const response = await updateContactInformation(payload)
    applyData(response.data?.data)

    success.value = 'Contact information saved successfully.'
  } catch (err) {
    error.value =
      err.response?.data?.message ||
      'Unable to save contact information.'
  } finally {
    saving.value = false
  }
}

onMounted(loadInformation)
</script>

<template>
  <div class="contact-page">
    <header class="page-header">
      <div>
        <h1>Contact Information</h1>
        <p>Manage the business contact details displayed on your storefront.</p>
      </div>

      <div class="header-actions">
        <button
          type="button"
          class="secondary-button"
          :disabled="loading || saving"
          @click="loadInformation"
        >
          <RefreshCw :size="16" />
          Refresh
        </button>

        <button
          v-if="canUpdate"
          type="button"
          class="primary-button"
          :disabled="loading || saving || !hasChanges"
          @click="saveChanges"
        >
          <Save :size="16" />
          {{ saving ? 'Saving...' : 'Save Changes' }}
        </button>
      </div>
    </header>

    <div v-if="error" class="notice error" role="alert">
      <AlertCircle :size="18" />
      {{ error }}
    </div>

    <div v-if="success" class="notice success" role="status">
      <CheckCircle2 :size="18" />
      {{ success }}
    </div>

    <p v-if="loading" class="loading-message">
      Loading contact information...
    </p>

    <form v-else @submit.prevent="saveChanges">
      <section
        v-for="group in fieldGroups"
        :key="group.title"
        class="form-section"
      >
        <h2>{{ group.title }}</h2>
        <p class="section-description">{{ group.description }}</p>

        <div class="fields-grid">
          <div
            v-for="field in group.fields"
            :key="field.key"
            class="field"
          >
            <label :for="field.key">{{ field.label }}</label>

            <textarea
              v-if="field.multiline"
              :id="field.key"
              v-model="form[field.key]"
              :maxlength="field.max"
              :disabled="!canUpdate || saving"
              rows="3"
            />

            <input
              v-else
              :id="field.key"
              v-model="form[field.key]"
              :type="field.type"
              :maxlength="field.max"
              :disabled="!canUpdate || saving"
            />
          </div>
        </div>
      </section>

      <section class="form-section">
        <h2>Customer Visits</h2>
        <p class="section-description">
          Control whether customers are permitted to visit your business address.
        </p>

        <label class="checkbox-label">
          <input
            v-model="form.allow_customer_visits"
            type="checkbox"
            :disabled="!canUpdate || saving"
          />
          Allow customers to visit the business location
        </label>
      </section>

      <div v-if="canUpdate" class="footer-actions">
        <button
          type="submit"
          class="primary-button"
          :disabled="loading || saving || !hasChanges"
        >
          <Save :size="16" />
          {{ saving ? 'Saving...' : 'Save Changes' }}
        </button>
      </div>
    </form>
  </div>
</template>

<style scoped>
.contact-page {
  padding: 24px;
  max-width: 1100px;
  margin: 0 auto;
}

.page-header,
.header-actions,
.primary-button,
.secondary-button,
.notice {
  display: flex;
  align-items: center;
  gap: 12px;
}

.page-header {
  justify-content: space-between;
  flex-wrap: wrap;
  margin-bottom: 24px;
}

.page-header h1 {
  margin: 0 0 8px;
  font-size: 28px;
}

.page-header p,
.section-description {
  color: #64748b;
  margin: 0;
}

.primary-button,
.secondary-button {
  padding: 10px 16px;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
}

.primary-button {
  background: #2563eb;
  color: white;
  border: 1px solid #2563eb;
}

.secondary-button {
  background: white;
  color: #334155;
  border: 1px solid #cbd5e1;
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.form-section {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 20px;
}

.form-section h2 {
  margin: 0 0 8px;
  font-size: 19px;
}

.section-description {
  margin-bottom: 20px;
}

.fields-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.field label {
  font-weight: 600;
  font-size: 14px;
}

.field input,
.field textarea {
  width: 100%;
  box-sizing: border-box;
  padding: 11px 12px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  font: inherit;
}

.field textarea {
  resize: vertical;
}

.field input:disabled,
.field textarea:disabled {
  background: #f8fafc;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
}

.checkbox-label input {
  width: 18px;
  height: 18px;
}

.notice {
  padding: 14px;
  border-radius: 8px;
  margin-bottom: 20px;
}

.notice.error {
  background: #fef2f2;
  color: #b91c1c;
}

.notice.success {
  background: #f0fdf4;
  color: #166534;
}

.loading-message {
  color: #64748b;
}

.footer-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 24px;
}

@media (max-width: 640px) {
  .contact-page {
    padding: 16px;
  }

  .fields-grid {
    grid-template-columns: 1fr;
  }
}
</style>
