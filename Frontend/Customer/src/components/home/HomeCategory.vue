
<script setup>
import { onMounted, ref } from 'vue'
import api from '../../services/api'

const emit = defineEmits(['select-category'])

const categories = ref([])
const loading = ref(false)

import { getMediaUrl } from '../../utils/mediaUrl'

function getImageUrl(path) {
  return getMediaUrl(path)
}

async function loadCategories() {
  loading.value = true

  try {
    const response = await api.get('/store/categories')
    const payload = response.data

    const list = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.data)
        ? payload.data
        : Array.isArray(payload?.categories)
          ? payload.categories
          : Array.isArray(payload?.data?.categories)
            ? payload.data.categories
            : []

    categories.value = list.filter(
      category => category.is_active !== false
    )
  } catch (error) {
    console.error('Failed to load categories:', error)
    categories.value = []
  } finally {
    loading.value = false
  }
}

onMounted(loadCategories)
</script>

<template>
  <section
    v-if="categories.length"
    class="category-section"
    aria-labelledby="homepage-categories-title"
  >
    <div class="category-section-heading">
      <h2 id="homepage-categories-title">Categories</h2>
    </div>

    <div class="category-grid">
      <button
        v-for="category in categories"
        :key="category.id"
        type="button"
        class="category-card"
        @click="emit('select-category', category)"
      >
        <div class="category-image-wrap">
          <img
            v-if="category.image_url"
            :src="getImageUrl(category.image_url)"
            :alt="category.name"
            loading="lazy"
          />
          <div v-else class="category-image-placeholder">
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
  display: grid;
  grid-template-columns: repeat(9, minmax(0, 1fr));
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
    grid-template-columns: repeat(6, minmax(0, 1fr));
  }
}

@media (max-width: 760px) {
  .category-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

@media (max-width: 420px) {
  .category-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
</style>
