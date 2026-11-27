<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

const emit = defineEmits(['select-category'])
const props = defineProps({
  loading: Boolean,
  categories: {
    type: Array,
    default: () => []
  }
})

import {
  getResponsiveImageSrcSet,
  getResponsiveImageUrl,
} from '@/utils/mediaUrl'

const failedCategoryImages = ref(new Set())
const showAll = ref(false)
const columnCount = ref(9)
const initialCount = computed(() => {
  if (columnCount.value === 9) return 9
  if (columnCount.value === 6) return 18
  return columnCount.value * 2
})
const visibleCategories = computed(() => showAll.value
  ? props.categories
  : props.categories.slice(0, initialCount.value))

function updateColumnCount() {
  const width = window.innerWidth
  columnCount.value = width <= 420 ? 3 : width <= 760 ? 5 : width <= 1100 ? 6 : 9
}

onMounted(() => {
  updateColumnCount()
  window.addEventListener('resize', updateColumnCount, { passive: true })
})
onBeforeUnmount(() => window.removeEventListener('resize', updateColumnCount))

function handleCategoryImageError(categoryId) {
  failedCategoryImages.value.add(String(categoryId))
}

function getCategoryImage(category) {
  return {
    src: getResponsiveImageUrl(category),
    srcset: getResponsiveImageSrcSet(category?.responsive_images),
  }
}

</script>

<template>
  <section
    v-if="loading || props.categories.length"
    :aria-busy="loading"
    class="category-section"
    aria-labelledby="homepage-categories-title"
  >
    <div class="category-section-heading">
      <h2 id="homepage-categories-title">Categories</h2>

      <button
        v-if="!loading && props.categories.length > initialCount"
        type="button"
        class="view-all-categories"
        aria-controls="homepage-category-grid"
        :aria-expanded="showAll"
        @click="showAll = !showAll"
      >
        {{ showAll ? 'View Less' : 'View More' }}
        <span aria-hidden="true">{{ showAll ? '↑' : '→' }}</span>
      </button>
    </div>

    <div v-if="loading" class="category-grid" aria-hidden="true">
      <div v-for="n in columnCount" :key="n" class="category-card">
        <div class="category-image-wrap category-skeleton"></div>
        <span class="category-name">&nbsp;</span>
      </div>
    </div>
    <div v-else id="homepage-category-grid" class="category-grid">
      <button
        v-for="category in visibleCategories"
        :key="category.id"
        type="button"
        class="category-card"
        @click="emit('select-category', category)"
      >
        <div class="category-image-wrap">
          <img
            v-if="getCategoryImage(category).src && !failedCategoryImages.has(String(category.id))"
            :src="getCategoryImage(category).src"
            :srcset="getCategoryImage(category).srcset || undefined"
            sizes="(max-width: 420px) 28vw, (max-width: 760px) 18vw, 112px"
            alt=""
            loading="lazy"
            decoding="async"
            @error="handleCategoryImageError(category.id)"
          />
          <div v-else class="category-image-placeholder" aria-hidden="true">
            {{ category.name }}
          </div>
        </div>

        <span class="category-name">{{ category.name }}</span>
      </button>


    </div>
  </section>
</template>

<style scoped>
.category-section {
  margin-top: var(--space-8);
}

.category-section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  margin-bottom: var(--space-3);
}

.category-section-heading h2 {
  margin: 0;
  color: var(--color-text);
  font-family: var(--font-family-display);
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
}

.category-grid {
  --category-columns: 9;
  display: grid;
  grid-template-columns: repeat(var(--category-columns), minmax(0, 1fr));
  border-top: 1px solid var(--color-border-soft);
  border-left: 1px solid var(--color-border-soft);
  background: var(--color-surface);
}

.category-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding: 16px 10px 12px;
  border: 0;
  border-right: 1px solid var(--color-border-soft);
  border-bottom: 1px solid var(--color-border-soft);
  background: var(--color-surface);
  color: var(--color-text);
  cursor: pointer;
  text-align: center;
}

.category-skeleton { background: var(--color-surface-muted); }

.category-card:hover {
  background: var(--color-surface-muted);
}

.view-all-categories {
  display: flex;
  align-items: center;
  justify-content: center;
  width: fit-content;
  gap: 8px;
  margin: 0 0 var(--space-1);
  padding: 9px 14px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-pill);
  background: var(--color-surface);
  color: var(--color-primary);
  cursor: pointer;
  white-space: nowrap;
}

.category-image-wrap {
  display: grid;
  place-items: center;
  width: 100%;
  max-width: 112px;
  aspect-ratio: 1;
  overflow: hidden;
}

.category-image-wrap img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.category-image-placeholder {
  display: grid;
  place-items: center;
  width: 100%;
  height: 100%;
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
}

.category-name {
  width: 100%;
  color: var(--color-text);
  /* Scales with screen width: ~10px on small phones, up to the normal size on desktop */
  font-size: clamp(10px, 2.6vw, var(--font-size-sm));
  line-height: 1.3;
  /* Wrap between words, and hyphenate only if a single word is still too long */
  overflow-wrap: break-word;
  word-break: normal;
  hyphens: auto;
}

@media (max-width: 1100px) {
  .category-grid {
    --category-columns: 6;
  }
}

@media (max-width: 760px) {
  .category-grid {
    --category-columns: 5;
  }

   .category-card {
    padding: 12px 6px 10px;
  }
}

@media (max-width: 420px) {
  .category-grid {
    --category-columns: 3;
  }

    .category-card {
    gap: 6px;
    padding: 10px 4px 8px;
  }

  .category-name {
    font-size: clamp(9.5px, 2.8vw, 11px);
  }
}
</style>
