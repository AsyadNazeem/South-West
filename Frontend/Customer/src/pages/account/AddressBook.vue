<script setup>
import AccountConfirmDialog from '@/components/account/AccountConfirmDialog.vue'
import AccountPageHeader from '@/components/account/AccountPageHeader.vue'
import { accountFeedback } from '@/utils/accountFeedback'
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
  return accountFeedback(error, fallback)
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
    confirmingId.value = null
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
    <AccountPageHeader title="Saved addresses" :description="`Save up to ${MAX_ADDRESSES} delivery addresses for checkout.`">
      <button v-if="!formOpen" type="button" class="btn primary" :disabled="!canAdd" @click="openForm()">
        + Add address
      </button>
    </AccountPageHeader>

    <p v-if="flashMessage" class="notice success" role="status">{{ flashMessage }}</p>
    <p v-if="errorMessage" class="notice error" role="alert">{{ errorMessage }}</p>
    <p v-if="!formOpen && !canAdd && !loading" class="notice">
      You have saved {{ MAX_ADDRESSES }} addresses. Delete one to add a new address.
    </p>

    <!-- Loading -->
    <ul v-if="loading" class="address-list" aria-busy="true" aria-label="Loading your addresses">
      <li v-for="n in 2" :key="n" class="card" aria-hidden="true">
        <div class="col"><span class="bar w-40"></span><span class="bar w-30"></span><span class="bar w-90"></span></div>
        <div class="col side"><span class="bar w-60"></span></div>
      </li>
    </ul>

    <!-- Empty -->
    <div v-else-if="!addresses.length && !formOpen" class="state">
      <h3>No saved addresses yet</h3>
      <p class="muted">Add a delivery address so checkout is faster next time.</p>
      <button type="button" class="btn primary" @click="openForm()">Add your first address</button>
    </div>

    <!-- Addresses -->
    <ul v-else-if="!formOpen" class="address-list">
      <li v-for="address in addresses" :key="address.id" class="card" :class="{ 'is-default': address.is_default }">

        <div class="col">
          <div class="who">
            <p class="name">{{ address.recipient_name }}</p>
            <p class="muted">{{ address.phone }}</p>
          </div>
          <p class="address-text">{{ formatAddress(address) }}</p>
        </div>

        <div class="col side">
          <div class="meta">
            <span v-if="address.is_default" class="status">Default</span>
            <span class="muted">{{ addressTypeLabel[address.address_type] || 'Shipping address' }}</span>
          </div>

          <div class="actions">
            <button type="button" class="link" @click="openForm(address)">Edit</button>
            <button v-if="!address.is_default" type="button" class="link" @click="makeDefault(address)">Make default</button>
            <button type="button" class="link danger" @click="confirmingId = address.id">Delete</button>
          </div>
        </div>

        <AccountConfirmDialog v-if="confirmingId === address.id" title="Delete this address?" :description="formatAddress(address)"
          confirm-label="Yes, delete" :busy="deleting" @cancel="confirmingId = null" @confirm="deleteAddress(address)" />
      </li>
    </ul>

    <!-- Add / edit form -->
    <form v-else class="address-form" @submit.prevent="saveAddress">
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
          <label class="choice"><input v-model="form.address_type" type="radio" value="shipping" /><span>Shipping</span></label>
          <label class="choice"><input v-model="form.address_type" type="radio" value="billing" /><span>Billing</span></label>
        </div>
      </fieldset>

      <label class="check">
        <input v-model="form.is_default" type="checkbox" />
        <span>Make this my default address<small class="muted">We will select it automatically at checkout.</small></span>
      </label>

      <div class="form-actions">
        <button type="button" class="btn" :disabled="saving" @click="closeForm">Cancel</button>
        <button type="submit" class="btn primary" :disabled="saving">
          {{ saving ? 'Saving…' : editingId ? 'Save changes' : 'Save address' }}
        </button>
      </div>
    </form>
  </div>
</template>

<style scoped>
.address-book { min-width: 0; color: var(--color-text); }
.muted { margin: 0; color: var(--color-text-muted); font-size: 12px; line-height: 1.5; }
button:disabled { cursor: not-allowed; opacity: .55; }

/* Buttons */
.btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 36px; padding: 0 14px; background: var(--color-surface); color: var(--color-text); border: 1px solid var(--color-border); border-radius: var(--radius-md); font: 600 13px/1 var(--font-family-base); white-space: nowrap; cursor: pointer; transition: border-color .15s ease, color .15s ease; }
.btn:hover:not(:disabled) { border-color: var(--color-primary); color: var(--color-primary); }
.btn.primary { background: var(--color-primary); border-color: var(--color-primary); color: var(--color-on-primary); }
.btn.primary:hover:not(:disabled) { background: var(--color-primary-hover); border-color: var(--color-primary-hover); color: var(--color-on-primary); }
.link { padding: 4px 0; background: none; border: 0; color: var(--color-primary); font: 600 13px/1.4 var(--font-family-base); white-space: nowrap; cursor: pointer; }
.link:hover:not(:disabled) { text-decoration: underline; }
.link.danger { color: #b42318; }
.btn:focus-visible, .link:focus-visible, .choice:has(input:focus-visible), .check:has(input:focus-visible) { outline: 2px solid var(--color-focus-outline); outline-offset: 2px; }

/* Notices */
.notice { margin: 0 0 14px; padding: 10px 14px; background: var(--color-surface-muted); color: var(--color-text); border: 1px solid var(--color-border-soft); border-radius: var(--radius-md); font-size: 13px; line-height: 1.5; }
.notice.success { background: #ecfdf3; color: #166534; border-color: #bbf7d0; }
.notice.error { background: #fef2f2; color: #b42318; border-color: #fecaca; }

/* Empty state */
.state { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 48px 20px; text-align: center; background: var(--color-surface); border: 1px solid var(--color-border-soft); border-radius: var(--radius-lg); }
.state h3 { margin: 0; font-family: var(--font-family-display); font-size: 16px; }
.state .muted { margin-bottom: 10px; font-size: 13px; }

/* Address cards: two halves */
.address-list { display: grid; gap: 12px; margin: 0; padding: 0; list-style: none; }
.card { position: relative; display: grid; grid-template-columns: minmax(0, 1fr) 220px; min-width: 0; overflow: hidden; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-lg); box-shadow: var(--shadow-sm); }
.card.is-default::before { content: ''; position: absolute; top: 0; bottom: 0; left: 0; width: 3px; background: var(--color-primary); }
.col { display: flex; flex-direction: column; gap: 10px; min-width: 0; padding: 16px 18px; }
.side { justify-content: space-between; background: color-mix(in srgb, var(--color-primary) 5%, var(--color-surface)); border-left: 1px solid var(--color-border); }

.name { margin: 0 0 2px; font-size: 14px; font-weight: 700; overflow-wrap: anywhere; }
.address-text { margin: 0; font-size: 13px; line-height: 1.55; overflow-wrap: anywhere; }

.meta { display: grid; gap: 4px; }
.status { display: inline-flex; align-items: center; gap: 6px; color: var(--color-primary); font-size: 12px; font-weight: 600; }
.status::before { content: ''; width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
.actions { display: flex; flex-wrap: wrap; gap: 2px 16px; }

/* Loading */
.bar { display: block; height: 11px; background: var(--color-border); border-radius: 4px; animation: pulse 1.4s ease-in-out infinite; }
.w-30 { width: 30%; } .w-40 { width: 40%; } .w-60 { width: 60%; } .w-90 { width: 90%; }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: .5; } }

/* Form */
.address-form { padding: 22px; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-lg); box-shadow: var(--shadow-sm); }
.form-head { margin-bottom: 20px; padding-bottom: 14px; border-bottom: 1px solid var(--color-border-soft); }
.form-head h3 { margin: 0 0 2px; font-family: var(--font-family-display); font-size: 16px; font-weight: 700; }

.group { min-width: 0; margin: 0 0 22px; padding: 0; border: 0; }
.group legend { margin-bottom: 12px; padding: 0; color: var(--color-text-muted); font-size: 12px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; }
.grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
.field { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.field.wide { grid-column: 1 / -1; }
.field label { color: var(--color-text-label); font-size: 12px; font-weight: 600; }
.field input { box-sizing: border-box; width: 100%; height: 40px; padding: 0 12px; background: var(--color-surface); color: var(--color-text); border: 1px solid var(--color-border); border-radius: var(--radius-md); font: 400 14px var(--font-family-base); transition: border-color .15s ease, box-shadow .15s ease; }
.field input::placeholder { color: var(--color-text-muted); }
.field input:focus { outline: none; border-color: var(--color-focus); box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-focus) 16%, transparent); }

/* Shipping / billing */
.choices { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; max-width: 360px; }
.choice { display: flex; align-items: center; gap: 10px; min-height: 40px; padding: 0 14px; border: 1px solid var(--color-border); border-radius: var(--radius-md); font-size: 13px; cursor: pointer; transition: border-color .15s ease, background .15s ease; }
.choice input, .check input { margin: 0; accent-color: var(--color-primary); }
.choice:has(input:checked) { border-color: var(--color-primary); background: color-mix(in srgb, var(--color-primary) 6%, var(--color-surface)); font-weight: 600; }

/* Default checkbox */
.check { display: flex; align-items: flex-start; gap: 10px; font-size: 13px; font-weight: 500; cursor: pointer; }
.check input { flex-shrink: 0; width: 16px; height: 16px; margin-top: 2px; }
.check small { display: block; margin-top: 2px; font-weight: 400; }

.form-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 22px; padding-top: 16px; border-top: 1px solid var(--color-border-soft); }
.form-actions .btn { min-height: 40px; padding: 0 18px; }

@media (max-width: 760px) {
  .card { grid-template-columns: minmax(0, 1fr); }
  .side { gap: 12px; border-left: 0; border-top: 1px solid var(--color-border); }
  .col { padding: 14px; }
}

@media (max-width: 560px) {
  .address-form { padding: 16px; }
  .grid, .choices { grid-template-columns: minmax(0, 1fr); max-width: none; }
  .form-actions { flex-direction: column-reverse; }
  .form-actions .btn { width: 100%; }
  .field input { font-size: 16px; }
}

@media (prefers-reduced-motion: reduce) { .bar { animation: none; } }
</style>