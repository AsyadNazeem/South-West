<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import api from '../../services/api'

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
      ...address,
      district_id: address.district_id ? String(address.district_id) : '',
      area_id: address.area_id ? String(address.area_id) : '',
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
      ...address,
      is_default: true,
    })
    flash('Default address updated.')
    await loadAddresses()
  } catch (error) {
    errorMessage.value = getError(error, 'We could not update your default address.')
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
        Add address
      </button>
    </header>

    <p v-if="flashMessage" class="notice success" role="status">{{ flashMessage }}</p>
    <p v-if="errorMessage" class="notice error" role="alert">{{ errorMessage }}</p>

    <p v-if="!formOpen && !canAdd && !loading" class="notice">
      You have saved {{ MAX_ADDRESSES }} addresses. Delete one to add a new address.
    </p>

    <p v-if="loading" class="muted">Loading your addresses…</p>

    <!-- Empty state -->
    <div v-else-if="!addresses.length && !formOpen" class="empty">
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
          <div>
            <p class="name">{{ address.recipient_name }}</p>
            <p class="muted">{{ address.phone }}</p>
          </div>
          <span v-if="address.is_default" class="badge">Default</span>
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
          <button type="button" class="link danger" @click="confirmingId = address.id">
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
            <select id="ab-district" v-model="form.district_id" required>
              <option value="">Select district</option>
              <option v-for="district in districts" :key="district.id" :value="String(district.id)">
                {{ district.district_name }}
              </option>
            </select>
          </div>
          <div class="field">
            <label for="ab-area">Area *</label>
            <select id="ab-area" v-model="form.area_id" required :disabled="!form.district_id">
              <option value="">{{ form.district_id ? 'Select area' : 'Choose a district first' }}</option>
              <option v-for="area in areas" :key="area.id" :value="String(area.id)">
                {{ area.area_name }}
              </option>
            </select>
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
  margin-bottom: var(--space-5);
}

.page-head h2 {
  margin: 0 0 var(--space-1);
  font-family: var(--font-family-display);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-bold);
}

.muted {
  margin: 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

/* Buttons */
.button {
  height: 40px;
  padding: 0 var(--space-5);
  border-radius: var(--radius-md);
  font: inherit;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
  white-space: nowrap;
}

.button.primary {
  border: 1px solid var(--color-primary);
  background: var(--color-primary);
  color: var(--color-on-primary);
}

.button.primary:hover:not(:disabled) {
  background: var(--color-primary-hover);
}

.button.secondary {
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text);
}

.button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.button:focus-visible,
.link:focus-visible,
.choice input:focus-visible,
.check input:focus-visible {
  outline: 2px solid var(--color-focus-outline);
  outline-offset: 2px;
}

.link {
  padding: 0;
  border: 0;
  background: none;
  color: var(--color-primary);
  font: inherit;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
}

.link.danger {
  color: var(--color-danger);
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
  border-radius: var(--radius-sm);
  background: var(--color-surface-muted);
  font-size: var(--font-size-sm);
}

.notice.success {
  border-left-color: var(--color-success);
  background: var(--color-success-bg);
  color: var(--color-success);
}

.notice.error {
  border-left-color: var(--color-danger);
  background: var(--color-danger-bg);
  color: var(--color-danger);
}

/* Empty state */
.empty {
  padding: var(--space-8) var(--space-5);
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-md);
  text-align: center;
}

.empty-title {
  margin: 0 0 var(--space-1);
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
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding: var(--space-5);
  border: 1px solid var(--color-border-soft);
  border-radius: var(--radius-md);
  background: var(--color-surface);
}

.address-card.is-default {
  border-color: var(--color-accent-deep);
}

.card-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
}

.name {
  margin: 0 0 var(--space-1);
  font-weight: var(--font-weight-semibold);
}

.badge {
  padding: 3px 10px;
  border-radius: var(--radius-pill);
  background: var(--color-primary);
  color: var(--color-on-primary);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  white-space: nowrap;
}

.address-text {
  margin: var(--space-4) 0 var(--space-2);
  font-size: var(--font-size-sm);
  line-height: var(--line-height-base);
  overflow-wrap: anywhere;
}

.type {
  margin: 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
}

.card-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-4);
  margin-top: auto;
  padding-top: var(--space-4);
  border-top: 1px solid var(--color-border-soft);
}

.card-actions:not(:first-child) {
  margin-top: var(--space-4);
}

.confirm {
  margin-top: auto;
  padding-top: var(--space-4);
  border-top: 1px solid var(--color-border-soft);
}

.confirm p {
  margin: 0 0 var(--space-2);
  font-size: var(--font-size-sm);
}

.confirm .card-actions {
  margin-top: 0;
  padding-top: 0;
  border-top: 0;
}

/* Form */
.address-form {
  padding: var(--space-6);
  border: 1px solid var(--color-border-soft);
  border-radius: var(--radius-md);
  background: var(--color-surface);
}

.form-head {
  margin-bottom: var(--space-5);
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
  margin-bottom: var(--space-3);
  padding: 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  text-transform: uppercase;
  letter-spacing: 0.08em;
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
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
}

.field input,
.field select {
  box-sizing: border-box;
  width: 100%;
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
}

.field input:focus,
.field select:focus {
  outline: none;
  border-color: var(--color-focus);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-focus-outline) 40%, transparent);
}

.field select:disabled {
  background: var(--color-surface-muted);
  color: var(--color-text-muted);
  cursor: not-allowed;
}

/* Address type choices */
.choices {
  display: flex;
  gap: var(--space-3);
}

.choice {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  height: var(--field-height);
  padding: 0 var(--space-5);
  border: var(--border-width-field) solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  cursor: pointer;
}

.choice:has(input:checked) {
  border-color: var(--color-primary);
  background: var(--color-surface-muted);
  font-weight: var(--font-weight-semibold);
}

/* Default checkbox */
.check {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  font-size: var(--font-size-sm);
  cursor: pointer;
}

.check input {
  margin-top: 3px;
}

.check small {
  display: block;
  margin-top: 2px;
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

  .grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .address-form {
    padding: var(--space-5);
  }

  .form-actions .button {
    flex: 1;
  }
}
</style>
