<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import api from '@/services/api'
import SearchableSelect from '@/components/SearchableSelect.vue'

const MAX_ADDRESSES = 3

const addresses = ref([])
const districts = ref([])
const areas = ref([])

const loading = ref(true)
const saving = ref(false)
const deleting = ref(false)
const formOpen = ref(false)
const editingId = ref(null)
const confirmingId = ref(null)
const errorMessage = ref('')
const flashMessage = ref('')

const canAdd = computed(() => addresses.value.length < MAX_ADDRESSES)

const addressTypeLabel = {
  shipping: 'Shipping address',
  billing: 'Billing address',
}

const blankForm = () => ({
  recipient_name: '',
  phone: '',
  address_line_1: '',
  address_line_2: '',
  city: '',
  state: '',
  postal_code: '',
  country: 'Sri Lanka',
  district_id: '',
  area_id: '',
  address_type: 'shipping',
  is_default: false,
})

const form = reactive(blankForm())

// Stops the district watcher from clearing the area while editing an existing address.
let suppressAreaReset = false

let flashTimer = null
function flash(message) {
  flashMessage.value = message
  clearTimeout(flashTimer)
  flashTimer = setTimeout(() => {
    flashMessage.value = ''
  }, 3000)
}

function getData(response) {
  const body = response.data
  return body?.data ?? body
}

function getError(error, fallback) {
  return error.response?.data?.message || error.message || fallback
}

async function loadAddresses() {
  loading.value = true
  errorMessage.value = ''

  try {
    const result = getData(await api.get('/customer/addresses'))
    addresses.value = Array.isArray(result)
        ? result
        : Array.isArray(result?.addresses)
            ? result.addresses
            : []
  } catch (error) {
    errorMessage.value = getError(error, 'We could not load your addresses. Please refresh the page.')
  } finally {
    loading.value = false
  }
}

async function loadDistricts() {
  try {
    const result = getData(await api.get('/delivery-districts'))
    districts.value = Array.isArray(result) ? result : []
  } catch (error) {
    errorMessage.value = getError(error, 'We could not load districts. Please try again.')
  }
}

async function loadAreas(districtId) {
  areas.value = []
  if (!districtId) return

  try {
    const result = getData(await api.get('/delivery-areas', {
      params: { district_id: districtId },
    }))
    areas.value = Array.isArray(result)
        ? result
        : Array.isArray(result?.areas)
            ? result.areas
            : []
  } catch (error) {
    errorMessage.value = getError(error, 'We could not load delivery areas. Please try again.')
  }
}

watch(() => form.district_id, async (districtId, oldDistrictId) => {
  if (!suppressAreaReset && districtId !== oldDistrictId) {
    form.area_id = ''
  }
  await loadAreas(districtId)
})

async function openForm(address = null) {
  errorMessage.value = ''
  confirmingId.value = null
  Object.assign(form, blankForm())
  editingId.value = address?.id ?? null
  formOpen.value = true

  if (address) {
    suppressAreaReset = true
    Object.assign(form, {
      ...blankForm(),
      recipient_name: address.recipient_name || '',
      phone: address.phone || '',
      address_line_1: address.address_line_1 || '',
      address_line_2: address.address_line_2 || '',
      city: address.city || '',
      state: address.state || '',
      postal_code: address.postal_code || '',
      country: address.country || 'Sri Lanka',
      district_id: address.district_id ? String(address.district_id) : '',
      area_id: address.area_id ? String(address.area_id) : '',
      address_type: address.address_type || 'shipping',
      is_default: Boolean(address.is_default),
    })
  }

  if (!districts.value.length) await loadDistricts()

  if (address?.district_id) {
    await loadAreas(String(address.district_id))
    form.area_id = String(address.area_id || '')
  }

  suppressAreaReset = false
}

function closeForm() {
  if (saving.value) return
  formOpen.value = false
  editingId.value = null
  errorMessage.value = ''
  Object.assign(form, blankForm())
}

async function saveAddress() {
  errorMessage.value = ''

  if (!form.district_id || !form.area_id) {
    errorMessage.value = 'Please choose your district and delivery area.'
    return
  }

  saving.value = true

  const payload = {
    ...form,
    district_id: Number(form.district_id),
    area_id: Number(form.area_id),
    is_default: Boolean(form.is_default),
  }

  try {
    if (editingId.value) {
      await api.patch(`/customer/addresses/${editingId.value}`, payload)
      flash('Your address has been updated.')
    } else {
      await api.post('/customer/addresses', payload)
      flash('Your new address has been saved.')
    }

    formOpen.value = false
    editingId.value = null
    Object.assign(form, blankForm())
    await loadAddresses()
  } catch (error) {
    errorMessage.value = getError(error, 'We could not save this address. Please check the details and try again.')
  } finally {
    saving.value = false
  }
}

async function makeDefault(address) {
  errorMessage.value = ''

  try {
    await api.patch(`/customer/addresses/${address.id}`, {
      is_default: true,
    })

    flash('Default address updated.')
    await loadAddresses()
  } catch (error) {
    errorMessage.value = getError(
      error,
      'We could not update your default address.'
    )
  }
}

async function deleteAddress(address) {
  errorMessage.value = ''
  deleting.value = true

  try {
    await api.delete(`/customer/addresses/${address.id}`)
    confirmingId.value = null
    flash('Address deleted.')
    await loadAddresses()
  } catch (error) {
    errorMessage.value = getError(error, 'We could not delete this address. Please try again.')
  } finally {
    deleting.value = false
  }
}

function formatAddress(address) {
  const area = address.area?.area_name
      || address.deliveryArea?.area_name
      || areas.value.find(item => item.id === address.area_id)?.area_name

  const district = address.district?.district_name
      || address.deliveryDistrict?.district_name
      || districts.value.find(item => item.id === address.district_id)?.district_name

  return [
    address.address_line_1,
    address.address_line_2,
    area,
    address.city,
    district,
    address.state,
    address.postal_code,
    address.country,
  ].filter(Boolean).join(', ')
}

onMounted(async () => {
  await Promise.all([loadAddresses(), loadDistricts()])
})
</script>

<template>
  <div class="address-book">
    <header class="page-head">
      <div>
        <h2>Address Book</h2>
        <p class="muted">Save up to {{ MAX_ADDRESSES }} addresses for faster checkout.</p>
      </div>

      <button
          v-if="!formOpen"
          type="button"
          class="button primary"
          :disabled="!canAdd"
          @click="openForm()"
      >
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" />
        </svg>
        Add address
      </button>
    </header>

    <p v-if="flashMessage" class="notice success" role="status">{{ flashMessage }}</p>
    <p v-if="errorMessage" class="notice error" role="alert">{{ errorMessage }}</p>

    <p v-if="!formOpen && !canAdd && !loading" class="notice">
      You have saved {{ MAX_ADDRESSES }} addresses. Delete one to add a new address.
    </p>

    <!-- Loading skeletons -->
    <ul v-if="loading" class="address-list" aria-busy="true" aria-label="Loading your addresses">
      <li v-for="n in 2" :key="n" class="address-card skeleton" aria-hidden="true">
        <span class="bar w-40"></span>
        <span class="bar w-30"></span>
        <span class="bar w-90 tall"></span>
        <span class="bar w-60"></span>
      </li>
    </ul>

    <!-- Empty state -->
    <div v-else-if="!addresses.length && !formOpen" class="empty">
      <span class="empty-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none">
          <path
            d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linejoin="round"
          />
          <circle cx="12" cy="10" r="2.3" stroke="currentColor" stroke-width="1.8" />
        </svg>
      </span>
      <p class="empty-title">No saved addresses yet</p>
      <p class="muted">Add a delivery address so checkout is faster next time.</p>
      <button type="button" class="button primary" @click="openForm()">
        Add your first address
      </button>
    </div>

    <!-- Saved addresses -->
    <ul v-else-if="!formOpen" class="address-list">
      <li
          v-for="address in addresses"
          :key="address.id"
          class="address-card"
          :class="{ 'is-default': address.is_default }"
      >
        <div class="card-top">
          <div class="who">
            <p class="name">{{ address.recipient_name }}</p>
            <p class="muted">{{ address.phone }}</p>
          </div>
          <span v-if="address.is_default" class="badge">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="m5 12.5 4.5 4.5L19 7.5" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            Default
          </span>
        </div>

        <p class="address-text">{{ formatAddress(address) }}</p>
        <p class="type">{{ addressTypeLabel[address.address_type] || 'Shipping address' }}</p>

        <div v-if="confirmingId !== address.id" class="card-actions">
          <button type="button" class="link" @click="openForm(address)">Edit</button>
          <button
              v-if="!address.is_default"
              type="button"
              class="link"
              @click="makeDefault(address)"
          >
            Make default
          </button>
          <button type="button" class="link danger push" @click="confirmingId = address.id">
            Delete
          </button>
        </div>

        <div v-else class="confirm">
          <p>Delete this address?</p>
          <div class="card-actions">
            <button type="button" class="link danger" :disabled="deleting" @click="deleteAddress(address)">
              {{ deleting ? 'Deleting…' : 'Yes, delete' }}
            </button>
            <button type="button" class="link" @click="confirmingId = null">
              Keep it
            </button>
          </div>
        </div>
      </li>
    </ul>

    <!-- Add / edit form -->
    <form v-else class="address-form" novalidate @submit.prevent="saveAddress">
      <div class="form-head">
        <h3>{{ editingId ? 'Edit address' : 'New address' }}</h3>
        <p class="muted">Fields marked * are required.</p>
      </div>

      <fieldset class="group">
        <legend>Contact</legend>
        <div class="grid">
          <div class="field">
            <label for="ab-name">Full name *</label>
            <input id="ab-name" v-model.trim="form.recipient_name" required maxlength="150" autocomplete="name" />
          </div>
          <div class="field">
            <label for="ab-phone">Phone *</label>
            <input id="ab-phone" v-model.trim="form.phone" required type="tel" maxlength="30" autocomplete="tel" />
          </div>
        </div>
      </fieldset>

      <fieldset class="group">
        <legend>Delivery area</legend>

        <div class="grid">
          <div class="field">
            <label for="ab-district">District *</label>

            <SearchableSelect
              id="ab-district"
              :model-value="form.district_id"
              :options="districts"
              :get-value="district => String(district.id)"
              :get-label="district => district.district_name"
              placeholder="Search or select district"
              empty-text="No districts found"
              @update:model-value="form.district_id = $event"
            />
          </div>

          <div class="field">
            <label for="ab-area">Area *</label>

            <SearchableSelect
              id="ab-area"
              :model-value="form.area_id"
              :options="areas"
              :get-value="area => String(area.id)"
              :get-label="area => area.area_name"
              :placeholder="form.district_id ? 'Search or select area' : 'Choose a district first'"
              empty-text="No areas found"
              :disabled="!form.district_id"
              @update:model-value="form.area_id = $event"
            />
          </div>
        </div>
      </fieldset>

      <fieldset class="group">
        <legend>Address</legend>
        <div class="grid">
          <div class="field wide">
            <label for="ab-line1">Address line 1 *</label>
            <input id="ab-line1" v-model.trim="form.address_line_1" required maxlength="255" autocomplete="address-line1" placeholder="House number and street" />
          </div>
          <div class="field wide">
            <label for="ab-line2">Address line 2</label>
            <input id="ab-line2" v-model.trim="form.address_line_2" maxlength="255" autocomplete="address-line2" placeholder="Apartment, floor, landmark (optional)" />
          </div>
          <div class="field">
            <label for="ab-city">City *</label>
            <input id="ab-city" v-model.trim="form.city" required maxlength="100" autocomplete="address-level2" />
          </div>
          <div class="field">
            <label for="ab-postal">Postal code</label>
            <input id="ab-postal" v-model.trim="form.postal_code" maxlength="20" autocomplete="postal-code" />
          </div>
          <div class="field">
            <label for="ab-state">Province</label>
            <input id="ab-state" v-model.trim="form.state" maxlength="100" autocomplete="address-level1" />
          </div>
          <div class="field">
            <label for="ab-country">Country *</label>
            <input id="ab-country" v-model.trim="form.country" required maxlength="100" autocomplete="country-name" />
          </div>
        </div>
      </fieldset>

      <fieldset class="group">
        <legend>Use this address for</legend>
        <div class="choices">
          <label class="choice">
            <input v-model="form.address_type" type="radio" value="shipping" />
            <span>Shipping</span>
          </label>
          <label class="choice">
            <input v-model="form.address_type" type="radio" value="billing" />
            <span>Billing</span>
          </label>
        </div>
      </fieldset>

      <label class="check">
        <input v-model="form.is_default" type="checkbox" />
        <span>
          Make this my default address
          <small class="muted">We will select it automatically at checkout.</small>
        </span>
      </label>

      <div class="form-actions">
        <button type="button" class="button secondary" :disabled="saving" @click="closeForm">
          Cancel
        </button>
        <button type="submit" class="button primary" :disabled="saving">
          {{ saving ? 'Saving…' : editingId ? 'Save changes' : 'Save address' }}
        </button>
      </div>
    </form>
  </div>
</template>

<style scoped>
.address-book {
  color: var(--color-text);
}

/* Header */
.page-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
  margin-bottom: var(--space-6);
}

.page-head h2 {
  margin: 0 0 var(--space-1);
  font-family: var(--font-family-display);
  font-size: var(--font-size-lg, var(--font-size-md));
  font-weight: var(--font-weight-bold);
  line-height: 1.25;
}

.muted {
  margin: 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  line-height: 1.5;
}

/* Buttons */
.button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  height: 44px;
  padding: 0 var(--space-5);
  border-radius: var(--radius-md);
  font: inherit;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
  white-space: nowrap;
  transition:
    background-color var(--transition-fast),
    border-color var(--transition-fast),
    box-shadow var(--transition-fast),
    transform var(--transition-fast);
}

.button svg {
  width: 16px;
  height: 16px;
}

.button.primary {
  border: 1px solid var(--color-primary);
  background: var(--color-primary);
  color: var(--color-on-primary);
  box-shadow: 0 1px 2px rgb(0 0 0 / 12%);
}

.button.primary:hover:not(:disabled) {
  background: var(--color-primary-hover);
  border-color: var(--color-primary-hover);
}

.button.secondary {
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text);
}

.button.secondary:hover:not(:disabled) {
  background: var(--color-surface-muted);
}

.button:active:not(:disabled) {
  transform: translateY(1px);
}

.button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.button:focus-visible,
.link:focus-visible,
.choice:has(input:focus-visible),
.check:has(input:focus-visible) {
  outline: 2px solid var(--color-focus-outline);
  outline-offset: 2px;
}

/* Text buttons */
.link {
  min-height: 36px;
  margin: 0 calc(var(--space-2) * -1);
  padding: 0 var(--space-3);
  border: 0;
  border-radius: var(--radius-sm);
  background: none;
  color: var(--color-primary);
  font: inherit;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
  transition: background-color var(--transition-fast);
}

.link:hover:not(:disabled) {
  background: color-mix(in srgb, var(--color-primary) 8%, transparent);
}

.link.danger {
  color: var(--color-danger);
}

.link.danger:hover:not(:disabled) {
  background: color-mix(in srgb, var(--color-danger) 9%, transparent);
}

.link:disabled {
  opacity: 0.55;
  cursor: wait;
}

/* Notices */
.notice {
  margin: 0 0 var(--space-4);
  padding: var(--space-3) var(--space-4);
  border-left: 3px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface-muted);
  font-size: var(--font-size-sm);
  line-height: 1.5;
}

.notice.success {
  border-left-color: var(--color-success);
  background: var(--color-success-bg);
  color: var(--color-success);
  font-weight: var(--font-weight-medium);
}

.notice.error {
  border-left-color: var(--color-danger);
  background: var(--color-danger-bg);
  color: var(--color-danger);
  font-weight: var(--font-weight-medium);
}

/* Empty state */
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--space-8) var(--space-5);
  border: 1.5px dashed var(--color-border);
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--color-surface-muted) 55%, transparent);
  text-align: center;
}

.empty-icon {
  display: grid;
  place-items: center;
  width: 56px;
  height: 56px;
  margin-bottom: var(--space-4);
  border-radius: 50%;
  background: color-mix(in srgb, var(--color-primary) 10%, transparent);
  color: var(--color-primary);
}

.empty-icon svg {
  width: 28px;
  height: 28px;
}

.empty-title {
  margin: 0 0 var(--space-1);
  font-family: var(--font-family-display);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
}

.empty .button {
  margin-top: var(--space-5);
}

/* Address cards */
.address-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-4);
  margin: 0;
  padding: 0;
  list-style: none;
}

.address-card {
  position: relative;
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding: var(--space-5);
  border: 1px solid var(--color-border-soft);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}

@media (hover: hover) {
  .address-card:not(.skeleton):hover {
    border-color: var(--color-border);
    box-shadow: 0 6px 20px rgb(0 0 0 / 7%);
  }
}

.address-card.is-default {
  border-color: var(--color-primary);
  background: color-mix(in srgb, var(--color-primary) 4%, var(--color-surface));
  box-shadow: 0 0 0 1px var(--color-primary);
}

.card-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
}

.who {
  min-width: 0;
}

.name {
  margin: 0 0 2px;
  font-weight: var(--font-weight-semibold);
  overflow-wrap: anywhere;
}

.badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: var(--radius-pill);
  background: var(--color-primary);
  color: var(--color-on-primary);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  white-space: nowrap;
}

.badge svg {
  width: 12px;
  height: 12px;
}

.address-text {
  margin: var(--space-4) 0 var(--space-3);
  font-size: var(--font-size-sm);
  line-height: var(--line-height-base);
  overflow-wrap: anywhere;
}

.type {
  align-self: flex-start;
  margin: 0;
  padding: 3px 10px;
  border-radius: var(--radius-pill);
  background: var(--color-surface-muted);
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
}

.card-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-4);
  margin-top: auto;
  padding-top: var(--space-3);
  border-top: 1px solid var(--color-border-soft);
}

.card-actions:not(:first-child) {
  margin-top: var(--space-4);
}

.card-actions .push {
  margin-left: auto;
}

.confirm {
  margin-top: auto;
  padding: var(--space-3) var(--space-4);
  margin-inline: calc(var(--space-4) * -1);
  margin-bottom: calc(var(--space-3) * -1);
  border-radius: var(--radius-sm);
  background: var(--color-danger-bg);
}

.confirm p {
  margin: 0 0 var(--space-1);
  color: var(--color-danger);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
}

.confirm .card-actions {
  margin-top: 0;
  padding-top: 0;
  border-top: 0;
}

/* Loading skeleton */
.skeleton {
  gap: var(--space-3);
}

.bar {
  display: block;
  height: 12px;
  border-radius: var(--radius-pill);
  background: linear-gradient(
    90deg,
    var(--color-surface-muted) 25%,
    color-mix(in srgb, var(--color-border) 55%, var(--color-surface-muted)) 50%,
    var(--color-surface-muted) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.4s linear infinite;
}

.bar.tall {
  height: 16px;
  margin-top: var(--space-2);
}

.w-30 { width: 30%; }
.w-40 { width: 40%; }
.w-60 { width: 60%; }
.w-90 { width: 90%; }

@keyframes shimmer {
  from { background-position: 200% 0; }
  to { background-position: -200% 0; }
}

/* Form */
.address-form {
  padding: var(--space-6);
  border: 1px solid var(--color-border-soft);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  box-shadow: 0 4px 18px rgb(0 0 0 / 5%);
}

.form-head {
  margin-bottom: var(--space-6);
  padding-bottom: var(--space-4);
  border-bottom: 1px solid var(--color-border-soft);
}

.form-head h3 {
  margin: 0 0 var(--space-1);
  font-family: var(--font-family-display);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-bold);
}

.group {
  margin: 0 0 var(--space-6);
  padding: 0;
  border: 0;
  min-width: 0;
}

.group legend {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  width: 100%;
  margin-bottom: var(--space-4);
  padding: 0;
  color: var(--color-text);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-bold);
}

.group legend::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--color-border-soft);
}

.grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-4);
}

.field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  min-width: 0;
}

.field.wide {
  grid-column: 1 / -1;
}

.field label {
  color: var(--color-text-label);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
}

.field input {
  box-sizing: border-box;
  width: 100%;
  min-height: 48px;
  height: var(--field-height);
  padding: 0 var(--space-4);
  border: var(--border-width-field) solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-text);
  font: inherit;
  font-size: var(--font-size-sm);
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}

.field input::placeholder {
  color: var(--color-text-muted);
  opacity: 0.8;
}

@media (hover: hover) {
  .field input:hover:not(:focus) {
    border-color: var(--color-text-muted);
  }
}

.field input:focus {
  outline: 2px solid transparent; /* keeps a visible ring in forced-colors mode */
  border-color: var(--color-focus);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--color-focus-outline) 35%, transparent);
}

/* Address type choices */
.choices {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-3);
  max-width: 420px;
}

.choice {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-height: 48px;
  padding: 0 var(--space-4);
  border: var(--border-width-field) solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  cursor: pointer;
  transition: border-color var(--transition-fast), background-color var(--transition-fast);
}

.choice input,
.check input {
  accent-color: var(--color-primary);
}

.choice input {
  width: 18px;
  height: 18px;
  margin: 0;
}

@media (hover: hover) {
  .choice:hover {
    border-color: var(--color-text-muted);
  }
}

.choice:has(input:checked) {
  border-color: var(--color-primary);
  background: color-mix(in srgb, var(--color-primary) 7%, var(--color-surface));
  font-weight: var(--font-weight-semibold);
}

/* Default checkbox */
.check {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-4);
  border: 1px solid var(--color-border-soft);
  border-radius: var(--radius-md);
  background: var(--color-surface-muted);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
}

.check input {
  flex-shrink: 0;
  width: 18px;
  height: 18px;
  margin: 1px 0 0;
}

.check small {
  display: block;
  margin-top: 2px;
  font-weight: var(--font-weight-normal);
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
  margin-top: var(--space-6);
  padding-top: var(--space-5);
  border-top: 1px solid var(--color-border-soft);
}

/* Responsive */
@media (max-width: 760px) {
  .address-list {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 560px) {
  .page-head {
    flex-direction: column;
  }

  .page-head .button {
    width: 100%;
  }

  .grid,
  .choices {
    grid-template-columns: minmax(0, 1fr);
  }

  .address-form {
    padding: var(--space-5);
  }

  .form-actions {
    flex-direction: column-reverse;
  }

  .form-actions .button {
    width: 100%;
  }

  /* 16px stops iOS zooming into the field on focus */
  .field input {
    font-size: 16px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .button,
  .link,
  .address-card,
  .field input,
  .choice {
    transition: none;
  }

  .bar {
    animation: none;
  }
}
</style>