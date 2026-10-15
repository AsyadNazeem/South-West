<script setup>
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

const props = defineProps({
  product: { type: Object, required: true },
  layout: { type: String, default: 'grid' },
})

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


const BACKEND_URL = (
    import.meta.env.VITE_API_URL || 'http://localhost:5001/api'
).replace(/\/api\/?$/, '')

const image = computed(() => {
  const value =
      props.product.image ||
      props.product.image_url ||
      props.product.thumbnail ||
      ''

  if (!value) return ''

  // Preserve absolute URLs.
  if (/^https?:\/\//i.test(value)) {
    return value
  }

  // Resolve relative upload paths against the backend.
  return `${BACKEND_URL}/${value.replace(/^\/+/, '')}`
})


const rating = computed(() => Number(props.product.rating) || 0)
const roundedRating = computed(() => Math.round(rating.value))

const inStock = computed(() =>
    props.product.in_stock !== false && Number(props.product.stock_quantity ?? 1) > 0,
)

const link = computed(() => `/product/${props.product.slug ?? props.product.id}`)

function formatPrice(value) {
  return `Rs. ${Number(value).toLocaleString('en-LK', { maximumFractionDigits: 0 })}`
}
</script>

<template>
  <li class="product-card" :class="{ 'is-out': !inStock, 'is-list': layout === 'list' }">
    <RouterLink :to="link" class="card-link">
      <div class="image-wrap">
        <img v-if="image" :src="image" :alt="name" loading="lazy" />
        <span v-else class="image-fallback" aria-hidden="true">
          {{ name.charAt(0).toUpperCase() }}
        </span>

        <span v-if="discountPercent" class="tag discount">-{{ discountPercent }}%</span>
        <span v-if="!inStock" class="tag out">Out of stock</span>
      </div>

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
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--color-border-soft);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}

.product-card:hover {
  border-color: var(--color-border);
  box-shadow: var(--shadow-sm);
}

.card-link {
  display: flex;
  flex: 1;
  flex-direction: column;
  color: inherit;
  text-decoration: none;
}

.card-link:focus-visible {
  outline: 2px solid var(--color-focus-outline);
  outline-offset: -2px;
}

/* Image */
.image-wrap {
  position: relative;
  display: grid;
  place-items: center;
  aspect-ratio: 1 / 1;
  padding: var(--space-4);
  background: var(--color-surface-muted);
}

.image-wrap img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  transition: transform var(--transition-base);
}

.product-card:hover .image-wrap img {
  transform: scale(1.04);
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

.tag {
  position: absolute;
  top: var(--space-2);
  padding: 2px var(--space-2);
  border-radius: var(--radius-pill);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  line-height: 1.4;
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

/* Body */
.body {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: var(--space-1);
  padding: var(--space-3) var(--space-4) var(--space-4);
}

.brand {
  margin: 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.name {
  display: -webkit-box;
  min-height: calc(var(--font-size-sm) * 1.35 * 2);
  margin: 0;
  overflow: hidden;
  color: var(--color-text);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  line-height: 1.35;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.rating {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin: 0;
  font-size: var(--font-size-xs);
}

.stars {
  color: var(--color-primary);
  letter-spacing: 1px;
}

.rating-value {
  color: var(--color-text-muted);
}

.price-row {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: var(--space-2);
  margin-top: auto;
  padding-top: var(--space-2);
}

.price {
  color: var(--color-primary);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-bold);
}

.old-price {
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
}

/* Out of stock: dim the image only */
.product-card.is-out .image-wrap img {
  opacity: 0.55;
}

.product-card.is-list .card-link {
  flex-direction: row;
}

.product-card.is-list .image-wrap {
  width: 160px;
  flex-shrink: 0;
  aspect-ratio: auto;
  min-height: 160px;
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

@media (max-width: 560px) {
  .product-card.is-list .image-wrap {
    width: 110px;
    min-height: 110px;
  }
}

@media (max-width: 420px) {
  .image-wrap {
    padding: var(--space-3);
  }

  .body {
    padding: var(--space-2) var(--space-3) var(--space-3);
  }

  .name {
    font-size: var(--font-size-xs);
  }

  .price {
    font-size: var(--font-size-sm);
  }
}

@media (prefers-reduced-motion: reduce) {
  .image-wrap img,
  .product-card {
    transition: none;
  }

  .product-card:hover .image-wrap img {
    transform: none;
  }
}
</style>
