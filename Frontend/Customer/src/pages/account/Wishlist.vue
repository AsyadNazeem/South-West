<script setup>
import { productPathFor } from '@/utils/productSeo.js'
import AccountConfirmDialog from '@/components/account/AccountConfirmDialog.vue'
import AccountPageHeader from '@/components/account/AccountPageHeader.vue'
import { accountFeedback } from '@/utils/accountFeedback'
import {
  getResponsiveImageSrcSet,
  getResponsiveImageUrl,
} from '@/utils/mediaUrl'
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import api from '@/services/api'

const router = useRouter()
const wishlist = ref([])
const loading = ref(true)
const errorMessage = ref('')
const removingIds = ref([])
const removal = ref(null)
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
  return productPathFor(item) || null
}


function getProductImage(item) {
  if (!item) return { src: '', srcset: '' }

  const images = Array.isArray(item.images)
    ? [...item.images].sort(
        (a, b) =>
          Number(b.is_primary) - Number(a.is_primary) ||
          Number(a.sort_order || 0) - Number(b.sort_order || 0)
      )
    : []

  const primaryImage = images.find(image => image?.is_primary) || images[0]
  const firstImage = images[0]
  const selectedValue =
    primaryImage?.url ||
    firstImage?.url ||
    primaryImage?.file_path ||
    firstImage?.file_path ||
    (typeof primaryImage === 'string' ? primaryImage : '') ||
    (typeof firstImage === 'string' ? firstImage : '') ||
    item.image_url ||
    item.image ||
    item.main_image ||
    item.thumbnail ||
    ''
  const imageRecord = selectedValue === primaryImage?.url || selectedValue === primaryImage?.file_path || selectedValue === primaryImage
    ? primaryImage
    : selectedValue === firstImage?.url || selectedValue === firstImage?.file_path || selectedValue === firstImage
      ? firstImage
      : selectedValue

  return {
    src: selectedValue ? getResponsiveImageUrl(imageRecord) : '',
    srcset: imageRecord && typeof imageRecord === 'object'
      ? getResponsiveImageSrcSet(imageRecord.responsive_images)
      : '',
  }
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
      accountFeedback(error, 'Unable to load your wishlist. Please try again.')

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
      accountFeedback(error, 'Unable to remove this product from your wishlist.')
  } finally {
    removal.value = null
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
      accountFeedback(error, 'Unable to add this product to your cart. Please try again.')
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
    <AccountPageHeader title="Wishlist" description="Keep track of the products you’ve saved.">
      <button v-if="!loading && wishlist.length" type="button" class="btn" :disabled="loading" @click="loadWishlist">
        Refresh
      </button>
    </AccountPageHeader>

    <p v-if="notice" class="notice" :class="noticeType" :role="noticeType === 'success' ? 'status' : 'alert'">
      {{ notice }}
      <RouterLink v-if="noticeType === 'success'" to="/cart" class="notice-link">View cart</RouterLink>
    </p>

    <!-- Loading -->
    <div v-if="loading" class="wishlist-list" aria-busy="true" aria-label="Loading your wishlist">
      <div v-for="n in 4" :key="n" class="card skeleton" aria-hidden="true">
        <div class="media skeleton-line"></div>
        <div class="info">
          <div class="skeleton-line"></div>
          <div class="skeleton-line short"></div>
          <div class="skeleton-line button"></div>
        </div>
      </div>
    </div>

    <!-- Error -->
    <div v-else-if="errorMessage" class="state" role="alert">
      <h3>Something went wrong</h3>
      <p class="muted">{{ errorMessage }}</p>
      <button type="button" class="btn" @click="loadWishlist">Try again</button>
    </div>

    <!-- Empty -->
    <div v-else-if="!wishlist.length" class="state">
      <h3>Your wishlist is empty</h3>
      <p class="muted">Save products you're interested in and find them here later.</p>
      <RouterLink to="/" class="btn primary">Browse products</RouterLink>
    </div>

    <!-- Products -->
    <div v-else class="wishlist-list">
      <article v-for="entry in wishlist" :key="entry.id" class="card" :class="{ unavailable: isUnavailable(entry) }">

        <div class="media">
          <button
            v-if="getProductImage(getItem(entry)).src"
            type="button"
            class="image-button"
            :disabled="!getProductUrl(getItem(entry))"
            :aria-label="`View ${entryName(entry)}`"
            @click="openProduct(getItem(entry))"
          >
            <img
              :src="getProductImage(getItem(entry)).src"
              :srcset="getProductImage(getItem(entry)).srcset || undefined"
              sizes="(max-width: 340px) 100vw, (max-width: 560px) 50vw, 25vw"
              :alt="entryName(entry)"
              loading="lazy"
              decoding="async"
            >
          </button>
          <div v-else class="placeholder" aria-hidden="true">
            <span>{{ entryName(entry).charAt(0).toUpperCase() }}</span>
          </div>

          <span v-if="isUnavailable(entry)" class="tag">Unavailable</span>

          <button
            type="button"
            class="remove-button"
            :disabled="isRemoving(entry)"
            :aria-label="`Remove ${entryName(entry)} from wishlist`"
            title="Remove from wishlist"
            @click="removal = entry"
          >
            <span v-if="isRemoving(entry)" class="spinner" aria-hidden="true"></span>
            <svg v-else viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
            </svg>
          </button>
        </div>

        <div class="info">
          <div class="text">
            <RouterLink v-if="getProductUrl(getItem(entry))" :to="getProductUrl(getItem(entry))" class="name">
              {{ entryName(entry) }}
            </RouterLink>
            <h3 v-else class="name">{{ entryName(entry) }}</h3>

            <p v-if="getItem(entry)?.item_code" class="muted code">{{ getItem(entry)?.item_code }}</p>
            <p v-if="getPrice(getItem(entry)) !== null" class="price">{{ formatPrice(getPrice(getItem(entry))) }}</p>
          </div>

          <button type="button" class="cart-button" :disabled="isUnavailable(entry) || isAddingToCart(entry)" @click="addToCart(entry)">
            {{ isUnavailable(entry) ? 'Unavailable' : isAddingToCart(entry) ? 'Adding…' : 'Add to cart' }}
          </button>
        </div>

      </article>
    </div>

    <AccountConfirmDialog v-if="removal" title="Remove from wishlist?" :description="entryName(removal)" confirm-label="Remove product"
      :busy="isRemoving(removal)" @cancel="removal = null" @confirm="removeFromWishlist(removal)" />
  </section>
</template>

<style scoped>
.wishlist-page { width: 100%; min-width: 0; color: var(--color-text); }
.muted { margin: 0; color: var(--color-text-muted); font-size: 12px; overflow-wrap: anywhere; }
button:disabled { cursor: not-allowed; opacity: .55; }

/* Buttons */
.btn { display: inline-flex; align-items: center; justify-content: center; min-height: 36px; padding: 0 14px; background: var(--color-surface); color: var(--color-text); border: 1px solid var(--color-border); border-radius: var(--radius-md); font: 600 13px/1 var(--font-family-base); text-decoration: none; white-space: nowrap; cursor: pointer; transition: border-color .15s ease, color .15s ease; }
.btn:hover:not(:disabled) { border-color: var(--color-primary); color: var(--color-primary); }
.btn.primary { background: var(--color-primary); border-color: var(--color-primary); color: var(--color-on-primary); }
.btn.primary:hover { background: var(--color-primary-hover); border-color: var(--color-primary-hover); color: var(--color-on-primary); }

/* Notice */
.notice { margin: 0 0 14px; padding: 10px 14px; border-radius: var(--radius-md); font-size: 13px; }
.notice.success { background: #ecfdf3; color: #166534; border: 1px solid #bbf7d0; }
.notice.error { background: #fef2f2; color: #b42318; border: 1px solid #fecaca; }
.notice-link { margin-left: 8px; color: inherit; font-weight: 600; text-decoration: underline; }

/* States */
.state { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 48px 20px; text-align: center; background: var(--color-surface); border: 1px solid var(--color-border-soft); border-radius: var(--radius-lg); }
.state h3 { margin: 0; font-family: var(--font-family-display); font-size: 16px; }
.state .muted { margin-bottom: 10px; font-size: 13px; }

/* Grid */
.wishlist-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 14px; }

.card { display: flex; flex-direction: column; min-width: 0; overflow: hidden; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-lg); box-shadow: var(--shadow-sm); transition: border-color .15s ease, box-shadow .15s ease; }
@media (hover: hover) { .card:hover { border-color: var(--color-border-strong, var(--color-border)); box-shadow: var(--shadow-md); } }

/* Image tile */
.media { position: relative; aspect-ratio: 1 / 1; background: color-mix(in srgb, var(--color-primary) 4%, var(--color-surface)); border-bottom: 1px solid var(--color-border-soft); }
.image-button, .placeholder { position: absolute; inset: 0; display: grid; place-items: center; width: 100%; height: 100%; padding: 16px; overflow: hidden; background: transparent; border: 0; }
.image-button { cursor: pointer; }
.image-button:disabled { cursor: default; opacity: 1; }
.image-button img { max-width: 100%; max-height: 100%; object-fit: contain; mix-blend-mode: multiply; }
.placeholder span { display: grid; place-items: center; width: 48px; height: 48px; background: var(--color-surface); color: var(--color-primary); border: 1px solid var(--color-border); border-radius: var(--radius-md); font-family: var(--font-family-display); font-size: 18px; font-weight: 700; }
.card.unavailable img { opacity: .45; }

.tag { position: absolute; top: 8px; left: 8px; padding: 2px 8px; background: var(--color-surface); color: var(--color-text-muted); border: 1px solid var(--color-border); border-radius: var(--radius-pill); font-size: 11px; font-weight: 600; pointer-events: none; }

/* Remove: small, quiet */
.remove-button { position: absolute; top: 8px; right: 8px; z-index: 1; display: grid; place-items: center; width: 28px; height: 28px; padding: 0; background: var(--color-surface); color: var(--color-text-muted); border: 1px solid var(--color-border-soft); border-radius: 50%; cursor: pointer; transition: color .15s ease, border-color .15s ease, background .15s ease; }
.remove-button svg { width: 13px; height: 13px; }
.remove-button:hover:not(:disabled) { color: #b42318; border-color: #fecaca; background: #fef2f2; }
.spinner { width: 12px; height: 12px; border: 2px solid currentColor; border-top-color: transparent; border-radius: 50%; animation: spin .7s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

/* Info */
.info { display: flex; flex: 1; flex-direction: column; gap: 12px; min-width: 0; padding: 12px 14px 14px; }
.text { display: grid; flex: 1; align-content: start; gap: 3px; min-width: 0; }
.name { display: -webkit-box; margin: 0; overflow: hidden; color: var(--color-text); font-size: 13px; font-weight: 600; line-height: 1.4; text-decoration: none; overflow-wrap: anywhere; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; }
a.name:hover { color: var(--color-primary); }
.code { font-size: 11px; }
.price { margin: 4px 0 0; color: var(--color-text); font-size: 15px; font-weight: 700; font-variant-numeric: tabular-nums; }

.cart-button { width: 100%; min-height: 36px; margin-top: auto; padding: 0 12px; background: var(--color-primary); color: var(--color-on-primary); border: 0; border-radius: var(--radius-md); font: 600 13px/1 var(--font-family-base); cursor: pointer; transition: background .15s ease; }
.cart-button:hover:not(:disabled) { background: var(--color-primary-hover); }
.cart-button:disabled { background: var(--color-surface-muted); color: var(--color-text-muted); }

/* Focus */
.image-button:focus-visible, .name:focus-visible, .remove-button:focus-visible, .cart-button:focus-visible, .btn:focus-visible, .notice-link:focus-visible { outline: 2px solid var(--color-focus-outline); outline-offset: 2px; }

/* Loading */
.card.skeleton { pointer-events: none; }
.skeleton-line { height: 11px; background: var(--color-border-soft); border-radius: 4px; animation: pulse 1.4s ease-in-out infinite; }
.media.skeleton-line { height: auto; border-radius: 0; }
.skeleton-line.short { width: 45%; }
.skeleton-line.button { height: 36px; margin-top: 4px; border-radius: var(--radius-md); }
.card.skeleton .info { gap: 10px; }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: .5; } }

@media (pointer: coarse) { .remove-button { width: 34px; height: 34px; } .cart-button { min-height: 40px; } }

@media (max-width: 560px) {
  .wishlist-list { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
  .image-button, .placeholder { padding: 12px; }
  .info { padding: 10px 12px 12px; }
}
@media (max-width: 340px) { .wishlist-list { grid-template-columns: minmax(0, 1fr); } }

@media (prefers-reduced-motion: reduce) {
  .skeleton-line { animation: none; }
  .spinner { animation-duration: 1.6s; }
}
</style>
