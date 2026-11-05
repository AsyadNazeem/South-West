<script setup>
import { ref, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import Multiselect from 'vue-multiselect'
import 'vue-multiselect/dist/vue-multiselect.css'
import api from '@/api/axios'

const router = useRouter()
const route = useRoute()

const loading = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

const items = ref([])
const itemsLoading = ref(false)
const selectedItem = ref(null)

const variants = ref([])
const variantsLoading = ref(false)
const selectedVariantId = ref('')

// Checkout methods shown in the form, in display order.
const paymentMethodFields = [
  { key: 'cash', label: 'COD' },
  { key: 'card', label: 'Card' },
  { key: 'koko', label: 'KOKO' },
  { key: 'mintpay', label: 'Mintpay' }
]

const createPriceRow = () => ({
  variant_id: '',
  price: '',
  payment_prices: { cash: '', card: '', koko: '', mintpay: '' }
})

const priceRows = ref([createPriceRow()])

const addPriceRow = () => {
  priceRows.value.push(createPriceRow())
}

const removePriceRow = (index) => {
  if (priceRows.value.length > 1) {
    priceRows.value.splice(index, 1)
  }
}
const pricingMode = ref('same')

const isBulkEditMode = ref(false)
const bulkItemId = ref(null)
const bulkItemName = ref('')
const bulkRows = ref([])

const isEditMode = ref(false)
const priceId = ref(null)

const form = ref({
  price_type: '',
  price: '',
  currency: 'LKR',
  effective_from: '',
  effective_to: '',
  is_active: true
})

// Additional prices stored in item_payment_prices.
const paymentPrices = ref({
  cash: '',
  card: '',
  koko: '',
  mintpay: ''
})

const paymentPricesLoading = ref(false)

const isSellingPrice = () => form.value.price_type === 'selling'

const itemLabel = (item) => {
  return `${item.item_code} - ${item.item_name}`
}

const resetPaymentPrices = () => {
  paymentPrices.value = {
    cash: '',
    card: '',
    koko: '',
    mintpay: ''
  }
}

/*
|--------------------------------------------------------------------------
| Load Items
|--------------------------------------------------------------------------
*/

const loadItems = async () => {
  try {
    itemsLoading.value = true

    const response = await api.get('/items')
    items.value = response.data.data || []
  } catch (error) {
    console.error('Failed to load items:', error)

    errorMessage.value =
      error.response?.data?.message ||
      'Failed to load items.'
  } finally {
    itemsLoading.value = false
  }
}

/*
|--------------------------------------------------------------------------
| Load Variants
|--------------------------------------------------------------------------
*/

const loadVariants = async (itemId, preferredVariantId = null) => {
  variants.value = []
  selectedVariantId.value = ''

  if (!itemId) return

  try {
    variantsLoading.value = true

    const response = await api.get(`/items/${itemId}/variants`)
    const data = response.data.data || []

    // Only active variants can be selected.
    variants.value = data.filter(variant => variant.is_active)

    if (
      preferredVariantId &&
      variants.value.some(
        variant => Number(variant.id) === Number(preferredVariantId)
      )
    ) {
      selectedVariantId.value = String(preferredVariantId)
    }
  } catch (error) {
    console.error('Failed to load item variants:', error)

    errorMessage.value =
      error.response?.data?.message ||
      'Failed to load variants for the selected item.'
  } finally {
    variantsLoading.value = false
  }
}

const onItemChange = async (item) => {
  errorMessage.value = ''
  selectedVariantId.value = ''
  priceRows.value = [createPriceRow()]
  variants.value = []
  resetPaymentPrices()

  if (item?.id) {
    await loadVariants(item.id)

    if (isSellingPrice()) {
      await loadPaymentPrices()
    }
  }
}

/*
|--------------------------------------------------------------------------
| Load Checkout Method Prices
|--------------------------------------------------------------------------
*/

const loadPaymentPrices = async () => {
  resetPaymentPrices()

  if (!selectedItem.value?.id || !isSellingPrice()) {
    return
  }

  try {
    paymentPricesLoading.value = true

    const params = {
      item_id: Number(selectedItem.value.id)
    }

    if (selectedVariantId.value) {
      params.variant_id = Number(selectedVariantId.value)
    }

    const response = await api.get('/item-payment-prices', { params })
    const rows = response.data.data || []

    for (const row of rows) {
      if (
        Object.prototype.hasOwnProperty.call(
          paymentPrices.value,
          row.payment_method
        )
      ) {
        paymentPrices.value[row.payment_method] = row.price
      }
    }
  } catch (error) {
    console.error('Failed to load checkout prices:', error)

    errorMessage.value =
      error.response?.data?.message ||
      'Failed to load checkout prices.'
  } finally {
    paymentPricesLoading.value = false
  }
}

/*
|--------------------------------------------------------------------------
| Watch Price Type and Variant
|--------------------------------------------------------------------------
*/

watch(
  () => form.value.price_type,
  async (newType) => {
    if (newType === 'selling') {
      await loadPaymentPrices()
    } else {
      resetPaymentPrices()
    }
  }
)

watch(
  selectedVariantId,
  async () => {
    if (isSellingPrice() && selectedItem.value?.id) {
      await loadPaymentPrices()
    }
  }
)

/*
|--------------------------------------------------------------------------
| Load Existing Item Price
|--------------------------------------------------------------------------
*/

const loadItemPrice = async () => {
  try {
    loading.value = true
    errorMessage.value = ''

    const response = await api.get(`/item-prices/${priceId.value}`)
    const itemPrice = response.data.data

    if (!itemPrice) {
      errorMessage.value = 'Item price not found.'
      return
    }

    selectedItem.value =
      items.value.find(
        item => Number(item.id) === Number(itemPrice.item_id)
      ) || null

    form.value = {
      price_type: itemPrice.price_type || '',
      price: itemPrice.price ?? '',
      currency: itemPrice.currency || 'LKR',
      effective_from: itemPrice.effective_from
        ? String(itemPrice.effective_from).substring(0, 10)
        : '',
      effective_to: itemPrice.effective_to
        ? String(itemPrice.effective_to).substring(0, 10)
        : '',
      is_active: Boolean(itemPrice.is_active)
    }

    if (selectedItem.value) {
      await loadVariants(
        selectedItem.value.id,
        itemPrice.variant_id ?? itemPrice.variant?.id ?? null
      )

      if (isSellingPrice()) {
        await loadPaymentPrices()
      }
    }
  } catch (error) {
    console.error('Failed to load item price:', error)

    errorMessage.value =
      error.response?.data?.message ||
      error.message ||
      'Failed to load item price.'
  } finally {
    loading.value = false
  }
}

/*
|--------------------------------------------------------------------------
| Validate Checkout Prices
|--------------------------------------------------------------------------
*/

const validatePaymentPrices = (prices = paymentPrices.value) => {
  const methods = {
    cash: 'COD',
    card: 'Card',
    koko: 'KOKO',
    mintpay: 'Mintpay'
  }

  for (const [method, label] of Object.entries(methods)) {
    const value = prices[method]

    if (
      value === '' ||
      value === null ||
      value === undefined ||
      !/^\d{1,13}(?:\.\d{1,2})?$/.test(String(value)) ||
      !Number.isFinite(Number(value)) ||
      Number(value) < 0
    ) {
      errorMessage.value = `Please enter a valid ${label} price.`
      return false
    }
  }

  return true
}

/*
|--------------------------------------------------------------------------
| Save Checkout Prices
|--------------------------------------------------------------------------
*/


async function savePaymentPrices(variantId, prices = paymentPrices.value) {
  const itemId = Number(selectedItem.value?.id)

  if (!Number.isInteger(itemId) || itemId <= 0) {
    throw new Error('Please select a valid item.')
  }

  const payload = {
    item_id: itemId,
    variant_id: Number(variantId),
    currency: form.value.currency || 'LKR',
    prices: [
      { payment_method: 'cash', price: Number(prices.cash) },
      { payment_method: 'card', price: Number(prices.card) },
      { payment_method: 'koko', price: Number(prices.koko) },
      { payment_method: 'mintpay', price: Number(prices.mintpay) }
    ]
  }

  await api.post('/item-payment-prices/bulk', payload)
}

/*
|--------------------------------------------------------------------------
| Submit Form
|--------------------------------------------------------------------------
*/



const loadBulkItemPrices = async () => {
  try {
    loading.value = true
    errorMessage.value = ''

    bulkItemId.value = Number(route.params.itemId)
    if (!Number.isInteger(bulkItemId.value) || bulkItemId.value <= 0) {
      throw new Error('Invalid item ID.')
    }

    selectedItem.value = items.value.find(
      item => Number(item.id) === bulkItemId.value
    ) || null

    if (!selectedItem.value) throw new Error('Item not found.')

    bulkItemName.value =
      selectedItem.value.item_name ||
      selectedItem.value.item_code ||
      `Item ${bulkItemId.value}`

    const [pricesResponse, variantsResponse] = await Promise.all([
      api.get('/item-prices'),
      api.get(`/items/${bulkItemId.value}/variants`)
    ])

    const allPrices = pricesResponse.data?.data || []
    const allVariants = variantsResponse.data?.data || []

// Include inactive variants too, so existing price records
// can still display their currently assigned variant.
variants.value = allVariants

    const existingPrices = allPrices.filter(
      price => Number(price.item_id) === bulkItemId.value
    )

    if (!existingPrices.length) {
      throw new Error('No existing prices were found for this item.')
    }

    bulkRows.value = await Promise.all(existingPrices.map(async price => {
      const variantId = Number(price.variant_id ?? price.variant?.id)
      const variant = allVariants.find(
        entry => Number(entry.id) === variantId
      )

      const row = {
        id: price.id,
        variant_id: variantId,
        variant_label:
          variant?.variant_name ||
          variant?.name ||
          price.variant?.variant_name ||
          price.variant?.name ||
          `Variant #${variantId}`,
        price_type: price.price_type || '',
        price: price.price ?? '',
        currency: price.currency || 'LKR',
        effective_from: price.effective_from
          ? String(price.effective_from).substring(0, 10) : '',
        effective_to: price.effective_to
          ? String(price.effective_to).substring(0, 10) : '',
        is_active: Boolean(price.is_active),
        payment_prices: { cash: '', card: '', koko: '', mintpay: '' }
      }

      if (row.price_type === 'selling' && variantId > 0) {
        const response = await api.get('/item-payment-prices', {
          params: { item_id: bulkItemId.value, variant_id: variantId }
        })

        for (const payment of response.data?.data || []) {
          if (Object.prototype.hasOwnProperty.call(
            row.payment_prices, payment.payment_method
          )) {
            row.payment_prices[payment.payment_method] = payment.price ?? ''
          }
        }
      }

      return row
    }))
  } catch (error) {
    console.error('Failed to load item prices for bulk editing:', error)
    errorMessage.value =
      error.response?.data?.message || error.message ||
      'Failed to load item prices.'
  } finally {
    loading.value = false
  }
}

const saveBulkItemPrices = async () => {
  if (loading.value) return

  errorMessage.value = ''
  successMessage.value = ''

  const validPrice = value =>
    value !== '' && value !== null && value !== undefined &&
    /^\d{1,13}(?:\.\d{1,2})?$/.test(String(value)) &&
    Number.isFinite(Number(value)) && Number(value) >= 0

  if (!bulkRows.value.length) {
    errorMessage.value = 'There are no prices to update.'
    return
  }

  // Validate every row before sending any updates.
  for (let i = 0; i < bulkRows.value.length; i++) {
    const row = bulkRows.value[i]

    if (!row.id || !row.variant_id || !row.price_type || !validPrice(row.price)) {
      errorMessage.value = `Please check the price, type and variant in row ${i + 1}.`
      return
    }

    if (row.effective_from && row.effective_to &&
        row.effective_to < row.effective_from) {
      errorMessage.value = `Row ${i + 1}: Effective To cannot be before Effective From.`
      return
    }

    if (row.price_type === 'selling') {
      for (const method of paymentMethodFields) {
        if (!validPrice(row.payment_prices[method.key])) {
          errorMessage.value =
            `Row ${i + 1}: enter a valid ${method.label} checkout price.`
          return
        }
      }
    }
  }

  loading.value = true

  try {
    for (const row of bulkRows.value) {
      await api.put(`/item-prices/${row.id}`, {
        item_id: bulkItemId.value,
        variant_id: Number(row.variant_id),
        price_type: row.price_type,
        price: Number(row.price),
        currency: row.currency || 'LKR',
        effective_from: row.effective_from || null,
        effective_to: row.effective_to || null,
        is_active: Boolean(row.is_active)
      })

      if (row.price_type === 'selling') {
        await api.post('/item-payment-prices/bulk', {
          item_id: bulkItemId.value,
          variant_id: Number(row.variant_id),
          currency: row.currency || 'LKR',
          prices: paymentMethodFields.map(method => ({
            payment_method: method.key,
            price: Number(row.payment_prices[method.key])
          }))
        })
      }
    }

    successMessage.value = `Updated ${bulkRows.value.length} existing price record(s).`
    await new Promise(resolve => setTimeout(resolve, 700))
    await router.push('/admin/products/item-prices')
  } catch (error) {
    console.error('Failed to save all item prices:', error)
    errorMessage.value =
      error.response?.data?.message || error.message ||
      'Failed to save all item prices. Some earlier rows may already have been saved.'
  } finally {
    loading.value = false
  }
}

const submitForm = async () => {
  if (loading.value) return

  errorMessage.value = ''
  successMessage.value = ''

  if (!selectedItem.value) {
    errorMessage.value = 'Please select an item.'
    return
  }

  if (!form.value.price_type) {
    errorMessage.value = 'Please select a price type.'
    return
  }

  if (!variants.value.length) {
    errorMessage.value = 'This item has no active variants.'
    return
  }

  if (isEditMode.value && !selectedVariantId.value) {
    errorMessage.value = 'Please select a variant.'
    return
  }

  if (!isEditMode.value && pricingMode.value === 'different') {
    if (!priceRows.value.length) {
      errorMessage.value = 'Add at least one variant price.'
      return
    }

    const chosenVariantIds = priceRows.value.map(row => String(row.variant_id))
    if (chosenVariantIds.some(id => !id)) {
      errorMessage.value = 'Please select a variant for every price row.'
      return
    }

    if (new Set(chosenVariantIds).size !== chosenVariantIds.length) {
      errorMessage.value = 'Each variant can only be selected once.'
      return
    }

    for (const row of priceRows.value) {
      if (
        row.price === '' ||
        row.price === null ||
        row.price === undefined ||
        !/^\d{1,13}(?:\.\d{1,2})?$/.test(String(row.price)) ||
        !Number.isFinite(Number(row.price)) ||
        Number(row.price) < 0
      ) {
        errorMessage.value = 'Enter a valid price for every variant.'
        return
      }
    }
  }

  if (
    form.value.effective_from &&
    form.value.effective_to &&
    form.value.effective_to < form.value.effective_from
  ) {
    errorMessage.value =
      'Effective To date cannot be before Effective From date.'
    return
  }

  if (isEditMode.value || pricingMode.value === 'same') {
    const regularPrice = form.value.price

    if (
      regularPrice === '' ||
      regularPrice === null ||
      regularPrice === undefined ||
      !/^\d{1,13}(?:\.\d{1,2})?$/.test(String(regularPrice)) ||
      !Number.isFinite(Number(regularPrice)) ||
      Number(regularPrice) < 0
    ) {
      errorMessage.value = 'Please enter a valid price.'
      return
    }
  }

  if (isSellingPrice()) {
    if (!isEditMode.value && pricingMode.value === 'different') {
      for (let i = 0; i < priceRows.value.length; i++) {
        errorMessage.value = ''
        if (!validatePaymentPrices(priceRows.value[i].payment_prices)) {
          errorMessage.value = `Variant row ${i + 1}: ${errorMessage.value}`
          return
        }
      }
    } else if (!validatePaymentPrices()) {
      return
    }
  }

  loading.value = true

  try {
    const itemId = Number(selectedItem.value.id)

const basePayload = {
  item_id: Number(selectedItem.value.id),
  price_type: form.value.price_type,
  price: Number(form.value.price),
  currency: form.value.currency || 'LKR',
  effective_from: form.value.effective_from || null,
  effective_to: form.value.effective_to || null,
  is_active: Boolean(form.value.is_active)
}

    // Edit mode always updates the selected price record only.
    if (isEditMode.value) {
      const variantId = Number(selectedVariantId.value)

await api.put(`/item-prices/${priceId.value}`, {
  ...basePayload,
  variant_id: Number(selectedVariantId.value)
})

      if (isSellingPrice()) {
        await savePaymentPrices(variantId)
      }

      successMessage.value = 'Item price updated successfully.'
    } else if (pricingMode.value === 'same') {
      // One transactional request for all active variants.
      const paymentPricesPayload = isSellingPrice()
        ? [
            {
              payment_method: 'cash',
              price: Number(paymentPrices.value.cash)
            },
            {
              payment_method: 'card',
              price: Number(paymentPrices.value.card)
            },
            {
              payment_method: 'koko',
              price: Number(paymentPrices.value.koko)
            },
            {
              payment_method: 'mintpay',
              price: Number(paymentPrices.value.mintpay)
            }
          ]
        : []

      const response = await api.post('/item-prices/bulk', {
        ...basePayload,
        payment_prices: paymentPricesPayload
      })

      const count =
        response.data?.data?.variants_updated ?? variants.value.length

      successMessage.value = `Price saved successfully for ${count} active variant(s).`
    } else {
      // Save each variant's price in the same form submission.
      for (const row of priceRows.value) {
        const variantId = Number(row.variant_id)

        await api.post('/item-prices', {
          ...basePayload,
          price: Number(row.price),
          variant_id: variantId
        })

        if (isSellingPrice()) {
          await savePaymentPrices(variantId, row.payment_prices)
        }
      }

      successMessage.value = `Prices saved successfully for ${priceRows.value.length} variant(s).`
    }

    // Let the success message show briefly before leaving the page.
    await new Promise(resolve => setTimeout(resolve, 700))

    await router.push('/admin/products/item-prices')
  } catch (error) {
    console.error('Failed to save item prices:', error)

    errorMessage.value =
      error.response?.data?.message ||
      error.message ||
      'Failed to save item prices.'
  } finally {
    loading.value = false
  }
}


/*
|--------------------------------------------------------------------------
| Navigation
|--------------------------------------------------------------------------
*/

const goBack = () => {
  router.push('/admin/products/item-prices')
}

/*
|--------------------------------------------------------------------------
| Page Initialization
|--------------------------------------------------------------------------
*/

onMounted(async () => {
  await loadItems()

  isBulkEditMode.value = Boolean(route.params.itemId)
  priceId.value = route.params.id || null
  isEditMode.value = Boolean(priceId.value) && !isBulkEditMode.value

  if (isBulkEditMode.value) {
    await loadBulkItemPrices()
  } else if (isEditMode.value) {
    await loadItemPrice()
  }
})
</script>


<template>
  <div class="item-price-form-page">

    <!-- Header -->
    <div class="form-header">
      <div>
        <h1>
          {{
            isBulkEditMode
              ? 'Edit All Item Prices'
              : (isEditMode ? 'Edit Item Price' : 'Create Item Price')
          }}
        </h1>

        <p>
          {{
            isBulkEditMode
              ? `Update prices for ${bulkItemName}.`
              : (isEditMode
                  ? 'Update the pricing details for this item.'
                  : 'Add a price for an item.')
          }}
        </p>
      </div>

      <button
        type="button"
        class="btn-secondary"
        :disabled="loading"
        @click="goBack"
      >
        Cancel
      </button>
    </div>

    <!-- Error -->
    <div
      v-if="errorMessage"
      class="error-message"
    >
      {{ errorMessage }}
    </div>

    <!-- Success -->
    <div
      v-if="successMessage"
      class="success-message"
    >
      {{ successMessage }}
    </div>


<form
  v-if="isBulkEditMode"
  class="item-price-form"
  @submit.prevent="saveBulkItemPrices"
>
  <!-- Item details -->
  <section class="form-section">
    <div class="section-header">
      <h2>Item Details</h2>
      <p>All price records below belong to this item.</p>
    </div>

    <div class="form-grid single">
      <div class="form-group">
        <label>Selected Item</label>
        <input
          :value="itemLabel(selectedItem)"
          type="text"
          readonly
        />
      </div>
    </div>
  </section>

  <!-- Existing price records -->
  <section
    v-for="(row, index) in bulkRows"
    :key="row.id"
    class="form-section"
  >
    <div class="section-header">
      <h2>{{ row.variant_label }}</h2>
      <p>
        Price record #{{ row.id }} · Variant {{ index + 1 }}
      </p>
    </div>

    <!-- Variant and pricing -->
    <div class="form-grid">
      <div class="form-group">
        <label :for="`bulk-variant-${row.id}`">
          Price Applies To <span>*</span>
        </label>

        <select
          :id="`bulk-variant-${row.id}`"
          v-model="row.variant_id"
          required
          :disabled="loading || variantsLoading"
        >
          <option value="">Select a variant</option>
          <option
            v-for="variant in variants"
            :key="variant.id"
            :value="Number(variant.id)"
          >
            {{ variant.variant_sku }} - {{ variant.variant_name }}
            {{ variant.is_default ? '(Default)' : '' }}
          </option>
        </select>
      </div>

      <div class="form-group">
        <label :for="`bulk-type-${row.id}`">
          Price Type <span>*</span>
        </label>

        <select
          :id="`bulk-type-${row.id}`"
          v-model="row.price_type"
          required
          :disabled="loading"
        >
          <option value="" disabled>Select price type</option>
          <option value="cost">Cost Price</option>
          <option value="selling">Selling Price</option>
          <option value="wholesale">Wholesale Price</option>
          <option value="retail">Retail Price</option>
          <option value="special">Special Price</option>
        </select>
      </div>

      <div class="form-group">
        <label :for="`bulk-currency-${row.id}`">
          Currency <span>*</span>
        </label>

        <select
          :id="`bulk-currency-${row.id}`"
          v-model="row.currency"
          required
          :disabled="loading"
        >
          <option value="LKR">LKR</option>
          <option value="USD">USD</option>
          <option value="AED">AED</option>
          <option value="EUR">EUR</option>
          <option value="GBP">GBP</option>
        </select>
      </div>

      <div class="form-group">
        <label :for="`bulk-price-${row.id}`">
          Price <span>*</span>
        </label>

        <div class="money-input">
          <span class="money-tag">{{ row.currency }}</span>
          <input
            :id="`bulk-price-${row.id}`"
            v-model="row.price"
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            required
            :disabled="loading"
          />
        </div>
      </div>
    </div>

    <!-- Checkout prices -->
    <div
      v-if="row.price_type === 'selling'"
      class="checkout-block spaced"
    >
      <h4>Checkout Method Prices</h4>
      <p class="checkout-help">
        Set the price charged for each payment method.
      </p>

      <div class="checkout-grid">
        <div
          v-for="method in paymentMethodFields"
          :key="method.key"
          class="form-group"
        >
          <label :for="`bulk-${method.key}-${row.id}`">
            {{ method.label }}
          </label>

          <div class="money-input">
            <span class="money-tag">{{ row.currency }}</span>
            <input
              :id="`bulk-${method.key}-${row.id}`"
              v-model="row.payment_prices[method.key]"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              required
              :disabled="loading"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Validity -->
    <div class="bulk-subsection">
      <div class="section-header">
        <h2>Validity</h2>
        <p>Set the period during which this price applies.</p>
      </div>

      <div class="form-grid">
        <div class="form-group">
          <label :for="`bulk-from-${row.id}`">Effective From</label>
          <input
            :id="`bulk-from-${row.id}`"
            v-model="row.effective_from"
            type="date"
            :disabled="loading"
          />
        </div>

        <div class="form-group">
          <label :for="`bulk-to-${row.id}`">Effective To</label>
          <input
            :id="`bulk-to-${row.id}`"
            v-model="row.effective_to"
            type="date"
            :min="row.effective_from || undefined"
            :disabled="loading"
          />
        </div>
      </div>
    </div>

    <!-- Settings -->
    <div class="bulk-subsection">
      <div class="section-header">
        <h2>Settings</h2>
        <p>Choose whether this price record is active.</p>
      </div>

      <div class="checkbox-group">
        <label>
          <input
            v-model="row.is_active"
            type="checkbox"
            :disabled="loading"
          />
          <span>Active</span>
        </label>
      </div>
    </div>
  </section>

  <!-- Actions -->
  <div class="form-actions">
    <button
      type="button"
      class="btn-secondary"
      :disabled="loading"
      @click="goBack"
    >
      Cancel
    </button>

    <button
      type="submit"
      class="btn-primary"
      :disabled="loading || !bulkRows.length"
    >
      {{ loading ? 'Saving...' : 'Save All Prices' }}
    </button>
  </div>
</form>


    <!-- Existing create and single-edit form -->
    <form
      v-else
      class="item-price-form"
      @submit.prevent="submitForm"
    >

      <!-- Item -->
      <section class="form-section">

        <div class="section-header">
          <h2>Item</h2>

          <p>
            Search and select the item this price belongs to.
          </p>
        </div>

        <div class="form-grid single">

          <div class="form-group">

            <label for="item">
              Item
              <span>*</span>
            </label>

            <Multiselect
              id="item"
              v-model="selectedItem"
              :options="items"
              :custom-label="itemLabel"
              track-by="id"
              :loading="itemsLoading"
              :options-limit="200"
              :show-labels="false"
              placeholder="Search by item code or name..."
              :disabled="loading"
              @select="onItemChange"
            >
              <template #noResult>
                No items found.
              </template>

              <template #noOptions>
                No items available.
              </template>
            </Multiselect>

          </div>

          <!-- Pricing mode -->
          <div
v-if="selectedItem"
            class="form-group"
          >

            <span class="field-label">Pricing mode</span>

            <div
              class="mode-options"
              role="radiogroup"
              aria-label="Pricing mode"
            >

              <label
                class="mode-option"
                :class="{ selected: pricingMode === 'same', disabled: loading || variantsLoading }"
              >
                <input
                  v-model="pricingMode"
                  type="radio"
                  value="same"
                  :disabled="loading || variantsLoading"
                />

                <span class="mode-text">
                  <strong>Same price</strong>
                  <small>One price for every active variant</small>
                </span>
              </label>

              <label
                class="mode-option"
                :class="{ selected: pricingMode === 'different', disabled: loading || variantsLoading }"
              >
                <input
                  v-model="pricingMode"
                  type="radio"
                  value="different"
                  :disabled="loading || variantsLoading"
                />

                <span class="mode-text">
                  <strong>Different prices</strong>
                  <small>Set a price for each variant</small>
                </span>
              </label>

            </div>

            <small v-if="variantsLoading">Loading variants...</small>

            <small v-else-if="!variants.length">
              This product has no active variants. Create an active variant first.
            </small>

            <small v-else-if="pricingMode === 'same'">
              The entered price will be registered for every active variant.
            </small>

          </div>

        </div>

      </section>

            <!-- Pricing -->
      <section class="form-section">

        <div class="section-header">
          <h2>Pricing</h2>

          <p>
            Define the price type, amount and currency.
          </p>
        </div>

        <div class="form-grid">

          <!-- Price Type -->
          <div class="form-group">

            <label for="price_type">
              Price Type
              <span>*</span>
            </label>

            <select
              id="price_type"
              v-model="form.price_type"
              required
              :disabled="loading"
            >
              <option value="" disabled>
                Select price type
              </option>

              <option value="cost">Cost Price</option>
              <option value="selling">Selling Price</option>
              <option value="wholesale">Wholesale Price</option>
              <option value="retail">Retail Price</option>
              <option value="special">Special Price</option>
            </select>

          </div>

          <!-- Currency -->
          <div class="form-group">

            <label for="currency">
              Currency
              <span>*</span>
            </label>

            <select
              id="currency"
              v-model="form.currency"
              required
              :disabled="loading"
            >
              <option value="LKR">LKR</option>
              <option value="USD">USD</option>
              <option value="AED">AED</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
            </select>

          </div>

          <!-- Price -->
          <div
            v-if="isEditMode || pricingMode === 'same'"
            class="form-group"
          >

            <label for="price">
              Price
              <span>*</span>
            </label>

            <div class="money-input">
              <span class="money-tag">{{ form.currency }}</span>

              <input
                id="price"
                v-model="form.price"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                required
                :disabled="loading"
              />
            </div>

          </div>

        </div>

        <!-- Checkout method prices (same price mode / edit) -->
        <div
          v-if="form.price_type === 'selling' && (isEditMode || pricingMode === 'same')"
          class="checkout-block spaced"
        >

          <h4>Checkout method prices</h4>

          <p class="checkout-help">
            Set the amount charged for each checkout payment method.
          </p>

          <p
            v-if="paymentPricesLoading"
            class="hint"
          >
            Loading checkout prices...
          </p>

          <div
            v-else
            class="checkout-grid"
          >

            <div
              v-for="method in paymentMethodFields"
              :key="method.key"
              class="form-group"
            >

              <label :for="`${method.key}_price`">
                {{ method.label }}
              </label>

              <div class="money-input">
                <span class="money-tag">{{ form.currency }}</span>

                <input
                  :id="`${method.key}_price`"
                  v-model="paymentPrices[method.key]"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  :disabled="loading"
                />
              </div>

            </div>

          </div>

        </div>

      </section>
      
      <!-- Variant -->
      <section
        v-if="selectedItem && (pricingMode === 'different' || isEditMode)"
        class="form-section"
      >

        <div class="section-header">
          <h2>{{ isEditMode ? 'Variant' : 'Variant Prices' }}</h2>

          <p>
            {{
              isEditMode
                ? 'Select the individual variant this price applies to.'
                : 'Add a price for each variant. Each variant can be selected only once.'
            }}
          </p>
        </div>

        <!-- Edit mode: one variant -->
        <div
          v-if="isEditMode"
          class="form-grid single"
        >

          <div class="form-group">

            <label for="variant">
              Price Applies To
              <span>*</span>
            </label>

            <select
              id="variant"
              v-model="selectedVariantId"
              required
              :disabled="loading || variantsLoading || !variants.length"
            >
              <option value="">Select a variant</option>

              <option
                v-for="variant in variants"
                :key="variant.id"
                :value="String(variant.id)"
              >
                {{ variant.variant_sku }} - {{ variant.variant_name }}
                {{ variant.is_default ? '(Default)' : '' }}
              </option>
            </select>

            <small v-if="variantsLoading">Loading variants...</small>

            <small v-else-if="!variants.length">
              This product has no active variants. Create an active variant first.
            </small>

          </div>

        </div>

        <!-- Create mode: price per variant -->
        <template v-else>

          <div class="variant-price-list">

            <div
              v-for="(row, index) in priceRows"
              :key="index"
              class="variant-card"
            >

              <div class="variant-card-header">

                <h3>Variant {{ index + 1 }}</h3>

                <button
                  v-if="priceRows.length > 1"
                  type="button"
                  class="action-button delete"
                  :disabled="loading"
                  @click="removePriceRow(index)"
                >
                  Remove
                </button>

              </div>

              <div class="form-grid">

                <div class="form-group">

                  <label :for="`price-variant-${index}`">
                    Variant
                    <span>*</span>
                  </label>

                  <select
                    :id="`price-variant-${index}`"
                    v-model="row.variant_id"
                    required
                    :disabled="loading || variantsLoading"
                  >
                    <option value="">Select a variant</option>

                    <option
                      v-for="variant in variants"
                      :key="variant.id"
                      :value="String(variant.id)"
                      :disabled="priceRows.some((other, otherIndex) =>
                        otherIndex !== index &&
                        String(other.variant_id) === String(variant.id)
                      )"
                    >
                      {{ variant.variant_sku }} - {{ variant.variant_name }}
                      {{ variant.is_default ? '(Default)' : '' }}
                    </option>
                  </select>

                </div>

                <div class="form-group">

                  <label :for="`variant-price-${index}`">
                    Price
                    <span>*</span>
                  </label>

                  <div class="money-input">
                    <span class="money-tag">{{ form.currency }}</span>

                    <input
                      :id="`variant-price-${index}`"
                      v-model="row.price"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      required
                      :disabled="loading"
                    />
                  </div>

                </div>

              </div>

              <!-- Checkout method prices for this variant -->
              <div
                v-if="form.price_type === 'selling'"
                class="checkout-block"
              >

                <h4>Checkout method prices</h4>

                <div class="checkout-grid">

                  <div
                    v-for="method in paymentMethodFields"
                    :key="method.key"
                    class="form-group"
                  >

                    <label :for="`${method.key}-price-${index}`">
                      {{ method.label }}
                    </label>

                    <div class="money-input">
                      <span class="money-tag">{{ form.currency }}</span>

                      <input
                        :id="`${method.key}-price-${index}`"
                        v-model="row.payment_prices[method.key]"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        required
                        :disabled="loading"
                      />
                    </div>

                  </div>

                </div>

              </div>

            </div>

          </div>

          <button
            type="button"
            class="add-row-button"
            :disabled="loading || variantsLoading || priceRows.length >= variants.length"
            @click="addPriceRow"
          >
            + Add another variant
          </button>

          <small
            v-if="variantsLoading"
            class="hint"
          >
            Loading variants...
          </small>

          <small
            v-else-if="!variants.length"
            class="hint"
          >
            This product has no active variants. Create an active variant first.
          </small>

        </template>

      </section>

      <!-- Validity -->
      <section class="form-section">

        <div class="section-header">
          <h2>Validity</h2>

          <p>
            Optionally limit the period during which this price applies.
          </p>
        </div>

        <div class="form-grid">

          <!-- Effective From -->
          <div class="form-group">

            <label for="effective_from">
              Effective From
            </label>

            <input
              id="effective_from"
              v-model="form.effective_from"
              type="date"
              :disabled="loading"
            />

          </div>

          <!-- Effective To -->
          <div class="form-group">

            <label for="effective_to">
              Effective To
            </label>

            <input
              id="effective_to"
              v-model="form.effective_to"
              type="date"
              :min="form.effective_from || undefined"
              :disabled="loading"
            />

          </div>

        </div>

      </section>

      <!-- Settings -->
      <section class="form-section">

        <div class="section-header">
          <h2>Settings</h2>

          <p>
            Configure whether this price can be used in the system.
          </p>
        </div>

        <div class="checkbox-group">

          <label>
            <input
              v-model="form.is_active"
              type="checkbox"
              :disabled="loading"
            />

            <span>Active</span>
          </label>

          <small>
            Inactive prices will not be applied in selling operations.
          </small>

        </div>

      </section>

      <!-- Actions -->
      <div class="form-actions">

        <button
          type="button"
          class="btn-secondary"
          :disabled="loading"
          @click="goBack"
        >
          Cancel
        </button>

        <button
          type="submit"
          class="btn-primary"
          :disabled="loading"
        >
          {{
            loading
              ? 'Saving...'
              : (isEditMode ? 'Update Item Price' : 'Create Item Price')
          }}
        </button>

      </div>

    </form>

  </div>
</template>

<style scoped>
.item-price-form-page {
  width: 100%;
  max-width: 1100px;
  margin: 0 auto;
  font-family: var(--font-family);
}

.bulk-subsection {
  margin-top: var(--spacing-xl);
  padding-top: var(--spacing-lg);
  border-top: 1px solid var(--color-border-light);
}

.bulk-subsection .section-header {
  margin-bottom: var(--spacing-lg);
}

/* =========================
   Header
   ========================= */

.form-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-lg);
  margin-bottom: var(--spacing-2xl);
}

.form-header h1 {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
}

.form-header p {
  margin-top: 5px;
  font-size: var(--font-size-md);
  color: var(--color-text-secondary);
}

/* =========================
   Form / Sections
   ========================= */

.item-price-form {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xl);
}

.form-section {
  padding: var(--spacing-2xl);
  background: var(--color-surface);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
}

.section-header {
  margin-bottom: var(--spacing-xl);
}

.section-header h2 {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
}

.section-header p {
  margin-top: 5px;
  font-size: var(--font-size-md);
  color: var(--color-text-secondary);
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--spacing-xl);
}

.form-grid.single {
  grid-template-columns: minmax(0, 1fr);
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  min-width: 0;
}

/* =========================
   Labels / Inputs
   ========================= */

.form-group label,
.field-label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.form-group label span {
  color: var(--color-danger);
}

.form-group input:not([type="radio"]),
.form-group select {
  width: 100%;
  box-sizing: border-box;
  height: 40px;
  padding: 0 var(--spacing-lg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  color: var(--color-text-primary);
  font-family: inherit;
  font-size: var(--font-size-md);
  outline: none;
  transition: border-color var(--transition-fast),
  box-shadow var(--transition-fast);
}

.form-group input::placeholder {
  color: var(--color-text-muted);
}

.form-group input:focus,
.form-group select:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-light);
}

.form-group input:disabled,
.form-group select:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.form-group small,
.checkbox-group small,
.hint {
  font-size: var(--font-size-xs);
  line-height: 1.5;
  color: var(--color-text-muted);
}

.hint {
  display: block;
  margin-top: var(--spacing-md);
  font-size: var(--font-size-sm);
}

/* =========================
   Money input (currency prefix)
   ========================= */

.money-input {
  display: flex;
  align-items: stretch;
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  transition: border-color var(--transition-fast),
  box-shadow var(--transition-fast);
}

.money-input:focus-within {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-light);
}

.money-tag {
  display: inline-flex;
  align-items: center;
  padding: 0 var(--spacing-md);
  border-right: 1px solid var(--color-border-light);
  background: var(--color-hover-bg);
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  letter-spacing: 0.03em;
}

.form-group .money-input input {
  height: 38px;
  border: 0;
  border-radius: 0;
  box-shadow: none;
  font-variant-numeric: tabular-nums;
}

/* =========================
   Pricing mode (radio cards)
   ========================= */

.mode-options {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--spacing-md);
}

.mode-option {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-md);
  padding: var(--spacing-lg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  cursor: pointer;
  transition: border-color var(--transition-fast),
  background var(--transition-fast),
  box-shadow var(--transition-fast);
}

.mode-option:hover:not(.disabled):not(.selected) {
  background: var(--color-hover-bg);
}

.mode-option.selected {
  border-color: var(--color-primary);
  background: var(--color-primary-light);
  box-shadow: 0 0 0 1px var(--color-primary);
}

.mode-option.disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.mode-option input {
  width: 16px;
  height: 16px;
  margin-top: 2px;
  flex-shrink: 0;
  accent-color: var(--color-primary);
}

.mode-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.mode-text strong {
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.mode-option.selected .mode-text strong {
  color: var(--color-primary);
}

.mode-text small {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

/* =========================
   Variant price cards
   ========================= */

.variant-price-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.variant-card {
  padding: var(--spacing-xl);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
}

.variant-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-lg);
  margin-bottom: var(--spacing-lg);
}

.variant-card-header h3 {
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.add-row-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  margin-top: var(--spacing-lg);
  padding: var(--spacing-md);
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-lg);
  background: transparent;
  color: var(--color-primary);
  font-family: inherit;
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
  transition: background var(--transition-fast),
  border-color var(--transition-fast);
}

.add-row-button:hover:not(:disabled) {
  background: var(--color-primary-light);
  border-color: var(--color-primary);
}

.add-row-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* =========================
   Checkout method prices
   ========================= */

.checkout-block {
  margin-top: var(--spacing-xl);
  padding: var(--spacing-lg);
  border-radius: var(--radius-lg);
  background: var(--color-hover-bg);
}

.checkout-block.spaced {
  margin-top: var(--spacing-2xl);
}

.checkout-block h4 {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--color-text-secondary);
}

.checkout-help {
  margin-top: 4px;
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.checkout-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--spacing-lg);
  margin-top: var(--spacing-lg);
}

/* =========================
   Searchable Select (vue-multiselect)
   ========================= */

.form-group :deep(.multiselect) {
  min-height: 40px;
  font-family: inherit;
  font-size: var(--font-size-md);
  color: var(--color-text-primary);
}

.form-group :deep(.multiselect__tags) {
  min-height: 40px;
  padding: 7px 40px 0 var(--spacing-lg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  transition: border-color var(--transition-fast),
  box-shadow var(--transition-fast);
}

.form-group :deep(.multiselect--active .multiselect__tags) {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-light);
}

.form-group :deep(.multiselect__input),
.form-group :deep(.multiselect__single) {
  min-height: 20px;
  margin-bottom: 0;
  padding: 0;
  background: transparent;
  color: var(--color-text-primary);
  font-family: inherit;
  font-size: var(--font-size-md);
}

.form-group :deep(.multiselect__placeholder) {
  margin-bottom: 0;
  padding-top: 0;
  color: var(--color-text-muted);
}

.form-group :deep(.multiselect__select) {
  height: 38px;
  right: 4px;
}

.form-group :deep(.multiselect__content-wrapper) {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  box-shadow: var(--shadow-sm);
  z-index: 1000;
}

.form-group :deep(.multiselect__option) {
  padding: 10px var(--spacing-lg);
  min-height: 0;
  font-size: var(--font-size-md);
  color: var(--color-text-primary);
}

.form-group :deep(.multiselect__option--highlight),
.form-group :deep(.multiselect__option--highlight::after) {
  background: var(--color-primary);
  color: var(--color-text-light);
}

.form-group :deep(.multiselect__option--selected) {
  background: var(--color-hover-bg);
  font-weight: var(--font-weight-semibold);
}

.form-group :deep(.multiselect__option--selected.multiselect__option--highlight) {
  background: var(--color-primary);
  color: var(--color-text-light);
}

.form-group :deep(.multiselect__content) {
  padding: 0;
}

.form-group :deep(.multiselect__spinner) {
  background: var(--color-surface);
}

/* =========================
   Checkbox
   ========================= */

.checkbox-group {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.checkbox-group label {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  cursor: pointer;
}

.checkbox-group input[type="checkbox"] {
  width: 16px;
  height: 16px;
  cursor: pointer;
  accent-color: var(--color-primary);
}

/* =========================
   States
   ========================= */

.error-message,
.success-message {
  margin-bottom: var(--spacing-lg);
  padding: var(--spacing-md) var(--spacing-lg);
  border: 1px solid;
  border-radius: var(--radius-lg);
  font-size: var(--font-size-sm);
}

.error-message {
  border-color: var(--color-danger-light);
  background: var(--color-danger-bg);
  color: var(--color-danger);
}

.success-message {
  border-color: var(--color-success-light);
  background: var(--color-success-bg);
  color: var(--color-success);
}

/* =========================
   Actions / Buttons
   ========================= */

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-md);
}

.btn-primary,
.btn-secondary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 40px;
  padding: 0 var(--spacing-xl);
  border-radius: var(--radius-lg);
  font-family: inherit;
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
  white-space: nowrap;
  cursor: pointer;
  transition: background var(--transition-fast),
  color var(--transition-fast),
  border-color var(--transition-fast);
}

.btn-primary {
  border: none;
  background: var(--color-primary);
  color: var(--color-text-light);
}

.btn-primary:hover:not(:disabled) {
  background: var(--color-primary-hover);
}

.btn-secondary {
  border: 1px solid var(--color-border-light);
  background: var(--color-surface);
  color: var(--color-text-secondary);
}

.btn-secondary:hover:not(:disabled) {
  background: var(--color-hover-bg);
  color: var(--color-text-primary);
}

.btn-primary:disabled,
.btn-secondary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.action-button {
  display: inline-flex;
  align-items: center;
  padding: 6px var(--spacing-md);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-text-secondary);
  font-family: inherit;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  white-space: nowrap;
  cursor: pointer;
  transition: background var(--transition-fast),
  color var(--transition-fast),
  border-color var(--transition-fast);
}

.action-button.delete:hover:not(:disabled) {
  background: var(--color-danger-bg);
  border-color: var(--color-danger-light);
  color: var(--color-danger);
}

.action-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* =========================
   Responsive
   ========================= */

@media (max-width: 900px) {
  .checkout-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 768px) {
  .form-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .form-grid,
  .mode-options {
    grid-template-columns: 1fr;
  }

  .form-section {
    padding: var(--spacing-xl);
  }

  .form-actions {
    flex-direction: column-reverse;
  }

  .btn-primary,
  .btn-secondary {
    width: 100%;
  }
}

@media (max-width: 520px) {
  .checkout-grid {
    grid-template-columns: 1fr;
  }
}
</style>