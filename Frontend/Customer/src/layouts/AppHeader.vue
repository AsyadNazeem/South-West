<script setup>
import {computed, onMounted, onUnmounted, ref} from 'vue'
import {useRouter} from 'vue-router'
import api from '../services/api.js'

const router = useRouter()
const searchText = ref('')
const customer = ref(null)
const menuOpen = ref(false)
const accountMenuRef = ref(null)
const token = ref(sessionStorage.getItem('customerToken'))

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
  router.push({
    path: '/',
    query: query ? {search: query} : {},
  })
}

function openAccount() {
  menuOpen.value = false
  router.push('/account')
}


function goTo(path) {
  menuOpen.value = false
  router.push(path)
}


async function logout() {
  menuOpen.value = false

  try {
    await api.post('/customer-auth/logout')
  } catch {
    // The local session is still cleared if the server session expired.
  } finally {
    sessionStorage.removeItem('customerToken')
    sessionStorage.removeItem('customerProfile')
    token.value = null
    customer.value = null
    router.push('/')
  }
}

function handleStorageChange() {
  syncCustomer()
}

function handleClickOutside(event) {
  if (menuOpen.value && accountMenuRef.value && !accountMenuRef.value.contains(event.target)) {
    menuOpen.value = false
  }
}

function handleKeydown(event) {
  if (event.key === 'Escape') menuOpen.value = false
}

onMounted(() => {
  loadCustomer()
  window.addEventListener('storage', handleStorageChange)
  document.addEventListener('click', handleClickOutside)
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('storage', handleStorageChange)
  document.removeEventListener('click', handleClickOutside)
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <header class="site-header">
    <div class="top-strip">
      <div class="header-container top-strip-inner">
        <span class="welcome">Welcome to South West</span>

        <nav class="top-links" aria-label="Utility navigation">
          <RouterLink to="/">Shop</RouterLink>
          <a href="mailto:support@southwest.example">Help &amp; Support</a>

          <span class="top-divider" aria-hidden="true"></span>

          <!-- Logged in -->

          <!-- Logged-in customer -->
          <div
              v-if="isLoggedIn"
              ref="accountMenuRef"
              class="account-menu"
              @mouseenter="menuOpen = true"
              @mouseleave="menuOpen = false"
          >
            <button
                class="account-button"
                :class="{ open: menuOpen }"
                type="button"
                aria-haspopup="menu"
                :aria-expanded="menuOpen"
                @click="menuOpen = !menuOpen"
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

            <div v-if="menuOpen" class="dropdown-menu" role="menu">
              <button type="button" role="menuitem" @click="openAccount">
                Manage My Account
              </button>

              <button type="button" role="menuitem" @click="goTo('/orders')">
                My Orders
              </button>

              <button type="button" role="menuitem" @click="goTo('/wishlist')">
                My Wishlist &amp; Followed Stores
              </button>

              <button type="button" role="menuitem" @click="goTo('/reviews')">
                My Reviews
              </button>

              <button
                  type="button"
                  role="menuitem"
                  @click="goTo('/returns')"
              >
                My Returns &amp; Cancellations
              </button>

              <div class="dropdown-divider"></div>

              <button
                  type="button"
                  class="logout-item"
                  role="menuitem"
                  @click="logout"
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

        <form class="search-form" role="search" @submit.prevent="searchProducts">
          <input
              v-model="searchText"
              type="search"
              placeholder="Search products, brands and accessories"
              aria-label="Search products"
          />
          <button type="submit" aria-label="Search">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="10.8" cy="10.8" r="6.5" stroke="currentColor" stroke-width="1.9"/>
              <path d="m16 16 4.5 4.5" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>
            </svg>
          </button>
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
  width: min(var(--container-store), 94%);
  margin: 0 auto;
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

.top-links {
  display: flex;
  align-items: center;
  gap: 20px;
  height: 100%;
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
  padding: 7px;
  background: var(--color-surface);
  border: 1px solid var(--color-border-soft);
  border-radius: 0 0 var(--radius-md) var(--radius-md);
  box-shadow: var(--shadow-lg);
  color: var(--color-text);
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

.account-button:focus-visible,
.dropdown-menu button:focus-visible {
  outline: 2px solid var(--color-focus-outline);
  outline-offset: 2px;
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

/* ---------- Responsive ---------- */
@media (max-width: 850px) {
  .site-header {
    position: relative;
    top: 0;
  }

  .main-header-inner {
    flex-wrap: wrap;
    gap: 12px;
    padding: 14px 0;
  }

  .brand {
    flex: 1;
  }

  .search-form {
    order: 3;
    flex-basis: 100%;
    max-width: none;
  }
}

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
}
</style>
