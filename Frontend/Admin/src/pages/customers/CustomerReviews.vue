<script setup>
import {computed, onMounted, ref} from "vue"
import api from "../../api/axios"

const reviews = ref([])
const loading = ref(true)
const errorMessage = ref("")
const search = ref("")
const ratingFilter = ref("all")

const customerName = (review) => {
  if (!review.customer) {
    return "Guest"
  }

  return `${review.customer.first_name || ""} ${
      review.customer.last_name || ""
  }`.trim() || "Guest"
}

const productName = (review) => {
  return review.item?.item_name || review.item?.name || "-"
}

const filteredReviews = computed(() => {
  const term = search.value.toLowerCase().trim()

  return reviews.value.filter((review) => {
    const matchesSearch =
        !term ||
        customerName(review).toLowerCase().includes(term) ||
        productName(review).toLowerCase().includes(term) ||
        `${review.review_title || ""}`.toLowerCase().includes(term) ||
        `${review.review_text || ""}`.toLowerCase().includes(term)

    const matchesRating =
        ratingFilter.value === "all" ||
        Number(review.rating) === Number(ratingFilter.value)

    return matchesSearch && matchesRating
  })
})

const loadReviews = async () => {
  try {
    loading.value = true
    errorMessage.value = ""

    const response = await api.get("/product-reviews")

    reviews.value = response.data.data || []
  } catch (error) {
    console.error("Review loading error:", error)

    errorMessage.value =
        error.response?.data?.message ||
        "Failed to load customer reviews."
  } finally {
    loading.value = false
  }
}

const deleteReview = async (id) => {
  if (!confirm("Are you sure you want to delete this review?")) {
    return
  }

  try {
    await api.delete(`/product-reviews/${id}`)

    await loadReviews()
  } catch (error) {
    console.error("Delete review error:", error)

    alert(
        error.response?.data?.message ||
        "Failed to delete review."
    )
  }
}

const formatDate = (date) => {
  if (!date) {
    return "-"
  }

  return new Date(date).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  })
}

const stars = (rating) => Math.min(5, Math.max(0, Math.round(Number(rating) || 0)))

onMounted(loadReviews)
</script>

<template>
  <div class="page-container">

    <!-- Header -->
    <div class="page-header">
      <div>
        <h1>Product Reviews</h1>

        <p>
          Manage reviews submitted by customers for purchased products.
        </p>
      </div>
    </div>

    <!-- Error -->
    <div
        v-if="errorMessage"
        class="error-state"
    >
      {{ errorMessage }}
    </div>

    <!-- Filters -->
    <div class="filter-card">

      <div class="search-box">
        <input
            v-model="search"
            type="text"
            placeholder="Search customer, product, review..."
        />
      </div>

      <select v-model="ratingFilter">
        <option value="all">
          All Ratings
        </option>

        <option value="5">
          5 Stars
        </option>

        <option value="4">
          4 Stars
        </option>

        <option value="3">
          3 Stars
        </option>

        <option value="2">
          2 Stars
        </option>

        <option value="1">
          1 Star
        </option>
      </select>

    </div>

    <!-- Table -->
    <div class="table-card">

      <div
          v-if="loading"
          class="empty-state"
      >
        Loading reviews...
      </div>

      <div
          v-else-if="!filteredReviews.length"
          class="empty-state"
      >
        No customer reviews found.
      </div>

      <div
          v-else
          class="table-container"
      >

        <table>

          <thead>
          <tr>
            <th>Customer</th>
            <th>Product</th>
            <th>Rating</th>
            <th>Title</th>
            <th>Review</th>
            <th>Date</th>
            <th>Actions</th>
          </tr>
          </thead>

          <tbody>

          <tr
              v-for="review in filteredReviews"
              :key="review.id"
          >

            <!-- Customer -->
            <td>
              <strong>
                {{ customerName(review) }}
              </strong>
            </td>

            <!-- Product -->
            <td>
              {{ productName(review) }}
            </td>

            <!-- Rating -->
            <td>
              <td>
  <span class="rating">
    {{ "★".repeat(stars(review.rating)) }}<span class="rating-empty">{{ "★".repeat(5 - stars(review.rating)) }}</span>
  </span>
                <small>{{ Number(review.rating) || 0 }}/5</small>
              </td>

              <small>
                {{ review.rating }}/5
              </small>
            </td>

            <!-- Title -->
            <td>
              {{ review.review_title || "-" }}
            </td>

            <!-- Review -->
            <td class="review-column">
              {{ review.review_text || "-" }}
            </td>

            <!-- Date -->
            <td>
              {{ formatDate(review.created_at || review.createdAt) }}
            </td>

            <!-- Actions -->
            <td>

              <div class="action-buttons">

                <button
                    class="action-button delete"
                    @click="deleteReview(review.id)"
                >
                  Delete
                </button>

              </div>

            </td>

          </tr>

          </tbody>

        </table>

      </div>

    </div>

  </div>
</template>

<style scoped>
.page-container {
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

.page-header h1 {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
}

.page-header p {
  margin-top: 5px;
  font-size: var(--font-size-md);
  color: var(--color-text-secondary);
}

/* =========================
   Buttons
   ========================= */

.action-buttons {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.action-button {
  display: inline-flex;
  align-items: center;
  padding: 6px var(--spacing-md);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-text-secondary);
  font-family: inherit;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  text-decoration: none;
  cursor: pointer;
  transition: background var(--transition-fast),
  color var(--transition-fast),
  border-color var(--transition-fast);
}

.action-button.edit:hover {
  background: var(--color-primary-light);
  border-color: var(--color-primary-light);
  color: var(--color-primary);
}

.action-button.delete:hover {
  background: var(--color-danger-bg);
  border-color: var(--color-danger-light);
  color: var(--color-danger);
}

/* =========================
   Filters
   ========================= */

.filter-card {
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

.search-box {
  flex: 1;
  max-width: 420px;
}

.search-box input,
.filter-card select {
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

.search-box input {
  width: 100%;
  padding: 0 var(--spacing-lg);
}

.search-box input::placeholder {
  color: var(--color-text-muted);
}

.filter-card select {
  min-width: 150px;
  padding: 0 var(--spacing-md);
  color: var(--color-text-secondary);
  cursor: pointer;
}

.search-box input:focus,
.filter-card select:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-light);
}

/* =========================
   Table
   ========================= */

.table-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
}

.table-container {
  overflow-x: auto;
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

td strong {
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

tbody tr {
  transition: background var(--transition-fast);
}

tbody tr:hover {
  background: var(--color-surface-hover);
}

tbody tr:last-child td {
  border-bottom: none;
}

/* =========================
   Review Column
   ========================= */

.review-column {
  min-width: 260px;
  max-width: 380px;
  line-height: 1.5;
}

.review-column strong {
  display: block;
  margin-bottom: 2px;
}

.review-column span {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* =========================
   Rating
   ========================= */

.rating-stars {
  color: var(--color-warning);
  font-size: var(--font-size-lg);
  letter-spacing: 2px;
  white-space: nowrap;
}

/* =========================
   Badges
   ========================= */

.status,
.default-badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: var(--radius-full);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  text-transform: capitalize;
  white-space: nowrap;
}

.status.pending {
  background: var(--color-warning-bg);
  color: var(--color-warning);
}

.status.approved {
  background: var(--color-success-bg);
  color: var(--color-success);
}

.status.rejected {
  background: var(--color-danger-bg);
  color: var(--color-danger);
}

.default-badge {
  background: var(--color-info-bg);
  color: var(--color-info);
}

/* =========================
   States
   ========================= */

.empty-state {
  padding: 50px var(--spacing-xl);
  text-align: center;
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.error-state {
  margin-bottom: var(--spacing-lg);
  padding: var(--spacing-md) var(--spacing-lg);
  border-radius: var(--radius-lg);
  background: var(--color-danger-bg);
  color: var(--color-danger);
  font-size: var(--font-size-sm);
}

.rating {
  color: var(--color-warning);
  font-size: var(--font-size-lg);
  letter-spacing: 2px;
  white-space: nowrap;
}

.rating-empty {
  color: var(--color-border);
}

td small {
  margin-left: var(--spacing-sm);
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

/* =========================
   Responsive
   ========================= */

@media (max-width: 900px) {
  .filter-card {
    flex-wrap: wrap;
  }

  .search-box {
    flex-basis: 100%;
    max-width: none;
  }
}

@media (max-width: 700px) {
  .page-header,
  .filter-card {
    flex-direction: column;
    align-items: stretch;
  }

  .filter-card select {
    width: 100%;
  }
}
</style>
