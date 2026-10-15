<script setup>
import ProductCard from './ProductCard.vue'

defineProps({
  products: {
    type: Array,
    default: () => [],
  },
  loading: Boolean,
  error: String,
  // 'grid' shows cards in columns, 'list' shows one wide card per row.
  view: {
    type: String,
    default: 'grid',
  },
})

const skeletonCount = 8
</script>

<template>
  <ul
      v-if="loading"
      class="product-grid"
      :class="{ 'is-list': view === 'list' }"
      aria-busy="true"
      aria-label="Loading products"
  >
    <li v-for="n in skeletonCount" :key="n" class="skeleton-card" aria-hidden="true">
      <div class="skeleton-image"></div>
      <div class="skeleton-body">
        <div class="skeleton-line short"></div>
        <div class="skeleton-line"></div>
        <div class="skeleton-line price"></div>
      </div>
    </li>
  </ul>

  <div v-else-if="error" class="state" role="alert">
    <p class="state-title">We could not load products</p>
    <p class="state-text">{{ error }}</p>
  </div>

  <ul
      v-else-if="products.length"
      class="product-grid"
      :class="{ 'is-list': view === 'list' }"
  >
    <ProductCard
        v-for="(product, index) in products"
        :key="product.id ?? product.slug ?? index"
        :product="product"
        :layout="view"
    />
  </ul>

  <div v-else class="state">
    <p class="state-title">No products found</p>
    <p class="state-text">Try a different category, or clear some filters.</p>
  </div>
</template>

<style scoped>
/* Grid view: four across on desktop, fewer on smaller screens */
.product-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--space-5);
  margin: 0;
  padding: 0;
  list-style: none;
}

@media (max-width: 1200px) {
  .product-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 860px) {
  .product-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-4);
  }
}

@media (max-width: 420px) {
  .product-grid {
    gap: var(--space-3);
  }
}

/* List view: one wide card per row at every screen size */
.product-grid.is-list {
  grid-template-columns: minmax(0, 1fr);
  gap: var(--space-4);
}

/* Loading placeholders */
.skeleton-card {
  overflow: hidden;
  border: 1px solid var(--color-border-soft);
  border-radius: var(--radius-md);
  background: var(--color-surface);
}

.skeleton-image,
.skeleton-line {
  background: var(--color-surface-muted);
  animation: pulse 1.4s ease-in-out infinite;
}

.skeleton-image {
  aspect-ratio: 1 / 1;
}

.skeleton-body {
  display: grid;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4) var(--space-4);
}

.skeleton-line {
  height: 10px;
  border-radius: var(--radius-sm);
}

.skeleton-line.short {
  width: 35%;
}

.skeleton-line.price {
  width: 50%;
  height: 12px;
  margin-top: var(--space-2);
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

/* Empty and error states span the full grid */
.state {
  grid-column: 1 / -1;
  padding: var(--space-10) var(--space-5);
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  text-align: center;
}

.state-title {
  margin: 0 0 var(--space-1);
  color: var(--color-text);
  font-family: var(--font-family-display);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-bold);
}

.state-text {
  margin: 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

@media (prefers-reduced-motion: reduce) {
  .skeleton-image,
  .skeleton-line {
    animation: none;
  }
}
</style>
