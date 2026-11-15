<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import api from '@/services/api'
import ProductCard from '@/components/products/ProductCard.vue'

const props = defineProps({
  category: { type: Object, required: true },
  // Flat list of all categories (used to include sub-categories)
  allCategories: { type: Array, default: () => [] },
  limit: { type: Number, default: 12 },
})

const emit = defineEmits(['select-category'])

const root = ref(null)
const track = ref(null)
const products = ref([])
const loading = ref(true)
const failed = ref(false)
const canScrollLeft = ref(false)
const canScrollRight = ref(false)

let observer = null
let started = false

function getDescendantIds(parentId) {
  const ids = new Set([Number(parentId)])
  let changed = true

  while (changed) {
    changed = false
    for (const c of props.allCategories) {
      if (c.parent_id == null) continue
      const id = Number(c.id)
      if (ids.has(Number(c.parent_id)) && !ids.has(id)) {
        ids.add(id)
        changed = true
      }
    }
  }
  return ids
}

async function load() {
  if (started) return
  started = true

  try {
    const response = await api.get('/store/products', {
      params: {
        paginate: 1,
        limit: props.limit,
        sort: 'relevance',
        categoryIds: Array.from(getDescendantIds(props.category.id)).join(','),
      },
    })
    products.value = Array.isArray(response.data?.data) ? response.data.data : []
  } catch (err) {
    console.error(`Failed to load rail for category ${props.category.id}:`, err)
    failed.value = true
  } finally {
    loading.value = false
    await nextTick()
    updateArrows()
  }
}

function updateArrows() {
  const el = track.value
  if (!el) return
  canScrollLeft.value = el.scrollLeft > 4
  canScrollRight.value = el.scrollLeft + el.clientWidth < el.scrollWidth - 4
}

function scrollByPage(direction) {
  const el = track.value
  if (!el) return
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  el.scrollBy({
    left: direction * el.clientWidth * 0.85,
    behavior: reduce ? 'auto' : 'smooth',
  })
}

// Hide the whole rail if the category has no products
const visible = computed(() => loading.value || products.value.length > 0)

onMounted(() => {
  if (!('IntersectionObserver' in window)) {
    load()
    return
  }

  observer = new IntersectionObserver(
    entries => {
      if (entries.some(e => e.isIntersecting)) {
        observer.disconnect()
        load()
      }
    },
    { rootMargin: '400px 0px' },
  )
  observer.observe(root.value)
  window.addEventListener('resize', updateArrows, { passive: true })
})

onBeforeUnmount(() => {
  observer?.disconnect()
  window.removeEventListener('resize', updateArrows)
})
</script>

<template>
  <section
    v-if="visible && !failed"
    ref="root"
    class="category-rail"
    :aria-label="`${category.name} products`"
  >
    <header class="rail-header">
      <h2>{{ category.name }}</h2>

      <button
        type="button"
        class="rail-view-all"
        @click="emit('select-category', category)"
      >
        View all
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M5 12h14m-6-6 6 6-6 6"
            stroke="currentColor"
            stroke-width="2.2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </button>
    </header>

    <div class="rail-wrap">
      <button
        v-show="canScrollLeft"
        type="button"
        class="rail-arrow rail-prev"
        :aria-label="`Scroll ${category.name} left`"
        @click="scrollByPage(-1)"
      >
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="m15 6-6 6 6 6" stroke="currentColor" stroke-width="2.2"
                stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>

      <ul
        v-if="loading"
        class="rail-track"
        aria-busy="true"
        aria-label="Loading products"
      >
        <li v-for="n in 6" :key="n" class="rail-skeleton" aria-hidden="true">
          <div class="sk-image"></div>
          <div class="sk-line short"></div>
          <div class="sk-line"></div>
        </li>
      </ul>

      <ul
        v-else
        ref="track"
        class="rail-track"
        tabindex="0"
        @scroll.passive="updateArrows"
      >
        <ProductCard
          v-for="(product, index) in products"
          :key="product.id ?? product.slug ?? index"
          :product="product"
          layout="grid"
        />
      </ul>

      <button
        v-show="canScrollRight"
        type="button"
        class="rail-arrow rail-next"
        :aria-label="`Scroll ${category.name} right`"
        @click="scrollByPage(1)"
      >
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="m9 6 6 6-6 6" stroke="currentColor" stroke-width="2.2"
                stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>
    </div>
  </section>

  <!-- Keeps a node for the observer while the rail is still loading -->
  <div v-else-if="!started" ref="root" />
</template>

<style scoped>
.category-rail {
  --rail-card-w: clamp(160px, 22vw, 230px);
  margin-top: var(--space-10);
}

.rail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  margin-bottom: var(--space-4);
}

.rail-header h2 {
  margin: 0;
  color: var(--color-text);
  font-family: var(--font-family-display);
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
}

.rail-view-all {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0;
  border: 0;
  background: none;
  color: var(--color-primary);
  cursor: pointer;
  font: inherit;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
}

.rail-view-all svg {
  width: 16px;
  height: 16px;
  transition: transform var(--transition-fast);
}

.rail-view-all:hover svg {
  transform: translateX(3px);
}

.rail-view-all:focus-visible,
.rail-arrow:focus-visible,
.rail-track:focus-visible {
  outline: 2px solid var(--color-focus-outline);
  outline-offset: 2px;
}

.rail-wrap {
  position: relative;
}

.rail-track {
  display: flex;
  gap: var(--space-4);
  margin: 0;
  padding: 2px 2px var(--space-3);
  list-style: none;
  overflow-x: auto;
  overscroll-behavior-x: contain;
  scroll-snap-type: x proximity;
  scrollbar-width: none;
}

.rail-track::-webkit-scrollbar {
  display: none;
}

/* Every product card gets a fixed width inside the rail */
.rail-track > :deep(*) {
  flex: 0 0 var(--rail-card-w);
  min-width: 0;
  scroll-snap-align: start;
}

/* Arrows */
.rail-arrow {
  position: absolute;
  top: 40%;
  z-index: 2;
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  padding: 0;
  border: 1px solid var(--color-border-soft);
  border-radius: 50%;
  background: var(--color-surface);
  box-shadow: var(--shadow-md);
  color: var(--color-text);
  cursor: pointer;
  transform: translateY(-50%);
}

.rail-arrow svg {
  width: 18px;
  height: 18px;
}

.rail-prev { left: -12px; }
.rail-next { right: -12px; }

.rail-arrow:hover {
  background: var(--color-surface-muted);
}

/* Touch devices swipe instead */
@media (pointer: coarse) {
  .rail-arrow {
    display: none;
  }
}

/* Skeleton */
.rail-skeleton {
  display: grid;
  gap: var(--space-2);
  padding-bottom: var(--space-3);
  border: 1px solid var(--color-border-soft);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  overflow: hidden;
}

.sk-image,
.sk-line {
  background: var(--color-surface-muted);
  animation: pulse 1.4s ease-in-out infinite;
}

.sk-image { aspect-ratio: 1 / 1; }

.sk-line {
  height: 10px;
  margin: 0 var(--space-3);
  border-radius: var(--radius-sm);
}

.sk-line.short { width: 35%; }

@media (max-width: 650px) {
  .category-rail {
    --rail-card-w: 44vw;
    margin-top: var(--space-8);
  }

  .rail-header h2 {
    font-size: var(--font-size-md);
  }

  .rail-track {
    gap: var(--space-3);
  }
}

@media (prefers-reduced-motion: reduce) {
  .sk-image,
  .sk-line {
    animation: none;
  }

  .rail-view-all svg {
    transition: none;
  }
}
</style>