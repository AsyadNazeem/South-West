<script setup>
import {computed, onMounted, onUnmounted, ref} from 'vue'
import {useRouter} from 'vue-router'
import api from '../services/api.js'

const router = useRouter()
const searchText = ref('')
const searchSuggestions = ref([])
const searchOpen = ref(false)
const searchLoading = ref(false)
const activeSuggestion = ref(-1)

let searchTimer = null
let searchRequestId = 0
let productCache = null
const customer = ref(null)
const menuOpen = ref(false)
const accountMenuRef = ref(null)
const token = ref(sessionStorage.getItem('customerToken'))
const searchFormRef = ref(null)

const showLogoutModal = ref(false)

const isLoggedIn = computed(() => Boolean(token.value))

const customerName = computed(() => {
  if (!customer.value) return 'My Account'
  return [
    customer.value.first_name,
    customer.value.last_name,
  ].filter(Boolean).join(' ') || 'My Account'
})

function syncCustomer() {
  token.value = sessionStorage.getItem('customerToken')
  try {
    customer.value = JSON.parse(sessionStorage.getItem('customerProfile') || 'null')
  } catch {
    customer.value = null
  }
}

async function loadCustomer() {
  syncCustomer()

  if (!isLoggedIn.value) {
    customer.value = null
    return
  }

  try {
    const response = await api.get('/customer-auth/me')
    customer.value =
        response.data?.customer ??
        response.data?.data?.customer ??
        response.data?.data ??
        response.data

    sessionStorage.setItem('customerProfile', JSON.stringify(customer.value))
  } catch {
    // Do not log the customer out automatically here.
    // Existing authentication/session handling remains authoritative.
  }
}

function searchProducts() {
  const query = searchText.value.trim()
  closeSearch()

  router.push({
    path: '/',
    query: query ? { search: query } : {},
  })
}


function getProductList(responseData) {
  const result = responseData?.data ?? responseData

  if (Array.isArray(result)) return result
  if (Array.isArray(result?.products)) return result.products

  return []
}


function getSuggestionImage(product) {
  const images = Array.isArray(product.images) ? product.images : []

  const primaryImage =
    images.find(image => image.is_primary) || images[0]

  const rawImage =
    product.image ||
    product.image_url ||
    product.thumbnail ||
    primaryImage?.url ||
    primaryImage?.file_path ||
    primaryImage?.file_name ||
    product.file_path ||
    ''

  if (!rawImage || typeof rawImage !== 'string') {
    return ''
  }

  // Already an absolute URL
  if (/^https?:\/\//i.test(rawImage)) {
    return rawImage
  }

  // Resolve relative image paths against the backend server.
  const apiBase =
    api.defaults.baseURL ||
    import.meta.env.VITE_API_URL ||
    ''

  try {
    const backendOrigin = new URL(apiBase, window.location.origin).origin
    const imagePath = rawImage.startsWith('/')
      ? rawImage
      : `/${rawImage}`

    return new URL(imagePath, backendOrigin).href
  } catch (error) {
    console.error('Unable to resolve product image URL:', rawImage, error)
    return ''
  }
}


function getSuggestionPrice(product) {
  const price = Number(product.price ?? product.selling_price)
  return Number.isFinite(price) && price > 0
    ? `Rs. ${price.toLocaleString('en-LK', { maximumFractionDigits: 0 })}`
    : ''
}

function getSuggestionLink(product) {
  if (!product.slug || !product.public_id) return '/'

  return `/product/${product.slug}-${product.public_id}`
}

function scheduleSearch() {
  clearTimeout(searchTimer)

  const query = searchText.value.trim()
  const requestId = ++searchRequestId

  searchSuggestions.value = []
  activeSuggestion.value = -1

  if (query.length < 2) {
    searchOpen.value = false
    searchLoading.value = false
    return
  }

  searchOpen.value = true

  searchTimer = setTimeout(async () => {
    searchLoading.value = true

    try {
      if (!productCache) {
        const response = await api.get('/store/products')
        productCache = getProductList(response.data)
      }

      // Ignore results from an older search.
      if (requestId !== searchRequestId) return

      const normalizedQuery = query.toLowerCase()

      searchSuggestions.value = productCache
        .filter(product => {
          const searchableText = [
            product.item_name,
            product.name,
            product.item_code,
            product.brand,
            product.category,
            product.slug
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()

          return searchableText.includes(normalizedQuery)
        })
        .slice(0, 7)

    } catch (error) {
      if (requestId === searchRequestId) {
        console.error('Product suggestions failed:', error)
        searchSuggestions.value = []
      }
    } finally {
      if (requestId === searchRequestId) {
        searchLoading.value = false
      }
    }
  }, 250)
}

function selectSuggestion(product) {
  const destination = getSuggestionLink(product)

  searchOpen.value = false
  searchText.value = ''

  if (destination === '/') return

  router.push(destination)
}

function handleSearchKeydown(event) {
  if (!searchOpen.value || !searchSuggestions.value.length) {
    if (event.key === 'Escape') searchOpen.value = false
    return
  }

  if (event.key === 'ArrowDown') {
    event.preventDefault()
    activeSuggestion.value =
      (activeSuggestion.value + 1) % searchSuggestions.value.length
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    activeSuggestion.value =
      activeSuggestion.value <= 0
        ? searchSuggestions.value.length - 1
        : activeSuggestion.value - 1
  } else if (
    event.key === 'Enter' &&
    activeSuggestion.value >= 0
  ) {
    event.preventDefault()
    selectSuggestion(searchSuggestions.value[activeSuggestion.value])
  } else if (event.key === 'Escape') {
    searchOpen.value = false
    activeSuggestion.value = -1
  }
}

function closeSearch() {
  searchOpen.value = false
  activeSuggestion.value = -1
}


function openAccount() {
  menuOpen.value = false
  router.push('/account')
}

function goTo(path) {
  menuOpen.value = false
  router.push(path)
}


function confirmLogout() {
    menuOpen.value = false
    showLogoutModal.value = true
}

function cancelLogout() {
    showLogoutModal.value = false
}

async function logout() {
    showLogoutModal.value = false

    try {
        await api.post('/customer-auth/logout')
    } catch {
        // Clear the local session even if the server session has expired.
    } finally {
        sessionStorage.removeItem('customerToken')
        sessionStorage.removeItem('customerProfile')

        token.value = null
        customer.value = null

        router.push('/')
    }
}


/* Hover only applies to a real mouse. Touch and keyboard use click. */
function onPointerEnter(event) {
  if (event.pointerType === 'mouse') menuOpen.value = true
}

function onPointerLeave(event) {
  if (event.pointerType === 'mouse') menuOpen.value = false
}

function toggleMenu(event) {
  // Hover already opened the menu for a mouse; the click must not close it.
  if (event.pointerType === 'mouse' && menuOpen.value) return
  menuOpen.value = !menuOpen.value
}

function handleAuthChanged() {
  syncCustomer()

  if (token.value) {
    loadCustomer()
  }
}

function handleStorageChange() {
  syncCustomer()
}

function handleClickOutside(event) {
  if (
    searchFormRef.value &&
    !searchFormRef.value.contains(event.target)
  ) {
    closeSearch()
  }

  if (
    accountMenuRef.value &&
    !accountMenuRef.value.contains(event.target)
  ) {
    menuOpen.value = false
  }
}

function handleKeydown(event) {
  if (event.key === 'Escape') menuOpen.value = false
}

onMounted(() => {
  loadCustomer()

  // Fires after login/logout in the same browser tab.
  window.addEventListener('customer-auth-changed', handleAuthChanged)

  // Handles storage changes from other tabs.
  window.addEventListener('storage', handleStorageChange)

  document.addEventListener('pointerdown', handleClickOutside)
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('customer-auth-changed', handleAuthChanged)
  window.removeEventListener('storage', handleStorageChange)

  document.removeEventListener('pointerdown', handleClickOutside)
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <header class="site-header">
    <div class="top-strip">
      <div class="header-container top-strip-inner">
        <span class="welcome">Welcome to South West</span>

        <nav class="top-links" aria-label="Utility navigation">
          <RouterLink to="/" class="shop-link">Shop</RouterLink>
          <a href="mailto:support@southwest.example" class="help-link">Help &amp; Support</a>

          <span class="top-divider" aria-hidden="true"></span>

          <!-- Logged-in customer -->
          <div
              v-if="isLoggedIn"
              ref="accountMenuRef"
              class="account-menu"
              @pointerenter="onPointerEnter"
              @pointerleave="onPointerLeave"
          >
            <button
                class="account-button"
                :class="{ open: menuOpen }"
                type="button"
                aria-haspopup="menu"
                aria-controls="account-dropdown"
                :aria-expanded="menuOpen"
                @click="toggleMenu"
                @keydown.esc="menuOpen = false"
            >
              <span class="account-label">{{ customerName }}</span>

              <span class="chevron" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none">
                  <path
                      d="m6 9 6 6 6-6"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                  />
                </svg>
              </span>
            </button>

            <div v-if="menuOpen" id="account-dropdown" class="dropdown-menu" role="menu">
              <button type="button" role="menuitem" @click="openAccount">
                Manage My Account
              </button>

              <button type="button" role="menuitem" @click="goTo('/account/orders')">
                My Orders
              </button>

              <button type="button" role="menuitem" @click="goTo('/account/wishlist')">
                My Wishlist &amp; Followed Stores
              </button>

              <button type="button" role="menuitem" @click="goTo('/account/reviews')">
                My Reviews
              </button>

              <button type="button" role="menuitem" @click="goTo('/account/returns')">
                My Returns &amp; Cancellations
              </button>

              <div class="dropdown-divider"></div>

              <button
                  type="button"
                  class="logout-item"
                  role="menuitem"
@click="confirmLogout"
              >
                Logout
              </button>
            </div>
          </div>

          <!-- Guest -->
          <div v-else class="guest-actions">
            <RouterLink to="/login" class="login-link">Login</RouterLink>
            <RouterLink to="/register" class="register-button">Register</RouterLink>
          </div>
        </nav>
      </div>
    </div>

    <div class="main-header">
      <div class="header-container main-header-inner">
        <RouterLink to="/" class="brand" aria-label="South West home">
          <span class="brand-mark">S</span>
          <span class="brand-name">SOUTH<span>WEST</span></span>
        </RouterLink>


<form
ref="searchFormRef"
  class="search-form"
  role="search"
  @submit.prevent="searchProducts"
  @keydown="handleSearchKeydown"
>
  <input
    v-model="searchText"
    type="search"
    enterkeyhint="search"
    autocomplete="off"
    placeholder="Search products, brands and accessories"
    aria-label="Search products"
    aria-autocomplete="list"
    aria-controls="product-search-suggestions"
    :aria-expanded="searchOpen"
    @input="scheduleSearch"
    @focus="searchText.trim().length >= 2 && (searchOpen = true)"
  />

  <button type="submit" aria-label="Search">
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle
        cx="10.8"
        cy="10.8"
        r="6.5"
        stroke="currentColor"
        stroke-width="1.9"
      />
      <path
        d="m16 16 4.5 4.5"
        stroke="currentColor"
        stroke-width="1.9"
        stroke-linecap="round"
      />
    </svg>
  </button>

  <div
    v-if="searchOpen"
    id="product-search-suggestions"
    class="search-suggestions"
    role="listbox"
  >
    <p v-if="searchLoading" class="search-suggestion-state">
      Searching products...
    </p>

    <p
      v-else-if="searchText.trim().length >= 2 && !searchSuggestions.length"
      class="search-suggestion-state"
    >
      No matching products found.
    </p>

    <button
      v-for="(product, index) in searchSuggestions"
      :key="product.id"
      type="button"
      class="search-suggestion"
      :class="{ active: activeSuggestion === index }"
      role="option"
      :aria-selected="activeSuggestion === index"
      @mousedown.prevent="selectSuggestion(product)"
    >
      <img
  v-if="getSuggestionImage(product)"
  :src="getSuggestionImage(product)"
  :alt="product.item_name || product.name || 'Product'"
  class="search-suggestion-image"
  @error="(event) => console.error(
    'Search image failed:',
    event.target.src,
    product
  )"
/>

      <span v-else class="search-suggestion-placeholder">
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="4" y="5" width="16" height="14" rx="2" stroke="currentColor" stroke-width="1.5" />
          <path d="m4 15 5-5 4 4 2-2 5 5" stroke="currentColor" stroke-width="1.5" />
        </svg>
      </span>

      <span class="search-suggestion-details">
        <span class="search-suggestion-name">
          {{ product.item_name || product.name || 'Unnamed product' }}
        </span>
        <span class="search-suggestion-meta">
          <span v-if="product.brand">{{ product.brand }}</span>
          <span v-if="product.item_code">{{ product.item_code }}</span>
        </span>
      </span>

      <span v-if="getSuggestionPrice(product)" class="search-suggestion-price">
        {{ getSuggestionPrice(product) }}
      </span>
    </button>

    <button
      type="button"
      class="search-all-results"
      @mousedown.prevent="searchProducts"
    >
      Search all results for "{{ searchText.trim() }}"
    </button>
  </div>
</form>


        <RouterLink to="/cart" class="cart-link" aria-label="Shopping cart">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M3 4h2l2.1 10.1a2 2 0 0 0 2 1.6h8.7a2 2 0 0 0 2-1.6L21 8H6" stroke="currentColor"
                  stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
            <circle cx="10" cy="20" r="1.4" fill="currentColor"/>
            <circle cx="18" cy="20" r="1.4" fill="currentColor"/>
          </svg>
          <span>Cart</span>
        </RouterLink>
      </div>
    </div>
  </header>

<Teleport to="body">
  <div
    v-if="showLogoutModal"
    class="logout-modal-overlay"
    @click.self="cancelLogout"
    @keydown.esc="cancelLogout"
  >
    <div
      class="logout-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="logout-modal-title"
      aria-describedby="logout-modal-description"
    >
      <div class="logout-modal-icon">
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M10 17l5-5-5-5M15 12H3m9-8h5a3 3 0 013 3v10a3 3 0 01-3 3h-5"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </div>

      <h2 id="logout-modal-title">Log out?</h2>

      <p id="logout-modal-description">
        Are you sure you want to log out of your South West account?
      </p>

      <div class="logout-modal-actions">
        <button
          type="button"
          class="logout-cancel-button"
          @click="cancelLogout"
        >
          Cancel
        </button>

        <button
          type="button"
          class="logout-confirm-button"
          @click="logout"
        >
          Logout
        </button>
      </div>
    </div>
  </div>
</Teleport>

</template>

<style scoped>
.site-header {
  position: sticky;
  top: calc(var(--strip-height) * -1);
  z-index: 200;
  isolation: isolate;
  background: var(--color-surface);
  box-shadow: var(--shadow-md);
}

.header-container {
  box-sizing: border-box;
  width: min(var(--container-store), 94%);
  margin: 0 auto;
  /* Keeps content clear of notches in landscape (needs viewport-fit=cover) */
  padding-left: env(safe-area-inset-left);
  padding-right: env(safe-area-inset-right);
}

/* ---------- Top strip ---------- */
.top-strip {
  background: var(--color-black);
  color: rgb(255 255 255 / 72%);
  font-size: var(--font-size-xs);
  letter-spacing: 0.02em;
  border-bottom: 1px solid rgb(255 255 255 / 6%);
  position: relative;
  z-index: 202;
}

.top-strip-inner {
  height: var(--strip-height);
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-4);
}

.welcome {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.top-links {
  display: flex;
  align-items: center;
  gap: 20px;
  height: 100%;
  flex-shrink: 0;
  white-space: nowrap;
}

.top-links a {
  color: inherit;
  text-decoration: none;
  transition: color var(--transition-fast);
}

.top-links a:hover {
  color: var(--color-on-primary);
}

.top-divider {
  width: 1px;
  height: 14px;
  background: rgb(255 255 255 / 18%);
}

.guest-actions {
  display: flex;
  align-items: center;
  gap: 16px;
}

.top-links .login-link {
  color: rgb(255 255 255 / 92%);
  font-weight: var(--font-weight-semibold);
}

.top-links .login-link:hover {
  color: var(--color-accent);
}

.top-links .register-button {
  padding: 3px 14px;
  border: 1px solid rgb(255 255 255 / 35%);
  border-radius: var(--radius-pill);
  color: var(--color-on-primary);
  font-weight: var(--font-weight-semibold);
  line-height: 1.5;
  transition: background var(--transition-fast), border-color var(--transition-fast), color var(--transition-fast);
}

.top-links .register-button:hover {
  border-color: var(--color-on-primary);
  background: var(--color-on-primary);
  color: var(--color-primary);
}

/* ---------- Main header ---------- */
.main-header {
  background: var(--gradient-metal);
  color: var(--color-on-primary);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 8%),
  inset 0 -1px 0 rgb(0 0 0 / 45%);
}

.main-header-inner {
  min-height: 72px;
  display: flex;
  align-items: center;
  gap: 14px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--color-on-primary);
  text-decoration: none;
  flex-shrink: 0;
  margin-right: 10px;
}

.brand-mark {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border: 1.5px solid rgb(255 255 255 / 80%);
  border-radius: 10px;
  background: linear-gradient(145deg, rgb(255 255 255 / 20%), rgb(255 255 255 / 4%));
  box-shadow: var(--highlight-inset);
  font-family: var(--font-family-display);
  font-size: 22px;
  font-weight: 800;
}

.brand-name {
  font-family: var(--font-family-display);
  font-size: 18px;
  font-weight: 800;
  letter-spacing: 0.14em;
  white-space: nowrap;
}

.brand-name span {
  color: var(--color-accent);
  font-weight: var(--font-weight-medium);
}

/* Search: smaller, centred between brand and cart */
.search-form {
  display: flex;
  flex: 1;
  max-width: 760px;
  min-width: 120px;
  height: 40px;
  margin: 0;
  background: var(--color-surface);
  border: 1px solid rgb(255 255 255 / 25%);
  border-radius: var(--radius-md);
  overflow: hidden;
  transition: box-shadow var(--transition-fast);
}

.search-form:focus-within {
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-accent) 50%, transparent);
}

.search-form input {
  flex: 1;
  min-width: 0;
  border: 0;
  outline: 0;
  padding: 0 14px;
  background: transparent;
  font: inherit;
  font-size: var(--font-size-xs);
  color: var(--color-text);
  text-overflow: ellipsis;
}

.search-form input::placeholder {
  color: var(--color-text-muted);
}

.search-form button {
  display: grid;
  place-items: center;
  width: 46px;
  border: 0;
  background: var(--color-primary);
  color: var(--color-on-primary);
  cursor: pointer;
  transition: background var(--transition-fast);
}

.search-form button:hover {
  background: var(--color-primary-hover);
}

.search-form svg {
  width: 20px;
  height: 20px;
}

/* Cart: inline icon + label, pill style */
.cart-link {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 16px;
  border: 1px solid rgb(255 255 255 / 22%);
  border-radius: var(--radius-md);
  background: rgb(255 255 255 / 6%);
  color: var(--color-on-primary);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  text-decoration: none;
  white-space: nowrap;
  flex-shrink: 0;
  transition: background var(--transition-fast), border-color var(--transition-fast);
}

.cart-link svg {
  width: 20px;
  height: 20px;
}

.cart-link:hover {
  border-color: rgb(255 255 255 / 45%);
  background: rgb(255 255 255 / 12%);
}

/* ---------- Account menu (top strip) ---------- */
.account-menu {
  height: 100%;
  display: flex;
  align-items: center;
  position: relative;
  z-index: 203;
}

.account-button {
  display: flex;
  align-items: center;
  gap: 7px;
  max-width: 230px;
  padding: 6px 9px;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  background: transparent;
  color: rgb(255 255 255 / 92%);
  cursor: pointer;
  font: inherit;
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  transition:
      background var(--transition-fast),
      border-color var(--transition-fast);
}

.account-button:hover,
.account-button.open {
  background: rgb(255 255 255 / 10%);
  border-color: rgb(255 255 255 / 15%);
}

.account-label {
  max-width: 190px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chevron {
  display: grid;
  width: 13px;
  height: 13px;
  flex-shrink: 0;
  transition: transform var(--transition-fast);
}

.chevron svg {
  width: 100%;
  height: 100%;
}

.account-button.open .chevron {
  transform: rotate(180deg);
}

.dropdown-menu {
  position: absolute;
  top: 100%;
  right: 0;
  z-index: 204;
  width: 250px;
  max-width: calc(100vw - 16px);
  max-height: calc(100vh - var(--strip-height) - 16px);
  max-height: calc(100dvh - var(--strip-height) - 16px);
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 7px;
  background: var(--color-surface);
  border: 1px solid var(--color-border-soft);
  border-radius: 0 0 var(--radius-md) var(--radius-md);
  box-shadow: var(--shadow-lg);
  color: var(--color-text);
  white-space: normal;
}

.dropdown-menu button {
  display: block;
  width: 100%;
  padding: 11px 12px;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text-muted);
  font: inherit;
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  line-height: 1.4;
  text-align: left;
  cursor: pointer;
  transition:
      background var(--transition-fast),
      color var(--transition-fast);
}

.dropdown-menu button:hover {
  background: var(--color-surface-muted);
  color: var(--color-primary);
}

.dropdown-menu .dropdown-divider {
  height: 1px;
  margin: 5px 4px;
  background: var(--color-border-soft);
}

.dropdown-menu button.logout-item {
  color: var(--color-danger);
}

.dropdown-menu button.logout-item:hover {
  background: var(--color-danger-bg);
}

/* ---------- Focus ---------- */
.top-links a:focus-visible,
.brand:focus-visible,
.search-form button:focus-visible,
.cart-link:focus-visible,
.account-button:focus-visible,
.dropdown-menu button:focus-visible {
  outline: 2px solid var(--color-focus-outline);
  outline-offset: 2px;
}


.logout-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgb(0 0 0 / 60%);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}

.logout-modal {
  width: min(100%, 400px);
  padding: 30px;
  background: var(--color-surface);
  color: var(--color-text);
  border: 1px solid var(--color-border-soft);
  border-radius: 16px;
  box-shadow: 0 24px 80px rgb(0 0 0 / 25%);
  text-align: center;
  animation: logout-modal-enter 180ms ease-out;
}

.logout-modal-icon {
  display: grid;
  place-items: center;
  width: 54px;
  height: 54px;
  margin: 0 auto 18px;
  border-radius: 50%;
  background: var(--color-danger-bg);
  color: var(--color-danger);
}

.logout-modal-icon svg {
  width: 26px;
  height: 26px;
}

.logout-modal h2 {
  margin: 0 0 10px;
  font-size: 22px;
  font-weight: 700;
}

.logout-modal p {
  margin: 0;
  color: var(--color-text-muted);
  font-size: 14px;
  line-height: 1.6;
}

.logout-modal-actions {
  display: flex;
  gap: 12px;
  margin-top: 26px;
}

.logout-modal-actions button {
  flex: 1;
  min-height: 44px;
  padding: 10px 16px;
  border-radius: 8px;
  font: inherit;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background 150ms ease, transform 150ms ease;
}

.logout-cancel-button {
  border: 1px solid var(--color-border-soft);
  background: var(--color-surface);
  color: var(--color-text);
}

.logout-cancel-button:hover {
  background: var(--color-surface-muted);
}

.logout-confirm-button {
  border: 1px solid var(--color-danger);
  background: var(--color-danger);
  color: white;
}

.logout-confirm-button:hover {
  filter: brightness(0.92);
}

.logout-modal-actions button:focus-visible {
  outline: 2px solid var(--color-focus-outline);
  outline-offset: 3px;
}

@keyframes logout-modal-enter {
  from {
    opacity: 0;
    transform: translateY(8px) scale(0.98);
  }

  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}


/* Keep the dropdown anchored to the search bar */
.search-form {
  position: relative;
  overflow: visible;
}

/* Product suggestions must not inherit the search button's 46px width */
.search-form .search-suggestions {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  right: 0;
  z-index: 1000;
  display: block;
  width: 100%;
  box-sizing: border-box;
  max-height: min(440px, 70vh);
  overflow-y: auto;
  background: var(--color-surface);
  color: var(--color-text);
  border: 1px solid var(--color-border-soft);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
}

/* Override .search-form button */
.search-form button.search-suggestion {
  display: flex;
  place-items: initial;
  align-items: center;
  gap: 12px;
  width: 100%;
  min-height: 70px;
  box-sizing: border-box;
  padding: 10px 12px;
  border: 0;
  border-bottom: 1px solid var(--color-border-soft);
  border-radius: 0;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.search-form button.search-suggestion:hover,
.search-form button.search-suggestion.active {
  background: var(--color-surface-muted);
}

.search-form button.search-all-results {
  display: block;
  width: 100%;
  height: auto;
  box-sizing: border-box;
  padding: 14px;
  border: 0;
  border-radius: 0;
  background: var(--color-surface-muted);
  color: var(--color-primary);
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  text-align: center;
  white-space: normal;
  cursor: pointer;
}

.search-form button.search-all-results:hover {
  background: var(--color-border-soft);
}

.search-suggestion-image,
.search-suggestion-placeholder {
  flex: 0 0 48px;
  width: 48px;
  height: 48px;
  border-radius: 6px;
  object-fit: contain;
  background: var(--color-surface-muted);
}

.search-suggestion-placeholder {
  display: grid;
  place-items: center;
}

.search-suggestion-details {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 5px;
  min-width: 0;
}

.search-suggestion-name {
  overflow: hidden;
  font-size: 13px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.search-suggestion-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  color: var(--color-text-muted);
  font-size: 11px;
}

.search-suggestion-price {
  flex-shrink: 0;
  font-size: 12px;
  font-weight: 700;
}

.search-suggestion-state {
  margin: 0;
  padding: 18px;
  color: var(--color-text-muted);
  font-size: 13px;
}

@media (max-width: 850px) {
  .search-form .search-suggestions {
    max-height: 55vh;
  }
}


@media (prefers-reduced-motion: reduce) {
  .logout-modal {
    animation: none;
  }
}


/* ---------- Touch devices: bigger tap targets, same visual size ---------- */
@media (pointer: coarse) {
  .top-links a,
  .account-button {
    position: relative;
  }

  .top-links a::after,
  .account-button::after {
    content: "";
    position: absolute;
    inset: -10px -6px;
  }

  .dropdown-menu button {
    min-height: 44px;
  }

  .cart-link {
    min-height: 44px;
  }
}

/* ---------- Tablet portrait / unfolded foldables / large phones ---------- */
@media (max-width: 850px) {
  .site-header {
    position: relative;
    top: 0;
  }

  .main-header-inner {
    flex-wrap: wrap;
    gap: 12px;
    padding-top: 14px;
    padding-bottom: 14px;
  }

  .brand {
    flex: 1;
    min-width: 0;
  }

  .search-form {
    order: 3;
    flex-basis: 100%;
    max-width: none;
    height: 44px;
  }

  /* 16px stops iOS Safari from zooming the page on focus */
  .search-form input {
    font-size: 16px;
  }

  .search-form button {
    width: 52px;
  }
}

/* ---------- Phones ---------- */
@media (max-width: 520px) {
  .welcome {
    display: none;
  }

  .top-strip-inner {
    justify-content: center;
  }

  .top-links {
    gap: 14px;
  }

  .brand-mark {
    width: 34px;
    height: 34px;
    font-size: 19px;
  }

  .brand-name {
    font-size: 15px;
  }

  .account-label {
    max-width: 85px;
  }

  .cart-link {
    padding: 8px 10px;
  }

  .cart-link span {
    display: none;
  }

  /* Dropdown spans the screen width instead of overflowing off-screen */
  .account-menu {
    position: static;
  }

  .dropdown-menu {
    left: 3%;
    right: 3%;
    width: auto;
    max-width: none;
  }
}

/* ---------- Small phones ---------- */
@media (max-width: 420px) {
  .shop-link {
    display: none; /* brand already links home */
  }
}

/* ---------- Fold cover screens (≈280–360px) ---------- */
@media (max-width: 360px) {
  .header-container {
    width: 96%;
  }

  .top-links {
    gap: 12px;
  }

  .guest-actions {
    gap: 12px;
  }

  .top-links .register-button {
    padding: 3px 10px;
  }

  .main-header-inner {
    gap: 10px;
  }

  .brand {
    gap: 8px;
    margin-right: 0;
  }

  .brand-name {
    font-size: 14px;
    letter-spacing: 0.1em;
  }

  .account-label {
    max-width: 70px;
  }
}

/* ---------- Landscape phones: do not pin the header over a short screen ---------- */
@media (max-height: 480px) and (orientation: landscape) {
  .site-header {
    position: relative;
    top: 0;
  }

  .main-header-inner {
    min-height: 60px;
  }
}

/* ---------- Reduced motion ---------- */
@media (prefers-reduced-motion: reduce) {
  .site-header *,
  .site-header *::before,
  .site-header *::after {
    transition: none !important;
  }
}
</style>