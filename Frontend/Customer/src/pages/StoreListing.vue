<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import api from '@/services/api'
import ProductGrid from '@/components/products/ProductGrid.vue'
import ProductSort from '@/components/products/ProductSort.vue'
import { analyticsItem, trackEvent } from '@/services/analytics'
import { itemListSchema, setStructuredData } from '@/utils/structuredData'

const route = useRoute()
const products = ref([])
const categories = ref([])
const loading = ref(true)
const loadingMore = ref(false)
const error = ref('')
const sortBy = ref('relevance')

const hasMore = ref(false)
const nextCursor = ref(null)
const shuffleSeed = ref(null)
let latestLoadId = 0

const selectedCategoryId = computed(() => {
  const value = Number(route.query.category)
  return Number.isInteger(value) && value > 0 ? value : null
})

const selectedBrandId = computed(() => {
  const value = Number(route.query.brand)
  return Number.isInteger(value) && value > 0 ? value : null
})

function getCategoryIds(parentId) {
  const ids = new Set([Number(parentId)])
  let changed = true

  while (changed) {
    changed = false

    function visit(items) {
      for (const item of items || []) {
        if (
          item.parent_id != null &&
          ids.has(Number(item.parent_id)) &&
          !ids.has(Number(item.id))
        ) {
          ids.add(Number(item.id))
          changed = true
        }

        visit(item.children)
      }
    }

    visit(categories.value)
  }

  return ids
}

const isOffers = computed(() => route.path === '/offers')
const title = computed(() => isOffers.value ? 'Special Offers' : 'All Products')
const description = computed(() => isOffers.value
  ? 'Explore products with active discounts and special prices.'
  : 'Browse our complete collection of products.')

const visibleProducts = computed(() => products.value)

function getStructuredProductPath(product) {
  const slug = String(product?.slug || '').trim()
  const publicId = String(product?.public_id || '').trim()
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(slug)) return ''
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(publicId)) return ''
  return `/product/${slug}-${publicId}`
}

function updateItemListSchema() {
  const seen = new Set()
  const entries = products.value.flatMap(product => {
    const path = getStructuredProductPath(product)
    const id = String(product?.public_id || '')
    if (!path || !id || seen.has(id)) return []
    seen.add(id)
    return [{
      name: product.item_name || product.name || product.product_name || '',
      path,
    }]
  })
  setStructuredData('item-list', itemListSchema(entries))
}

async function loadProducts(reset = true) {
  const requestId = reset ? ++latestLoadId : latestLoadId
  if (reset) {
    products.value = []
    nextCursor.value = null
    shuffleSeed.value = null
    hasMore.value = false
    loading.value = true
    error.value = ''
    setStructuredData('item-list', null)
  } else {
    if (loading.value || loadingMore.value || !hasMore.value) return
    loadingMore.value = true
  }

  try {
    const params = {
      paginate: 1,
      limit: 20,
      sort: sortBy.value,
    }

    if (shuffleSeed.value) params.seed = shuffleSeed.value
    if (!reset && nextCursor.value) params.cursor = nextCursor.value

    if (selectedCategoryId.value !== null) {
      params.categoryIds = [...getCategoryIds(
        selectedCategoryId.value
      )].join(',')
    }

    if (selectedBrandId.value !== null) {
      params.brandIds = String(selectedBrandId.value)
    }

    if (isOffers.value) params.offers = 1

    const response = await api.get('/store/products', { params })
    if (requestId !== latestLoadId) return
    const payload = response.data
    const list = Array.isArray(payload?.data) ? payload.data : null

    if (!list || !payload?.pagination) {
      throw new Error('Unexpected paginated product API response.')
    }

    const mappedProducts = list.map(product => {
      const discountedPrice = Number(
        product.price ?? product.selling_price
      ) || 0

      const discount = Number(product.discount_amount) || 0

      return {
        ...product,
        price: discountedPrice,
        compare_at_price: Number(
          product.compare_at_price ??
          product.original_price ??
          product.mrp ??
          (discount > 0 ? discountedPrice + discount : 0)
        ) || 0,
      }
    })

    if (reset) {
      products.value = mappedProducts
      trackEvent('view_item_list', {
        item_list_name: isOffers.value ? 'Special Offers' : 'All Products',
        items: mappedProducts.map(product => analyticsItem(product)),
      })
    } else {
      const existingIds = new Set(
        products.value.map(product => String(product.public_id || product.id))
      )

      products.value.push(...mappedProducts.filter(product => {
        const id = String(product.public_id || product.id || '')
        if (!id || existingIds.has(id)) return false
        existingIds.add(id)
        return true
      }))
    }

    updateItemListSchema()

    shuffleSeed.value = payload.pagination.seed
    nextCursor.value = payload.pagination.nextCursor
    hasMore.value = Boolean(payload.pagination.hasMore)
  } catch (err) {
    if (requestId === latestLoadId) {
      error.value = err.response?.data?.message ||
        err.message ||
        'Please try again later.'
    }
  } finally {
    if (requestId === latestLoadId) {
      loading.value = false
      loadingMore.value = false
    }
  }
}

async function loadCategories() {
  try {
    const response = await api.get('/store/categories')
    const payload = response.data

    categories.value = Array.isArray(payload?.data) ? payload.data
      : Array.isArray(payload) ? payload : []
  } catch {
    categories.value = []
  }
}

watch(
  [
    () => route.path,
    () => route.query.category,
    () => route.query.brand,
    sortBy,
  ],
  () => loadProducts(true)
)

onMounted(async () => {
  await loadCategories()
  await loadProducts(true)
})

onBeforeUnmount(() => setStructuredData('item-list', null))
</script>

<template>
  <main class="store-page">
    <div class="store-container">
      <nav class="store-breadcrumb" aria-label="Breadcrumb">
        <RouterLink to="/">Home</RouterLink>
        <span>/</span>
        <span>{{ title }}</span>
      </nav>

      <header class="store-heading">
        <div>
          <p class="store-eyebrow">SOUTH WEST STORE</p>
          <h1>{{ title }}</h1>
          <p>{{ description }}</p>
        </div>
        <RouterLink v-if="isOffers" to="/shop" class="store-text-link">
          View all products
        </RouterLink>
      </header>

      <div class="store-toolbar">
        <span>{{ loading ? 'Loading products...' : `${visibleProducts.length} products` }}</span>
        <ProductSort v-model:sort-by="sortBy" />
      </div>

      <ProductGrid
        :products="visibleProducts"
        :loading="loading"
        :error="error"
      />

      <div v-if="hasMore && !loading" class="load-more-container">
        <button
          class="load-more-button"
          type="button"
          :disabled="loadingMore"
          @click="loadProducts(false)"
        >
          {{ loadingMore ? 'Loading...' : 'Load More' }}
        </button>
      </div>

      <button
        v-if="error"
        class="retry-button"
        type="button"
        @click="loadProducts(products.length === 0)"
      >
        Try again
      </button>
    </div>
  </main>
</template>

<style scoped>
.store-page {
  min-height: 55vh;
  padding: 28px 0 64px;
  background: var(--color-background, #f8f9fb);
}
.store-container {
  width: min(100% - 40px, 1440px);
  margin: 0 auto;
}
.store-breadcrumb {
  display: flex;
  gap: 10px;
  margin-bottom: 28px;
  color: var(--color-text-muted, #777);
  font-size: 13px;
}
.store-breadcrumb a {
  color: inherit;
  text-decoration: none;
}
.store-breadcrumb a:hover,
.store-text-link:hover {
  color: var(--color-primary, #263b63);
}
.store-heading {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 28px;
}
.store-eyebrow {
  margin: 0 0 8px;
  color: var(--color-primary, #263b63);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: .14em;
}
.store-heading h1 {
  margin: 0;
  color: var(--color-text, #20242b);
  font-size: clamp(28px, 4vw, 42px);
  font-weight: 750;
}
.store-heading p:not(.store-eyebrow) {
  margin: 9px 0 0;
  color: var(--color-text-muted, #737985);
  line-height: 1.6;
}
.store-text-link {
  color: var(--color-primary, #263b63);
  font-weight: 650;
  text-decoration: none;
  white-space: nowrap;
}
.store-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 22px;
  padding: 14px 0;
  border-top: 1px solid var(--color-border, #e5e7eb);
  border-bottom: 1px solid var(--color-border, #e5e7eb);
  color: var(--color-text-muted, #737985);
  font-size: 13px;
}
@media (max-width: 600px) {
  .store-container { width: min(100% - 28px, 1440px); }
  .store-heading { align-items: flex-start; flex-direction: column; }
  .store-toolbar { align-items: flex-start; flex-direction: column; }
}

.load-more-container {
  display: flex;
  justify-content: center;
  padding: 28px 0 40px;
}

.load-more-button {
  min-width: 160px;
  padding: 12px 28px;
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 8px;
  background: transparent;
  color: inherit;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.load-more-button:hover:not(:disabled) {
  background: var(--color-primary, #263b63);
  color: white;
}

.load-more-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

</style>
