<script setup>
import {computed, onMounted, ref} from 'vue'
import {useRoute, useRouter} from 'vue-router'
import orderApi from '../../api/orderApi'
import customerApi from '../../api/customerApi'
import itemApi from '../../api/itemApi'
import SearchableSelect from '../../components/common/SearchableSelect.vue'
import customerAddressApi from '../../api/deliveryAddressApi'
import deliveryAreaApi from '../../api/deliveryAreaApi'
import itemPriceApi from '../../api/itemPriceApi'

const route = useRoute()
const router = useRouter()

// List page of the orders section in your router
const LIST_ROUTE = '/admin/sales/orders'

const loading = ref(false)
const saving = ref(false)
const error = ref('')
const success = ref('')

const calculatingDelivery = ref(false)

const customers = ref([])
const itemList = ref([])
const itemPrices = ref([])

const customerAddresses = ref([])

let tempId = 1

// If the route has an :id param the page works as an edit form
const orderId = computed(() => route.params.id || null)
const isEdit = computed(() => Boolean(orderId.value))

const pageTitle = computed(() => isEdit.value ? 'Edit Order' : 'Create Order')

const submitText = computed(() => {
  if (saving.value) return isEdit.value ? 'Saving...' : 'Creating Order...'

  return isEdit.value ? 'Update Order' : 'Create Order'
})

const emptyForm = () => ({
  order_number: '',
  order_date: new Date().toISOString().split('T')[0],

  customer_id: '',

  order_type: 'manual',

  // Overall discount
  discount_percentage_mode: false,
  discount_percentage: 0,
  discount_amount: 0,

  tax_amount: 0,
  shipping_amount: 0,

  notes: '',

  items: [],

  address: {
    address_id: '',
    address_type: 'shipping'
  },

  delivery: {
    required: false,
    method: 'standard',
    charge: 0,
    recipient_name: '',
    recipient_phone: '',
    tracking_number: '',
    courier_name: '',
    expected_delivery_date: '',
    notes: ''
  },

  payment: {
    payment_number: '',
    method: '',
    status: 'unpaid',
    amount: 0
  },

  invoice_number: ''
})

const form = ref(emptyForm())

const generate10DigitNumber = () => {
  return Math.floor(
      1000000000 + Math.random() * 9000000000
  ).toString()
}

const generateOrderNumber = () => {
  return `ORD${generate10DigitNumber()}`
}

const generatePaymentNumber = () => {
  return `PAY${generate10DigitNumber()}`
}

const generateInvoiceNumber = () => {
  return `INV${generate10DigitNumber()}`
}

const generateDocumentNumbers = () => {
  if (isEdit.value) return

  form.value.order_number = generateOrderNumber()
  form.value.payment.payment_number = generatePaymentNumber()
  form.value.invoice_number = generateInvoiceNumber()
}

// ==========================================
// Response helpers
// (works whether the API returns an array, { data: [] }, { data: { rows: [] } } ...)
// ==========================================

const extractList = (response) => {
  let value = response

  for (let i = 0; i < 3; i++) {
    if (Array.isArray(value)) return value
    if (!value) break

    value =
        value.data ??
        value.items ??
        value.rows ??
        value.customers ??
        value.results
  }

  return Array.isArray(value) ? value : []
}

const unwrap = (response) => {
  let value = response

  for (let i = 0; i < 2; i++) {
    if (value && value.data !== undefined && value.id === undefined) {
      value = value.data
    }
  }

  return value
}

const selectedAddress = computed(() => {
  if (!form.value.address.address_id) {
    return null
  }

  return customerAddresses.value.find(
      address =>
          Number(address.id) === Number(form.value.address.address_id)
  ) || null
})

const addressChanged = async () => {
  const address = selectedAddress.value

  if (!address) {
    form.value.delivery.recipient_name = ''
    form.value.delivery.recipient_phone = ''

    form.value.delivery.charge = 0
    form.value.shipping_amount = 0

    return
  }

  form.value.delivery.recipient_name =
      address.recipient_name || ''

  form.value.delivery.recipient_phone =
      address.phone || ''

  await calculateDelivery()
}
// ==========================================
// Dropdown options
// ==========================================

const customerOptions = computed(() =>
    customers.value.map(customer => ({
      value: customer.id,
      label:
          customer.name ||
          [customer.first_name, customer.last_name].filter(Boolean).join(' ') ||
          customer.company_name ||
          customer.email ||
          `Customer #${customer.id}`,
      hint: customer.phone || customer.email || ''
    }))
)

const itemOptions = computed(() =>
    itemList.value.map(item => ({
      value: item.id,
      label: item.name || item.item_name || `Item #${item.id}`,
      hint: item.sku || item.item_code || item.code || ''
    }))
)

const customerAddressOptions = computed(() =>
    customerAddresses.value.map(address => ({
      value: address.id,
      label:
          `${address.address_type || 'Address'} - ${address.address_line_1}, ${address.city}`,
      hint:
          address.recipient_name ||
          address.phone ||
          ''
    }))
)

const deliveryChanged = () => {
  if (form.value.delivery.required) {
    form.value.shipping_amount =
        Number(form.value.delivery.charge || 0)
  } else {
    form.value.shipping_amount = 0
    form.value.delivery.charge = 0

    form.value.address.address_id = ''

    form.value.delivery.recipient_name = ''
    form.value.delivery.recipient_phone = ''
  }
}

// ==========================================
// Load data
// ==========================================

const loadCustomers = async () => {
  try {
    const response = await customerApi.getCustomers({limit: 1000})

    customers.value = extractList(response)
  } catch (err) {
    console.error('Failed to load customers:', err)

    error.value =
        err?.response?.data?.message ||
        'Failed to load customers.'
  }
}

const loadCustomerAddresses = async (customerId) => {
  customerAddresses.value = []

  form.value.address.address_id = ''

  if (!customerId) {
    return
  }

  try {
    const response =
        await customerAddressApi.getCustomerAddresses(customerId)

    customerAddresses.value =
        response?.data || response || []

  } catch (err) {
    console.error(
        'Failed to load customer addresses:',
        err
    )

    customerAddresses.value = []

    error.value =
        err?.response?.data?.message ||
        'Failed to load customer addresses.'
  }
}

const loadItemPrices = async () => {
  try {
    const response = await itemPriceApi.getItemPrices()

    itemPrices.value =
        response?.data ||
        response ||
        []
  } catch (err) {
    console.error(
        'Failed to load item prices:',
        err
    )

    itemPrices.value = []
  }
}

const customerChanged = async () => {
  form.value.address.address_id = ''

  form.value.delivery.recipient_name = ''
  form.value.delivery.recipient_phone = ''

  await loadCustomerAddresses(form.value.customer_id)
}

const loadItems = async () => {
  try {
    const response = await itemApi.getItems({limit: 1000})

    itemList.value = extractList(response)
  } catch (err) {
    console.error('Failed to load items:', err)

    error.value =
        err?.response?.data?.message ||
        'Failed to load items.'
  }
}

const loadOrder = async () => {
  if (!orderId.value) return

  try {
    // GET /orders/:id
    const response = await orderApi.getOrderById(orderId.value)

    const order = unwrap(response)

    if (!order) {
      throw new Error('Order not found')
    }

    const address =
        order.address ||
        order.shippingAddress ||
        order.shipping_address ||
        {}

    const payment =
        order.payment ||
        order.payments?.[0] ||
        {}

    const delivery =
        order.delivery ||
        order.deliveries?.[0] ||
        {}

    /*
     * Load customer addresses first.
     * This is required so the saved address can be selected
     * and used for delivery charge calculation.
     */
    if (order.customer_id) {
      await loadCustomerAddresses(order.customer_id)
    }

    /*
     * Find the saved address ID from the order response.
     *
     * Depending on your backend response, the ID may be:
     * address.id
     * address.address_id
     */
    const savedAddressId =
        address.address_id ??
        address.id ??
        ''

    form.value = {
      order_number: order.order_number || '',

      order_date: order.order_date
          ? String(order.order_date).slice(0, 10)
          : '',

      customer_id: order.customer_id || '',

      order_type: order.order_type || 'manual',

      discount_amount: Number(order.discount_amount || 0),

      discount_percentage_mode:
          Boolean(order.discount_percentage_mode),

      discount_percentage:
          Number(order.discount_percentage || 0),

      tax_amount:
          Number(order.tax_amount || 0),

      shipping_amount:
          Number(order.shipping_amount || 0),

      notes: order.notes || '',

      items: (order.items || []).map(line => {
        const quantity =
            Number(line.quantity || 0)

        const unitPrice =
            Number(line.unit_price || 0)

        const discount =
            Number(line.discount || 0)

        const itemId =
            line.item_id ??
            line.product_id ??
            ''

        const item =
            itemList.value.find(
                item =>
                    Number(item.id) ===
                    Number(itemId)
            )

        let shippingWeightKg = 0

        if (item) {
          const shippingWeight =
              Number(item.shipping_weight || 0)

          const shippingWeightUnit =
              item.shipping_weight_unit || 'kg'

          shippingWeightKg =
              shippingWeightUnit === 'g'
                  ? shippingWeight / 1000
                  : shippingWeight
        }

        return {
          tempId: tempId++,

          item_id: itemId,

          quantity,

          unit_price: unitPrice,

          discount_percentage_mode:
              Boolean(line.discount_percentage_mode),

          discount_percentage:
              Number(line.discount_percentage || 0),

          discount,

          total: Number(
              line.total ??
              (quantity * unitPrice - discount)
          ),

          shipping_weight_kg: shippingWeightKg
        }
      }),

      address: {
        address_id: savedAddressId,
        address_type:
            address.address_type || 'shipping'
      },

      payment: {
        payment_number:
            payment.payment_number || '',
        method:
            payment.method ||
            payment.payment_method ||
            '',

        status:
            order.payment_status ||
            payment.status ||
            'unpaid',

        amount:
            Number(payment.amount || 0)
      },

      delivery: {
        required:
            Boolean(delivery.id),

        method:
            delivery.delivery_method ||
            'standard',

        charge:
            Number(
                delivery.delivery_charge || 0
            ),

        recipient_name:
            delivery.recipient_name || '',

        recipient_phone:
            delivery.recipient_phone || '',

        tracking_number:
            delivery.tracking_number || '',

        courier_name:
            delivery.courier_name || '',

        expected_delivery_date:
            delivery.expected_delivery_date
                ? String(
                    delivery.expected_delivery_date
                ).slice(0, 10)
                : '',

        notes:
            delivery.notes || ''
      }
    }

    /*
     * Restore recipient information from
     * the selected saved address.
     */
    const selectedAddressData =
        selectedAddress.value

    if (selectedAddressData) {
      form.value.delivery.recipient_name =
          selectedAddressData.recipient_name || ''

      form.value.delivery.recipient_phone =
          selectedAddressData.phone || ''
    }

    /*
     * Recalculate delivery charge using:
     * saved address + current item shipping weights.
     */
    await calculateDelivery()

  } catch (err) {
    console.error(
        'Failed to load order:',
        err
    )

    error.value =
        err?.response?.data?.message ||
        err.message ||
        'Failed to load order.'
  }
}

onMounted(async () => {
  loading.value = true
  error.value = ''

  try {
    await loadCustomers()
    await loadItems()
    await loadItemPrices()

    if (!isEdit.value) {
      generateDocumentNumbers()
      addItem()
    } else {
      await loadOrder()
    }
  } finally {
    loading.value = false
  }
})
// ==========================================
// Items
// ==========================================

const addItem = () => {
  form.value.items.push({
    tempId: tempId++,

    item_id: '',

    quantity: 1,

    unit_price: 0,

    // Item discount
    discount_percentage_mode: false,
    discount_percentage: 0,
    discount: 0,

    total: 0,

    shipping_weight_kg: 0
  })
}

const removeItem = (index) => {
  form.value.items.splice(index, 1)
}

const calculateItem = (line) => {
  const quantity = Number(line.quantity || 0)
  const price = Number(line.unit_price || 0)

  const grossAmount = quantity * price

  let discountAmount = 0

  if (line.discount_percentage_mode) {
    const percentage = Math.min(
        100,
        Math.max(0, Number(line.discount_percentage || 0))
    )

    discountAmount =
        grossAmount * (percentage / 100)

    line.discount = discountAmount
  } else {
    discountAmount = Math.min(
        grossAmount,
        Math.max(0, Number(line.discount || 0))
    )

    line.discount = discountAmount

    if (grossAmount > 0) {
      line.discount_percentage =
          (discountAmount / grossAmount) * 100
    } else {
      line.discount_percentage = 0
    }
  }

  line.total = Math.max(
      0,
      grossAmount - discountAmount
  )
}

const itemChanged = (line) => {
  const selectedItemId = Number(line.item_id)

  if (!selectedItemId) {
    line.unit_price = 0
    line.shipping_weight_kg = 0
    calculateItem(line)
    calculateDelivery()
    return
  }

  // Check whether this product already exists
  // in another order line.
  const existingLine = form.value.items.find(
      item =>
          item !== line &&
          Number(item.item_id) === selectedItemId
  )

  if (existingLine) {
    // Increase the existing item's quantity
    existingLine.quantity =
        Number(existingLine.quantity || 0) + 1

    // Recalculate existing line
    calculateItem(existingLine)

    // Remove the newly created duplicate row
    const duplicateIndex =
        form.value.items.indexOf(line)

    if (duplicateIndex !== -1) {
      form.value.items.splice(duplicateIndex, 1)
    }

    // Recalculate delivery based on new quantity
    calculateDelivery()

    return
  }

  const item = itemList.value.find(
      item => Number(item.id) === selectedItemId
  )

  if (!item) {
    line.unit_price = 0
    line.shipping_weight_kg = 0
    calculateItem(line)
    calculateDelivery()
    return
  }

  /*
   * Find the active price for this item.
   */
  const pricesForItem = itemPrices.value
      .filter(
          price =>
              Number(price.item_id) === selectedItemId
      )

  /*
   * Prefer an active price.
   * If multiple active prices exist,
   * use the latest one.
   */
  const activePrice = pricesForItem
      .filter(price => price.is_active)
      .sort(
          (a, b) =>
              Number(b.id) - Number(a.id)
      )[0]

  line.unit_price = Number(
      activePrice?.price ?? 0
  )

  /*
   * Shipping weight
   */
  const shippingWeight =
      Number(item.shipping_weight || 0)

  const shippingWeightUnit =
      item.shipping_weight_unit || 'kg'

  if (shippingWeightUnit === 'g') {
    line.shipping_weight_kg =
        shippingWeight / 1000
  } else {
    line.shipping_weight_kg =
        shippingWeight
  }

  calculateItem(line)
  calculateDelivery()
}

const quantityChanged = (line) => {
  calculateItem(line)
  calculateDelivery()
}

const calculateDelivery = async () => {
  // Delivery is not required
  if (!form.value.delivery.required) {
    form.value.delivery.charge = 0
    form.value.shipping_amount = 0
    return
  }

  // Pickup does not require delivery charge
  if (form.value.delivery.method === 'pickup') {
    form.value.delivery.charge = 0
    form.value.shipping_amount = 0
    return
  }

  const address = selectedAddress.value

  // No address selected
  if (!address) {
    form.value.delivery.charge = 0
    form.value.shipping_amount = 0
    return
  }

  // Saved address must have an area
  if (!address.area_id) {
    form.value.delivery.charge = 0
    form.value.shipping_amount = 0

    error.value = 'Selected address does not have a delivery area.'
    return
  }

  // Calculate total shipping weight
  const totalWeightKg = Number(
      totalShippingWeight.value || 0
  )

  // No products / no weight
  if (totalWeightKg <= 0) {
    form.value.delivery.charge = 0
    form.value.shipping_amount = 0
    return
  }

  try {
    calculatingDelivery.value = true
    error.value = ''

    const response =
        await deliveryAreaApi.calculateCharge({
          area_id: Number(address.area_id),
          total_weight_kg: totalWeightKg
        })

    const data =
        response?.data || {}

    const deliveryCharge =
        Number(data.delivery_charge || 0)

    form.value.delivery.charge = deliveryCharge
    form.value.shipping_amount = deliveryCharge

  } catch (err) {
    console.error(
        'Failed to calculate delivery charge:',
        err
    )

    form.value.delivery.charge = 0
    form.value.shipping_amount = 0

    error.value =
        err?.response?.data?.message ||
        'Failed to calculate delivery charge.'

  } finally {
    calculatingDelivery.value = false
  }
}

// ==========================================
// Totals
// ==========================================
const totalShippingWeight = computed(() => {
  return form.value.items.reduce((total, line) => {
    const quantity = Number(line.quantity || 0)
    const weightKg = Number(line.shipping_weight_kg || 0)

    return total + (quantity * weightKg)
  }, 0)
})
const subtotal = computed(() => {
  return form.value.items.reduce(
      (total, line) => total + Number(line.total || 0),
      0
  )
})

const calculatedDiscountAmount = computed(() => {
  if (form.value.discount_percentage_mode) {
    const percentage = Math.min(
        100,
        Math.max(
            0,
            Number(form.value.discount_percentage || 0)
        )
    )

    return subtotal.value * (percentage / 100)
  }

  return Math.min(
      subtotal.value,
      Math.max(
          0,
          Number(form.value.discount_amount || 0)
      )
  )
})


const totalAmount = computed(() => {
  return Math.max(
      0,
      Number(subtotal.value || 0) -
      Number(calculatedDiscountAmount.value || 0) +
      Number(form.value.tax_amount || 0) +
      Number(form.value.shipping_amount || 0)
  )
})

// ==========================================
// Formatting
// ==========================================

const formatAmount = (amount) => {
  return Number(amount || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}



// ==========================================
// Submit
// ==========================================

const submitOrder = async () => {
  error.value = ''
  success.value = ''

  if (form.value.items.length === 0) {
    error.value = 'Please add at least one product.'
    return
  }

  if (form.value.items.some(line => !line.item_id)) {
    error.value = 'Please select a product for every item row.'
    return
  }
  saving.value = true

  try {
    const payload = {
      order_number: form.value.order_number,
      invoice_number: form.value.invoice_number,
      customer_id: form.value.customer_id || null,
      order_date: form.value.order_date,
      order_type: form.value.order_type,

      payment_status: form.value.payment.status,

      subtotal: subtotal.value,
      discount_amount: Number(
          calculatedDiscountAmount.value || 0
      ),

      discount_percentage_mode:
          Boolean(form.value.discount_percentage_mode),

      discount_percentage:
          form.value.discount_percentage_mode
              ? Number(form.value.discount_percentage || 0)
              : 0,
      tax_amount: Number(form.value.tax_amount || 0),
      shipping_amount: Number(form.value.shipping_amount || 0),
      total_amount: totalAmount.value,

      notes: form.value.notes,

      items: form.value.items.map(line => ({
        item_id: line.item_id,
        quantity: line.quantity,
        unit_price: line.unit_price,

        discount_percentage_mode:
            Boolean(line.discount_percentage_mode),

        discount_percentage:
            Number(line.discount_percentage || 0),

        discount:
            Number(line.discount || 0),

        total:
            Number(line.total || 0)
      })),
      address: form.value.delivery.required
          ? {
            address_id: form.value.address.address_id,
            address_type: 'shipping'
          }
          : null,

      payment: form.value.payment,

      delivery: form.value.delivery.required
          ? form.value.delivery
          : {
            required: false
          }
    }

    if (isEdit.value) {
      // Needs orderApi.updateOrder(id, data) -> PUT /orders/:id
      await orderApi.updateOrder(orderId.value, payload)

      success.value = 'Order updated successfully.'
    } else {
      await orderApi.createOrder({
        ...payload,
        status: 'pending',
        fulfillment_status: 'unfulfilled'
      })

      success.value = 'Order created successfully.'
    }

    setTimeout(() => {
      router.push(LIST_ROUTE)
    }, 700)
  } catch (err) {
    console.error('Save order error:', err)

    error.value =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        err.message ||
        'Failed to save order.'
  } finally {
    saving.value = false
  }
}

const goBack = () => {
  router.push(LIST_ROUTE)
}
</script>

<template>
  <div class="order-form-page">

    <!-- Header -->
    <div class="form-header">
      <div>
        <h1>{{ pageTitle }}</h1>

        <p>
          {{
            isEdit
                ? 'Update the order information.'
                : 'Create a new customer, POS, or manual order.'
          }}
        </p>
      </div>

      <button
          type="button"
          class="btn-secondary"
          @click="goBack"
          :disabled="saving"
      >
        Cancel
      </button>
    </div>

    <!-- Error -->
    <div
        v-if="error"
        class="error-message"
    >
      {{ error }}
    </div>

    <!-- Success -->
    <div
        v-if="success"
        class="success-message"
    >
      {{ success }}
    </div>

    <!-- Loading -->
    <div
        v-if="loading"
        class="loading-message"
    >
      Loading...
    </div>

    <!-- Form -->
    <form
        v-else
        class="order-form"
        @submit.prevent="submitOrder"
    >

      <!-- Order Information -->
      <section class="form-section">

        <div class="section-header">
          <h2>Order Information</h2>

          <p>Enter the basic order details.</p>
        </div>

        <div class="form-grid">

          <!-- Order Number -->
          <div class="form-group">

            <label for="order_number">
              Order Number
              <span>*</span>
            </label>

            <input
                id="order_number"
                v-model="form.order_number"
                type="text"
                readonly
            />

            <small>Enter a unique order number.</small>

          </div>

          <!-- Order Date -->
          <div class="form-group">

            <label for="order_date">
              Order Date
              <span>*</span>
            </label>

            <input
                id="order_date"
                v-model="form.order_date"
                type="date"
                required
                :disabled="saving"
            />

          </div>

          <!-- Order Type -->
          <div class="form-group">

            <label for="order_type">
              Order Type
            </label>

            <select
                id="order_type"
                v-model="form.order_type"
                :disabled="saving"
            >
              <option value="online">Online</option>
              <option value="pos">POS</option>
              <option value="manual">Manual</option>
            </select>

          </div>

          <!-- Customer -->
          <div class="form-group">

            <label>
              Customer
            </label>

            <SearchableSelect
                v-model="form.customer_id"
                :options="customerOptions"
                placeholder="Select customer"
                @change="customerChanged"
            />

          </div>

        </div>

      </section>

      <!-- Order Items -->
      <section class="form-section">

        <div class="section-header section-header-row">

          <div>
            <h2>Order Items</h2>

            <p>Add the products included in this order.</p>
          </div>

          <button
              type="button"
              class="btn-primary"
              :disabled="saving"
              @click="addItem"
          >
            + Add Product
          </button>

        </div>

        <div class="items-table">

          <table>

            <thead>
            <tr>
              <th class="col-product">Product</th>
              <th>Quantity</th>
              <th>Unit Price</th>
              <th>Discount</th>
              <th>Total</th>
              <th></th>
            </tr>
            </thead>

            <tbody>

            <tr
                v-for="(line, index) in form.items"
                :key="line.tempId"
            >

              <td class="cell-product">
                <SearchableSelect
                    v-model="line.item_id"
                    :options="itemOptions"
                    placeholder="Search product..."
                    required
                    :disabled="saving"
                    @change="itemChanged(line)"
                />
              </td>

              <td>
                <input
                    v-model.number="line.quantity"
                    type="number"
                    min="1"
                    step="1"
                    @input="quantityChanged(line)"
                >
              </td>

              <td>
                <input
                    v-model.number="line.unit_price"
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    :disabled="saving"
                    @input="calculateItem(line)"
                />
              </td>

              <td>
                <div class="discount-field">

                  <label class="checkbox-label">
                    <input
                        v-model="line.discount_percentage_mode"
                        type="checkbox"
                        :disabled="saving"
                        @change="calculateItem(line)"
                    />

                    %
                  </label>

                  <input
                      v-if="line.discount_percentage_mode"
                      v-model.number="line.discount_percentage"
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      placeholder="%"
                      :disabled="saving"
                      @input="calculateItem(line)"
                  />

                  <input
                      v-else
                      v-model.number="line.discount"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Amount"
                      :disabled="saving"
                      @input="calculateItem(line)"
                  />

                </div>
              </td>

              <td class="nowrap">
                <strong>Rs. {{ formatAmount(line.total) }}</strong>
              </td>

              <td>
                <button
                    type="button"
                    class="remove-button"
                    title="Remove product"
                    :disabled="saving"
                    @click="removeItem(index)"
                >
                  ×
                </button>
              </td>

            </tr>

            <tr v-if="form.items.length === 0">
              <td colspan="6" class="empty-items">
                <strong>No products added</strong>

                <span>Click "Add Product" to add items.</span>
              </td>
            </tr>

            </tbody>

          </table>

        </div>

      </section>

      <!-- Delivery Address -->
      <section class="form-section">

        <div class="section-header">
          <h2>Delivery</h2>
          <p>Choose whether this order needs to be delivered.</p>
        </div>

        <div class="form-stack">

          <div class="form-group">
            <label class="checkbox-label">
              <input
                  type="checkbox"
                  v-model="form.delivery.required"
                  :disabled="saving"
                  @change="deliveryChanged"
              >
              <span>Delivery Required</span>
            </label>
          </div>


          <template v-if="form.delivery.required">

            <div class="form-group">
              <label>Delivery Address <span class="required">*</span></label>

              <SearchableSelect
                  v-model="form.address.address_id"
                  :options="customerAddressOptions"
                  placeholder="Select saved address"
                  :disabled="!form.customer_id || saving"
                  @change="addressChanged"
              />

              <small
                  v-if="form.customer_id && customerAddresses.length === 0"
                  class="text-muted"
              >
                This customer has no saved addresses.
              </small>
            </div>

            <div
                v-if="selectedAddress"
                class="selected-address"
            >
              <strong>Selected Address</strong>

              <p>
                {{ selectedAddress.recipient_name }}
              </p>

              <p>
                {{ selectedAddress.address_line_1 }}
                <span v-if="selectedAddress.address_line_2">
                    , {{ selectedAddress.address_line_2 }}
                </span>
              </p>

              <p>
                {{ selectedAddress.city }}
                <span v-if="selectedAddress.state">
                    , {{ selectedAddress.state }}
                </span>
              </p>

              <p v-if="selectedAddress.postal_code">
                {{ selectedAddress.postal_code }}
              </p>

              <p>
                {{ selectedAddress.country }}
              </p>

              <p v-if="selectedAddress.phone">
                Phone: {{ selectedAddress.phone }}
              </p>
            </div>

            <div class="form-grid">

              <div class="form-group">
                <label>Delivery Method</label>

                <select
                    v-model="form.delivery.method"
                    class="form-control"
                >
                  <option value="standard">Standard</option>
                  <option value="express">Express</option>
                  <option value="pickup">Pickup</option>
                  <option value="courier">Courier</option>
                </select>
              </div>

              <div class="form-group">
                <label>Delivery Charge</label>

                <input
                    v-model="form.delivery.charge"
                    type="number"
                    class="form-control"
                    readonly
                >
              </div>

              <div class="form-group">
                <label>Total Shipping Weight</label>

                <input
                    :value="totalShippingWeight.toFixed(3)"
                    type="text"
                    class="form-control"
                    readonly
                >

                <small>
                  Total weight of all products based on quantity.
                </small>
              </div>

              <div class="form-group">
                <label>Courier Name</label>

                <input
                    v-model="form.delivery.courier_name"
                    type="text"
                    class="form-control"
                >
              </div>

              <div class="form-group">
                <label>Tracking Number</label>

                <input
                    v-model="form.delivery.tracking_number"
                    type="text"
                    class="form-control"
                >
              </div>

              <div class="form-group">
                <label>Expected Delivery Date</label>

                <input
                    v-model="form.delivery.expected_delivery_date"
                    type="date"
                    class="form-control"
                >
              </div>

            </div>

            <div class="form-group">
              <label>Delivery Notes</label>

              <textarea
                  v-model="form.delivery.notes"
                  class="form-control"
                  rows="3"
              ></textarea>
            </div>

          </template>

        </div>
      </section>

      <!-- Payment -->
      <section class="form-section">

        <div class="section-header">
          <h2>Payment</h2>

          <p>Record the payment received for this order.</p>
        </div>

        <div class="form-grid">

          <div class="form-group">

            <label for="payment_method">
              Payment Method
            </label>

            <select
                id="payment_method"
                v-model="form.payment.method"
                :disabled="saving"
            >
              <option value="">
                Select Payment Method
              </option>
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="koko">KOKO</option>
              <option value="mintpay">MintPay</option>
            </select>

          </div>

          <div class="form-group">

            <label for="payment_status">
              Payment Status
            </label>

            <select
                id="payment_status"
                v-model="form.payment.status"
                :disabled="saving"
            >
              <option value="unpaid">Unpaid</option>
              <option value="partially_paid">Partially Paid</option>
              <option value="paid">Paid</option>
            </select>

          </div>

          <div class="form-group">

            <label for="payment_amount">
              Amount Paid
            </label>

            <input
                id="payment_amount"
                v-model.number="form.payment.amount"
                type="number"
                min="0"
                step="0.01"
                :disabled="saving"
            />

          </div>

        </div>

      </section>

      <!-- Totals -->
      <section class="form-section totals-section">

        <div class="totals">

          <div class="total-row">
            <span>Subtotal</span>

            <strong>Rs. {{ formatAmount(subtotal) }}</strong>
          </div>

          <div class="form-group">

            <label for="discount">
              Order Discount
            </label>

            <div class="discount-field">

              <label class="checkbox-label">
                <input
                    v-model="form.discount_percentage_mode"
                    type="checkbox"
                    :disabled="saving"
                />

                %
              </label>

              <input
                  v-if="form.discount_percentage_mode"
                  id="discount"
                  v-model.number="form.discount_percentage"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  placeholder="Percentage"
                  :disabled="saving"
              />

              <input
                  v-else
                  id="discount"
                  v-model.number="form.discount_amount"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Amount"
                  :disabled="saving"
              />

            </div>

            <small v-if="form.discount_percentage_mode">
              Discount: Rs. {{ formatAmount(calculatedDiscountAmount) }}
            </small>

          </div>

          <div class="total-row">
            <span>Tax</span>

            <input
                v-model.number="form.tax_amount"
                type="number"
                min="0"
                step="0.01"
                :disabled="saving"
            />
          </div>

          <div class="total-row">
            <span>Shipping</span>

            <input
                v-model.number="form.shipping_amount"
                type="number"
                min="0"
                step="0.01"
                :disabled="saving"
            />
          </div>

          <div class="grand-total">
            <span>Total</span>

            <strong>Rs. {{ formatAmount(totalAmount) }}</strong>
          </div>

        </div>

      </section>

      <!-- Notes -->
      <section class="form-section">

        <div class="section-header">
          <h2>Notes</h2>

          <p>Add any additional information about this order.</p>
        </div>

        <div class="form-group">

          <label for="notes">
            Notes
          </label>

          <textarea
              id="notes"
              v-model="form.notes"
              rows="5"
              placeholder="Add any notes about this order..."
              :disabled="saving"
          ></textarea>

        </div>

      </section>

      <!-- Actions -->
      <div class="form-actions">

        <button
            type="button"
            class="btn-secondary"
            @click="goBack"
            :disabled="saving"
        >
          Cancel
        </button>

        <button
            type="submit"
            class="btn-primary"
            :disabled="saving"
        >
          {{ submitText }}
        </button>

      </div>

    </form>

  </div>
</template>

<style scoped>
.order-form-page {
  width: 100%;
  max-width: 1100px;
  margin: 0 auto;
  font-family: var(--font-family);
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

.order-form {
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

.section-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-lg);
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

.form-group {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.form-group.full-width {
  grid-column: span 2;
}

/* Vertical spacing between blocks inside a section (Delivery) */
.form-stack {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xl);
}

/* =========================
   Labels / Inputs
   ========================= */

.form-group label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

/* Required star */
.form-group label span {
  color: var(--color-danger);
}

.form-group input,
.form-group select,
.items-table input,
.total-row input {
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

.form-group select {
  cursor: pointer;
}

.form-group textarea {
  width: 100%;
  box-sizing: border-box;
  padding: var(--spacing-md) var(--spacing-lg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  color: var(--color-text-primary);
  font-family: inherit;
  font-size: var(--font-size-md);
  line-height: 1.5;
  resize: vertical;
  outline: none;
  transition: border-color var(--transition-fast),
  box-shadow var(--transition-fast);
}

.form-group input::placeholder,
.form-group textarea::placeholder,
.items-table input::placeholder,
.totals input::placeholder {
  color: var(--color-text-muted);
}

.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus,
.items-table input:focus,
.total-row input:focus,
.totals .discount-field input:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-light);
}

/* Read-only fields (order number, delivery charge, weight) */
.form-group input[readonly] {
  background: var(--color-hover-bg);
  color: var(--color-text-secondary);
  cursor: default;
}

.form-group input[readonly]:focus {
  border-color: var(--color-border);
  box-shadow: none;
}

.form-group input:disabled,
.form-group select:disabled,
.form-group textarea:disabled,
.items-table input:disabled,
.total-row input:disabled,
.totals .discount-field input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.form-group small {
  font-size: var(--font-size-xs);
  line-height: 1.5;
  color: var(--color-text-muted);
}

.text-muted {
  color: var(--color-text-muted);
}

/* =========================
   Checkbox (Delivery Required)
   ========================= */

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
}

/* Extra specificity so these beat ".form-group input" and
   ".form-group label span" (which would turn the text red) */
.form-group .checkbox-label input {
  width: 18px;
  height: 18px;
  padding: 0;
  cursor: pointer;
  accent-color: var(--color-primary);
  box-shadow: none;
}

.form-group .checkbox-label span {
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

/* =========================
   Discount Field  (% toggle + input)
   Used in item rows and the order totals
   ========================= */

.discount-field {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  min-width: 170px;
}

.discount-field input[type="number"] {
  flex: 1;
  min-width: 0;
}

/* The "%" toggle pill */
.discount-field .checkbox-label {
  position: relative;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0;
  min-width: 44px;
  height: 40px;
  padding: 0 var(--spacing-md);
  box-sizing: border-box;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  color: var(--color-text-secondary);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
  line-height: 1;
  user-select: none;
  cursor: pointer;
  transition: background var(--transition-fast),
  color var(--transition-fast),
  border-color var(--transition-fast),
  box-shadow var(--transition-fast);
}

/* Hide the native checkbox but keep it focusable and clickable */
.discount-field .checkbox-label input {
  position: absolute;
  width: 0;
  height: 0;
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
  opacity: 0;
  pointer-events: none;
}

.discount-field .checkbox-label:hover {
  background: var(--color-hover-bg);
  color: var(--color-text-primary);
}

/* ON state */
.discount-field .checkbox-label:has(input:checked) {
  border-color: var(--color-primary);
  background: var(--color-primary-light);
  color: var(--color-primary);
}

/* Keyboard focus */
.discount-field .checkbox-label:has(input:focus-visible) {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-light);
}

/* Disabled while saving */
.discount-field .checkbox-label:has(input:disabled) {
  opacity: 0.6;
  cursor: not-allowed;
}

/* =========================
   Selected Address Card
   ========================= */

.selected-address {
  padding: var(--spacing-lg);
  background: var(--color-hover-bg);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-lg);
}

.selected-address strong {
  display: block;
  margin-bottom: var(--spacing-sm);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--color-text-secondary);
}

.selected-address p {
  margin: 0;
  font-size: var(--font-size-sm);
  line-height: 1.6;
  color: var(--color-text-secondary);
}

.selected-address p:first-of-type {
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

/* =========================
   Items Table
   ========================= */

.items-table {
  overflow-x: auto;
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-lg);
}

.items-table table {
  width: 100%;
  border-collapse: collapse;
}

.items-table th {
  padding: var(--spacing-md) var(--spacing-lg);
  text-align: left;
  white-space: nowrap;
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--color-text-secondary);
  background: var(--color-hover-bg);
  border-bottom: 1px solid var(--color-border-light);
}

.items-table td {
  padding: var(--spacing-md) var(--spacing-lg);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  border-bottom: 1px solid var(--color-border-light);
  vertical-align: middle;
}

.items-table td strong {
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.items-table tbody tr:last-child td {
  border-bottom: none;
}

.items-table td input {
  min-width: 110px;
}

/* Inside the discount cell the input can be narrower */
.items-table td .discount-field input[type="number"] {
  min-width: 80px;
}

.cell-product {
  min-width: 240px;
}

.col-product {
  width: 35%;
}

.nowrap {
  white-space: nowrap;
}

.empty-items {
  padding: 40px var(--spacing-xl);
  text-align: center;
  color: var(--color-text-muted);
}

.empty-items strong {
  display: block;
  margin-bottom: var(--spacing-sm);
  font-size: var(--font-size-md);
  color: var(--color-text-primary);
}

.remove-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-text-secondary);
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
  transition: background var(--transition-fast),
  color var(--transition-fast),
  border-color var(--transition-fast);
}

.remove-button:hover:not(:disabled) {
  background: var(--color-danger-bg);
  border-color: var(--color-danger-light);
  color: var(--color-danger);
}

.remove-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* =========================
   Totals
   ========================= */

.totals-section {
  display: flex;
  justify-content: flex-end;
}

.totals {
  width: 420px;
  max-width: 100%;
}

.total-row {
  display: grid;
  grid-template-columns: 1fr 180px;
  align-items: center;
  gap: var(--spacing-lg);
  padding: var(--spacing-sm) 0;
}

.total-row span {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.total-row strong {
  text-align: right;
  color: var(--color-text-primary);
}

.total-row input {
  text-align: right;
}

/* Order Discount row: lines up with Subtotal / Tax / Shipping */
.totals > .form-group {
  display: grid;
  grid-template-columns: 1fr 180px;
  align-items: center;
  gap: var(--spacing-xs) var(--spacing-lg);
  padding: var(--spacing-sm) 0;
}

.totals > .form-group > label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-regular, 400);
  color: var(--color-text-secondary);
}

.totals > .form-group > .discount-field {
  min-width: 0;
}

.totals > .form-group > .discount-field input[type="number"] {
  text-align: right;
}

.totals > .form-group > small {
  grid-column: 2;
  text-align: right;
}

.grand-total {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: var(--spacing-md);
  padding-top: var(--spacing-lg);
  border-top: 1px solid var(--color-border-light);
  font-size: var(--font-size-lg, 18px);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.grand-total strong {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-bold);
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

.loading-message {
  padding: 50px var(--spacing-xl);
  text-align: center;
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
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

/* =========================
   Responsive
   ========================= */

@media (max-width: 768px) {
  .form-header,
  .section-header-row {
    flex-direction: column;
    align-items: flex-start;
  }

  .form-grid {
    grid-template-columns: 1fr;
  }

  .form-group.full-width {
    grid-column: span 1;
  }

  .form-section {
    padding: var(--spacing-xl);
  }

  .totals {
    width: 100%;
  }

  .total-row,
  .totals > .form-group {
    grid-template-columns: 1fr 150px;
  }

  .form-actions {
    flex-direction: column-reverse;
  }

  .btn-primary,
  .btn-secondary {
    width: 100%;
  }
}
</style>
