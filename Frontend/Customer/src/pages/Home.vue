<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import api from '../services/api'
import CategoryNav from '../layouts/CategoryNav.vue'
import ProductFilters from '../components/products/ProductFilters.vue'
import ProductGrid from '../components/products/ProductGrid.vue'
import ProductSort from '../components/products/ProductSort.vue'

const route = useRoute()

const products = ref([])
const loading = ref(true)
const error = ref('')
const activeCategory = ref('All Products')
const sortBy = ref('relevance')

// 'grid' or 'list'. Remembered in the browser between visits.
const view = ref('grid')
const VIEW_KEY = 'shop-view'

const DEFAULT_FILTERS = {
  minPrice: 0,
  maxPrice: 100000,
  minRating: 0,
  brands: [],
  warranties: [],
  colors: [],
  inStock: false,
}

// `filters` is what the sidebar edits. `appliedFilters` is what the grid uses.
const filters = ref({ ...DEFAULT_FILTERS })
const appliedFilters = ref({ ...DEFAULT_FILTERS })

const searchQuery = computed(() =>
    typeof route.query.search === 'string' ? route.query.search.trim() : '',
)

// Options for the sidebar, built from the products that were loaded.
function uniqueValues(getValue) {
  const values = products.value
      .map(getValue)
      .filter(value => value !== undefined && value !== null && value !== '')
  return [...new Set(values)].sort((a, b) => String(a).localeCompare(String(b)))
}

const availableBrands = computed(() => uniqueValues(p => p.brand))
const availableWarranties = computed(() => uniqueValues(p => p.warranty))
const availableColors = computed(() => uniqueValues(p => p.color))

const minAvailablePrice = computed(() => {
  const prices = products.value.map(p => Number(p.price ?? p.selling_price)).filter(Number.isFinite)
  return prices.length ? Math.floor(Math.min(...prices)) : 0
})

const maxAvailablePrice = computed(() => {
  const prices = products.value.map(p => Number(p.price ?? p.selling_price)).filter(Number.isFinite)
  return prices.length ? Math.ceil(Math.max(...prices)) : 100000
})

const visibleProducts = computed(() => {
  const applied = appliedFilters.value
  let result = [...products.value]

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(product =>
        [
          product.item_name,
          product.name,
          product.product_name,
          product.brand,
          product.description,
        ]
            .filter(Boolean)
            .some(value => String(value).toLowerCase().includes(query)),
    )
  }

  if (activeCategory.value !== 'All Products') {
    result = result.filter(product =>
        String(product.category || product.category_name || product.category?.name || '')
            .toLowerCase()
            .includes(activeCategory.value.toLowerCase()),
    )
  }

  const priceOf = product => Number(product.price ?? product.selling_price)

  result = result.filter(product => priceOf(product) >= Number(applied.minPrice))
  result = result.filter(product => priceOf(product) <= Number(applied.maxPrice))

  if (applied.brands.length) {
    result = result.filter(product => applied.brands.includes(product.brand))
  }

  if (applied.warranties.length) {
    result = result.filter(product => applied.warranties.includes(product.warranty))
  }

  if (applied.colors.length) {
    result = result.filter(product => applied.colors.includes(product.color))
  }

  if (Number(applied.minRating) > 0) {
    result = result.filter(product => Number(product.rating) >= Number(applied.minRating))
  }

  if (applied.inStock) {
    result = result.filter(product => product.in_stock === true)
  }

  if (sortBy.value === 'price_asc') {
    result.sort((a, b) => priceOf(a) - priceOf(b))
  } else if (sortBy.value === 'price_desc') {
    result.sort((a, b) => priceOf(b) - priceOf(a))
  } else if (sortBy.value === 'name_asc') {
    result.sort((a, b) =>
        String(a.item_name || a.name || a.product_name || '').localeCompare(
            String(b.item_name || b.name || b.product_name || ''),
        ),
    )
  }

  return result
})

// Copies the sidebar selections into the filters the grid uses.
function applyFilters() {
  appliedFilters.value = { ...filters.value }
}

function restoreView() {
  try {
    const saved = localStorage.getItem(VIEW_KEY)
    if (saved === 'grid' || saved === 'list') view.value = saved
  } catch {
    // Storage can be blocked. The default grid view still works.
  }
}

watch(view, (value) => {
  try {
    localStorage.setItem(VIEW_KEY, value)
  } catch {
    // Ignore storage errors.
  }
})

async function loadProducts() {
  loading.value = true
  error.value = ''

  try {
    // Change this only if your backend uses a different public product route.
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
      throw new Error('The product API returned an unexpected response format.')
    }

    products.value = list
  } catch (err) {
    error.value = err.response?.data?.message || err.message || 'Please try again later.'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  restoreView()
  loadProducts()
})
</script>

<template>
  <div class="storefront">
    <CategoryNav v-model:active-category="activeCategory" />

    <main class="store-container">
      <nav class="breadcrumb" aria-label="Breadcrumb">
        <RouterLink to="/">Home</RouterLink>
        <span>/</span>
        <span>Shop</span>
      </nav>

      <div class="shop-layout">
        <!-- No box around the filters: they sit on the page background. -->
        <aside class="sidebar">
          <ProductFilters
              v-model:filters="filters"
              :min-available-price="minAvailablePrice"
              :max-available-price="maxAvailablePrice"
              :brands="availableBrands"
              :warranty-options="availableWarranties"
              :colors="availableColors"
              @apply="applyFilters"
              @reset="applyFilters"
          />
        </aside>

        <section class="shop-main">
          <div class="shop-heading">
            <div>
              <h1>{{ searchQuery ? `Results for "${searchQuery}"` : activeCategory }}</h1>
              <p>{{ visibleProducts.length }} products</p>
            </div>

            <div class="heading-tools">
              <!-- Grid / list view buttons -->
              <div class="view-toggle" role="group" aria-label="Product view">
                <button
                    type="button"
                    class="view-button"
                    :class="{ active: view === 'grid' }"
                    :aria-pressed="view === 'grid'"
                    aria-label="Grid view"
                    title="Grid view"
                    @click="view = 'grid'"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <rect x="3" y="3" width="8" height="8" rx="1" fill="currentColor" />
                    <rect x="13" y="3" width="8" height="8" rx="1" fill="currentColor" />
                    <rect x="3" y="13" width="8" height="8" rx="1" fill="currentColor" />
                    <rect x="13" y="13" width="8" height="8" rx="1" fill="currentColor" />
                  </svg>
                </button>

                <button
                    type="button"
                    class="view-button"
                    :class="{ active: view === 'list' }"
                    :aria-pressed="view === 'list'"
                    aria-label="List view"
                    title="List view"
                    @click="view = 'list'"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <rect x="3" y="4" width="18" height="3" rx="1" fill="currentColor" />
                    <rect x="3" y="10.5" width="18" height="3" rx="1" fill="currentColor" />
                    <rect x="3" y="17" width="18" height="3" rx="1" fill="currentColor" />
                  </svg>
                </button>
              </div>

              <ProductSort v-model:sort-by="sortBy" />
            </div>
          </div>

          <ProductGrid
              :products="visibleProducts"
              :loading="loading"
              :error="error"
              :view="view"
          />

          <button
              v-if="error"
              class="retry-button"
              type="button"
              @click="loadProducts"
          >
            Try again
          </button>
        </section>
      </div>
    </main>
  </div>
</template>

<style scoped>
.storefront {
  min-height: 100vh;
  background: var(--color-store-bg);
}

.store-container {
  width: min(var(--container-store), 94%);
  margin: 0 auto;
  padding: var(--space-6) 0 var(--space-16);
}

.breadcrumb {
  display: flex;
  gap: var(--space-2);
  margin-bottom: var(--space-6);
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
}

.breadcrumb a {
  color: inherit;
  text-decoration: none;
}

.breadcrumb a:hover {
  color: var(--color-primary);
}

.shop-layout {
  display: grid;
  grid-template-columns: 225px minmax(0, 1fr);
  gap: var(--space-8);
  align-items: start;
}

/* Plain column: no border, background, or padding box */
.sidebar {
  min-width: 0;
}

.shop-main {
  min-width: 0;
}

.shop-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  margin-bottom: var(--space-6);
  padding-bottom: var(--space-4);
  border-bottom: 1px solid var(--color-border-soft);
}

.shop-heading h1 {
  margin: 0 0 var(--space-1);
  color: var(--color-text);
  font-family: var(--font-family-display);
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
  letter-spacing: var(--letter-spacing-heading);
}

.shop-heading p {
  margin: 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
}

/* View buttons sit directly before the sort dropdown */
.heading-tools {
  display: flex;
  align-items: center;
  gap: var(--space-5);
  flex-shrink: 0;
}

.view-toggle {
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

.view-button {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  padding: 0;
  border: var(--border-width-field) solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-border);
  cursor: pointer;
  transition: color var(--transition-fast), border-color var(--transition-fast);
}

.view-button svg {
  width: 18px;
  height: 18px;
}

.view-button.active {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.view-button:not(.active):hover {
  border-color: var(--color-text-muted);
  color: var(--color-text-muted);
}

.view-button:focus-visible {
  outline: 2px solid var(--color-focus-outline);
  outline-offset: 2px;
}

.retry-button {
  display: block;
  margin: var(--space-4) auto;
  height: var(--control-height);
  padding: 0 var(--space-6);
  border: 0;
  border-radius: var(--radius-md);
  background: var(--color-primary);
  color: var(--color-on-primary);
  font: inherit;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
}

.retry-button:hover {
  background: var(--color-primary-hover);
}

.retry-button:focus-visible {
  outline: 2px solid var(--color-focus-outline);
  outline-offset: 2px;
}

@media (max-width: 900px) {
  .shop-layout {
    grid-template-columns: 190px minmax(0, 1fr);
    gap: var(--space-5);
  }
}

@media (max-width: 650px) {
  .shop-layout {
    grid-template-columns: minmax(0, 1fr);
    gap: var(--space-5);
  }

  .shop-heading {
    flex-direction: column;
    align-items: flex-start;
  }

  .heading-tools {
    width: 100%;
    justify-content: space-between;
  }

  .shop-heading h1 {
    font-size: var(--font-size-md);
  }
}
</style>
