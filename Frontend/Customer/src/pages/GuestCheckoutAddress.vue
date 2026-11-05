<script setup>
import { reactive, ref, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '@/services/api'
import CheckoutAddressForm from '@/components/CheckoutAddressForm.vue'

const route = useRoute()
const router = useRouter()

const loading = ref(true)
const submitting = ref(false)
const error = ref('')
const districts = ref([])
const areas = ref([])
const session = ref(null)

const token = String(
  route.params.token || sessionStorage.getItem('guestCheckoutToken') || ''
)

const addressStorageKey = `southWestGuestCheckoutAddress:${token}`
const returnPathStorageKey = `southWestCheckoutReturn:${token}`
const buyNowReturnPath = sessionStorage.getItem(returnPathStorageKey) || ''

const details = reactive({
  recipient_name: '',
  customer_email: '',
  phone: '',
  address_line_1: '',
  address_line_2: '',
  city: '',
  state: '',
  postal_code: '',
  country: 'Sri Lanka',
  district_id: '',
  area_id: '',
})

function guestHeaders() {
  return {
    headers: {
      'x-guest-checkout-token': token,
    },
  }
}

function getData(response) {
  return response?.data?.data ?? response?.data ?? {}
}

async function loadAreas(districtId) {
  areas.value = []
  details.area_id = ''

  if (!districtId) return

  const response = await api.get('/delivery-areas', {
    params: { district_id: districtId },
  })

  const data = getData(response)

  areas.value = Array.isArray(data)
    ? data
    : Array.isArray(data?.areas)
      ? data.areas
      : []
}

watch(
  () => details.district_id,
  async (districtId, oldDistrictId) => {
    if (districtId === oldDistrictId) return

    details.area_id = ''

    try {
      await loadAreas(districtId)
    } catch (err) {
      error.value =
        err.response?.data?.message ||
        'Unable to load delivery areas.'
    }
  }
)

async function loadPage() {
  if (!/^[a-f0-9]{64}$/i.test(token)) {
    error.value = 'Your guest checkout session could not be identified. Please return to your cart.'
    loading.value = false
    return
  }

  try {
    const [sessionResponse, districtsResponse] = await Promise.all([
      api.get('/guest-checkout/session', guestHeaders()),
      api.get('/delivery-districts'),
    ])

    const data = getData(sessionResponse)

    session.value =
      data?.session ??
      data?.cart ??
      data?.guest_cart ??
      data

    const districtData = getData(districtsResponse)
    districts.value = Array.isArray(districtData) ? districtData : []

    if (!session.value) {
      throw new Error('Your guest checkout session could not be found.')
    }

    const savedAddress = sessionStorage.getItem(addressStorageKey)

    if (savedAddress) {
      try {
        const parsed = JSON.parse(savedAddress)

        Object.assign(details, {
          ...parsed,
          country: 'Sri Lanka',
        })

        if (details.district_id) {
          const response = await api.get('/delivery-areas', {
            params: { district_id: details.district_id },
          })

          const areaData = getData(response)
          areas.value = Array.isArray(areaData)
            ? areaData
            : Array.isArray(areaData?.areas)
              ? areaData.areas
              : []
        }
      } catch {
        sessionStorage.removeItem(addressStorageKey)
      }
    }
  } catch (err) {
    error.value =
      err.response?.data?.message ||
      err.message ||
      'Unable to load your delivery details. Please try again.'
  } finally {
    loading.value = false
  }
}

function continueToCheckout() {
  error.value = ''

  const requiredFields = [
    ['recipient_name', 'Please enter the recipient name.'],
    ['customer_email', 'Please enter your email address.'],
    ['phone', 'Please enter your phone number.'],
    ['address_line_1', 'Please enter your delivery address.'],
    ['district_id', 'Please select a district.'],
    ['area_id', 'Please select a delivery area.'],
    ['city', 'Please enter your city or town.'],
  ]

  for (const [field, message] of requiredFields) {
    if (!String(details[field] ?? '').trim()) {
      error.value = message
      return
    }
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(details.customer_email.trim())) {
    error.value = 'Please enter a valid email address.'
    return
  }

  if (!/^[a-f0-9]{64}$/i.test(token)) {
    error.value = 'Your guest checkout session is invalid. Please return to your cart.'
    return
  }

  submitting.value = true

  try {
    sessionStorage.setItem(
      addressStorageKey,
      JSON.stringify({
        ...details,
        country: 'Sri Lanka',
      })
    )

    router.push(`/checkout/${token}`)
  } catch {
    error.value = 'Unable to save your delivery details. Please try again.'
  } finally {
    submitting.value = false
  }
}

function backToCart() {
  if (buyNowReturnPath) {
    router.push(buyNowReturnPath)
    return
  }

  router.push('/cart')
}

onMounted(loadPage)
</script>

<template>
  <main class="guest-address-page">
    <header class="address-hero">
      <div class="address-container">
        <p class="eyebrow">SOUTH WEST STORE</p>
        <h1>Delivery details</h1>
        <p>Where should we deliver your order?</p>

        <ol class="address-steps">
          <li class="active"><span>1</span> Delivery details</li>
          <li><span>2</span> Checkout</li>
          <li><span>3</span> Confirmation</li>
        </ol>
      </div>
    </header>

    <div class="address-container address-body">
      <div v-if="loading" class="address-panel">
        Loading your checkout session...
      </div>

      <div v-else class="address-panel">
        <div v-if="error" class="address-error" role="alert">
          {{ error }}
        </div>

        <template v-if="session">
          <div class="panel-heading">
            <div>
              <h2>Contact and delivery address</h2>
              <p>Enter the details we need to deliver your order.</p>
            </div>
          </div>

          <CheckoutAddressForm
            mode="delivery"
            :details="details"
            :districts="districts"
            :areas="areas"
          />

          <div class="address-actions">
            <button
              type="button"
              class="secondary-button"
              @click="backToCart"
              :disabled="submitting"
            >
              {{ buyNowReturnPath ? 'Back to product' : 'Back to cart' }}
            </button>

            <button
              type="button"
              class="primary-button"
              @click="continueToCheckout"
              :disabled="submitting"
            >
              {{ submitting ? 'Continuing...' : 'Continue to Checkout' }}
            </button>
          </div>
        </template>

        <div v-else class="session-error">
          <h2>Checkout session unavailable</h2>
          <p>Your guest checkout session may have expired.</p>
          <button type="button" class="primary-button" @click="backToCart">
            {{ buyNowReturnPath ? 'Return to product' : 'Return to cart' }}
          </button>
        </div>
      </div>
    </div>
  </main>
</template>

<style scoped>
.guest-address-page {
  min-height: 100vh;
  min-height: 100dvh;
  padding-bottom: var(--space-16);
  background: var(--color-store-bg);
  color: var(--color-text);
}

.address-container {
  width: min(var(--container-store), 1120px, 94%);
  margin: 0 auto;
}

.address-hero {
  padding: var(--space-8) 0;
  background: var(--gradient-metal);
  color: var(--color-on-primary);
  box-shadow: inset 0 -1px 0 rgb(0 0 0 / 45%);
}

.eyebrow {
  margin: 0;
  color: var(--color-accent);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-bold);
  letter-spacing: 0.14em;
}

.address-hero h1 {
  margin: var(--space-2) 0;
  font-family: var(--font-family-display);
  font-size: clamp(26px, 4.5vw, 36px);
}

.address-hero p:not(.eyebrow) {
  margin-bottom: 0;
  color: rgb(255 255 255 / 75%);
  font-size: var(--font-size-sm);
}

.address-steps {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-6);
  margin: var(--space-6) 0 0;
  padding: 0;
  list-style: none;
  font-size: var(--font-size-xs);
}

.address-steps li {
  display: flex;
  align-items: center;
  gap: 8px;
  color: rgb(255 255 255 / 55%);
}

.address-steps li span {
  display: grid;
  place-items: center;
  width: 25px;
  height: 25px;
  border: 1px solid rgb(255 255 255 / 45%);
  border-radius: 50%;
}

.address-steps li.active {
  color: white;
  font-weight: var(--font-weight-semibold);
}

.address-steps li.active span {
  border-color: var(--color-accent);
  background: var(--color-accent);
  color: var(--color-black);
}

.address-body {
  padding-top: var(--space-6);
}

.address-panel {
  display: grid;
  gap: var(--space-6);
  min-width: 0;
  padding: var(--space-6);
  border: 1px solid var(--color-border-soft);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  box-shadow: var(--shadow-sm);
}

.panel-heading h2,
.session-error h2 {
  margin: 0;
  font-size: var(--font-size-lg);
}

.panel-heading p,
.session-error p {
  margin: 6px 0 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

.address-error {
  padding: 12px 14px;
  border: 1px solid var(--color-danger);
  border-radius: var(--radius-md);
  color: var(--color-danger);
  font-size: var(--font-size-sm);
}

.address-actions {
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--space-3);
  padding-top: var(--space-5);
  border-top: 1px solid var(--color-border-soft);
}

.primary-button,
.secondary-button {
  min-height: 44px;
  padding: 11px 18px;
  border-radius: var(--radius-md);
  font: inherit;
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
}

.primary-button {
  border: 1px solid var(--color-primary);
  background: var(--color-primary);
  color: var(--color-on-primary);
}

.secondary-button {
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text);
}

.primary-button:disabled,
.secondary-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

@media (max-width: 640px) {
  .address-panel {
    padding: var(--space-4);
  }

  .address-actions {
    flex-direction: column-reverse;
  }

  .address-actions button {
    width: 100%;
  }
}
</style>
