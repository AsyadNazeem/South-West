<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import api from '@/services/api'
import {
  getMediaUrl,
  getResponsiveImageSrcSet,
  getResponsiveImageUrl,
} from '@/utils/mediaUrl'

const props = defineProps({
  product: { type: Object, required: true },
  layout: { type: String, default: 'grid' },
})

const router = useRouter()
const route = useRoute()

const name = computed(() =>
    props.product.item_name ||
    props.product.name ||
    props.product.product_name ||
    'Unnamed product',
)

const price = computed(() => Number(props.product.price ?? props.product.selling_price) || 0)

const comparePrice = computed(() =>
    Number(props.product.compare_at_price ?? props.product.original_price ?? props.product.mrp) || 0,
)

const hasDiscount = computed(() => comparePrice.value > price.value && price.value > 0)

const discountPercent = computed(() =>
    hasDiscount.value ? Math.round((1 - price.value / comparePrice.value) * 100) : 0,
)

const image = computed(() => {
  const product = props.product
  const directValue = product.image || product.image_url || product.thumbnail || ''
  const gallery = Array.isArray(product.images) ? product.images : []
  const directUrl = getResponsiveImageUrl(directValue)
  const matchingImage = directUrl
    ? gallery.find(candidate => getResponsiveImageUrl(candidate) === directUrl)
    : null
  const primaryImage = gallery.find(candidate => candidate?.is_primary) || gallery[0]
  const source = directValue && typeof directValue === 'object'
    ? { ...(matchingImage || primaryImage || {}), ...directValue }
    : matchingImage || directValue || primaryImage

  return {
    src: getResponsiveImageUrl(source) || directUrl,
    srcset: getResponsiveImageSrcSet(source?.responsive_images),
  }
})

const imageSizes = computed(() => props.layout === 'list'
  ? '(max-width: 340px) 92px, (max-width: 560px) 104px, 150px'
  : '(max-width: 310px) 100vw, (max-width: 600px) 50vw, (max-width: 860px) 33vw, 20vw'
)

const campaignVisual = computed(() => {
  const visual = props.product.campaign_visual

  if (!visual || !visual.frame_url) return null

  return visual
})

const campaignFrameUrl = computed(() => {
  const value = campaignVisual.value?.frame_url

  if (!value) return ''

  return getMediaUrl(value)
})

const rating = computed(() => Number(props.product.rating) || 0)
const roundedRating = computed(() => Math.round(rating.value))

const inStock = computed(() =>
    props.product.in_stock !== false && Number(props.product.stock_quantity ?? 1) > 0,
)

const link = computed(() => {
  const slug = props.product.slug
  const publicId = props.product.public_id

  if (!slug || !publicId) return '/'

  return `/product/${slug}-${publicId}`
})

function formatPrice(value) {
  return `Rs. ${Number(value).toLocaleString('en-LK', { maximumFractionDigits: 0 })}`
}

// --------------------------------------------------
// Quick actions: wishlist and add to cart
// --------------------------------------------------

// Wishlist API. Adjust these two calls to match your backend routes.
const wishlistApi = {
  add: () => api.post('/customer-wishlist/items', { item_id: props.product.id }),
  remove: () => api.delete(`/customer-wishlist/items/${encodeURIComponent(props.product.id)}`),
}

const wishlistBusy = ref(false)
const cartState = ref('idle') // 'idle' | 'loading' | 'added'
const toast = ref('')

const wishlisted = ref(
  Boolean(props.product.is_wishlisted ?? props.product.in_wishlist)
)

function getWishlistItemId(entry) {
  return entry?.item?.id ??
    entry?.Item?.id ??
    entry?.item_id ??
    null
}

async function loadWishlistStatus() {
  if (!sessionStorage.getItem('customerToken')) {
    wishlisted.value = false
    return
  }

  try {
    const response = await api.get('/customer-wishlist')
    const entries = Array.isArray(response.data?.data)
      ? response.data.data
      : []

    wishlisted.value = entries.some(
      entry => String(getWishlistItemId(entry)) === String(props.product.id)
    )
  } catch (error) {
    // Keep the current state if the wishlist request fails.
    console.error('Unable to load wishlist status:', error)
  }
}

function handleWishlistSync(event) {
  if (String(event.detail?.itemId) !== String(props.product.id)) return

  wishlisted.value = event.detail.wishlisted
}

let toastTimer = null
let cartTimer = null

function showToast(message) {
  toast.value = message

  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    toast.value = ''
  }, 2200)
}

// Sends guests to the login page and brings them back afterwards.
function requireLogin() {
  if (sessionStorage.getItem('customerToken')) return true

  router.push({
    path: '/login',
    query: { redirect: route.fullPath },
  })

  return false
}

async function handleWishlist() {
  if (wishlistBusy.value || !requireLogin()) return

  const next = !wishlisted.value

  // Update the heart straight away, then undo if the request fails.
  wishlisted.value = next
  wishlistBusy.value = true

  try {
    if (next) {
      await wishlistApi.add()
    } else {
      await wishlistApi.remove()
    }

    window.dispatchEvent(
      new CustomEvent('customer-wishlist-updated', {
        detail: {
          itemId: props.product.id,
          wishlisted: next,
        },
      })
    )

    showToast(next ? 'Saved to wishlist' : 'Removed from wishlist')
  } catch (err) {
    wishlisted.value = !next
    showToast(err.response?.data?.message || 'Could not update wishlist')
  } finally {
    wishlistBusy.value = false
  }
}

async function loadActiveVariants() {
  const response = await api.get(`/store/products/${props.product.id}/variants`)
  const payload = response.data?.data ?? response.data

  return Array.isArray(payload)
    ? payload.filter(variant => variant.is_active !== false)
    : []
}

async function handleAddToCart() {
  if (!inStock.value || cartState.value === 'loading') return

  cartState.value = 'loading'

  try {
    const variants = await loadActiveVariants()

    if (variants.length > 1) {
      cartState.value = 'idle'
      router.push(link.value)
      return
    }

    const variant = variants[0]

    if (
      variant &&
      (variant.in_stock === false || Number(variant.available_quantity) <= 0)
    ) {
      cartState.value = 'idle'
      showToast('Out of stock')
      return
    }

    const payload = {
      item_id: props.product.id,
      quantity: 1
    }

    if (variant) {
      payload.variant_id = variant.id
    }

    const customerToken = sessionStorage.getItem('customerToken')

    if (customerToken) {
      await api.post('/customer-cart/items', payload)
    } else {
      let guestToken = sessionStorage.getItem('guestCheckoutToken')

      if (guestToken) {
        await api.post('/guest-checkout/session/items', payload, {
          headers: {
            'x-guest-checkout-token': guestToken
          }
        })
      } else {
        const response = await api.post('/guest-checkout/session', payload)

        guestToken = response?.data?.token

        if (!/^[a-f0-9]{64}$/i.test(guestToken || '')) {
          throw new Error('Unable to create your guest cart.')
        }

        sessionStorage.setItem('guestCheckoutToken', guestToken)
      }
    }

    cartState.value = 'added'
    showToast('Added to cart')

    clearTimeout(cartTimer)

    cartTimer = setTimeout(() => {
      cartState.value = 'idle'
    }, 1800)
  } catch (err) {
    cartState.value = 'idle'
    showToast(err.response?.data?.message || 'Could not add to cart')
  }
}

onMounted(() => {
  window.addEventListener('customer-wishlist-updated', handleWishlistSync)
  loadWishlistStatus()
})

onBeforeUnmount(() => {
  clearTimeout(toastTimer)
  clearTimeout(cartTimer)

  window.removeEventListener('customer-wishlist-updated', handleWishlistSync)
})
</script>

<template>
  <li class="product-card" :class="{ 'is-out': !inStock, 'is-list': layout === 'list' }">
    <div class="image-wrap">
      <RouterLink :to="link" class="image-link" :aria-label="`View ${name}`">
        <img
          v-if="image.src"
          :src="image.src"
          :srcset="image.srcset || undefined"
          :sizes="imageSizes"
          alt=""
          loading="lazy"
          decoding="async"
        />

        <span v-else class="image-fallback">
          {{ name.charAt(0).toUpperCase() }}
        </span>
      </RouterLink>

      <div
        v-if="campaignVisual && campaignFrameUrl"
        class="campaign-frame"
        aria-hidden="true"
      >
        <img
          :src="campaignFrameUrl"
          alt=""
          loading="lazy"
          decoding="async"
        />
      </div>

      <span v-if="discountPercent" class="tag discount">-{{ discountPercent }}%</span>
      <span v-if="!inStock" class="tag out">Out of stock</span>

      <Transition name="toast">
        <span v-if="toast" class="action-toast" role="status">{{ toast }}</span>
      </Transition>

      <!-- Two circle buttons, bottom right of the image -->
      <div class="product-actions">
        <button
          type="button"
          class="product-action-btn wishlist-btn"
          :class="{ active: wishlisted }"
          :aria-pressed="wishlisted"
          :disabled="wishlistBusy"
          :aria-label="wishlisted ? 'Remove from wishlist' : 'Add to wishlist'"
          :title="wishlisted ? 'Remove from wishlist' : 'Add to wishlist'"
          @click.stop.prevent="handleWishlist"
        >
          <svg
            viewBox="0 0 24 24"
            :fill="wishlisted ? 'currentColor' : 'none'"
            aria-hidden="true"
          >
            <path
              d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2Z"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linejoin="round"
            />
          </svg>
        </button>

        <button
          type="button"
          class="product-action-btn cart-btn"
          :class="{ added: cartState === 'added' }"
          :disabled="!inStock || cartState === 'loading'"
          :aria-label="cartState === 'added' ? 'Added to cart' : 'Add to cart'"
          :title="inStock ? 'Add to cart' : 'Out of stock'"
          @click.stop.prevent="handleAddToCart"
        >
          <span v-if="cartState === 'loading'" class="spinner" aria-hidden="true"></span>

          <svg v-else-if="cartState === 'added'" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="m5 12.5 4.5 4.5L19 7.5"
              stroke="currentColor"
              stroke-width="2.2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>

          <svg v-else viewBox="0 0 24 24" fill="none" aria-hidden="true">
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
        </button>
      </div>
    </div>

    <RouterLink :to="link" class="card-link">
      <div class="body">
        <p v-if="product.brand" class="brand">{{ product.brand }}</p>
        <h3 class="name">{{ name }}</h3>

        <p v-if="rating" class="rating" :aria-label="`Rated ${rating.toFixed(1)} out of 5`">
          <span class="stars" aria-hidden="true">
            {{ '★'.repeat(roundedRating) }}{{ '☆'.repeat(5 - roundedRating) }}
          </span>
          <span class="rating-value">{{ rating.toFixed(1) }}</span>
        </p>

        <div class="price-row">
          <span class="price">{{ formatPrice(price) }}</span>
          <s v-if="hasDiscount" class="old-price">{{ formatPrice(comparePrice) }}</s>
        </div>
      </div>
    </RouterLink>
  </li>
</template>

<style scoped>
.product-card {
  position: relative;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--color-border-soft);
  border-radius: 14px;
  background: var(--color-surface);
  transition:
    border-color var(--transition-fast),
    box-shadow var(--transition-fast),
    transform var(--transition-fast);
}

/* Hover effects only on devices that can hover, so touch screens do not get a stuck hover state */
@media (hover: hover) {
  .product-card:hover {
    border-color: var(--color-border);
    box-shadow: 0 10px 28px rgb(0 0 0 / 9%);
    transform: translateY(-2px);
  }

  .product-card:hover .image-link img {
    transform: scale(1.04);
  }

  .card-link:hover .name {
    color: var(--color-primary);
  }
}

/* ---------- Image ---------- */
/* The photo fills the tile; only a thin inset keeps it off the card edge. */
.image-wrap {
  position: relative;
  aspect-ratio: 1 / 1;
  margin: 6px 6px 0;
  overflow: hidden;
  border-radius: 10px;
  background: var(--color-surface-muted);
}

.image-link {
  position: absolute;
  inset: 0;
  z-index: 0;
  display: grid;
  place-items: center;
  padding: 0;
}

.image-link img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  /* White product photos blend into the tile background */
  mix-blend-mode: multiply;
  transition: transform var(--transition-base);
}

.image-fallback {
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

/* ---------- Uploaded campaign frame overlays ---------- */
.campaign-frame {
  position: absolute;
  inset: 0;
  z-index: 1;
  overflow: hidden;
  pointer-events: none;
  border: 0;
}

.campaign-frame img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: fill;
}

/* Keep campaign decorations below badges and quick actions */
.tag {
  position: absolute;
  top: var(--space-2);
  z-index: 2;
  padding: 3px 9px;
  border-radius: var(--radius-pill);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  line-height: 1.4;
  white-space: nowrap;
  /* Clicks go through to the image link */
  pointer-events: none;
}

.tag.discount {
  left: var(--space-2);
  background: var(--color-primary);
  color: var(--color-on-primary);
}

.tag.out {
  right: var(--space-2);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text-muted);
}

/* ---------- Quick action buttons (two circles, bottom right) ---------- */
.product-actions {
  position: absolute;
  right: var(--space-2);
  bottom: var(--space-2);
  z-index: 3;
  display: flex;
  gap: var(--space-2);
}

.product-action-btn {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  padding: 0;
  border: 1px solid var(--color-border-soft);
  border-radius: 50%;
  background: var(--color-surface);
  color: var(--color-primary);
  box-shadow: 0 2px 8px rgb(0 0 0 / 14%);
  cursor: pointer;
  transition:
    background var(--transition-fast),
    color var(--transition-fast),
    border-color var(--transition-fast),
    transform var(--transition-fast);
}

.product-action-btn svg {
  width: 18px;
  height: 18px;
}

.product-action-btn:hover:not(:disabled) {
  border-color: var(--color-primary);
  background: var(--color-primary);
  color: var(--color-on-primary);
}

.product-action-btn:active:not(:disabled) {
  transform: scale(0.92);
}

.product-action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.product-action-btn:focus-visible {
  outline: 2px solid var(--color-focus-outline);
  outline-offset: 2px;
}

/* Wishlisted: filled red heart */
.wishlist-btn.active {
  color: var(--color-danger);
}

.wishlist-btn.active:hover:not(:disabled) {
  background: var(--color-danger);
  border-color: var(--color-danger);
  color: var(--color-on-primary);
}

/* Added to cart: green check */
.cart-btn.added {
  border-color: transparent;
  background: #16a34a;
  color: #fff;
}

.spinner {
  width: 16px;
  height: 16px;
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

/* Short message above the buttons */
.action-toast {
  position: absolute;
  bottom: 52px;
  left: 50%;
  z-index: 3;
  max-width: calc(100% - 16px);
  padding: 5px 12px;
  overflow: hidden;
  border-radius: var(--radius-pill);
  background: var(--color-black);
  color: var(--color-on-primary);
  font-size: 11px;
  font-weight: var(--font-weight-semibold);
  text-overflow: ellipsis;
  transform: translateX(-50%);
  white-space: nowrap;
  pointer-events: none;
}

.toast-enter-active,
.toast-leave-active {
  transition: opacity var(--transition-fast);
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
}

/* Mouse users: the buttons appear only while hovering the image (or when a button has keyboard focus).
   Touch screens have no hover, so there the buttons stay visible. */
@media (hover: hover) and (pointer: fine) {
  .product-actions {
    opacity: 0;
    transform: translateY(8px);
    pointer-events: none;
    transition: opacity var(--transition-fast), transform var(--transition-fast);
  }

  .image-wrap:hover .product-actions,
  .image-wrap:focus-within .product-actions {
    opacity: 1;
    transform: translateY(0);
    pointer-events: auto;
  }
}

/* Touch screens: larger buttons */
@media (pointer: coarse) {
  .product-action-btn {
    width: 40px;
    height: 40px;
  }
}

/* ---------- Body ---------- */
.card-link {
  display: flex;
  flex: 1;
  min-width: 0;
  color: inherit;
  text-decoration: none;
}

.card-link:focus-visible {
  outline: 2px solid var(--color-focus-outline);
  outline-offset: -2px;
}

.body {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  padding: 10px 12px 12px;
}

.brand {
  margin: 0;
  overflow: hidden;
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  line-height: 1.3;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.name {
  display: -webkit-box;
  min-height: calc(var(--font-size-sm) * 1.35 * 2);
  margin: 0;
  overflow: hidden;
  overflow-wrap: anywhere;
  color: var(--color-text);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  line-height: 1.35;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  transition: color var(--transition-fast);
}

.rating {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin: 2px 0 0;
  font-size: var(--font-size-xs);
}

.stars {
  color: var(--color-accent-deep);
  letter-spacing: 1px;
  white-space: nowrap;
}

.rating-value {
  color: var(--color-text-muted);
}

.price-row {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 2px var(--space-2);
  margin-top: auto;
  padding-top: 6px;
}

.price {
  color: var(--color-primary);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-bold);
  line-height: 1.2;
}

.old-price {
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
}

/* Out of stock: dim the image only */
.product-card.is-out .image-link img {
  opacity: 0.55;
}

/* ---------- List view ---------- */
.product-card.is-list {
  flex-direction: row;
  align-items: stretch;
}

.product-card.is-list .image-wrap {
  width: 150px;
  flex-shrink: 0;
  margin: 6px 0 6px 6px;
  aspect-ratio: auto;
  min-height: 150px;
}

.product-card.is-list .body {
  justify-content: center;
  padding: var(--space-4) var(--space-5);
}

.product-card.is-list .name {
  min-height: 0;
}

.product-card.is-list .price-row {
  margin-top: var(--space-2);
}

/* ---------- Phones ---------- */
@media (max-width: 560px) {
  .product-card.is-list .image-wrap {
    width: 104px;
    min-height: 104px;
  }

  .product-card.is-list .body {
    padding: var(--space-3) var(--space-4);
  }

  /* Smaller circles so both fit on the narrow list image */
  .product-card.is-list .product-action-btn {
    width: 32px;
    height: 32px;
  }

  .product-card.is-list .product-action-btn svg {
    width: 16px;
    height: 16px;
  }

  .product-card.is-list .action-toast {
    display: none;
  }
}

@media (max-width: 420px) {
  .product-card {
    border-radius: 12px;
  }

  .image-wrap {
    margin: 4px 4px 0;
    border-radius: 9px;
  }

  /* Two cards per row: smaller tags so discount and out-of-stock never overlap */
  .tag {
    padding: 1px 6px;
    font-size: 10px;
  }

  .body {
    padding: 8px 10px 10px;
  }

  .name {
    min-height: calc(var(--font-size-xs) * 1.35 * 2);
    font-size: var(--font-size-xs);
  }

  .price {
    font-size: var(--font-size-sm);
  }
}

/* ---------- Fold cover screens (≈280–340px) ---------- */
@media (max-width: 340px) {
  .product-card.is-list .image-wrap {
    width: 92px;
    min-height: 92px;
  }

  .product-card.is-list .body {
    padding: var(--space-2) var(--space-3);
  }
}

@media (prefers-reduced-motion: reduce) {
  .product-card,
  .image-link img,
  .product-actions,
  .product-action-btn,
  .toast-enter-active,
  .toast-leave-active {
    transition: none;
  }

  .product-card:hover {
    transform: none;
  }

  .product-card:hover .image-link img {
    transform: none;
  }

  .spinner {
    animation-duration: 1.6s;
  }
}
</style>
