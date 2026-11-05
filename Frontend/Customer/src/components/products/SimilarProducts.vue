<script setup>
import { ref, watch } from 'vue'
import api from '@/services/api'
import ProductGrid from '@/components/products/ProductGrid.vue'

const props = defineProps({
  productId: {
    type: [Number, String],
    required: true,
  },
})

const products = ref([])
const loading = ref(false)

let requestVersion = 0

async function loadSimilarProducts() {
  const version = ++requestVersion

  products.value = []

  if (!props.productId) return

  loading.value = true

  try {
    const response = await api.get(
      `/store/products/${encodeURIComponent(props.productId)}/related`
    )

    if (version !== requestVersion) return

    const result = response.data?.data

    products.value = Array.isArray(result) ? result : []
  } catch (error) {
    console.error('Unable to load similar products:', error)
    products.value = []
  } finally {
    if (version === requestVersion) {
      loading.value = false
    }
  }
}

watch(
  () => props.productId,
  loadSimilarProducts,
  { immediate: true }
)
</script>

<template>
  <section
    v-if="loading || products.length"
    class="similar-products"
    aria-labelledby="similar-products-heading"
  >
    <div class="similar-products-header">
      <div>
        <p class="similar-eyebrow">DISCOVER MORE</p>
        <h2 id="similar-products-heading">Similar Products</h2>
        <p class="similar-description">
          You might also be interested in these products.
        </p>
      </div>
    </div>

    <ProductGrid
      :products="products"
      :loading="loading"
      view="grid"
    />
  </section>
</template>

<style scoped>
.similar-products {
  width: min(1280px, 94%);
  margin: 34px auto 0;
}

.similar-products-header {
  margin-bottom: 20px;
}

.similar-eyebrow {
  margin: 0 0 5px;
  color: var(--color-primary);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: .1em;
}

.similar-products-header h2 {
  margin: 0;
  color: var(--color-text);
  font-size: clamp(21px, 2.5vw, 27px);
  font-weight: 750;
}

.similar-description {
  margin: 7px 0 0;
  color: var(--color-text-muted);
  font-size: 14px;
}
</style>
