<script setup>
import { ref, onMounted } from 'vue'
import api from '@/services/api'
import { getMediaUrl } from '@/utils/mediaUrl'
import AccountPageHeader from '@/components/account/AccountPageHeader.vue'

const reviews = ref([]), loading = ref(true), failed = ref(false)

async function load() {
  loading.value = true
  failed.value = false

  try {
    const response = await api.get('/customer-reviews/my')

    reviews.value = response.data.data
  } catch (error) {
    console.error('Failed to load reviews:', error)
    failed.value = true
  } finally {
    loading.value = false
  }
}

const STAR = 'M12 3.5l2.7 5.5 6 .9-4.4 4.2 1 6-5.3-2.8-5.3 2.8 1-6L3.3 9.9l6-.9z'
const MAX_PHOTOS = 5

// The customer's own photos for this review (the API sends { id, url })
function reviewPhotos(review) {
  return (Array.isArray(review.images) ? review.images : [])
    .filter(image => image?.url)
    .slice(0, MAX_PHOTOS)
    .map(image => ({ id: image.id, url: getMediaUrl(image.url) || image.url }))
}

function tone(status) {
  const key = String(status || '').toLowerCase()
  if (['approved', 'published', 'active'].includes(key)) return 'success'
  if (['pending', 'under_review', 'in_review'].includes(key)) return 'warning'
  if (['rejected', 'hidden', 'removed'].includes(key)) return 'danger'
  return 'neutral'
}

const formatStatus = (status) =>
  String(status || '').replaceAll('_', ' ').replace(/\b\w/g, c => c.toUpperCase())

const formatDate = (value) => {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

onMounted(load)
</script>

<template>
  <section class="reviews-page">
    <AccountPageHeader title="My reviews" description="Your product ratings and feedback." />

    <!-- Loading -->
    <div v-if="loading" class="list" aria-busy="true" aria-label="Loading your reviews">
      <div v-for="n in 2" :key="n" class="card" aria-hidden="true">
        <div class="col"><div class="skeleton-line short"></div><div class="skeleton-line"></div></div>
        <div class="col side"><div class="skeleton-line"></div><div class="skeleton-line short"></div></div>
      </div>
    </div>

    <!-- Error -->
    <div v-else-if="failed" class="state" role="alert">
      <h3>Something went wrong</h3>
      <p class="muted">Your reviews couldn’t be loaded.</p>
      <button type="button" class="btn" @click="load">Try again</button>
    </div>

    <!-- Empty -->
    <div v-else-if="!reviews.length" class="state">
      <h3>No reviews yet</h3>
      <p class="muted">Open a purchased product to share your experience.</p>
      <RouterLink class="btn primary" to="/account/orders">View my orders</RouterLink>
    </div>

    <!-- Reviews -->
    <div v-else class="list">
      <article v-for="r in reviews" :key="r.id" class="card">

        <div class="col">
          <header class="top">
            <h3 class="product">{{ r.item?.item_name || 'Product review' }}</h3>
            <span v-if="r.status" class="status" :class="`tone-${tone(r.status)}`">{{ formatStatus(r.status) }}</span>
          </header>

          <!-- Customer's own photos: between the product name and the stars -->
          <div v-if="reviewPhotos(r).length" class="photos">
            <a
              v-for="photo in reviewPhotos(r)"
              :key="photo.id"
              :href="photo.url"
              target="_blank"
              rel="noopener"
              class="photo"
              aria-label="View review photo full size"
            >
              <img :src="photo.url" alt="Review photo" loading="lazy" decoding="async">
            </a>
          </div>

          <div class="rating-row">
            <span class="stars" role="img" :aria-label="`${r.rating} out of 5`">
              <svg v-for="n in 5" :key="n" viewBox="0 0 24 24" :class="{ on: n <= Number(r.rating) }" aria-hidden="true">
                <path :d="STAR" />
              </svg>
            </span>
            <strong class="score">{{ r.rating }}/5</strong>
          </div>

          <span class="muted date">{{ formatDate(r.created_at) }}</span>
        </div>

        <div class="col side">
          <h4 v-if="r.review_title" class="review-title">{{ r.review_title }}</h4>
          <p v-if="r.review_text" class="review-text">{{ r.review_text }}</p>
          <p v-if="!r.review_title && !r.review_text" class="muted">No written feedback.</p>
        </div>

      </article>
    </div>
  </section>
</template>

<style scoped>
.reviews-page { min-width: 0; color: var(--color-text); }
.muted { margin: 0; color: var(--color-text-muted); font-size: 12px; }

/* Buttons */
.btn { display: inline-flex; align-items: center; justify-content: center; min-height: 36px; padding: 0 14px; background: var(--color-surface); color: var(--color-text); border: 1px solid var(--color-border); border-radius: var(--radius-md); font: 600 13px/1 var(--font-family-base); text-decoration: none; white-space: nowrap; cursor: pointer; transition: border-color .15s ease, color .15s ease; }
.btn:hover { border-color: var(--color-primary); color: var(--color-primary); }
.btn.primary { background: var(--color-primary); border-color: var(--color-primary); color: var(--color-on-primary); }
.btn.primary:hover { background: var(--color-primary-hover); border-color: var(--color-primary-hover); color: var(--color-on-primary); }
.btn:focus-visible, .photo:focus-visible { outline: 2px solid var(--color-focus-outline); outline-offset: 2px; }

/* Two-half cards */
.list { display: grid; gap: 12px; }
.card { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.3fr); min-width: 0; overflow: hidden; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-lg); box-shadow: var(--shadow-sm); }
.col { display: flex; flex-direction: column; gap: 12px; min-width: 0; padding: 16px 18px; }
.side { background: color-mix(in srgb, var(--color-primary) 5%, var(--color-surface)); border-left: 1px solid var(--color-border); }

/* Left half */
.top { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.product { margin: 0; font-size: 14px; font-weight: 700; line-height: 1.4; overflow-wrap: anywhere; }

.status { display: inline-flex; align-items: center; gap: 6px; flex-shrink: 0; font-size: 12px; font-weight: 600; white-space: nowrap; }
.status::before { content: ''; width: 6px; height: 6px; flex-shrink: 0; border-radius: 50%; background: currentColor; }
.tone-neutral { color: var(--color-text-muted); }
.tone-warning { color: #b45309; }
.tone-success { color: #15803d; }
.tone-danger { color: #b42318; }

/* Customer photos: up to 5 in one row, shrinking to fit */
.photos { display: grid; grid-template-columns: repeat(5, minmax(0, 64px)); gap: 8px; }
.photo { display: block; aspect-ratio: 1; overflow: hidden; background: var(--color-surface-muted); border: 1px solid var(--color-border); border-radius: var(--radius-md); transition: border-color .15s ease; }
.photo:hover { border-color: var(--color-primary); }
.photo img { display: block; width: 100%; height: 100%; object-fit: cover; }

.rating-row { display: flex; align-items: center; gap: 8px; }
.stars { display: inline-flex; gap: 2px; }
.stars svg { width: 16px; height: 16px; fill: var(--color-border); stroke: none; }
.stars svg.on { fill: var(--color-accent-deep, var(--color-accent, #d49d12)); }
.score { font-size: 13px; font-weight: 700; font-variant-numeric: tabular-nums; }
.date { margin-top: auto; }

/* Right half */
.review-title { margin: 0; font-size: 14px; font-weight: 600; line-height: 1.4; overflow-wrap: anywhere; }
.review-text { margin: 0; color: var(--color-text); font-size: 13px; line-height: 1.6; white-space: pre-line; overflow-wrap: anywhere; }

/* States */
.state { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 48px 20px; text-align: center; background: var(--color-surface); border: 1px solid var(--color-border-soft); border-radius: var(--radius-lg); }
.state h3 { margin: 0; font-family: var(--font-family-display); font-size: 16px; }
.state .muted { margin-bottom: 10px; font-size: 13px; }

/* Loading */
.skeleton-line { height: 11px; margin-top: 8px; background: var(--color-border); border-radius: 4px; animation: pulse 1.4s ease-in-out infinite; }
.skeleton-line:first-child { margin-top: 0; }
.skeleton-line.short { width: 40%; }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: .5; } }

@media (max-width: 760px) {
  .card { grid-template-columns: minmax(0, 1fr); }
  .side { border-left: 0; border-top: 1px solid var(--color-border); }
  .col { padding: 14px; }
}

@media (prefers-reduced-motion: reduce) { .skeleton-line { animation: none; } }
</style>