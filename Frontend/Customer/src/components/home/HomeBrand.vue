

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import api from '../../services/api'

const props = defineProps({
  products: {
    type: Array,
    default: () => []
  }
})

const router = useRouter()
const brands = ref([])
const loading = ref(false)
const showAll = ref(false)

import { getMediaUrl } from '../../utils/mediaUrl'

// Get brand IDs that have at least one available product.
const productBrandIds = computed(() => {
  return new Set(
    props.products
      .map(product =>
        product.brand_id ??
        product.brandId ??
        product.brand?.id ??
        product.Brand?.id
      )
      .filter(id => id !== null && id !== undefined)
      .map(id => String(id))
  )
})

// Only display brands that have products.
const brandsWithProducts = computed(() =>
  brands.value.filter(brand =>
    productBrandIds.value.has(String(brand.id))
  )
)

const visibleBrands = computed(() =>
  showAll.value
    ? brandsWithProducts.value
    : brandsWithProducts.value.slice(0, 10)
)

function getImageUrl(path) {
  return getMediaUrl(path)
}

async function loadBrands() {
  loading.value = true

  try {
    const response = await api.get('/store/brands')
    const payload = response.data

    const list = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.data)
        ? payload.data
        : Array.isArray(payload?.brands)
          ? payload.brands
          : Array.isArray(payload?.data?.brands)
            ? payload.data.brands
            : []

    brands.value = list.filter(
      brand => brand.is_active !== false
    )
  } catch (error) {
    console.error('Failed to load brands:', error)
    brands.value = []
  } finally {
    loading.value = false
  }
}

function selectBrand(brand) {
  router.push({
    path: '/',
    query: { brand: String(brand.id) }
  })
}

onMounted(loadBrands)
</script>


<template>
<section
  v-if="brandsWithProducts.length || loading"
    class="brand-section"
    aria-labelledby="homepage-brands-title"
  >
    <div class="section-head">
      <div>
        <h2 id="homepage-brands-title">Brands</h2>
        <p>Shop your favourite brands</p>
      </div>

      <button
v-if="brandsWithProducts.length > 10"
        type="button"
        class="view-all-brands"
        @click="showAll = !showAll"
      >
        {{ showAll ? 'Show less' : 'View all' }}
        <span aria-hidden="true">{{ showAll ? '↑' : '→' }}</span>
      </button>
    </div>

    <p v-if="loading && !brands.length" class="brands-loading">
      Loading brands...
    </p>

    <div v-else class="brand-grid">
      <button
        v-for="brand in visibleBrands"
        :key="brand.id"
        type="button"
        class="brand-card"
        :aria-label="`Shop ${brand.name}`"
@click="selectBrand(brand)"
      >
        <div class="brand-image-wrap">
          <img
            v-if="brand.image_url || brand.logo_url"
            :src="getImageUrl(brand.image_url || brand.logo_url)"
            :alt="brand.name"
            loading="lazy"
            @error="$event.target.style.display = 'none'"
          />
          <span
            v-else
            class="brand-name-fallback"
          >
            {{ brand.name }}
          </span>
        </div>
      </button>
    </div>
  </section>
</template>

<style scoped>
.brand-section {
  margin-top: var(--space-8);
}

.section-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--space-4);
  margin-bottom: var(--space-4);
}

.section-head h2 {
  margin: 0 0 var(--space-1);
  color: var(--color-text);
  font-family: var(--font-family-display);
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
}

.section-head p {
  margin: 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
}

.view-all-brands {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 9px 14px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-pill);
  background: var(--color-surface);
  color: var(--color-primary);
  cursor: pointer;
  white-space: nowrap;
}

.brand-grid {
  display: grid;
  grid-template-columns: repeat(10, minmax(0, 1fr));
  gap: 12px;
}

.brand-card {
  display: grid;
  place-items: center;
  min-width: 0;
  aspect-ratio: 1;
  padding: 12px;
  overflow: hidden;
  border: 1px solid var(--color-border-soft);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  cursor: pointer;
}

.brand-card:hover {
  border-color: var(--color-border);
  box-shadow: var(--shadow-sm);
}

.brand-image-wrap {
  display: grid;
  place-items: center;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.brand-image-wrap img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.brand-name-fallback {
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
  text-align: center;
  overflow-wrap: anywhere;
}

.brands-loading {
  padding: 24px;
  color: var(--color-text-muted);
  text-align: center;
}

@media (max-width: 1100px) {
  .brand-grid {
    grid-template-columns: repeat(6, minmax(0, 1fr));
  }
}

@media (max-width: 760px) {
  .brand-grid {
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 8px;
  }

  .brand-card {
    padding: 8px;
  }
}

@media (max-width: 420px) {
  .brand-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
</style>
