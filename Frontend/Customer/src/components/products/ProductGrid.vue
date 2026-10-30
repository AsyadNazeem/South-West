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

// 12 divides evenly into 1, 2, 3 and 4 columns, so the last row is never partial.
const skeletonCount = 12
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
/*
 * Grid view: up to four columns. The column count follows the width the grid
 * actually gets (with or without the filter sidebar), so it works on any
 * screen, including foldables, without viewport breakpoints.
 */
.product-grid {
  --card-min: 160px;
  --max-cols: 5;
  --grid-gap: var(--space-5);

  display: grid;
  grid-template-columns: repeat(
      auto-fill,
      minmax(
          min(
              100%,
              max(
                  var(--card-min),
                  calc((100% - (var(--max-cols) - 1) * var(--grid-gap)) / var(--max-cols))
              )
          ),
          1fr
      )
  );
  gap: var(--grid-gap);
  margin: 0;
  padding: 0;
  list-style: none;
}

@media (max-width: 860px) {
  .product-grid {
    --grid-gap: var(--space-4);
  }
}

/* Phones: two columns down to ≈300px wide. Fold cover screens below that get one. */
@media (max-width: 600px) {
  .product-grid {
    --card-min: 140px;
  }
}

@media (max-width: 420px) {
  .product-grid {
    --grid-gap: var(--space-3);
  }
}

/* List view: one wide card per row at every screen size */
.product-grid.is-list {
  --grid-gap: var(--space-4);
  grid-template-columns: minmax(0, 1fr);
}

/* Loading placeholders */
.skeleton-card {
  overflow: hidden;
  border: 1px solid var(--color-border-soft);
  border-radius: var(--radius-md);
  background: var(--color-surface);
}

/* List view: image beside the text, not a full-width square */
.product-grid.is-list .skeleton-card {
  display: grid;
  grid-template-columns: clamp(110px, 28%, 200px) minmax(0, 1fr);
}

.product-grid.is-list .skeleton-body {
  align-content: center;
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

@media (max-width: 600px) {
  .state {
    padding: var(--space-8) var(--space-4);
  }
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
  overflow-wrap: anywhere;
}

@media (prefers-reduced-motion: reduce) {
  .skeleton-image,
  .skeleton-line {
    animation: none;
  }
}
</style>