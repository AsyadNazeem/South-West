<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '@/api/axios'

const route = useRoute()
const router = useRouter()

const editing = computed(() => Boolean(route.params.id))
const loading = ref(false)
const fetching = ref(false)
const error = ref('')
const success = ref('')

const form = reactive({
  promotion_code: '',
  promotion_name: '',
  description: '',
  promotion_type: 'percentage',
  discount_value: 10,
  minimum_order_amount: '',
  maximum_discount_amount: '',
  usage_limit: '',
  usage_limit_per_customer: 1,
  start_date: '',
  end_date: '',
  status: 'draft',
    eligibility_type: 'all_products',
  selected_item_ids: [],
  selected_category_ids: [],
  selected_brand_ids: [],
  is_active: true
})

const statuses = [
  { label: 'Draft', value: 'draft' },
  { label: 'Scheduled', value: 'scheduled' },
  { label: 'Active', value: 'active' },
  { label: 'Paused', value: 'paused' }
]

const items = ref([])
const categories = ref([])
const brands = ref([])

const eligibilityTypes = [
  { label: 'All products', value: 'all_products' },
  { label: 'Selected products', value: 'selected_products' },
  { label: 'Selected categories', value: 'selected_categories' },
  { label: 'Selected brands', value: 'selected_brands' }
]

async function loadEligibilityOptions() {
  const results = await Promise.allSettled([
    api.get('/items'),
    api.get('/categories'),
    api.get('/brands')
  ])

  if (results[0].status === 'fulfilled') {
    items.value = results[0].value.data.data || []
  }

  if (results[1].status === 'fulfilled') {
    categories.value = results[1].value.data.data || []
  }

  if (results[2].status === 'fulfilled') {
    brands.value = results[2].value.data.data || []
  }

  if (results.some(result => result.status === 'rejected')) {
    error.value = 'Some product, category, or brand options could not be loaded. Check the API endpoints and try again.'
  }
}

function toLocalDateTime(value) {
  if (!value) return ''
  const date = new Date(value)
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 16)
}

function generateCode() {
  const suffix = Math.random().toString(36).slice(2, 7).toUpperCase()
  form.promotion_code = `SW-${suffix}`
}

async function loadPromotion() {
  if (!editing.value) return

  fetching.value = true
  error.value = ''

  try {
    const { data } = await api.get(`/promotions/${route.params.id}`)
    const promotion = data.data

    Object.assign(form, {
      promotion_code: promotion.promotion_code ?? '',
      promotion_name: promotion.promotion_name ?? '',
      description: promotion.description ?? '',
      promotion_type: promotion.promotion_type ?? 'percentage',
      discount_value: promotion.discount_value ?? 10,
      minimum_order_amount: promotion.minimum_order_amount ?? '',
      maximum_discount_amount: promotion.maximum_discount_amount ?? '',
      usage_limit: promotion.usage_limit ?? '',
      usage_limit_per_customer: promotion.usage_limit_per_customer ?? 1,
      start_date: toLocalDateTime(promotion.start_date),
      end_date: toLocalDateTime(promotion.end_date),
      status: promotion.status ?? 'draft',
            eligibility_type: promotion.eligibility_type ?? 'all_products',
      selected_item_ids: (promotion.items ?? []).map(
        entry => String(entry.item_id)
      ),
      selected_category_ids: (promotion.categories ?? []).map(
        entry => String(entry.category_id)
      ),
      selected_brand_ids: (promotion.brands ?? []).map(
        entry => String(entry.brand_id)
      ),
      is_active: Boolean(promotion.is_active)
    })
  } catch (err) {
    error.value =
      err.response?.data?.message || 'Unable to load this promo code.'
  } finally {
    fetching.value = false
  }
}

function validateForm() {
  if (!form.promotion_code.trim()) return 'Enter a promo code.'
  if (!form.promotion_name.trim()) return 'Enter a promo name.'

  if (!['percentage', 'fixed_amount'].includes(form.promotion_type)) {
    return 'Select a supported discount type.'
  }

  const value = Number(form.discount_value)

  if (!Number.isFinite(value) || value <= 0) {
    return 'Discount value must be greater than zero.'
  }

  if (form.promotion_type === 'percentage' && value > 100) {
    return 'Percentage discount cannot exceed 100%.'
  }

  if (
    form.minimum_order_amount !== '' &&
    Number(form.minimum_order_amount) < 0
  ) {
    return 'Minimum order amount cannot be negative.'
  }

  if (
    form.maximum_discount_amount !== '' &&
    Number(form.maximum_discount_amount) <= 0
  ) {
    return 'Maximum discount must be greater than zero.'
  }

  if (form.usage_limit !== '' &&
      (!Number.isInteger(Number(form.usage_limit)) ||
       Number(form.usage_limit) < 1)) {
    return 'Usage limit must be a positive whole number.'
  }

  if (!form.start_date || !form.end_date) {
    return 'Select both start and end dates.'
  }

  if (new Date(form.end_date) <= new Date(form.start_date)) {
    return 'End date must be later than start date.'
  }

    const allowedEligibilityTypes = [
    'all_products',
    'selected_products',
    'selected_categories',
    'selected_brands'
  ]

  if (!allowedEligibilityTypes.includes(form.eligibility_type)) {
    return 'Select a valid promotion eligibility type.'
  }

  if (
    form.eligibility_type === 'selected_products' &&
    !form.selected_item_ids.length
  ) {
    return 'Select at least one product.'
  }

  if (
    form.eligibility_type === 'selected_categories' &&
    !form.selected_category_ids.length
  ) {
    return 'Select at least one category.'
  }

  if (
    form.eligibility_type === 'selected_brands' &&
    !form.selected_brand_ids.length
  ) {
    return 'Select at least one brand.'
  }

  return ''
}

async function submitForm() {
  error.value = ''
  success.value = ''

  const validationMessage = validateForm()
  if (validationMessage) {
    error.value = validationMessage
    return
  }

  const payload = {
    promotion_code: form.promotion_code.trim().toUpperCase(),
    promotion_name: form.promotion_name.trim(),
    description: form.description.trim() || null,
    promotion_type: form.promotion_type,
    discount_value: Number(form.discount_value),
    minimum_order_amount:
      form.minimum_order_amount === ''
        ? null
        : Number(form.minimum_order_amount),
    maximum_discount_amount:
      form.maximum_discount_amount === ''
        ? null
        : Number(form.maximum_discount_amount),
    usage_limit:
      form.usage_limit === '' ? null : Number(form.usage_limit),
    usage_limit_per_customer:
      form.usage_limit_per_customer === ''
        ? null
        : Number(form.usage_limit_per_customer),
    start_date: new Date(form.start_date).toISOString(),
    end_date: new Date(form.end_date).toISOString(),
    status: form.status,
        eligibility_type: form.eligibility_type,
    selected_item_ids:
      form.eligibility_type === 'selected_products'
        ? form.selected_item_ids.map(Number)
        : [],
    selected_category_ids:
      form.eligibility_type === 'selected_categories'
        ? form.selected_category_ids.map(Number)
        : [],
    selected_brand_ids:
      form.eligibility_type === 'selected_brands'
        ? form.selected_brand_ids.map(Number)
        : [],
    is_active: form.is_active
  }

  loading.value = true

  try {
    if (editing.value) {
      await api.put(`/promotions/${route.params.id}`, payload)
      success.value = 'Promo code updated successfully.'
    } else {
      await api.post('/promotions', payload)
      success.value = 'Promo code created successfully.'
    }

    router.push('/admin/marketing/promotions')
  } catch (err) {
    error.value =
      err.response?.data?.message ||
      err.response?.data?.errors?.join(', ') ||
      'Unable to save the promo code.'
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await loadEligibilityOptions()
  await loadPromotion()
})
</script>

<template>
  <div class="promo-page">
    <div class="page-header">
      <div>
        <p class="eyebrow">MARKETING / PROMOTIONS</p>
        <h1>{{ editing ? 'Edit promo code' : 'Create promo code' }}</h1>
        <p class="subtitle">
          Configure a discount code customers can use at checkout.
        </p>
      </div>

      <button class="btn btn-secondary" @click="router.push('/admin/marketing/promotions')">
        Back to promotions
      </button>
    </div>

    <div v-if="error" class="alert alert-error">{{ error }}</div>
    <div v-if="success" class="alert alert-success">{{ success }}</div>

    <div v-if="fetching" class="loading">Loading promo code…</div>

    <form v-else class="promo-form" @submit.prevent="submitForm">
      <section class="panel">
        <div class="panel-heading">
          <div>
            <h2>Basic information</h2>
            <p>Set the code customers will enter at checkout.</p>
          </div>
        </div>

        <div class="form-grid">
          <div class="field">
            <label for="promotion_name">Promotion name *</label>
            <input
              id="promotion_name"
              v-model="form.promotion_name"
              maxlength="150"
              placeholder="e.g. New Customer Offer"
              required
            />
          </div>

          <div class="field">
            <label for="promotion_code">Promo code *</label>
            <div class="input-action">
              <input
                id="promotion_code"
                v-model="form.promotion_code"
                maxlength="100"
                placeholder="e.g. WELCOME10"
                required
                @input="form.promotion_code = form.promotion_code.toUpperCase()"
              />
              <button type="button" class="btn btn-secondary" @click="generateCode">
                Generate
              </button>
            </div>
            <small>Codes are converted to uppercase.</small>
          </div>

          <div class="field field-full">
            <label for="description">Description</label>
            <textarea
              id="description"
              v-model="form.description"
              rows="3"
              placeholder="Describe this promotion for your team."
            />
          </div>
        </div>
      </section>

      <section class="panel">
        <div class="panel-heading">
          <div>
            <h2>Discount configuration</h2>
            <p>Choose how the discount is calculated.</p>
          </div>
        </div>

        <div class="form-grid">
          <div class="field">
            <label for="promotion_type">Discount type *</label>
            <select id="promotion_type" v-model="form.promotion_type">
              <option value="percentage">Percentage (%)</option>
              <option value="fixed_amount">Fixed amount (LKR)</option>
            </select>
          </div>

          <div class="field">
            <label for="discount_value">
              {{ form.promotion_type === 'percentage'
                ? 'Discount percentage *'
                : 'Discount amount (LKR) *' }}
            </label>
            <input
              id="discount_value"
              v-model.number="form.discount_value"
              type="number"
              min="0.01"
              :max="form.promotion_type === 'percentage' ? 100 : undefined"
              step="0.01"
              required
            />
          </div>

          <div class="field">
            <label for="minimum_order_amount">Minimum order amount (LKR)</label>
            <input
              id="minimum_order_amount"
              v-model="form.minimum_order_amount"
              type="number"
              min="0"
              step="0.01"
              placeholder="No minimum"
            />
          </div>

          <div class="field">
            <label for="maximum_discount_amount">Maximum discount (LKR)</label>
            <input
              id="maximum_discount_amount"
              v-model="form.maximum_discount_amount"
              type="number"
              min="0.01"
              step="0.01"
              placeholder="No cap"
            />
            <small>Useful for limiting percentage discounts.</small>
          </div>
        </div>
      </section>


      <section class="panel">
        <div class="panel-heading">
          <div>
            <h2>Promotion eligibility</h2>
            <p>Choose which products this promo code can discount.</p>
          </div>
        </div>

        <div class="form-grid">
          <div class="field field-full">
            <label for="eligibility_type">Apply promotion to *</label>
            <select
              id="eligibility_type"
              v-model="form.eligibility_type"
              required
            >
              <option
                v-for="type in eligibilityTypes"
                :key="type.value"
                :value="type.value"
              >
                {{ type.label }}
              </option>
            </select>
          </div>

          <div
            v-if="form.eligibility_type === 'selected_products'"
            class="field field-full"
          >
            <label for="selected_item_ids">Select products *</label>
            <select
              id="selected_item_ids"
              v-model="form.selected_item_ids"
              multiple
              size="7"
              required
            >
              <option
                v-for="item in items"
                :key="item.id"
                :value="String(item.id)"
              >
                {{ item.item_name || item.name || `Product #${item.id}` }}
              </option>
            </select>
            <small>Hold Command on Mac or Ctrl on Windows to select multiple products.</small>
          </div>

          <div
            v-if="form.eligibility_type === 'selected_categories'"
            class="field field-full"
          >
            <label for="selected_category_ids">Select categories *</label>
            <select
              id="selected_category_ids"
              v-model="form.selected_category_ids"
              multiple
              size="7"
              required
            >
              <option
                v-for="category in categories"
                :key="category.id"
                :value="String(category.id)"
              >
                {{ category.name || category.category_name || `Category #${category.id}` }}
              </option>
            </select>
            <small>All products belonging to the selected categories are eligible.</small>
          </div>

          <div
            v-if="form.eligibility_type === 'selected_brands'"
            class="field field-full"
          >
            <label for="selected_brand_ids">Select brands *</label>
            <select
              id="selected_brand_ids"
              v-model="form.selected_brand_ids"
              multiple
              size="7"
              required
            >
              <option
                v-for="brand in brands"
                :key="brand.id"
                :value="String(brand.id)"
              >
                {{ brand.name || brand.brand_name || `Brand #${brand.id}` }}
              </option>
            </select>
            <small>All products belonging to the selected brands are eligible.</small>
          </div>
        </div>
      </section>


      <section class="panel">
        <div class="panel-heading">
          <div>
            <h2>Usage limits</h2>
            <p>Control how often this promo code can be redeemed.</p>
          </div>
        </div>

        <div class="form-grid">
          <div class="field">
            <label for="usage_limit">Total usage limit</label>
            <input
              id="usage_limit"
              v-model="form.usage_limit"
              type="number"
              min="1"
              step="1"
              placeholder="Unlimited"
            />
          </div>

          <div class="field">
            <label for="usage_limit_per_customer">Usage limit per customer</label>
            <input
              id="usage_limit_per_customer"
              v-model="form.usage_limit_per_customer"
              type="number"
              min="1"
              step="1"
              placeholder="1"
            />
            <small>Your checkout currently enforces one redemption per account.</small>
          </div>
        </div>
      </section>

      <section class="panel">
        <div class="panel-heading">
          <div>
            <h2>Schedule and status</h2>
            <p>Choose when the promo code is valid.</p>
          </div>
        </div>

        <div class="form-grid">
          <div class="field">
            <label for="start_date">Start date and time *</label>
            <input
              id="start_date"
              v-model="form.start_date"
              type="datetime-local"
              required
            />
          </div>

          <div class="field">
            <label for="end_date">End date and time *</label>
            <input
              id="end_date"
              v-model="form.end_date"
              type="datetime-local"
              :min="form.start_date || undefined"
              required
            />
          </div>

          <div class="field">
            <label for="status">Status *</label>
            <select id="status" v-model="form.status">
              <option
                v-for="status in statuses"
                :key="status.value"
                :value="status.value"
              >
                {{ status.label }}
              </option>
            </select>
          </div>

          <div class="field field-toggle">
            <label for="is_active">Enabled</label>
            <label class="switch-row">
              <input id="is_active" v-model="form.is_active" type="checkbox" />
              <span>{{ form.is_active ? 'Enabled' : 'Disabled' }}</span>
            </label>
          </div>
        </div>
      </section>

      <div class="form-footer">
        <button
          type="button"
          class="btn btn-secondary"
          @click="router.push('/admin/marketing/promotions')"
        >
          Cancel
        </button>

        <button class="btn btn-primary" type="submit" :disabled="loading">
          {{ loading ? 'Saving…' : editing ? 'Save changes' : 'Create promo code' }}
        </button>
      </div>
    </form>
  </div>
</template>

<style scoped>
.promo-page {
  max-width: 1100px;
  margin: 0 auto;
  padding: 28px;
  color: var(--text-primary, #172033);
}
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 20px;
  margin-bottom: 26px;
}
.eyebrow {
  color: #64748b;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 1.2px;
  margin: 0 0 8px;
}
h1 {
  font-size: 28px;
  margin: 0;
  font-weight: 750;
}
.subtitle, .panel-heading p {
  color: #64748b;
  margin: 8px 0 0;
  font-size: 14px;
}
.panel {
  background: var(--surface, #fff);
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 18px;
}
.panel-heading {
  margin-bottom: 22px;
}
.panel-heading h2 {
  font-size: 17px;
  margin: 0;
}
.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 22px 20px;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}
.field-full {
  grid-column: 1 / -1;
}
.field > label {
  font-size: 13px;
  font-weight: 650;
}
input:not([type="checkbox"]), select, textarea {
  width: 100%;
  box-sizing: border-box;
  padding: 11px 12px;
  border: 1px solid #cbd5e1;
  border-radius: 7px;
  background: var(--input-background, #fff);
  color: inherit;
  font: inherit;
  font-size: 14px;
}
input:focus, select:focus, textarea:focus {
  outline: 2px solid #93c5fd;
  border-color: #3b82f6;
}
small {
  font-size: 12px;
  color: #64748b;
}
.input-action {
  display: flex;
  gap: 8px;
}
.input-action input {
  min-width: 0;
  flex: 1;
}
.btn {
  border: 0;
  border-radius: 7px;
  padding: 11px 16px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 650;
  white-space: nowrap;
}
.btn:disabled {
  opacity: .6;
  cursor: not-allowed;
}
.btn-primary {
  background: #172033;
  color: white;
}
.btn-secondary {
  background: #f1f5f9;
  color: #334155;
}
.field-toggle {
  justify-content: flex-start;
}
.switch-row {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 42px;
  font-size: 14px;
}
.switch-row input {
  width: 17px;
  height: 17px;
}
.form-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 8px 0 28px;
}
.alert {
  border-radius: 8px;
  padding: 13px 15px;
  margin-bottom: 18px;
  font-size: 14px;
}
.alert-error {
  background: #fef2f2;
  color: #b91c1c;
}
.alert-success {
  background: #f0fdf4;
  color: #166534;
}
.loading {
  padding: 40px;
  text-align: center;
  color: #64748b;
}
@media (max-width: 700px) {
  .promo-page { padding: 16px; }
  .page-header { flex-direction: column; }
  .form-grid { grid-template-columns: 1fr; }
  .field-full { grid-column: auto; }
  .panel { padding: 18px; }
}
</style>