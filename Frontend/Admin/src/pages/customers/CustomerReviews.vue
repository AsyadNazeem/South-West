
<script setup>
import { computed, onMounted, ref } from "vue"
import api from "@/api/axios"

const reviews = ref([])
const loading = ref(true)
const errorMessage = ref("")
const successMessage = ref("")
const search = ref("")
const ratingFilter = ref("all")
const statusFilter = ref("pending")
const processingId = ref(null)

const statuses = [
  { label: "Pending", value: "pending" },
  { label: "Approved", value: "approved" },
  { label: "Rejected", value: "rejected" },
  { label: "All Reviews", value: "all" },
]

const customerName = (review) => {
  if (!review.customer) return "Guest"

  const name = `${review.customer.first_name || ""} ${
    review.customer.last_name || ""
  }`.trim()

  return name || "Guest"
}

const productName = (review) =>
  review.item?.item_name || review.item?.name || "-"

const reviewStatus = (review) => {
  const status = String(review.status || "pending").toLowerCase()

  return ["pending", "approved", "rejected"].includes(status)
    ? status
    : "pending"
}

const statusCounts = computed(() => ({
  all: reviews.value.length,
  pending: reviews.value.filter(
    (review) => reviewStatus(review) === "pending"
  ).length,
  approved: reviews.value.filter(
    (review) => reviewStatus(review) === "approved"
  ).length,
  rejected: reviews.value.filter(
    (review) => reviewStatus(review) === "rejected"
  ).length,
}))

const filteredReviews = computed(() => {
  const term = search.value.toLowerCase().trim()

  return reviews.value.filter((review) => {
    const matchesStatus =
      statusFilter.value === "all" ||
      reviewStatus(review) === statusFilter.value

    const matchesRating =
      ratingFilter.value === "all" ||
      Number(review.rating) === Number(ratingFilter.value)

    const searchableText = [
      customerName(review),
      productName(review),
      review.review_title || "",
      review.review_text || "",
      String(review.id),
    ]
      .join(" ")
      .toLowerCase()

    return (
      matchesStatus &&
      matchesRating &&
      (!term || searchableText.includes(term))
    )
  })
})

const loadReviews = async () => {
  try {
    loading.value = true
    errorMessage.value = ""

    const response = await api.get("/product-reviews")
    const data = response.data?.data

    reviews.value = Array.isArray(data) ? data : []
  } catch (error) {
    console.error("Review loading error:", error)

    errorMessage.value =
      error.response?.data?.message ||
      "Failed to load customer reviews."
  } finally {
    loading.value = false
  }
}

const updateReviewStatus = async (review, newStatus) => {
  if (!review?.id || processingId.value !== null) return

  const action = newStatus === "approved" ? "approve" : "reject"

  const confirmed = window.confirm(
    `Are you sure you want to ${action} this review?`
  )

  if (!confirmed) return

  try {
    processingId.value = review.id
    errorMessage.value = ""
    successMessage.value = ""

    await api.put(`/product-reviews/${review.id}`, {
      status: newStatus,
    })

    // Update the local list immediately after the server confirms success.
    const index = reviews.value.findIndex(
      (item) => String(item.id) === String(review.id)
    )

    if (index !== -1) {
      reviews.value[index] = {
        ...reviews.value[index],
        status: newStatus,
      }
    }

    successMessage.value =
      newStatus === "approved"
        ? "Review approved successfully."
        : "Review rejected successfully."

    // Refresh to keep the list and counts in sync with the backend.
    await loadReviews()
  } catch (error) {
    console.error("Review status update error:", error)

    errorMessage.value =
      error.response?.data?.message ||
      `Failed to ${action} the review.`
  } finally {
    processingId.value = null
  }
}

const deleteReview = async (review) => {
  if (!review?.id || processingId.value !== null) return

  if (
    !window.confirm(
      "Are you sure you want to permanently delete this review?"
    )
  ) {
    return
  }

  try {
    processingId.value = review.id
    errorMessage.value = ""
    successMessage.value = ""

    await api.delete(`/product-reviews/${review.id}`)

    reviews.value = reviews.value.filter(
      (item) => String(item.id) !== String(review.id)
    )

    successMessage.value = "Review deleted successfully."
    await loadReviews()
  } catch (error) {
    console.error("Delete review error:", error)

    errorMessage.value =
      error.response?.data?.message ||
      "Failed to delete the review."
  } finally {
    processingId.value = null
  }
}

const formatDate = (date) => {
  if (!date) return "-"

  const parsedDate = new Date(date)

  if (Number.isNaN(parsedDate.getTime())) return "-"

  return parsedDate.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

const stars = (rating) =>
  Math.min(5, Math.max(0, Math.round(Number(rating) || 0)))

onMounted(loadReviews)
</script>

<template>
  <div class="page-container">
    <div class="page-header">
      <div>
        <h1>Product Reviews</h1>
        <p>Review and moderate feedback submitted by customers.</p>
      </div>

      <button
        class="refresh-button"
        type="button"
        :disabled="loading"
        @click="loadReviews"
      >
        {{ loading ? "Loading..." : "Refresh Reviews" }}
      </button>
    </div>

    <div v-if="errorMessage" class="message error-state" role="alert">
      {{ errorMessage }}
      <button type="button" @click="errorMessage = ''" aria-label="Dismiss error">
        ×
      </button>
    </div>

    <div v-if="successMessage" class="message success-state" role="status">
      {{ successMessage }}
      <button
        type="button"
        @click="successMessage = ''"
        aria-label="Dismiss message"
      >
        ×
      </button>
    </div>

    <div class="status-tabs">
      <button
        v-for="tab in statuses"
        :key="tab.value"
        type="button"
        class="status-tab"
        :class="{ active: statusFilter === tab.value }"
        @click="statusFilter = tab.value"
      >
        {{ tab.label }}
        <span class="count">{{ statusCounts[tab.value] }}</span>
      </button>
    </div>

    <div class="filter-card">
      <div class="search-box">
        <input
          v-model="search"
          type="search"
          placeholder="Search customer, product or review..."
          aria-label="Search reviews"
        />
      </div>

      <select v-model="ratingFilter" aria-label="Filter by rating">
        <option value="all">All Ratings</option>
        <option value="5">5 Stars</option>
        <option value="4">4 Stars</option>
        <option value="3">3 Stars</option>
        <option value="2">2 Stars</option>
        <option value="1">1 Star</option>
      </select>
    </div>

    <div class="results-info">
      Showing {{ filteredReviews.length }}
      {{ filteredReviews.length === 1 ? "review" : "reviews" }}
    </div>

    <div class="table-card">
      <div v-if="loading" class="empty-state">
        Loading reviews...
      </div>

      <div v-else-if="!filteredReviews.length" class="empty-state">
        <div class="empty-icon">☆</div>
        <strong>No reviews found</strong>
        <p>
          {{
            statusFilter === "pending"
              ? "There are no pending reviews matching your filters."
              : "Try changing the status, search term or rating filter."
          }}
        </p>
      </div>

      <div v-else class="table-container">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Customer</th>
              <th>Product</th>
              <th>Rating</th>
              <th>Review</th>
              <th>Date</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            <tr v-for="review in filteredReviews" :key="review.id">
              <td>#{{ review.id }}</td>

              <td>
                <strong>{{ customerName(review) }}</strong>
              </td>

              <td class="product-column">
                {{ productName(review) }}
              </td>

              <td>
                <div class="rating">
                  <span>{{ "★".repeat(stars(review.rating)) }}</span><span class="rating-empty">{{ "★".repeat(5 - stars(review.rating)) }}</span>
                </div>
                <small>{{ Number(review.rating) || 0 }}/5</small>
              </td>

              <td class="review-column">
                <strong>{{ review.review_title || "Untitled review" }}</strong>
                <p>{{ review.review_text || "-" }}</p>
              </td>

              <td>
                {{ formatDate(review.created_at || review.createdAt) }}
              </td>

              <td>
                <span class="status-badge" :class="reviewStatus(review)">
                  {{ reviewStatus(review) }}
                </span>
              </td>

              <td>
                <div class="action-buttons">
                  <template v-if="reviewStatus(review) === 'pending'">
                    <button
                      class="action-button approve"
                      type="button"
                      :disabled="processingId !== null"
                      @click="updateReviewStatus(review, 'approved')"
                    >
                      {{
                        processingId === review.id
                          ? "Saving..."
                          : "Approve"
                      }}
                    </button>

                    <button
                      class="action-button reject"
                      type="button"
                      :disabled="processingId !== null"
                      @click="updateReviewStatus(review, 'rejected')"
                    >
                      Reject
                    </button>
                  </template>

                  <button
                    v-else-if="reviewStatus(review) === 'rejected'"
                    class="action-button approve"
                    type="button"
                    :disabled="processingId !== null"
                    @click="updateReviewStatus(review, 'approved')"
                  >
                    Approve
                  </button>

                  <button
                    v-else
                    class="action-button reject"
                    type="button"
                    :disabled="processingId !== null"
                    @click="updateReviewStatus(review, 'rejected')"
                  >
                    Revoke Approval
                  </button>

                  <button
                    class="action-button delete"
                    type="button"
                    :disabled="processingId !== null"
                    @click="deleteReview(review)"
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
  color: var(--color-text-primary);
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--spacing-lg);
  margin-bottom: var(--spacing-xl);
}

.page-header h1 {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
}

.page-header p {
  margin-top: 5px;
  color: var(--color-text-secondary);
  font-size: var(--font-size-md);
}

.refresh-button {
  padding: 10px 16px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-text-primary);
  cursor: pointer;
  font: inherit;
  font-size: var(--font-size-sm);
}

.refresh-button:disabled,
.action-button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.status-tabs {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: var(--spacing-lg);
}

.status-tab {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  padding: 10px 14px;
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-text-secondary);
  cursor: pointer;
  font: inherit;
  font-size: var(--font-size-sm);
}

.status-tab.active {
  border-color: var(--color-primary);
  color: var(--color-primary);
  background: var(--color-primary-light);
  font-weight: var(--font-weight-semibold);
}

.count {
  min-width: 23px;
  padding: 2px 6px;
  border-radius: var(--radius-full);
  background: var(--color-hover-bg);
  color: var(--color-text-primary);
  text-align: center;
  font-size: var(--font-size-xs);
}

.filter-card {
  display: flex;
  align-items: center;
  gap: var(--spacing-lg);
  margin-bottom: var(--spacing-md);
  padding: var(--spacing-xl);
  background: var(--color-surface);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
}

.search-box {
  flex: 1;
}

.search-box input,
.filter-card select {
  box-sizing: border-box;
  height: 42px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-text-primary);
  font: inherit;
  font-size: var(--font-size-sm);
  outline: none;
}

.search-box input {
  width: 100%;
  padding: 0 12px;
}

.filter-card select {
  min-width: 145px;
  padding: 0 10px;
}

.search-box input:focus,
.filter-card select:focus {
  border-color: var(--color-primary);
}

.results-info {
  margin-bottom: var(--spacing-md);
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

.table-card {
  overflow: hidden;
  background: var(--color-surface);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
}

.table-container {
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th {
  padding: 13px 15px;
  text-align: left;
  white-space: nowrap;
  background: var(--color-hover-bg);
  color: var(--color-text-secondary);
  border-bottom: 1px solid var(--color-border-light);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

td {
  padding: 15px;
  border-bottom: 1px solid var(--color-border-light);
  vertical-align: middle;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

tbody tr:last-child td {
  border-bottom: none;
}

tbody tr:hover {
  background: var(--color-surface-hover);
}

td strong {
  color: var(--color-text-primary);
  font-weight: var(--font-weight-semibold);
}

.product-column {
  min-width: 140px;
}

.review-column {
  min-width: 230px;
  max-width: 330px;
}

.review-column p {
  margin-top: 5px;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.rating {
  white-space: nowrap;
  color: var(--color-warning);
  font-size: 17px;
  letter-spacing: 1px;
}

.rating-empty {
  color: var(--color-border);
}

td small {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.status-badge {
  display: inline-flex;
  padding: 5px 9px;
  border-radius: var(--radius-full);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  text-transform: capitalize;
}

.status-badge.pending {
  background: var(--color-warning-bg);
  color: var(--color-warning);
}

.status-badge.approved {
  background: var(--color-success-bg);
  color: var(--color-success);
}

.status-badge.rejected {
  background: var(--color-danger-bg);
  color: var(--color-danger);
}

.action-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  min-width: 100px;
}

.action-button {
  padding: 7px 10px;
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-text-secondary);
  font: inherit;
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
  white-space: nowrap;
}

.action-button.approve {
  border-color: var(--color-success);
  background: var(--color-success-bg);
  color: var(--color-success);
}

.action-button.reject,
.action-button.delete {
  border-color: var(--color-danger-light);
  background: var(--color-danger-bg);
  color: var(--color-danger);
}

.action-button:hover:not(:disabled) {
  filter: brightness(0.96);
}

.empty-state {
  padding: 48px 20px;
  text-align: center;
  color: var(--color-text-muted);
}

.empty-state strong {
  display: block;
  margin: 8px 0;
  color: var(--color-text-primary);
}

.empty-state p {
  margin-top: 5px;
  font-size: var(--font-size-sm);
}

.empty-icon {
  font-size: 32px;
}

.message {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: var(--spacing-lg);
  padding: 12px 16px;
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
}

.message button {
  border: none;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font-size: 20px;
}

.error-state {
  background: var(--color-danger-bg);
  color: var(--color-danger);
}

.success-state {
  background: var(--color-success-bg);
  color: var(--color-success);
}

@media (max-width: 700px) {
  .page-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .filter-card {
    align-items: stretch;
    flex-direction: column;
    padding: 14px;
  }

  .filter-card select {
    width: 100%;
  }

  .status-tabs {
    gap: 6px;
  }

  .status-tab {
    padding: 8px 10px;
  }
}
</style>
