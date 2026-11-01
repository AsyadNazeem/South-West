<script setup>
import { getMediaUrl } from '../../utils/mediaUrl'
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import api from '../../services/api'

const router = useRouter()
const wishlist = ref([])
const loading = ref(true)
const errorMessage = ref('')
const removingIds = ref([])
const cartBusyIds = ref([])
const notice = ref('')
const noticeType = ref('success')

let noticeTimer = null

function getItem(entry) {
  return entry?.item ?? entry?.Item ?? null
}

function entryItemId(entry) {
  return getItem(entry)?.id ?? entry?.item_id
}

function entryName(entry) {
  return getItem(entry)?.item_name || 'Product'
}

function isUnavailable(entry) {
  return getItem(entry)?.is_active === false
}

function getProductUrl(item) {
  if (!item?.slug || !item?.public_id) return null

  return `/product/${encodeURIComponent(`${item.slug}-${item.public_id}`)}`
}


function getProductImage(item) {
  if (!item) return ''

  const images = Array.isArray(item.images)
    ? [...item.images].sort(
        (a, b) =>
          Number(b.is_primary) - Number(a.is_primary) ||
          Number(a.sort_order || 0) - Number(b.sort_order || 0)
      )
    : []

  const imageUrl =
    images.find(image => image.is_primary)?.url ||
    images[0]?.url ||
    images.find(image => image.is_primary)?.file_path ||
    images[0]?.file_path ||
    item.image_url ||
    item.image ||
    item.main_image ||
    item.thumbnail ||
    ''

  if (!imageUrl) return ''

  return getMediaUrl(imageUrl)
}

// Shown only when the API includes a price for the product.
function getPrice(item) {
  const value = Number(item?.price ?? item?.selling_price)

  return Number.isFinite(value) && value > 0 ? value : null
}

function formatPrice(value) {
  return `Rs. ${Number(value).toLocaleString('en-LK', { maximumFractionDigits: 0 })}`
}

function isRemoving(entry) {
  return removingIds.value.some(id => String(id) === String(entryItemId(entry)))
}

function isAddingToCart(entry) {
  return cartBusyIds.value.some(id => String(id) === String(entryItemId(entry)))
}

function showNotice(type, message) {
  noticeType.value = type
  notice.value = message

  clearTimeout(noticeTimer)
  noticeTimer = setTimeout(() => {
    notice.value = ''
  }, 4500)
}

async function loadWishlist() {
  loading.value = true
  errorMessage.value = ''

  try {
    const response = await api.get('/customer-wishlist')

    const body = response.data
    wishlist.value = Array.isArray(body?.data) ? body.data : []
  } catch (error) {
    errorMessage.value =
      error.response?.data?.message ||
      'Unable to load your wishlist. Please try again.'

    if (error.response?.status === 401) {
      sessionStorage.removeItem('customerToken')
      sessionStorage.removeItem('customerProfile')

      router.replace({
        path: '/login',
        query: { redirect: router.currentRoute.value.fullPath },
      })
    }
  } finally {
    loading.value = false
  }
}

async function removeFromWishlist(entry) {
  const itemId = getItem(entry)?.id ?? entry?.item_id

  if (!itemId || isRemoving(entry)) return

  removingIds.value = [...removingIds.value, itemId]
  errorMessage.value = ''

  try {
    await api.delete(
      `/customer-wishlist/items/${encodeURIComponent(itemId)}`
    )

    wishlist.value = wishlist.value.filter((wishlistEntry) => {
      const currentItemId =
        getItem(wishlistEntry)?.id ?? wishlistEntry?.item_id

      return String(currentItemId) !== String(itemId)
    })
  } catch (error) {
    errorMessage.value =
      error.response?.data?.message ||
      'Unable to remove this product from your wishlist.'
  } finally {
    removingIds.value = removingIds.value.filter(
      id => String(id) !== String(itemId)
    )
  }
}

function openProduct(item) {
  const url = getProductUrl(item)

  if (url) {
    router.push(url)
  }
}

async function loadActiveVariants(itemId) {
  const response = await api.get(`/store/products/${itemId}/variants`)
  const payload = response.data?.data ?? response.data

  return Array.isArray(payload)
    ? payload.filter(variant => variant.is_active !== false)
    : []
}

async function addToCart(entry) {
  const item = getItem(entry)
  const itemId = entryItemId(entry)

  if (!itemId || isUnavailable(entry) || isAddingToCart(entry)) return

  cartBusyIds.value = [...cartBusyIds.value, itemId]

  try {
    const variants = await loadActiveVariants(itemId)

    // Several options: the customer has to choose on the product page.
    if (variants.length > 1) {
      openProduct(item)
      return
    }

    const variant = variants[0]

    if (
      variant &&
      (variant.in_stock === false || Number(variant.available_quantity) <= 0)
    ) {
      showNotice('error', `${entryName(entry)} is currently out of stock.`)
      return
    }

    const payload = { item_id: itemId, quantity: 1 }
    if (variant) payload.variant_id = variant.id

    await api.post('/customer-cart/items', payload)

    showNotice('success', `${entryName(entry)} was added to your cart.`)
  } catch (error) {
    showNotice(
      'error',
      error.response?.data?.message ||
        'Unable to add this product to your cart. Please try again.'
    )
  } finally {
    cartBusyIds.value = cartBusyIds.value.filter(
      id => String(id) !== String(itemId)
    )
  }
}

onMounted(loadWishlist)

onBeforeUnmount(() => {
  clearTimeout(noticeTimer)
})
</script>


<template>
  <section class="wishlist-page">
    <div class="wishlist-heading">
      <div>
        <h2 class="section-title">
          Wishlist
          <span v-if="wishlist.length" class="count-pill">{{ wishlist.length }}</span>
        </h2>
        <p class="muted">Products you've saved for later.</p>
      </div>

      <button
        v-if="!loading && wishlist.length"
        type="button"
        class="refresh-button"
        :disabled="loading"
        @click="loadWishlist"
      >
        Refresh
      </button>
    </div>

    <p
      v-if="notice"
      class="message"
      :class="noticeType === 'success' ? 'success-text' : 'error-text'"
      :role="noticeType === 'success' ? 'status' : 'alert'"
    >
      {{ notice }}
      <RouterLink v-if="noticeType === 'success'" to="/cart" class="message-link">
        View cart
      </RouterLink>
    </p>

    <!-- Loading -->
    <div
      v-if="loading"
      class="wishlist-list"
      aria-busy="true"
      aria-label="Loading your wishlist"
    >
      <div v-for="n in 4" :key="n" class="wishlist-item skeleton" aria-hidden="true">
        <div class="skeleton-block image"></div>
        <div class="skeleton-body">
          <div class="skeleton-block"></div>
          <div class="skeleton-block short"></div>
          <div class="skeleton-block button"></div>
        </div>
      </div>
    </div>

    <div v-else-if="errorMessage" class="status-message error-message" role="alert">
      <p>{{ errorMessage }}</p>

      <button
        type="button"
        class="secondary-button"
        @click="loadWishlist"
      >
        Try again
      </button>
    </div>

    <div v-else-if="!wishlist.length" class="empty-state">
      <div class="empty-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none">
          <path
            d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2Z"
            stroke="currentColor"
            stroke-width="1.7"
            stroke-linejoin="round"
          />
        </svg>
      </div>

      <h3>Your wishlist is empty</h3>
      <p class="muted">
        Save products you're interested in and find them here later.
      </p>

      <RouterLink to="/" class="browse-button">
        Browse products
      </RouterLink>
    </div>

    <div v-else class="wishlist-list">
      <article
        v-for="entry in wishlist"
        :key="entry.id"
        class="wishlist-item"
        :class="{ unavailable: isUnavailable(entry) }"
      >
        <div class="product-media">
          <button
            v-if="getProductImage(getItem(entry))"
            type="button"
            class="product-image-button"
            :disabled="!getProductUrl(getItem(entry))"
            :aria-label="`View ${entryName(entry)}`"
            @click="openProduct(getItem(entry))"
          >
            <img
              :src="getProductImage(getItem(entry))"
              :alt="entryName(entry)"
              class="product-image"
              loading="lazy"
              decoding="async"
            >
          </button>

          <div
            v-else
            class="product-image-placeholder"
            aria-hidden="true"
          >
            <span>{{ entryName(entry).charAt(0).toUpperCase() }}</span>
          </div>

          <span v-if="isUnavailable(entry)" class="tag">Unavailable</span>

          <button
            type="button"
            class="remove-button"
            :disabled="isRemoving(entry)"
            :aria-label="`Remove ${entryName(entry)} from wishlist`"
            title="Remove from wishlist"
            @click="removeFromWishlist(entry)"
          >
            <span v-if="isRemoving(entry)" class="spinner" aria-hidden="true"></span>

            <svg v-else viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </button>
        </div>

        <div class="product-info">
          <div class="product-text">
          <RouterLink
            v-if="getProductUrl(getItem(entry))"
            :to="getProductUrl(getItem(entry))"
            class="product-name"
          >
            {{ entryName(entry) }}
          </RouterLink>

          <h3 v-else class="product-name">
            {{ entryName(entry) }}
          </h3>

          <p v-if="getItem(entry)?.item_code" class="muted product-code">
            {{ getItem(entry)?.item_code }}
          </p>

          <p v-if="getPrice(getItem(entry)) !== null" class="product-price">
            {{ formatPrice(getPrice(getItem(entry))) }}
          </p>
          </div>

          <button
            type="button"
            class="cart-button"
            :disabled="isUnavailable(entry) || isAddingToCart(entry)"
            @click="addToCart(entry)"
          >
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M3 4h2l2.1 10.1a2 2 0 0 0 2 1.6h8.7a2 2 0 0 0 2-1.6L21 8H6"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
              <circle cx="10" cy="20" r="1.4" fill="currentColor" />
              <circle cx="18" cy="20" r="1.4" fill="currentColor" />
            </svg>
            {{
              isUnavailable(entry)
                ? 'Unavailable'
                : isAddingToCart(entry)
                  ? 'Adding…'
                  : 'Add to cart'
            }}
          </button>
        </div>
      </article>
    </div>
  </section>
</template>

<style scoped>
.wishlist-page {
  width: 100%;
  min-width: 0;
  color: var(--color-text);
}

.wishlist-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
  margin-bottom: var(--space-5);
}

.section-title {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin: 0 0 6px;
  color: var(--color-primary);
  font-family: var(--font-family-display);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-bold);
}

.count-pill {
  min-width: 22px;
  padding: 1px 8px;
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--color-primary) 12%, var(--color-surface));
  color: var(--color-primary);
  font-family: inherit;
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  line-height: 1.6;
  text-align: center;
}

.muted {
  margin: 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

/* ---------- Messages and states ---------- */
.message {
  margin: 0 0 var(--space-4);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
}

.success-text {
  background: #e9f8f0;
  color: #176c49;
}

.error-text {
  border: 1px solid color-mix(in srgb, var(--color-danger) 30%, transparent);
  background: var(--color-danger-bg);
  color: var(--color-danger);
}

.message-link {
  margin-left: var(--space-2);
  color: inherit;
  font-weight: var(--font-weight-semibold);
  text-decoration: underline;
}

.status-message,
.empty-state {
  padding: var(--space-8) var(--space-4);
  text-align: center;
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface-muted);
}

.error-message {
  color: var(--color-danger);
}

.error-message p {
  margin: 0 0 var(--space-4);
}

.empty-icon {
  display: grid;
  place-items: center;
  width: 72px;
  height: 72px;
  margin: 0 auto var(--space-4);
  border-radius: 50%;
  background: color-mix(in srgb, var(--color-primary) 10%, var(--color-surface));
  color: var(--color-primary);
}

.empty-icon svg {
  width: 34px;
  height: 34px;
}

.empty-state h3 {
  margin: 0 0 var(--space-2);
  color: var(--color-text);
  font-family: var(--font-family-display);
  font-size: var(--font-size-md);
}

.empty-state p {
  margin-bottom: var(--space-5);
}

/* ---------- Product cards ---------- */
.wishlist-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
  gap: var(--space-5);
}

.wishlist-item {
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
  border: 1px solid var(--color-border-soft);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast), transform var(--transition-fast);
}

@media (hover: hover) {
  .wishlist-item:hover {
    border-color: var(--color-border);
    box-shadow: var(--shadow-md);
    transform: translateY(-2px);
  }

  .wishlist-item:hover .product-image {
    transform: scale(1.05);
  }
}

/* Image tile */
.product-media {
  position: relative;
  aspect-ratio: 1 / 1;
  background: var(--color-surface-muted);
}

.product-image-button,
.product-image-placeholder {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  width: 100%;
  height: 100%;
  padding: var(--space-4);
  overflow: hidden;
  border: 0;
  background: transparent;
}

.product-image-button {
  cursor: pointer;
}

.product-image-button:disabled {
  cursor: default;
}

.product-image {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  /* White product photos blend into the tile background */
  mix-blend-mode: multiply;
  transition: transform var(--transition-base);
}

.product-image-placeholder span {
  display: grid;
  place-items: center;
  width: 56px;
  height: 56px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-primary);
  font-family: var(--font-family-display);
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
}

.wishlist-item.unavailable .product-image {
  opacity: 0.5;
}

.tag {
  position: absolute;
  top: var(--space-2);
  left: var(--space-2);
  padding: 2px var(--space-2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-pill);
  background: var(--color-surface);
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  line-height: 1.4;
  pointer-events: none;
}

/* Remove: small circle, top right of the image */
.remove-button {
  position: absolute;
  top: var(--space-2);
  right: var(--space-2);
  z-index: 1;
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  padding: 0;
  border: 1px solid var(--color-border-soft);
  border-radius: 50%;
  background: var(--color-surface);
  color: var(--color-text-muted);
  box-shadow: var(--shadow-sm);
  cursor: pointer;
  transition: background var(--transition-fast), color var(--transition-fast), border-color var(--transition-fast);
}

.remove-button svg {
  width: 17px;
  height: 17px;
}

.remove-button:hover:not(:disabled) {
  border-color: var(--color-danger);
  background: var(--color-danger-bg);
  color: var(--color-danger);
}

.remove-button:disabled {
  cursor: wait;
  opacity: 0.7;
}

.spinner {
  width: 15px;
  height: 15px;
  border: 2px solid currentColor;
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* Info */
.product-info {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: var(--space-1);
  min-width: 0;
  padding: var(--space-3) var(--space-4) var(--space-4);
}

/* Text block grows, so the cart button sits at the bottom of every card */
.product-text {
  display: grid;
  flex: 1;
  align-content: start;
  gap: var(--space-1);
  min-width: 0;
  margin-bottom: var(--space-3);
}

.product-name {
  display: -webkit-box;
  margin: 0;
  overflow: hidden;
  overflow-wrap: anywhere;
  color: var(--color-text);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  line-height: 1.35;
  text-decoration: none;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  transition: color var(--transition-fast);
}

a.product-name:hover {
  color: var(--color-primary);
}

.product-code {
  font-size: var(--font-size-xs);
  overflow-wrap: anywhere;
}

.product-price {
  margin: var(--space-1) 0 0;
  color: var(--color-primary);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-bold);
}

/* ---------- Buttons ---------- */
.cart-button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  width: 100%;
  min-height: 40px;
  margin-top: auto;
  padding: 0 var(--space-3);
  border: 0;
  border-radius: var(--radius-md);
  background: var(--color-primary);
  color: var(--color-on-primary);
  cursor: pointer;
  font: inherit;
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-bold);
  transition: background var(--transition-fast);
}

.cart-button svg {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.cart-button:hover:not(:disabled) {
  background: var(--color-primary-hover);
}

.cart-button:disabled {
  background: var(--color-surface-muted);
  color: var(--color-text-muted);
  cursor: not-allowed;
}

.refresh-button,
.secondary-button {
  min-height: 40px;
  padding: 0 var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-text);
  cursor: pointer;
  font: inherit;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  transition: border-color var(--transition-fast), color var(--transition-fast);
}

.refresh-button:hover:not(:disabled),
.secondary-button:hover:not(:disabled) {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.refresh-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.browse-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  padding: 0 var(--space-6);
  border-radius: var(--radius-md);
  background: var(--color-primary);
  color: var(--color-on-primary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  text-decoration: none;
  transition: background var(--transition-fast);
}

.browse-button:hover {
  background: var(--color-primary-hover);
}

.product-image-button:focus-visible,
.product-name:focus-visible,
.remove-button:focus-visible,
.cart-button:focus-visible,
.refresh-button:focus-visible,
.secondary-button:focus-visible,
.browse-button:focus-visible,
.message-link:focus-visible {
  outline: 2px solid var(--color-focus-outline);
  outline-offset: 2px;
}

/* ---------- Loading skeleton ---------- */
.wishlist-item.skeleton {
  pointer-events: none;
}

.skeleton-body {
  display: grid;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4) var(--space-4);
}

.skeleton-block {
  height: 12px;
  border-radius: var(--radius-sm);
  background: var(--color-surface-muted);
  animation: pulse 1.4s ease-in-out infinite;
}

.skeleton-block.image {
  height: auto;
  aspect-ratio: 1 / 1;
  border-radius: 0;
}

.skeleton-block.short {
  width: 45%;
}

.skeleton-block.button {
  height: 40px;
  margin-top: var(--space-2);
  border-radius: var(--radius-md);
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.55;
  }
}

/* ---------- Touch devices ---------- */
@media (pointer: coarse) {
  .remove-button {
    width: 40px;
    height: 40px;
  }

  .cart-button,
  .refresh-button,
  .secondary-button {
    min-height: 44px;
  }
}

/* ---------- Phones: two compact columns ---------- */
@media (max-width: 560px) {
  .wishlist-list {
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: var(--space-3);
  }

  .product-image-button,
  .product-image-placeholder {
    padding: var(--space-3);
  }

  .product-info {
    padding: var(--space-2) var(--space-3) var(--space-3);
  }

  .product-price {
    font-size: var(--font-size-sm);
  }
}

/* ---------- Fold cover screens ---------- */
@media (max-width: 340px) {
  .wishlist-list {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (prefers-reduced-motion: reduce) {
  .wishlist-item,
  .product-image,
  .remove-button,
  .cart-button,
  .refresh-button,
  .secondary-button,
  .browse-button {
    transition: none;
  }

  .wishlist-item:hover {
    transform: none;
  }

  .skeleton-block {
    animation: none;
  }

  .spinner {
    animation-duration: 1.6s;
  }
}
</style>