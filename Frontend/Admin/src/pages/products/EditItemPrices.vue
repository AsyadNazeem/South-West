<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '../../api/axios'

const route = useRoute()
const router = useRouter()

const itemId = Number(route.params.itemId)
const loading = ref(true)
const saving = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const item = ref(null)
const rows = ref([])

const methods = [
  { key: 'cash', label: 'COD' },
  { key: 'card', label: 'Card' },
  { key: 'koko', label: 'KOKO' },
  { key: 'mintpay', label: 'Mintpay' }
]

const itemName = computed(() => item.value?.item_name || 'Item')

const validPrice = value =>
  value !== '' &&
  value !== null &&
  value !== undefined &&
  /^\d{1,13}(?:\.\d{1,2})?$/.test(String(value)) &&
  Number.isFinite(Number(value)) &&
  Number(value) >= 0

async function loadPaymentPrices(row) {
  if (row.price_type !== 'selling' || !row.variant_id) return

  const response = await api.get('/item-payment-prices', {
    params: {
      item_id: itemId,
      variant_id: row.variant_id
    }
  })

  for (const payment of response.data.data || []) {
    if (Object.prototype.hasOwnProperty.call(row.payment_prices, payment.payment_method)) {
      row.payment_prices[payment.payment_method] = String(payment.price)
      row.payment_active[payment.payment_method] = Boolean(payment.is_active)
    }
  }
}

async function loadPrices() {
  loading.value = true
  errorMessage.value = ''

  try {
    if (!Number.isInteger(itemId) || itemId <= 0) {
      throw new Error('Invalid item ID.')
    }

    const response = await api.get('/item-prices')
    const allPrices = response.data.data || []

    const itemPrices = allPrices.filter(
      price => Number(price.item_id ?? price.item?.id) === itemId
    )

    if (!itemPrices.length) {
      throw new Error('No existing prices were found for this item.')
    }

    item.value = itemPrices[0].item || {
      item_name: 'Item',
      item_code: ''
    }

    rows.value = itemPrices.map(price => ({
      id: price.id,
      variant_id: price.variant_id ?? price.variant?.id ?? null,
      variant_name: price.variant?.variant_name || 'Variant',
      variant_sku: price.variant?.variant_sku || '-',
      price_type: price.price_type || 'selling',
      price: String(price.price ?? ''),
      currency: price.currency || 'LKR',
      effective_from: price.effective_from
        ? String(price.effective_from).slice(0, 10)
        : '',
      effective_to: price.effective_to
        ? String(price.effective_to).slice(0, 10)
        : '',
      is_active: Boolean(price.is_active),
      payment_prices: {
        cash: '',
        card: '',
        koko: '',
        mintpay: ''
      },
      payment_active: {
        cash: true,
        card: true,
        koko: true,
        mintpay: true
      }
    }))

    for (const row of rows.value) {
      await loadPaymentPrices(row)
    }
  } catch (error) {
    console.error('Failed to load item prices:', error)
    errorMessage.value =
      error.response?.data?.message ||
      error.message ||
      'Failed to load item prices.'
  } finally {
    loading.value = false
  }
}

async function saveAll() {
  errorMessage.value = ''
  successMessage.value = ''

  if (!rows.value.length) {
    errorMessage.value = 'There are no prices to update.'
    return
  }

  for (const row of rows.value) {
    if (!validPrice(row.price)) {
      errorMessage.value = `Enter a valid price for ${row.variant_sku}.`
      return
    }

    if (
      row.effective_from &&
      row.effective_to &&
      row.effective_to < row.effective_from
    ) {
      errorMessage.value = `Effective To cannot be before Effective From for ${row.variant_sku}.`
      return
    }

    if (row.price_type === 'selling') {
      const values = Object.values(row.payment_prices)
      const hasAnyPaymentPrice = values.some(value => value !== '')

      if (hasAnyPaymentPrice && !values.every(validPrice)) {
        errorMessage.value =
          `Complete all four checkout prices for ${row.variant_sku}, or leave them all blank.`
        return
      }
    }
  }

  if (!confirm(`Save ${rows.value.length} existing price records for ${itemName.value}?`)) {
    return
  }

  saving.value = true

  try {
    for (const row of rows.value) {
      // Update the existing record only. Never create a new price here.
      await api.put(`/item-prices/${row.id}`, {
        price: Number(row.price),
        currency: row.currency.trim().toUpperCase(),
        price_type: row.price_type,
        effective_from: row.effective_from || null,
        effective_to: row.effective_to || null,
        is_active: row.is_active
      })

      if (
        row.price_type === 'selling' &&
        Object.values(row.payment_prices).some(value => value !== '')
      ) {
        await api.post('/item-payment-prices/bulk', {
          item_id: itemId,
          variant_id: row.variant_id,
          currency: row.currency.trim().toUpperCase(),
          prices: methods.map(method => ({
            payment_method: method.key,
            price: Number(row.payment_prices[method.key]),
            is_active: row.payment_active[method.key]
          }))
        })
      }
    }

    successMessage.value = 'All item prices updated successfully.'
    await new Promise(resolve => setTimeout(resolve, 600))
    await router.push('/admin/products/item-prices')
  } catch (error) {
    console.error('Failed to save item prices:', error)
    errorMessage.value =
      error.response?.data?.message ||
      'A save failed. Reload the page to verify which records were updated.'
    await loadPrices()
  } finally {
    saving.value = false
  }
}

onMounted(loadPrices)
</script>

<template>
  <div class="edit-prices-page">
    <header class="page-header">
      <div>
        <h1>Edit All Prices</h1>
        <p>{{ itemName }} — update each variant independently.</p>
      </div>
      <button type="button" class="secondary-button" :disabled="saving" @click="router.push('/admin/products/item-prices')">
        Cancel
      </button>
    </header>

    <p v-if="errorMessage" class="message error">{{ errorMessage }}</p>
    <p v-if="successMessage" class="message success">{{ successMessage }}</p>
    <p v-if="loading" class="message">Loading existing prices...</p>

    <form v-else @submit.prevent="saveAll">
      <div v-for="row in rows" :key="row.id" class="price-card">
        <div class="variant-heading">
          <div>
            <h2>{{ row.variant_name }}</h2>
            <p>{{ row.variant_sku }} · Price record #{{ row.id }}</p>
          </div>
          <label class="status-field">
            <input v-model="row.is_active" type="checkbox" :disabled="saving">
            Active
          </label>
        </div>

        <div class="fields">
          <label>
            Price Type
            <select v-model="row.price_type" :disabled="saving">
              <option value="selling">Selling</option>
              <option value="retail">Retail</option>
              <option value="wholesale">Wholesale</option>
              <option value="cost">Cost</option>
              <option value="special">Special</option>
            </select>
          </label>

          <label>
            Price
            <input v-model="row.price" type="number" min="0" step="0.01" required :disabled="saving">
          </label>

          <label>
            Currency
            <select v-model="row.currency" :disabled="saving">
              <option value="LKR">LKR</option>
              <option value="USD">USD</option>
              <option value="AED">AED</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
            </select>
          </label>

          <label>
            Effective From
            <input v-model="row.effective_from" type="date" :disabled="saving">
          </label>

          <label>
            Effective To
            <input v-model="row.effective_to" type="date" :disabled="saving">
          </label>
        </div>

        <div v-if="row.price_type === 'selling'" class="checkout-section">
          <h3>Checkout Payment Prices</h3>
          <div class="fields">
            <label v-for="method in methods" :key="method.key">
              {{ method.label }}
              <input
                v-model="row.payment_prices[method.key]"
                type="number"
                min="0"
                step="0.01"
                placeholder="Leave all blank to keep unchanged"
                :disabled="saving"
              >
            </label>
          </div>
          <p class="hint">Checkout prices are specific to this variant. Leave all four blank to keep them unchanged.</p>
        </div>
      </div>

      <footer class="form-actions">
        <button type="button" class="secondary-button" :disabled="saving" @click="router.push('/admin/products/item-prices')">
          Cancel
        </button>
        <button type="submit" class="primary-button" :disabled="saving || !rows.length">
          {{ saving ? 'Saving...' : `Save All (${rows.length})` }}
        </button>
      </footer>
    </form>
  </div>
</template>

<style scoped>
.edit-prices-page { padding: 24px; color: var(--color-text-primary); }
.page-header, .variant-heading, .form-actions { display: flex; justify-content: space-between; align-items: center; gap: 16px; }
.page-header { margin-bottom: 24px; }
.page-header h1 { margin: 0 0 6px; }
.page-header p, .variant-heading p, .hint { color: var(--color-text-secondary); }
.price-card { margin-bottom: 20px; padding: 22px; border: 1px solid var(--color-border-light); border-radius: var(--radius-lg); background: var(--color-surface); }
.variant-heading { margin-bottom: 20px; }
.variant-heading h2 { margin: 0 0 5px; font-size: 18px; }
.variant-heading p { margin: 0; }
.fields { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; }
.fields label { display: flex; flex-direction: column; gap: 7px; font-size: 14px; font-weight: 600; }
.fields input, .fields select { width: 100%; min-width: 0; box-sizing: border-box; height: 40px; padding: 8px 10px; border: 1px solid var(--color-border); border-radius: var(--radius-md); background: var(--color-surface); color: var(--color-text-primary); font: inherit; }
.status-field { display: flex; align-items: center; gap: 8px; white-space: nowrap; }
.checkout-section { margin-top: 24px; padding-top: 18px; border-top: 1px solid var(--color-border-light); }
.checkout-section h3 { margin: 0 0 16px; font-size: 16px; }
.hint { margin-bottom: 0; font-size: 13px; }
.form-actions { justify-content: flex-end; margin: 24px 0; }
.primary-button, .secondary-button { padding: 10px 16px; border-radius: var(--radius-md); cursor: pointer; font: inherit; }
.primary-button { border: 1px solid var(--color-primary); background: var(--color-primary); color: white; }
.secondary-button { border: 1px solid var(--color-border); background: var(--color-surface); color: var(--color-text-primary); }
.message { margin: 16px 0; }
.error { color: #dc2626; }
.success { color: #15803d; }
button:disabled { opacity: .6; cursor: not-allowed; }
@media (max-width: 600px) { .edit-prices-page { padding: 14px; } .page-header { align-items: flex-start; } .price-card { padding: 14px; } }
</style>
