<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

const emit = defineEmits(['select-category'])
const props = defineProps({
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
const initialCount = computed(() => columnCount.value === 9 ? 8 : columnCount.value * 3)
const visibleCategories = computed(() => showAll.value
  ? props.categories
  : props.categories.slice(0, initialCount.value))

function updateColumnCount() {
  const width = window.innerWidth
  columnCount.value = width <= 420 ? 3 : width <= 760 ? 4 : width <= 1100 ? 6 : 9
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
    v-if="props.categories.length"
    class="category-section"
    aria-labelledby="homepage-categories-title"
  >
    <div class="category-section-heading">
      <h2 id="homepage-categories-title">Categories</h2>
    </div>

    <div id="homepage-category-grid" class="category-grid">
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
            sizes="(max-width: 420px) 28vw, 112px"
            :alt="category.name"
            loading="lazy"
            decoding="async"
            @error="handleCategoryImageError(category.id)"
          />
          <div v-else class="category-image-placeholder">
            {{ category.name }}
          </div>
        </div>

        <span class="category-name">{{ category.name }}</span>
      </button>

      <button
        v-if="!showAll && props.categories.length > initialCount"
        type="button"
        class="category-card view-more-card"
        aria-controls="homepage-category-grid"
        :aria-expanded="showAll"
        @click="showAll = true"
      >
        <span class="view-more-icon" aria-hidden="true">＋</span>
        <span class="category-name">View More</span>
      </button>
    </div>
  </section>
</template>

<style scoped>
.category-section {
  margin-top: var(--space-8);
}

.category-section-heading {
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

.category-card:hover {
  background: var(--color-surface-muted);
}

.view-more-card { justify-content: center; color: var(--color-primary); }
.view-more-icon { display: grid; place-items: center; width: 44%; max-width: 56px; aspect-ratio: 1; border: 1px solid var(--color-border); border-radius: 50%; font-size: 28px; line-height: 1; }

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
  font-size: var(--font-size-sm);
  overflow-wrap: anywhere;
}

@media (max-width: 1100px) {
  .category-grid {
    --category-columns: 6;
  }
}

@media (max-width: 760px) {
  .category-grid {
    --category-columns: 4;
  }
}

@media (max-width: 420px) {
  .category-grid {
    --category-columns: 3;
  }
}
</style>
