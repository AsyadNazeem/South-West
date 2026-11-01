<script setup>
import { onMounted, ref } from 'vue'
import api from '../services/api'
import { getMediaUrl } from '../utils/mediaUrl'

const brands = ref([])
const loading = ref(true)
const error = ref('')

async function loadBrands() {
  loading.value = true
  error.value = ''

  try {
    const response = await api.get('/store/brands')
    const payload = response.data
    brands.value = Array.isArray(payload?.data) ? payload.data
      : Array.isArray(payload) ? payload : []
  } catch (err) {
    error.value = err.response?.data?.message ||
      'We could not load brands. Please try again.'
  } finally {
    loading.value = false
  }
}

function imageUrl(brand) {
  return getMediaUrl(brand.image_url)
}

onMounted(loadBrands)
</script>

<template>
  <main class="directory-page">
    <div class="directory-container">
      <nav class="directory-breadcrumb">
        <RouterLink to="/">Home</RouterLink><span>/</span><span>Brands</span>
      </nav>

      <header class="directory-heading">
        <p class="directory-eyebrow">EXPLORE THE BRANDS</p>
        <h1>Shop by Brand</h1>
        <p>Browse products from the brands available at South West.</p>
      </header>

      <div v-if="loading" class="directory-state">Loading brands...</div>
      <div v-else-if="error" class="directory-state error">{{ error }}</div>
      <div v-else-if="!brands.length" class="directory-state">
        No brands are available at the moment.
      </div>

      <section v-else class="brand-grid">
        <RouterLink
          v-for="brand in brands"
          :key="brand.id"
          class="brand-card"
          :to="{ path: '/shop', query: { brand: String(brand.id) } }"
        >
          <div class="brand-image">
            <img v-if="imageUrl(brand)" :src="imageUrl(brand)" :alt="brand.name" />
            <span v-else>{{ brand.name?.charAt(0) }}</span>
          </div>
          <h2>{{ brand.name }}</h2>
          <span class="brand-link">View products →</span>
        </RouterLink>
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
.brand-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 190px), 1fr));
  gap: 18px;
}
.brand-card {
  display: flex;
  min-height: 190px;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 10px;
  padding: 22px;
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 12px;
  background: var(--color-surface, #fff);
  color: var(--color-text, #20242b);
  text-align: center;
  text-decoration: none;
  transition: border-color .2s, transform .2s;
}
.brand-card:hover {
  transform: translateY(-3px);
  border-color: var(--color-primary, #263b63);
}
.brand-image {
  display: grid;
  width: 100%;
  height: 90px;
  place-items: center;
}
.brand-image img { max-width: 100%; max-height: 85px; object-fit: contain; }
.brand-image span { color: var(--color-primary, #263b63); font-size: 42px; font-weight: 750; }
.brand-card h2 { margin: 0; font-size: 17px; }
.brand-link { color: var(--color-primary, #263b63); font-size: 12px; font-weight: 650; }
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
