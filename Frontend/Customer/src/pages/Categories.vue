<script setup>
import { onMounted, ref } from 'vue'
import api from '@/services/api'
import { getMediaUrl } from '@/utils/mediaUrl'

const categories = ref([])
const loading = ref(true)
const error = ref('')

async function loadCategories() {
  loading.value = true
  error.value = ''

  try {
    const response = await api.get('/store/categories')
    const payload = response.data
    categories.value = Array.isArray(payload?.data) ? payload.data
      : Array.isArray(payload) ? payload : []
  } catch (err) {
    error.value = err.response?.data?.message ||
      'We could not load categories. Please try again.'
  } finally {
    loading.value = false
  }
}

function imageUrl(category) {
  return getMediaUrl(category.image_url)
}

onMounted(loadCategories)
</script>

<template>
  <main class="directory-page">
    <div class="directory-container">
      <nav class="directory-breadcrumb">
        <RouterLink to="/">Home</RouterLink><span>/</span><span>Categories</span>
      </nav>

      <header class="directory-heading">
        <p class="directory-eyebrow">FIND WHAT YOU NEED</p>
        <h1>Shop by Category</h1>
        <p>Explore our product categories and discover what you're looking for.</p>
      </header>

      <div v-if="loading" class="directory-state">Loading categories...</div>
      <div v-else-if="error" class="directory-state error">{{ error }}</div>
      <div v-else-if="!categories.length" class="directory-state">
        No categories are available at the moment.
      </div>

      <section v-else class="directory-grid">
        <article v-for="category in categories" :key="category.id" class="directory-card">
          <RouterLink :to="{ path: '/shop', query: { category: String(category.id) } }">
            <div class="directory-image">
              <img
                v-if="imageUrl(category)"
                :src="imageUrl(category)"
                :alt="category.name"
                loading="lazy"
                decoding="async"
              />
              <span v-else class="directory-placeholder">{{ category.name?.charAt(0) }}</span>
            </div>
            <div class="directory-card-body">
              <h2>{{ category.name }}</h2>
              <p v-if="category.description">{{ category.description }}</p>
              <span>Explore category <span aria-hidden="true">→</span></span>
            </div>
          </RouterLink>

          <div v-if="category.children?.length" class="directory-children">
            <RouterLink
              v-for="child in category.children"
              :key="child.id"
              :to="{ path: '/shop', query: { category: String(child.id) } }"
            >{{ child.name }}</RouterLink>
          </div>
        </article>
      </section>
    </div>
  </main>
</template>

<style scoped>
.directory-page {
  min-height: 55vh;
  padding: 28px 0 68px;
  background: var(--color-background, #f8f9fb);
}
.directory-container {
  width: min(100% - 40px, 1320px);
  margin: 0 auto;
}
.directory-breadcrumb {
  display: flex;
  gap: 10px;
  margin-bottom: 28px;
  color: var(--color-text-muted, #777);
  font-size: 13px;
}
.directory-breadcrumb a { color: inherit; text-decoration: none; }
.directory-heading { margin-bottom: 32px; }
.directory-eyebrow {
  margin: 0 0 8px;
  color: var(--color-primary, #263b63);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: .14em;
}
.directory-heading h1 {
  margin: 0;
  color: var(--color-text, #20242b);
  font-size: clamp(28px, 4vw, 42px);
}
.directory-heading > p:last-child {
  margin: 10px 0 0;
  color: var(--color-text-muted, #737985);
  line-height: 1.6;
}
.directory-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 245px), 1fr));
  gap: 22px;
}
.directory-card {
  overflow: hidden;
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 12px;
  background: var(--color-surface, #fff);
}
.directory-card > a { color: inherit; text-decoration: none; }
.directory-image {
  display: grid;
  aspect-ratio: 16 / 10;
  place-items: center;
  overflow: hidden;
  background: var(--color-surface-muted, #f0f2f5);
}
.directory-image img { width: 100%; height: 100%; object-fit: cover; transition: transform .25s; }
.directory-card:hover .directory-image img { transform: scale(1.04); }
.directory-placeholder { color: var(--color-primary, #263b63); font-size: 48px; font-weight: 700; }
.directory-card-body { padding: 18px; }
.directory-card-body h2 { margin: 0; font-size: 18px; }
.directory-card-body p { margin: 8px 0; color: var(--color-text-muted, #737985); font-size: 13px; line-height: 1.5; }
.directory-card-body > span { display: inline-block; margin-top: 10px; color: var(--color-primary, #263b63); font-size: 13px; font-weight: 650; }
.directory-children {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 0 18px 18px;
}
.directory-children a {
  padding: 6px 10px;
  border-radius: 20px;
  background: var(--color-surface-muted, #f0f2f5);
  color: var(--color-text, #20242b);
  font-size: 12px;
  text-decoration: none;
}
.directory-state {
  padding: 40px 20px;
  border: 1px dashed var(--color-border, #ddd);
  border-radius: 10px;
  color: var(--color-text-muted, #737985);
  text-align: center;
}
.error { color: #b42318; }
@media (max-width: 600px) {
  .directory-container { width: min(100% - 28px, 1320px); }
}
</style>
