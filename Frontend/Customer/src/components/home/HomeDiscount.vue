<script setup>
import { computed } from 'vue'
import ProductCard from '../products/ProductCard.vue'

const props = defineProps({
  products: {
    type: Array,
    default: () => []
  }
})

console.log('HomeDiscount products:', props.products)

const RAIL_SIZE = 12


function productPrice(product) {
  return Number(product.price ?? product.selling_price ?? 0)
}

function comparePrice(product) {
  return Number(
    product.original_price ??
    product.compare_at_price ??
    product.mrp ??
    0
  )
}

function productKey(product, index) {
  return product.id ?? product.slug ?? index
}

function getCampaignName(product) {
  return (
    product.discount_campaign?.campaign_name ||
    product.campaign?.campaign_name ||
    product.discount_campaign_name ||
    product.campaign_name ||
    'Special Offers'
  )
}

// Use the discount fields returned by the backend.
const dealProducts = computed(() =>
  props.products
    .filter(product => {
      const original = comparePrice(product)
      const price = productPrice(product)

      return (
        product.discount_campaign != null &&
        Number(product.discount_amount) > 0 &&
        original > price
      )
    })
    .sort(
      (a, b) =>
        Number(b.discount_percentage || 0) -
        Number(a.discount_percentage || 0)
    )
)

// Display a campaign even if it contains only one discounted product.
const discountCampaignRails = computed(() => {
  const groups = new Map()

  for (const product of dealProducts.value) {
    const campaignName = getCampaignName(product)

    if (!groups.has(campaignName)) {
      groups.set(campaignName, [])
    }

    groups.get(campaignName).push(product)
  }

  return Array.from(groups, ([name, products]) => ({
    key: `campaign-${name}`,
    title: name,
    subtitle: 'Special offers from this campaign',
    products: products.slice(0, RAIL_SIZE)
  }))
})

// Keep the top-rated section as a separate optional rail.
const topRatedProducts = computed(() =>
  props.products
    .filter(product => Number(product.rating) >= 4)
    .sort((a, b) => Number(b.rating) - Number(a.rating))
    .slice(0, RAIL_SIZE)
)

const rails = computed(() => [
  ...discountCampaignRails.value,
  ...(topRatedProducts.value.length
    ? [{
        key: 'top-rated',
        title: 'Top rated',
        subtitle: 'Highest customer ratings',
        products: topRatedProducts.value
      }]
    : [])
])


function scrollRail(event, direction) {
  const rail = event.currentTarget
    .closest('.rail-section')
    ?.querySelector('.product-rail')

  if (!rail) return

  rail.scrollBy({
    left: direction * rail.clientWidth * 0.85,
    behavior: window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches
      ? 'auto'
      : 'smooth'
  })
}
</script>

<template>
  <section
    v-if="rails.length"
    class="landing-section"
    aria-label="Featured products"
  >
    <div
      v-for="rail in rails"
      :key="rail.key"
      class="rail-section"
    >
      <div class="section-head">
        <div>
          <h2>{{ rail.title }}</h2>
          <p>{{ rail.subtitle }}</p>
        </div>

        <div class="rail-controls">
          <button
            type="button"
            class="rail-arrow"
            :aria-label="`Scroll ${rail.title} left`"
            @click="scrollRail($event, -1)"
          >
            ‹
          </button>

          <button
            type="button"
            class="rail-arrow"
            :aria-label="`Scroll ${rail.title} right`"
            @click="scrollRail($event, 1)"
          >
            ›
          </button>
        </div>
      </div>

      <ul class="product-rail">
        <ProductCard
          v-for="(product, index) in rail.products"
          :key="productKey(product, index)"
          :product="product"
          layout="grid"
        />
      </ul>
    </div>
  </section>
</template>

<style scoped>
.landing-section {
  margin-top: var(--space-10);
}

.rail-section + .rail-section {
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

.rail-controls {
  display: flex;
  gap: var(--space-2);
}

.rail-arrow {
  width: 38px;
  height: 38px;
  border: 1px solid var(--color-border);
  border-radius: 50%;
  background: var(--color-surface);
  color: var(--color-primary);
  cursor: pointer;
}

.rail-arrow:hover {
  background: var(--color-background);
}

.rail-arrow:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 3px;
}

.product-rail {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: calc((100% - 60px) / 6);
  gap: 12px;
  overflow-x: auto;
  overflow-y: hidden;
  padding: 4px 2px 12px;
  margin: 0;
  list-style: none;
  scroll-snap-type: x mandatory;
  scrollbar-width: thin;
}

.product-rail > * {
  min-width: 0;
  scroll-snap-align: start;
}

@media (max-width: 1200px) {
  .product-rail {
    grid-auto-columns: calc((100% - 36px) / 4);
  }
}

@media (max-width: 768px) {
  .product-rail {
    grid-auto-columns: calc((100% - 12px) / 2);
  }

  .rail-controls {
    display: none;
  }
}
</style>