<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import {
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Save,
  Plus,
  Trash2
} from 'lucide-vue-next'

import { hasPermission } from '@/auth/authorization'

import {
  getStockConfirmation,
  updateStockConfirmation
} from '@/api/stockConfirmationApi'

const form = reactive({
  enabled: false,
  threshold: '',
  primary_phone: '',
  primary_whatsapp: true,
  secondary_phone: '',
  secondary_whatsapp: false
})

const original = ref(JSON.stringify(form))
const loading = ref(false)
const saving = ref(false)
const loaded = ref(false)
const error = ref('')
const success = ref('')
const showSecondary = ref(false)

const canUpdate = computed(() =>
  hasPermission('stock_confirmation.update')
)

const hasChanges = computed(() =>
  JSON.stringify(form) !== original.value
)

const fieldsDisabled = computed(() =>
  !canUpdate.value || saving.value || loading.value
)

function applyData(data) {
  if (!data || typeof data.enabled !== 'boolean') {
    throw new Error('Invalid stock confirmation settings response.')
  }

  form.enabled = data.enabled
  form.threshold = String(data.threshold)
  form.primary_phone = data.primary_phone || ''
  form.primary_whatsapp = Boolean(data.primary_whatsapp)
  form.secondary_phone = data.secondary_phone || ''
  form.secondary_whatsapp = Boolean(data.secondary_whatsapp)

  showSecondary.value = Boolean(form.secondary_phone)

  original.value = JSON.stringify(form)
  loaded.value = true
}

function addSecondary() {
  if (fieldsDisabled.value) return

  showSecondary.value = true
  form.secondary_whatsapp = true
}

function removeSecondary() {
  if (fieldsDisabled.value) return

  showSecondary.value = false
  form.secondary_phone = ''
  form.secondary_whatsapp = false
}

async function loadSettings() {
  if (saving.value || loading.value) return

  if (
    loaded.value &&
    hasChanges.value &&
    !window.confirm('Discard unsaved changes and reload?')
  ) return

  loading.value = true
  error.value = ''
  success.value = ''

  try {
    const response = await getStockConfirmation()
    applyData(response.data?.data)
  } catch (err) {
    error.value =
      err.response?.data?.message ||
      err.message ||
      'Unable to load stock confirmation settings.'
  } finally {
    loading.value = false
  }
}

async function saveChanges() {
  if (
    !loaded.value ||
    fieldsDisabled.value ||
    !hasChanges.value
  ) return

  error.value = ''
  success.value = ''

  const threshold = Number(form.threshold)

  if (!Number.isFinite(threshold) || threshold <= 0) {
    error.value = 'Enter a valid price threshold.'
    return
  }

  if (!form.primary_phone.trim()) {
    error.value = 'Enter the primary phone number.'
    return
  }

  if (showSecondary.value && !form.secondary_phone.trim()) {
    error.value = 'Enter or remove the secondary phone number.'
    return
  }

  saving.value = true

  try {
    const payload = {
      enabled: form.enabled,
      threshold: form.threshold,
      primary_phone: form.primary_phone.trim(),
      primary_whatsapp: form.primary_whatsapp,
      secondary_phone: showSecondary.value
        ? form.secondary_phone.trim()
        : null,
      secondary_whatsapp: showSecondary.value
        ? form.secondary_whatsapp
        : false
    }

    const response = await updateStockConfirmation(payload)

    applyData(response.data?.data)

    success.value = 'Stock confirmation settings saved successfully.'
  } catch (err) {
    error.value =
      err.response?.data?.message ||
      err.message ||
      'Unable to save stock confirmation settings.'
  } finally {
    saving.value = false
  }
}

onMounted(loadSettings)
</script>

<template>
  <div class="contact-page">
    <header class="page-header">
      <div>
        <h1>Stock Confirmation</h1>
        <p>Manage stock confirmation requirements for high-value online orders.</p>
      </div>

      <div class="header-actions">
        <button
          type="button"
          class="secondary-button"
          :disabled="loading || saving"
          @click="loadSettings"
        >
          <RefreshCw :size="16" />
          Refresh
        </button>

        <button
          v-if="canUpdate"
          type="button"
          class="primary-button"
          :disabled="!loaded || loading || saving || !hasChanges"
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
      Loading stock confirmation settings...
    </p>

    <form v-else-if="loaded" @submit.prevent="saveChanges">

      <section class="form-section">
        <h2>General Settings</h2>

        <p class="section-description">
          Ask customers to confirm stock availability before
          placing high-value orders.
        </p>

        <label class="checkbox-label">
          <input
            v-model="form.enabled"
            type="checkbox"
            :disabled="fieldsDisabled"
          />
          Enable stock confirmation
        </label>

        <div class="fields-grid stock-fields">
          <div class="field">
            <label for="stock-threshold">
              Product Price Threshold (LKR)
            </label>

            <input
              id="stock-threshold"
              v-model="form.threshold"
              type="number"
              min="0.01"
              max="9999999999.99"
              step="0.01"
              required
              :disabled="fieldsDisabled"
            />

            <p class="section-description">
              Only individual products priced above this amount
              require acknowledgement.
            </p>
          </div>
        </div>
      </section>

      <section class="form-section">
        <h2>Primary Contact Number</h2>

        <p class="section-description">
          The main number displayed in the checkout popup.
        </p>

        <div class="fields-grid">
          <div class="field">
            <label for="primary-phone">Phone Number</label>

            <input
              id="primary-phone"
              v-model="form.primary_phone"
              type="tel"
              maxlength="20"
              placeholder="0773029614"
              required
              :disabled="fieldsDisabled"
            />
          </div>
        </div>

        <label class="checkbox-label stock-fields">
          <input
            v-model="form.primary_whatsapp"
            type="checkbox"
            :disabled="fieldsDisabled"
          />
          Enable WhatsApp for this number
        </label>
      </section>

      <section class="form-section">
        <h2>Secondary Contact Number</h2>

        <p class="section-description">
          Optionally provide customers with another contact number.
        </p>

        <template v-if="showSecondary">
          <div class="fields-grid">
            <div class="field">
              <label for="secondary-phone">Phone Number</label>

              <input
                id="secondary-phone"
                v-model="form.secondary_phone"
                type="tel"
                maxlength="20"
                placeholder="Enter second phone number"
                required
                :disabled="fieldsDisabled"
              />
            </div>
          </div>

          <label class="checkbox-label stock-fields">
            <input
              v-model="form.secondary_whatsapp"
              type="checkbox"
              :disabled="fieldsDisabled"
            />
            Enable WhatsApp for this number
          </label>

          <button
            v-if="canUpdate"
            type="button"
            class="secondary-button stock-fields"
            :disabled="fieldsDisabled"
            @click="removeSecondary"
          >
            <Trash2 :size="16" />
            Remove Second Number
          </button>
        </template>

        <button
          v-else-if="canUpdate"
          type="button"
          class="secondary-button"
          :disabled="fieldsDisabled"
          @click="addSecondary"
        >
          <Plus :size="16" />
          Add Second Phone Number
        </button>

        <p v-else>No secondary number configured.</p>
      </section>

      <section class="form-section">
        <h2>Customer Acknowledgement</h2>

        <p class="section-description">
          Customers must acknowledge that they have contacted
          South West to confirm stock availability.
          Orders continue through the normal checkout process.
          No staff approval is required.
        </p>
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


<style scoped>
.stock-fields {
  margin-top: 16px;
}
</style>
