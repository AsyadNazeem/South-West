<template>
  <div class="category-view-page">

    <!-- Header -->
    <div class="page-header">
      <div>
        <button class="back-button" @click="goBack">
          ← Back
        </button>

        <h1>Category Details</h1>
        <p>View category information and related categories.</p>
      </div>

      <div class="header-actions" v-if="category">
        <button class="edit-button" @click="editCategory">
          Edit Category
        </button>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="state-container">
      <div class="spinner"></div>
      <p>Loading category...</p>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="state-container error-state">
      <div class="error-icon">!</div>
      <h3>Failed to load category</h3>
      <p>{{ error }}</p>

      <button class="retry-button" @click="loadCategory">
        Try Again
      </button>
    </div>

    <!-- Content -->
    <div v-else-if="category" class="content">

      <!-- Basic Information -->
      <div class="card">

        <div class="card-header">
          <div>
            <h2>Basic Information</h2>
            <p>General information about this category.</p>
          </div>

          <span
              class="status-badge"
              :class="category.is_active ? 'active' : 'inactive'"
          >
            {{ category.is_active ? 'Active' : 'Inactive' }}
          </span>
        </div>

        <div class="details-grid">

          <div class="detail-item">
            <label>Category ID</label>
            <div class="value">
              {{ category.id || '-' }}
            </div>
          </div>

          <div class="detail-item">
            <label>Category Code</label>
            <div class="value code">
              {{ category.code || '-' }}
            </div>
          </div>

          <div class="detail-item">
            <label>Category Name</label>
            <div class="value">
              {{ category.name || '-' }}
            </div>
          </div>

          <div class="detail-item">
            <label>Status</label>
            <div class="value">
              <span
                  class="status-badge"
                  :class="category.is_active ? 'active' : 'inactive'"
              >
                {{ category.is_active ? 'Active' : 'Inactive' }}
              </span>
            </div>
          </div>

          <div class="detail-item full-width">
            <label>Description</label>
            <div class="value description">
              {{ category.description || 'No description provided.' }}
            </div>
          </div>

        </div>
      </div>

      <!-- Parent Category -->
      <div class="card">

        <div class="card-header">
          <div>
            <h2>Parent Category</h2>
            <p>The category this category belongs to.</p>
          </div>
        </div>

        <div v-if="category.parent" class="related-category">

          <div class="category-icon">
            📁
          </div>

          <div class="related-info">
            <strong>
              {{ category.parent.name }}
            </strong>

            <span>
              Code: {{ category.parent.code || '-' }}
            </span>

            <span>
              ID: {{ category.parent.id }}
            </span>
          </div>

        </div>

        <div v-else class="empty-state">
          <div class="empty-icon">📁</div>
          <p>This is a top-level category.</p>
        </div>

      </div>

      <!-- Child Categories -->
      <div class="card">

        <div class="card-header">
          <div>
            <h2>Child Categories</h2>
            <p>
              Categories that belong to this category.
            </p>
          </div>

          <span class="count-badge">
            {{ childCategories.length }}
          </span>
        </div>

        <div
            v-if="childCategories.length > 0"
            class="children-list"
        >

          <div
              v-for="child in childCategories"
              :key="child.id"
              class="child-row"
          >

            <div class="child-icon">
              📁
            </div>

            <div class="child-info">
              <strong>{{ child.name }}</strong>

              <span>
                Code: {{ child.code || '-' }}
              </span>
            </div>

            <div class="child-id">
              ID: {{ child.id }}
            </div>

            <button
                class="view-button"
                @click="viewChild(child.id)"
            >
              View
            </button>

          </div>

        </div>

        <div v-else class="empty-state">
          <div class="empty-icon">📂</div>
          <p>No child categories found.</p>
        </div>

      </div>

      <!-- Metadata -->
      <div class="card">

        <div class="card-header">
          <div>
            <h2>System Information</h2>
            <p>Category record information.</p>
          </div>
        </div>

        <div class="details-grid">

          <div class="detail-item">
            <label>Created At</label>
            <div class="value">
              {{ formatDate(category.created_at) }}
            </div>
          </div>

          <div class="detail-item">
            <label>Updated At</label>
            <div class="value">
              {{ formatDate(category.updated_at) }}
            </div>
          </div>

        </div>

      </div>

    </div>

    <!-- No Data -->
    <div v-else class="state-container">
      <div class="empty-icon">📁</div>
      <h3>Category not found</h3>
      <p>The requested category could not be found.</p>

      <button class="back-button-large" @click="goBack">
        Back to Categories
      </button>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '../../api/axios'

const route = useRoute()
const router = useRouter()

const category = ref(null)
const loading = ref(false)
const error = ref('')

/*
|--------------------------------------------------------------------------
| Child Categories
|--------------------------------------------------------------------------
*/

const childCategories = computed(() => {
  return category.value?.children || []
})

/*
|--------------------------------------------------------------------------
| Load Category
|--------------------------------------------------------------------------
*/

const loadCategory = async () => {
  loading.value = true
  error.value = ''

  try {
    const id = route.params.id

    if (!id) {
      throw new Error('Category ID is missing.')
    }

    const response = await api.get(`/categories/${id}`)
    console.log('Category API response:', response.data)

    category.value = response.data.data

  } catch (err) {
    console.error('Failed to load category:', err)

    if (err.response) {
      error.value =
          err.response.data?.message ||
          `Request failed with status ${err.response.status}`
    } else if (err.request) {
      error.value =
          'Unable to connect to the server. Please check that the backend is running.'
    } else {
      error.value =
          err.message || 'Failed to load category.'
    }

    category.value = null

  } finally {
    loading.value = false
  }
}

/*
|--------------------------------------------------------------------------
| Navigation
|--------------------------------------------------------------------------
*/

const goBack = () => {
  router.push('/admin/products/categories')
}

const editCategory = () => {
  if (!category.value?.id) return
  router.push(`/admin/products/categories/edit/${category.value.id}`)
}

const viewChild = (id) => {
  router.push(`/admin/products/categories/view/${id}`)
}

/*
|--------------------------------------------------------------------------
| Date Formatter
|--------------------------------------------------------------------------
*/

const formatDate = (date) => {
  if (!date) {
    return '-'
  }

  try {
    return new Date(date).toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch {
    return date
  }
}

/*
|--------------------------------------------------------------------------
| Mounted
|--------------------------------------------------------------------------
*/

onMounted(() => {
  loadCategory()
})
</script>

<style scoped>
.category-view-page {
  padding: 24px;
  max-width: 1200px;
  margin: 0 auto;
}

/* Header */

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;
}

.page-header h1 {
  margin: 10px 0 6px;
  font-size: 28px;
  font-weight: 700;
  color: #111827;
}

.page-header p {
  margin: 0;
  color: #6b7280;
}

.back-button {
  border: none;
  background: transparent;
  padding: 0;
  color: #4f46e5;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
}

.back-button:hover {
  text-decoration: underline;
}

.header-actions {
  display: flex;
  gap: 10px;
}

.edit-button {
  border: none;
  background: #4f46e5;
  color: white;
  padding: 10px 18px;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
}

.edit-button:hover {
  background: #4338ca;
}

/* Cards */

.card {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  margin-bottom: 20px;
  overflow: hidden;
}

.card-header {
  padding: 20px 24px;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-header h2 {
  margin: 0 0 4px;
  font-size: 18px;
  color: #111827;
}

.card-header p {
  margin: 0;
  font-size: 13px;
  color: #6b7280;
}

/* Details */

.details-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0;
}

.detail-item {
  padding: 20px 24px;
  border-bottom: 1px solid #f3f4f6;
}

.detail-item:nth-child(odd) {
  border-right: 1px solid #f3f4f6;
}

.detail-item.full-width {
  grid-column: 1 / -1;
  border-right: none;
}

.detail-item label {
  display: block;
  font-size: 12px;
  font-weight: 600;
  color: #6b7280;
  text-transform: uppercase;
  margin-bottom: 7px;
}

.value {
  font-size: 15px;
  color: #111827;
  font-weight: 500;
}

.value.code {
  font-family: monospace;
  background: #f3f4f6;
  display: inline-block;
  padding: 4px 8px;
  border-radius: 5px;
}

.description {
  line-height: 1.6;
  font-weight: 400;
}

/* Status */

.status-badge {
  display: inline-flex;
  align-items: center;
  padding: 5px 10px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
}

.status-badge.active {
  background: #dcfce7;
  color: #166534;
}

.status-badge.inactive {
  background: #fee2e2;
  color: #991b1b;
}

/* Count */

.count-badge {
  background: #eef2ff;
  color: #4338ca;
  padding: 5px 10px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
}

/* Related Category */

.related-category {
  padding: 20px 24px;
  display: flex;
  align-items: center;
  gap: 14px;
}

.category-icon,
.child-icon {
  width: 42px;
  height: 42px;
  background: #eef2ff;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
}

.related-info {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.related-info strong {
  font-size: 15px;
  color: #111827;
}

.related-info span {
  font-size: 13px;
  color: #6b7280;
}

/* Children */

.children-list {
  padding: 0;
}

.child-row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 24px;
  border-bottom: 1px solid #f3f4f6;
}

.child-row:last-child {
  border-bottom: none;
}

.child-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.child-info strong {
  font-size: 15px;
  color: #111827;
}

.child-info span {
  font-size: 13px;
  color: #6b7280;
}

.child-id {
  font-size: 12px;
  color: #9ca3af;
}

.view-button {
  border: 1px solid #d1d5db;
  background: white;
  color: #374151;
  padding: 7px 13px;
  border-radius: 7px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
}

.view-button:hover {
  background: #f9fafb;
}

/* Empty */

.empty-state {
  padding: 35px 24px;
  text-align: center;
  color: #6b7280;
}

.empty-state p {
  margin: 10px 0 0;
}

.empty-icon {
  font-size: 30px;
}

/* Loading */

.state-container {
  min-height: 350px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  color: #6b7280;
  text-align: center;
}

.spinner {
  width: 35px;
  height: 35px;
  border: 4px solid #e5e7eb;
  border-top-color: #4f46e5;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-bottom: 15px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* Error */

.error-state h3 {
  margin: 10px 0 5px;
  color: #111827;
}

.error-state p {
  max-width: 500px;
  margin: 0 0 15px;
}

.error-icon {
  width: 45px;
  height: 45px;
  border-radius: 50%;
  background: #fee2e2;
  color: #991b1b;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  font-size: 22px;
}

.retry-button,
.back-button-large {
  border: none;
  background: #4f46e5;
  color: white;
  padding: 10px 18px;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
}

.retry-button:hover,
.back-button-large:hover {
  background: #4338ca;
}

/* Responsive */

@media (max-width: 768px) {
  .category-view-page {
    padding: 16px;
  }

  .page-header {
    flex-direction: column;
    gap: 15px;
  }

  .details-grid {
    grid-template-columns: 1fr;
  }

  .detail-item:nth-child(odd) {
    border-right: none;
  }

  .child-row {
    flex-wrap: wrap;
  }

  .child-id {
    display: none;
  }
}
</style>
