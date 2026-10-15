
<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '../services/api'

const route = useRoute()
const router = useRouter()

const product = ref(null)
const loading = ref(true)
const error = ref('')
const selectedImage = ref(0)
const quantity = ref(1)
const addingToCart = ref(false)
const cartMessage = ref('')
const cartError = ref('')

const BACKEND_URL = (
    import.meta.env.VITE_API_URL || 'http://localhost:5001/api'
).replace(/\/api\/?$/, '')

const productName = computed(() =>
    product.value?.item_name ||
    product.value?.name ||
    product.value?.product_name ||
    'Product'
)

const images = computed(() => {
  if (!product.value) return []

  const gallery = Array.isArray(product.value.images)
      ? product.value.images
      : []

  const urls = gallery
      .map(image => typeof image === 'string' ? image : image?.url || image?.file_path)
      .filter(Boolean)

  const mainImage = product.value.image || product.value.image_url

  if (mainImage) urls.unshift(mainImage)

  return [...new Set(urls)].map(resolveImageUrl)
})

const currentImage = computed(() => images.value[selectedImage.value] || '')

const price = computed(() =>
    Number(product.value?.price ?? product.value?.selling_price ?? 0)
)

const comparePrice = computed(() =>
    Number(
        product.value?.compare_at_price ??
        product.value?.original_price ??
        product.value?.mrp ??
        0
    )
)

const discount = computed(() =>
    comparePrice.value > price.value && price.value > 0
        ? Math.round((1 - price.value / comparePrice.value) * 100)
        : 0
)

const availableQuantity = computed(() => {
  const value = product.value?.available_quantity
  return Number.isFinite(Number(value)) && value != null
      ? Math.max(0, Number(value))
      : 0
})

const inStock = computed(() =>
    product.value?.in_stock === true && availableQuantity.value > 0
)

const rating = computed(() => {
  const value = product.value?.rating
  return value == null || value === '' ? null : Number(value)
})

const reviewCount = computed(() => Number(product.value?.review_count || 0))

const specifications = computed(() => {
  const values = product.value?.specifications
  if (Array.isArray(values)) return values

  return []
})

function resolveImageUrl(value) {
  if (!value) return ''
  if (/^https?:\/\//i.test(value)) return value
  return `${BACKEND_URL}/${String(value).replace(/^\/+/, '')}`
}

function formatPrice(value) {
  return `Rs. ${Number(value).toLocaleString('en-LK', {
    maximumFractionDigits: 2,
  })}`
}

function selectImage(index) {
  selectedImage.value = index
}

function decreaseQuantity() {
  quantity.value = Math.max(1, quantity.value - 1)
}

function increaseQuantity() {
  if (quantity.value < availableQuantity.value) {
    quantity.value++
  }
}

async function loadProduct() {
  loading.value = true
  error.value = ''
  cartMessage.value = ''
  cartError.value = ''
  product.value = null
  selectedImage.value = 0
  quantity.value = 1

  try {
    const response = await api.get('/store/products')
    const payload = response.data

    const list = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.products)
            ? payload.products
            : Array.isArray(payload?.data?.products)
                ? payload.data.products
                : Array.isArray(payload?.data)
                    ? payload.data
                    : null

    if (!list) {
      throw new Error('Unexpected product response from the server.')
    }

    const found = list.find(
        item => String(item.id) === String(route.params.id)
    )

    if (!found) {
      error.value = 'This product could not be found or is no longer available.'
      return
    }

    product.value = found
  } catch (err) {
    error.value =
        err.response?.data?.message ||
        err.message ||
        'Unable to load this product. Please try again.'
  } finally {
    loading.value = false
  }
}

async function addToCart() {
  cartMessage.value = ''
  cartError.value = ''

  if (!sessionStorage.getItem('customerToken')) {
    router.push({
      path: '/login',
      query: { redirect: route.fullPath },
    })
    return
  }

  if (!inStock.value) {
    cartError.value = 'This product is currently out of stock.'
    return
  }

  addingToCart.value = true

  try {
    await api.post('/customer-cart/items', {
      item_id: product.value.id,
      quantity: quantity.value,
    })

    cartMessage.value = `${productName.value} added to your cart.`
  } catch (err) {
    cartError.value =
        err.response?.data?.message ||
        'Unable to add this product to your cart. Please try again.'
  } finally {
    addingToCart.value = false
  }
}

function buyNow() {
  if (!sessionStorage.getItem('customerToken')) {
    router.push({
      path: '/login',
      query: { redirect: route.fullPath },
    })
    return
  }

  cartError.value = 'Add this product to your cart first, then continue to checkout.'
}

watch(() => route.params.id, loadProduct)
onMounted(loadProduct)
</script>

<template>
  <main class="product-page">
    <div class="breadcrumbs">
      <RouterLink to="/">Home</RouterLink>
      <span>/</span>
      <span>Shop</span>
      <span>/</span>
      <span>{{ productName }}</span>
    </div>

    <div v-if="loading" class="state-message">
      Loading product details...
    </div>

    <div v-else-if="error" class="state-message error">
      <p>{{ error }}</p>
      <button type="button" @click="loadProduct">Try again</button>
      <RouterLink to="/">Back to shop</RouterLink>
    </div>

    <template v-else-if="product">
      <section class="product-layout">
        <div class="gallery">
          <div class="main-image">
            <img
                v-if="currentImage"
                :src="currentImage"
                :alt="productName"
            />
            <div v-else class="image-placeholder">
              <span>SW</span>
              <p>Product image unavailable</p>
            </div>

            <span v-if="discount" class="discount-badge">
                            -{{ discount }}%
                        </span>
          </div>

          <div v-if="images.length > 1" class="thumbnails">
            <button
                v-for="(image, index) in images"
                :key="`${image}-${index}`"
                type="button"
                class="thumbnail"
                :class="{ selected: selectedImage === index }"
                :aria-label="`View image ${index + 1}`"
                @click="selectImage(index)"
            >
              <img :src="image" :alt="`${productName} ${index + 1}`" />
            </button>
          </div>
        </div>

        <div class="product-info">
          <p class="eyebrow">
            {{ product.brand || 'South West' }}
          </p>

          <h1>{{ productName }}</h1>

          <div class="rating-row">
                        <span class="stars">
                            {{ rating == null ? '☆☆☆☆☆' : '★'.repeat(Math.max(0, Math.min(5, Math.round(rating)))) + '☆'.repeat(5 - Math.max(0, Math.min(5, Math.round(rating)))) }}
                        </span>
            <span v-if="rating != null">
                            {{ rating.toFixed(1) }} / 5
                        </span>
            <span v-else>No ratings yet</span>
            <span>({{ reviewCount }} reviews)</span>
          </div>

          <p v-if="product.item_code" class="item-code">
            Product code: {{ product.item_code }}
          </p>

          <div class="price-block">
            <strong>{{ formatPrice(price) }}</strong>
            <s v-if="discount">{{ formatPrice(comparePrice) }}</s>
            <span v-if="discount" class="discount-text">
                            Save {{ discount }}%
                        </span>
          </div>

          <p class="tax-note">Price shown in Sri Lankan Rupees (LKR).</p>

          <div class="feature-list">
            <div>
              <span>Brand</span>
              <strong>{{ product.brand || 'Not specified' }}</strong>
            </div>
            <div>
              <span>Warranty</span>
              <strong>{{ product.warranty || 'Check with seller' }}</strong>
            </div>
            <div>
              <span>Colour</span>
              <strong>{{ product.color || 'Not specified' }}</strong>
            </div>
            <div>
              <span>Condition</span>
              <strong>{{ product.condition || 'Not specified' }}</strong>
            </div>
          </div>

          <div class="stock-line" :class="{ unavailable: !inStock }">
            <span class="stock-dot"></span>
            {{ inStock ? `${availableQuantity} available online` : 'Currently unavailable' }}
          </div>

          <div class="purchase-row">
            <span class="quantity-label">Quantity</span>

            <div class="quantity-control">
              <button
                  type="button"
                  aria-label="Decrease quantity"
                  :disabled="quantity <= 1"
                  @click="decreaseQuantity"
              >−</button>
              <span>{{ quantity }}</span>
              <button
                  type="button"
                  aria-label="Increase quantity"
                  :disabled="!inStock || quantity >= availableQuantity"
                  @click="increaseQuantity"
              >+</button>
            </div>
          </div>

          <p v-if="cartMessage" class="feedback success">
            {{ cartMessage }}
          </p>
          <p v-if="cartError" class="feedback error">
            {{ cartError }}
          </p>

          <div class="action-buttons">
            <button
                type="button"
                class="buy-button"
                :disabled="!inStock"
                @click="buyNow"
            >
              Buy Now
            </button>
            <button
                type="button"
                class="cart-button"
                :disabled="!inStock || addingToCart"
                @click="addToCart"
            >
              {{ addingToCart ? 'Adding...' : 'Add to Cart' }}
            </button>
          </div>

          <div class="trust-note">
            <span><icon name="shield-check" size="18" /> Secure ordering</span>
            <span><icon name="package-check" size="18" /> Stock checked at checkout</span>
          </div>
        </div>

        <aside class="delivery-panel">
          <section>
            <h2><icon name="truck" size="19" /> Delivery options</h2>
            <p>Delivery availability and charges are confirmed during checkout.</p>
          </section>

          <section>
            <h2><icon name="shield-check" size="19" /> Returns & warranty</h2>
            <p>{{ product.warranty || 'Warranty details available from the seller.' }}</p>
            <p>Please review the applicable return policy before ordering.</p>
          </section>

          <section>
            <h2><icon name="package" size="19" /> Availability</h2>
            <p>{{ inStock ? 'Available from online inventory.' : 'Currently out of stock.' }}</p>
          </section>
        </aside>
      </section>

      <section class="details-section">
        <h2>Product details</h2>
        <p v-if="product.description">
          {{ product.description }}
        </p>
        <p v-else class="muted">
          No product description is available yet.
        </p>

        <h3>Specifications</h3>
        <div v-if="specifications.length" class="spec-table">
          <div
              v-for="(spec, index) in specifications"
              :key="spec.id ?? index"
              class="spec-row"
          >
            <span>{{ spec.name || spec.specification?.name || 'Specification' }}</span>
            <strong>{{ spec.value }}</strong>
          </div>
        </div>
        <div v-else class="spec-table">
          <div class="spec-row">
            <span>Brand</span>
            <strong>{{ product.brand || 'Not specified' }}</strong>
          </div>
          <div class="spec-row">
            <span>Category</span>
            <strong>{{ product.category || 'Not specified' }}</strong>
          </div>
          <div class="spec-row">
            <span>Warranty</span>
            <strong>{{ product.warranty || 'Not specified' }}</strong>
          </div>
          <div class="spec-row">
            <span>Condition</span>
            <strong>{{ product.condition || 'Not specified' }}</strong>
          </div>
        </div>

        <h3>Customer reviews</h3>
        <p class="muted">
          {{ reviewCount ? `${reviewCount} approved reviews for this product.` : 'No customer reviews yet. Be the first to share your experience after purchasing.' }}
        </p>
      </section>
    </template>
  </main>
</template>

<style scoped>
.product-page {
  min-height: 100vh;
  padding: 28px 0 64px;
  background: var(--color-store-bg, #f3f5f8);
  color: var(--color-text, #172033);
}

.breadcrumbs,
.product-layout,
.details-section,
.state-message {
  width: min(1280px, 94%);
  margin-inline: auto;
}

.breadcrumbs {
  display: flex;
  flex-wrap: wrap;
  gap: 9px;
  margin-bottom: 20px;
  color: var(--color-text-muted, #697386);
  font-size: 13px;
}

.breadcrumbs a {
  color: inherit;
  text-decoration: none;
}

.breadcrumbs a:hover {
  color: var(--color-primary, #1f4a8a);
}

.product-layout {
  display: grid;
  grid-template-columns: minmax(250px, 0.9fr) minmax(320px, 1.2fr) minmax(220px, 0.7fr);
  align-items: start;
  gap: 24px;
  padding: 24px;
  background: var(--color-surface, #fff);
  border: 1px solid var(--color-border-soft, #e5e9f0);
  border-radius: 12px;
}

.gallery {
  min-width: 0;
}

.main-image {
  position: relative;
  display: grid;
  place-items: center;
  aspect-ratio: 1 / 1;
  overflow: hidden;
  border-radius: 8px;
  background: #fff;
}

.main-image > img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  padding: 12px;
}

.image-placeholder {
  display: grid;
  place-items: center;
  align-content: center;
  gap: 8px;
  color: #8490a3;
}

.image-placeholder span {
  font-size: 52px;
  font-weight: 800;
}

.image-placeholder p {
  font-size: 12px;
}

.discount-badge {
  position: absolute;
  top: 12px;
  left: 12px;
  padding: 5px 9px;
  border-radius: 5px;
  background: #dc3e36;
  color: #fff;
  font-size: 12px;
  font-weight: 700;
}

.thumbnails {
  display: flex;
  flex-wrap: wrap;
  gap: 9px;
  margin-top: 14px;
}

.thumbnail {
  width: 60px;
  height: 60px;
  padding: 4px;
  overflow: hidden;
  border: 1px solid var(--color-border-soft, #e0e5ed);
  border-radius: 6px;
  background: #fff;
  cursor: pointer;
}

.thumbnail.selected {
  border: 2px solid var(--color-primary, #1f4a8a);
}

.thumbnail img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.product-info {
  min-width: 0;
}

.eyebrow {
  margin: 0 0 8px;
  color: var(--color-primary, #1f4a8a);
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.product-info h1 {
  margin: 0 0 14px;
  font-size: clamp(23px, 2.5vw, 31px);
  line-height: 1.3;
  overflow-wrap: anywhere;
}

.rating-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 18px;
  color: var(--color-text-muted, #687386);
  font-size: 12px;
}

.stars {
  color: #e6a23c;
  letter-spacing: 1px;
}

.item-code,
.tax-note {
  color: var(--color-text-muted, #687386);
  font-size: 12px;
}

.price-block {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 10px;
  padding: 20px 0 8px;
  border-top: 1px solid var(--color-border-soft, #e5e9f0);
}

.price-block > strong {
  color: var(--color-accent-deep, #e96826);
  font-size: clamp(27px, 3vw, 36px);
  font-weight: 700;
}

.price-block s {
  color: var(--color-text-muted, #8790a0);
  font-size: 14px;
}

.discount-text {
  color: #16845b;
  font-size: 13px;
  font-weight: 700;
}

.tax-note {
  margin-top: 0;
}

.feature-list {
  display: grid;
  gap: 0;
  margin: 20px 0;
  border-top: 1px solid var(--color-border-soft, #e5e9f0);
}

.feature-list > div {
  display: grid;
  grid-template-columns: minmax(85px, 0.7fr) minmax(0, 1fr);
  gap: 12px;
  padding: 11px 0;
  border-bottom: 1px solid var(--color-border-soft, #e5e9f0);
  font-size: 13px;
}

.feature-list span {
  color: var(--color-text-muted, #687386);
}

.feature-list strong {
  overflow-wrap: anywhere;
  font-weight: 600;
}

.stock-line {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #16845b;
  font-size: 13px;
  font-weight: 600;
}

.stock-line.unavailable {
  color: #c23b3b;
}

.stock-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentColor;
}

.purchase-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 18px;
  margin-top: 22px;
}

.quantity-label {
  color: var(--color-text-muted, #687386);
  font-size: 13px;
}

.quantity-control {
  display: flex;
  align-items: center;
  border: 1px solid var(--color-border-soft, #e0e5ed);
  border-radius: 6px;
}

.quantity-control button {
  width: 38px;
  height: 38px;
  border: 0;
  background: var(--color-surface-muted, #f4f6f9);
  color: var(--color-text, #172033);
  font-size: 20px;
  cursor: pointer;
}

.quantity-control button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.quantity-control span {
  min-width: 42px;
  text-align: center;
  font-size: 14px;
}

.action-buttons {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-top: 20px;
}

.action-buttons button {
  min-height: 46px;
  padding: 10px;
  border: 0;
  border-radius: 6px;
  font: inherit;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
}

.action-buttons button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.buy-button {
  background: var(--color-primary, #1f4a8a);
  color: #fff;
}

.cart-button {
  background: var(--color-accent-deep, #ed6b25);
  color: #fff;
}

.feedback {
  margin: 12px 0 0;
  padding: 10px;
  border-radius: 6px;
  font-size: 13px;
}

.feedback.success {
  background: #e9f8f0;
  color: #176c49;
}

.feedback.error,
.state-message.error {
  color: #b42318;
}

.trust-note {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 18px;
  color: var(--color-text-muted, #687386);
  font-size: 11px;
}

.trust-note span {
  display: flex;
  align-items: center;
  gap: 5px;
}

.delivery-panel {
  min-width: 0;
  border: 1px solid var(--color-border-soft, #e5e9f0);
  border-radius: 8px;
  background: var(--color-surface-muted, #f8f9fb);
}

.delivery-panel section {
  padding: 17px;
  border-bottom: 1px solid var(--color-border-soft, #e5e9f0);
}

.delivery-panel section:last-child {
  border-bottom: 0;
}

.delivery-panel h2 {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 12px;
  font-size: 14px;
}

.delivery-panel p {
  margin: 8px 0 0;
  color: var(--color-text-muted, #687386);
  font-size: 12px;
  line-height: 1.6;
}

.details-section {
  margin-top: 22px;
  padding: 28px;
  border: 1px solid var(--color-border-soft, #e5e9f0);
  border-radius: 12px;
  background: var(--color-surface, #fff);
}

.details-section h2 {
  margin: 0 0 18px;
  font-size: 22px;
}

.details-section h3 {
  margin: 28px 0 14px;
  font-size: 17px;
}

.details-section > p {
  line-height: 1.8;
  white-space: pre-line;
}

.muted {
  color: var(--color-text-muted, #687386);
  font-size: 13px;
}

.spec-table {
  border: 1px solid var(--color-border-soft, #e5e9f0);
  border-radius: 8px;
  overflow: hidden;
}

.spec-row {
  display: grid;
  grid-template-columns: minmax(120px, 0.7fr) minmax(0, 1fr);
  gap: 16px;
  padding: 13px 16px;
  border-bottom: 1px solid var(--color-border-soft, #e5e9f0);
  font-size: 13px;
}

.spec-row:last-child {
  border-bottom: 0;
}

.spec-row:nth-child(odd) {
  background: var(--color-surface-muted, #f8f9fb);
}

.spec-row span {
  color: var(--color-text-muted, #687386);
}

.spec-row strong {
  overflow-wrap: anywhere;
}

.state-message {
  padding: 50px 20px;
  text-align: center;
  background: var(--color-surface, #fff);
  border-radius: 10px;
}

.state-message button,
.state-message a {
  margin: 8px;
}

@media (max-width: 1050px) {
  .product-layout {
    grid-template-columns: minmax(220px, 0.8fr) minmax(280px, 1.2fr);
  }

  .delivery-panel {
    grid-column: 1 / -1;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .delivery-panel section {
    border-right: 1px solid var(--color-border-soft, #e5e9f0);
    border-bottom: 0;
  }

  .delivery-panel section:last-child {
    border-right: 0;
  }
}

@media (max-width: 650px) {
  .product-page {
    padding-top: 18px;
  }

  .product-layout {
    grid-template-columns: minmax(0, 1fr);
    gap: 20px;
    padding: 16px;
  }

  .main-image {
    max-height: 380px;
  }

  .delivery-panel {
    grid-column: auto;
    grid-template-columns: minmax(0, 1fr);
  }

  .delivery-panel section {
    border-right: 0;
    border-bottom: 1px solid var(--color-border-soft, #e5e9f0);
  }

  .details-section {
    padding: 18px;
  }

  .action-buttons {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
