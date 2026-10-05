<script setup>
import { ref, computed, onMounted } from 'vue'
import api from '../../api/axios'

// Files are served by the backend (e.g. http://localhost:5001/uploads/...).
// If the API returns a relative URL, prefix it with the API origin.
const API_ORIGIN = (() => {
  try {
    return new URL(import.meta.env.VITE_API_URL).origin
  } catch {
    return ''
  }
})()

const fileUrl = (url) => {
  if (!url) return ''

  return url.startsWith('/') ? `${API_ORIGIN}${url}` : url
}

// ==========================================
// State
// ==========================================

const loading = ref(false)
const errorMessage = ref('')

const images = ref([])
const videos = ref([])

const search = ref('')
const videoFilter = ref('')

const busyKey = ref(null)

// ==========================================
// Load
// ==========================================

const loadMedia = async (silent = false) => {
  if (!silent) loading.value = true

  errorMessage.value = ''

  const [imageResult, videoResult] = await Promise.allSettled([
    api.get('/item-images'),
    api.get('/item-videos')
  ])

  if (imageResult.status === 'fulfilled') {
    images.value = imageResult.value.data.data || []
  } else {
    console.error('Failed to load item images:', imageResult.reason)

    errorMessage.value =
        imageResult.reason.response?.data?.message ||
        'Failed to load item images.'
  }

  if (videoResult.status === 'fulfilled') {
    videos.value = videoResult.value.data.data || []
  } else {
    console.error('Failed to load item videos:', videoResult.reason)

    videos.value = []
  }

  loading.value = false
}

onMounted(() => loadMedia())

// ==========================================
// Group by product
// ==========================================

const groups = computed(() => {
  const map = new Map()

  const ensure = (itemId, item) => {
    if (!map.has(itemId)) {
      map.set(itemId, {
        item_id: itemId,
        item: item || null,
        images: [],
        video: null
      })
    } else if (item && !map.get(itemId).item) {
      map.get(itemId).item = item
    }

    return map.get(itemId)
  }

  images.value.forEach(image => {
    ensure(image.item_id, image.item).images.push(image)
  })

  videos.value.forEach(video => {
    ensure(video.item_id, video.item).video = video
  })

  return [...map.values()]
})

const filteredGroups = computed(() => {
  const term = search.value.toLowerCase().trim()

  return groups.value.filter(group => {
    const matchesSearch =
        !term ||
        group.item?.item_name?.toLowerCase().includes(term) ||
        group.item?.item_code?.toLowerCase().includes(term) ||
        group.images.some(
            image =>
                image.file_name?.toLowerCase().includes(term) ||
                image.alt_text?.toLowerCase().includes(term)
        )

    const matchesVideo =
        !videoFilter.value ||
        (videoFilter.value === 'with' && group.video) ||
        (videoFilter.value === 'without' && !group.video)

    return matchesSearch && matchesVideo
  })
})

// Main image first, then the rest in order
const stripImages = (group) =>
    [...group.images]
        .sort((a, b) => Number(b.is_primary) - Number(a.is_primary))
        .slice(0, 4)

// ==========================================
// Active status
// ==========================================

// A product's media is "active" if any of its files is active
const isGroupActive = (group) =>
    group.images.some(image => image.is_active) ||
    Boolean(group.video?.is_active)

const toggleGroupActive = async (group) => {
  const makeActive = !isGroupActive(group)
  const key = `group-${group.item_id}`

  try {
    busyKey.value = key

    const requests = group.images.map(image =>
        api.put(`/item-images/${image.id}`, { is_active: makeActive })
    )

    if (group.video) {
      requests.push(
          api.put(`/item-videos/${group.video.id}`, { is_active: makeActive })
      )
    }

    await Promise.all(requests)
    await loadMedia(true)
  } catch (error) {
    console.error('Failed to update media status:', error)

    alert(
        error.response?.data?.message ||
        'Failed to update media status.'
    )
  } finally {
    busyKey.value = null
  }
}
</script>

<template>
  <div class="media-list-page">

    <!-- Header -->
    <div class="page-header">
      <div>
        <h2>Product Media</h2>
        <p>Manage the images and video assigned to each product</p>
      </div>

      <router-link
          to="/admin/products/item-images/create"
          class="primary-button"
      >
        + Add Media
      </router-link>
    </div>

    <!-- Error -->
    <div
        v-if="errorMessage"
        class="error-message"
    >
      {{ errorMessage }}
    </div>

    <!-- Filters -->
    <div class="filters">
      <input
          v-model="search"
          type="text"
          placeholder="Search by product, code, file name or alt text..."
      />

      <select v-model="videoFilter">
        <option value="">All Products</option>
        <option value="with">With Video</option>
        <option value="without">Without Video</option>
      </select>
    </div>

    <!-- Loading -->
    <div
        v-if="loading"
        class="loading"
    >
      Loading media...
    </div>

    <!-- Table -->
    <div
        v-else
        class="table-container"
    >
      <table>
        <thead>
        <tr>
          <th>#</th>
          <th>Product</th>
          <th>Images</th>
          <th>Video</th>
          <th>Total Files</th>
          <th>Status</th>
          <th>Actions</th>
        </tr>
        </thead>

        <tbody>
        <tr
            v-for="(group, index) in filteredGroups"
            :key="group.item_id"
        >
          <td>{{ index + 1 }}</td>

          <td>
            <div class="item-info">
              <strong>
                {{ group.item?.item_name || 'Unknown Item' }}
              </strong>

              <small>
                {{ group.item?.item_code || '-' }}
              </small>
            </div>
          </td>

          <td>
            <div
                v-if="group.images.length"
                class="thumb-strip"
            >
              <img
                  v-for="image in stripImages(group)"
                  :key="image.id"
                  :src="fileUrl(image.url)"
                  :alt="image.alt_text || image.file_name"
                  class="thumb"
                  :class="{ 'thumb-main': image.is_primary }"
                  :title="image.is_primary ? 'Main image' : image.file_name"
              />

              <span
                  v-if="group.images.length > 4"
                  class="thumb-more"
              >
                +{{ group.images.length - 4 }}
              </span>
            </div>

            <span v-else>-</span>
          </td>

          <td>
            <span
                v-if="group.video"
                class="badge video"
            >
              Yes
            </span>

            <span v-else>-</span>
          </td>

          <td>
            {{ group.images.length }} /
            {{ group.images.length + (group.video ? 1 : 0) }}
            <small class="muted">images / total</small>
          </td>

          <td>
            <span
                class="badge"
                :class="isGroupActive(group) ? 'active' : 'inactive'"
            >
              {{ isGroupActive(group) ? 'Active' : 'Inactive' }}
            </span>
          </td>

          <td>
            <div class="actions">
              <router-link
                  :to="`/admin/products/item-images/edit/${group.item_id}`"
                  class="btn-edit"
              >
                Edit
              </router-link>

              <button
                  type="button"
                  class="btn-edit"
                  :disabled="busyKey === `group-${group.item_id}`"
                  @click="toggleGroupActive(group)"
              >
                {{ isGroupActive(group) ? 'Deactivate' : 'Activate' }}
              </button>
            </div>
          </td>
        </tr>

        <tr v-if="filteredGroups.length === 0">
          <td
              colspan="7"
              class="empty"
          >
            No product media found.
          </td>
        </tr>
        </tbody>
      </table>
    </div>

  </div>
</template>

<style scoped>
.media-list-page {
  width: 100%;
  font-family: var(--font-family);
}

/* =========================
   Page Header
   ========================= */

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--spacing-lg);
  margin-bottom: var(--spacing-2xl);
}

.page-header h2 {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
}

.page-header p {
  margin-top: 5px;
  font-size: var(--font-size-md);
  color: var(--color-text-secondary);
}

.primary-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 10px var(--spacing-lg);
  border-radius: var(--radius-lg);
  background: var(--color-primary);
  color: var(--color-text-light);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
  text-decoration: none;
  white-space: nowrap;
  transition: background var(--transition-fast);
}

.primary-button:hover {
  background: var(--color-primary-hover);
}

/* =========================
   Error
   ========================= */

.error-message {
  margin-bottom: var(--spacing-lg);
  padding: var(--spacing-md) var(--spacing-lg);
  border: 1px solid var(--color-danger-light);
  border-radius: var(--radius-lg);
  background: var(--color-danger-bg);
  color: var(--color-danger);
  font-size: var(--font-size-sm);
}

/* =========================
   Buttons
   ========================= */

button {
  font-family: inherit;
  cursor: pointer;
}

.actions {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.btn-edit,
.btn-delete {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 6px var(--spacing-md);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  white-space: nowrap;
  transition: background var(--transition-fast),
  color var(--transition-fast),
  border-color var(--transition-fast);
}

.btn-edit:hover:not(:disabled) {
  background: var(--color-primary-light);
  border-color: var(--color-primary-light);
  color: var(--color-primary);
}

.btn-delete:hover:not(:disabled) {
  background: var(--color-danger-bg);
  border-color: var(--color-danger-light);
  color: var(--color-danger);
}

.btn-edit:disabled,
.btn-delete:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* =========================
   Filters
   ========================= */

.filters {
  display: flex;
  align-items: center;
  gap: var(--spacing-lg);
  margin-bottom: var(--spacing-lg);
  padding: var(--spacing-xl);
  background: var(--color-surface);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
}

.filters input,
.filters select {
  height: 40px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  color: var(--color-text-primary);
  font-family: inherit;
  font-size: var(--font-size-md);
  outline: none;
  transition: border-color var(--transition-fast),
  box-shadow var(--transition-fast);
}

.filters input {
  flex: 1;
  max-width: 420px;
  padding: 0 var(--spacing-lg);
}

.filters input::placeholder {
  color: var(--color-text-muted);
}

.filters select {
  min-width: 150px;
  padding: 0 var(--spacing-md);
  color: var(--color-text-secondary);
  cursor: pointer;
}

.filters input:focus,
.filters select:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-light);
}

/* =========================
   Table
   ========================= */

.table-container {
  overflow-x: auto;
  background: var(--color-surface);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
}

table {
  width: 100%;
  border-collapse: collapse;
}

th {
  padding: var(--spacing-md) var(--spacing-lg);
  text-align: left;
  white-space: nowrap;
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--color-text-secondary);
  background: var(--color-hover-bg);
  border-bottom: 1px solid var(--color-border-light);
}

td {
  padding: 14px var(--spacing-lg);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  border-bottom: 1px solid var(--color-border-light);
  vertical-align: middle;
}

tbody tr {
  transition: background var(--transition-fast);
}

tbody tr:hover:not(.detail-row) {
  background: var(--color-surface-hover);
}

tbody tr:last-child td {
  border-bottom: none;
}

.item-info {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.item-info strong {
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.item-info small,
.muted {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

/* =========================
   Thumbnail strip
   ========================= */

.thumb-strip {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
}

.thumb {
  display: block;
  width: 44px;
  height: 44px;
  object-fit: cover;
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-md);
  background: var(--color-hover-bg);
}

.thumb-main {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px var(--color-primary-light);
}

.thumb-more {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: var(--radius-md);
  background: var(--color-hover-bg);
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
}

/* =========================
   Badges
   ========================= */

.badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: var(--radius-full);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  white-space: nowrap;
}

.badge.video {
  background: var(--color-success-bg);
  color: var(--color-success);
}

/* =========================
   Expanded details
   ========================= */

.detail-row td {
  padding: var(--spacing-xl);
  background: var(--color-hover-bg);
}

.media-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
  gap: var(--spacing-md);
}

.media-tile {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
}

.media-tile.is-primary {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px var(--color-primary-light);
}

.media-thumb {
  position: relative;
  width: 100%;
  aspect-ratio: 4 / 3;
  overflow: hidden;
  border-radius: var(--radius-md);
  background: var(--color-hover-bg);
}

.media-thumb img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.tile-badge {
  position: absolute;
  top: 6px;
  left: 6px;
  padding: 2px 8px;
  border-radius: var(--radius-full);
  background: var(--color-primary);
  color: var(--color-text-light);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
}

.inactive-badge {
  top: auto;
  bottom: 6px;
  background: var(--color-text-secondary);
}

.media-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 3px;
  min-width: 0;
}

.media-meta strong {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
}

.media-meta small {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.media-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-xs);
}

.video-block {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-lg);
  margin-top: var(--spacing-lg);
  padding-top: var(--spacing-lg);
  border-top: 1px solid var(--color-border-light);
}

.video-block video {
  width: 240px;
  max-width: 100%;
  max-height: 180px;
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-lg);
  background: #000;
}

.media-grid:empty + .video-block {
  margin-top: 0;
  padding-top: 0;
  border-top: none;
}

/* =========================
   States
   ========================= */

.loading,
.empty {
  padding: 50px var(--spacing-xl);
  text-align: center;
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

/* =========================
   Responsive
   ========================= */

@media (max-width: 900px) {
  .filters {
    flex-wrap: wrap;
  }

  .filters input {
    flex-basis: 100%;
    max-width: none;
  }
}

@media (max-width: 700px) {
  .page-header,
  .filters {
    flex-direction: column;
    align-items: stretch;
  }

  .page-header {
    align-items: flex-start;
  }

  .video-block {
    flex-direction: column;
  }

  .video-block video {
    width: 100%;
  }
}
</style>
