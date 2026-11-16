
<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from "vue"
import api from "@/api/axios"
import AppPagination from '@/components/common/AppPagination.vue'
import { createRequestSequence } from '@/composables/useServerPagination.js'
const paginationRequestSequence = createRequestSequence()

const reviews = ref([])
const loading = ref(true)
const errorMessage = ref("")
const successMessage = ref("")
const search = ref("")
const ratingFilter = ref("all")
const statusFilter = ref("pending")
const processingId = ref(null)
const ratingCounts = ref({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 })
const imageItems = ref([])
const selectedReviewImageIndex = ref(-1)
const imageFeedRequestSequence = createRequestSequence()

const currentReviewImage = computed(
  () => imageItems.value[selectedReviewImageIndex.value] || null
)

const allRatingCount = computed(
  () => Object.values(ratingCounts.value).reduce((total, count) => total + Number(count || 0), 0)
)

const openReviewImage = (review, image) => {
  const index = imageItems.value.findIndex(
    (item) =>
      String(item.id) === String(review.id) &&
      String(item.image.id) === String(image.id)
  )

  if (index !== -1) selectedReviewImageIndex.value = index
}

const closeReviewImage = () => {
  selectedReviewImageIndex.value = -1
}

const previousReviewImage = () => {
  if (selectedReviewImageIndex.value > 0) {
    selectedReviewImageIndex.value -= 1
  }
}

const nextReviewImage = () => {
  if (selectedReviewImageIndex.value < imageItems.value.length - 1) {
    selectedReviewImageIndex.value += 1
  }
}

const handleReviewImageKeydown = (event) => {
  if (selectedReviewImageIndex.value === -1) return

  if (event.key === "Escape") closeReviewImage()
  if (event.key === "ArrowLeft") previousReviewImage()
  if (event.key === "ArrowRight") nextReviewImage()
}

const page = ref(1); const pageSize = ref(25); const pagination = ref({ total: 0, totalPages: 1 })

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
  const requestId = paginationRequestSequence.begin()
  try {
    loading.value = true
    errorMessage.value = ""

    const response = await api.get("/product-reviews", { params: { page: page.value, pageSize: pageSize.value, status: statusFilter.value === 'all' ? undefined : statusFilter.value, rating: ratingFilter.value === 'all' ? undefined : ratingFilter.value, search: search.value || undefined } })
    if (!paginationRequestSequence.isCurrent(requestId)) return
    const data = response.data?.data

    reviews.value = Array.isArray(data) ? data : []
    ratingCounts.value = {
      1: Number(response.data?.ratingCounts?.[1] || 0),
      2: Number(response.data?.ratingCounts?.[2] || 0),
      3: Number(response.data?.ratingCounts?.[3] || 0),
      4: Number(response.data?.ratingCounts?.[4] || 0),
      5: Number(response.data?.ratingCounts?.[5] || 0),
    }
    pagination.value = response.data?.pagination || { total: reviews.value.length, totalPages: 1 }
  } catch (error) {
    if (!paginationRequestSequence.isCurrent(requestId)) return
    console.error("Review loading error:", error)

    errorMessage.value =
      error.response?.data?.message ||
      "Failed to load customer reviews."
  } finally {
    if (!paginationRequestSequence.isCurrent(requestId)) return
    loading.value = false
  }
}
const loadReviewImages = async () => {
  const requestId = imageFeedRequestSequence.begin()

  try {
    const params = {
      status: statusFilter.value === "all" ? undefined : statusFilter.value,
      rating: ratingFilter.value === "all" ? undefined : ratingFilter.value,
      search: search.value.trim() || undefined,
    }

    const response = await api.get("/product-reviews/images", { params })

    if (!imageFeedRequestSequence.isCurrent(requestId)) return

    const matchingReviews = Array.isArray(response.data?.data)
      ? response.data.data
      : []

    imageItems.value = matchingReviews.flatMap((review) =>
      (review.images || []).map((image) => ({
        ...review,
        image,
      }))
    )
  } catch (error) {
    if (!imageFeedRequestSequence.isCurrent(requestId)) return
    console.error("Review image loading error:", error)
    imageItems.value = []
  }
}

const refreshReviews = async () => {
  await Promise.all([loadReviews(), loadReviewImages()])
}

const changePage = async (value) => {
  page.value = value
  await loadReviews()
}

const changePageSize = async (value) => {
  pageSize.value = value
  page.value = 1
  await loadReviews()
}

watch([search, ratingFilter, statusFilter], () => {
  page.value = 1
  closeReviewImage()
  refreshReviews()
})

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
    await refreshReviews()
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
    closeReviewImage()
    await refreshReviews()
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

onMounted(() => {
  refreshReviews()
  window.addEventListener("keydown", handleReviewImageKeydown)
})

onUnmounted(() => {
  window.removeEventListener("keydown", handleReviewImageKeydown)
})
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
        @click="refreshReviews"
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

      <div class="rating-filters" role="group" aria-label="Filter reviews by rating">
        <button
          type="button"
          class="rating-filter-button"
          :class="{ active: ratingFilter === 'all' }"
          @click="ratingFilter = 'all'"
        >
          All <span>{{ allRatingCount }}</span>
        </button>

        <button
          v-for="rating in [5, 4, 3, 2, 1]"
          :key="rating"
          type="button"
          class="rating-filter-button"
          :class="{ active: ratingFilter === String(rating) }"
          @click="ratingFilter = String(rating)"
        >
          {{ rating }} ★ <span>{{ ratingCounts[rating] }}</span>
        </button>
      </div>
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

                <div
                  v-if="review.images?.length"
                  class="review-image-gallery"
                  aria-label="Review images"
                >
                  <button
                    v-for="image in review.images"
                    :key="image.id"
                    class="review-image-button"
                    type="button"
                    title="View review image"
                    @click="openReviewImage(review, image)"
                  >
                    <img
                      :src="image.url"
                      alt="Customer review attachment"
                      loading="lazy"
                    />
                  </button>
                </div>
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
        <AppPagination :page="page" :page-size="pageSize" :total="pagination.total"
        :total-pages="pagination.totalPages" :loading="loading" @update:page="changePage" @update:page-size="changePageSize" />
      </div>
    </div>
    <div
      v-if="currentReviewImage"
      class="review-image-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label="Customer review image viewer"
      @click.self="closeReviewImage"
    >
      <div class="review-image-viewer" @click.stop>
        <div class="review-image-toolbar">
          <span class="image-counter">
            Image {{ selectedReviewImageIndex + 1 }} of {{ imageItems.length }}
          </span>

          <button
            class="review-image-close"
            type="button"
            aria-label="Close image preview"
            @click="closeReviewImage"
          >
            &times;
          </button>
        </div>

        <div class="review-image-stage">
          <button
            class="review-image-nav previous"
            type="button"
            aria-label="Previous image"
            :disabled="selectedReviewImageIndex === 0"
            @click="previousReviewImage"
          >
            &#10094;
          </button>

          <img
            :src="currentReviewImage.image.url"
            alt="Customer review attachment"
          />

          <button
            class="review-image-nav next"
            type="button"
            aria-label="Next image"
            :disabled="selectedReviewImageIndex >= imageItems.length - 1"
            @click="nextReviewImage"
          >
            &#10095;
          </button>
        </div>

        <section class="review-image-details">
          <div class="image-review-heading">
            <div>
              <strong>{{ customerName(currentReviewImage) }}</strong>
              <span>{{ productName(currentReviewImage) }}</span>
            </div>

            <span class="status-badge" :class="reviewStatus(currentReviewImage)">
              {{ reviewStatus(currentReviewImage) }}
            </span>
          </div>

          <div class="image-review-rating">
            <span class="rating">
              {{ "★".repeat(stars(currentReviewImage.rating)) }}<span class="rating-empty">{{ "★".repeat(5 - stars(currentReviewImage.rating)) }}</span>
            </span>
            <span>{{ Number(currentReviewImage.rating) || 0 }}/5</span>
            <span>{{ formatDate(currentReviewImage.created_at || currentReviewImage.createdAt) }}</span>
            <span>Review #{{ currentReviewImage.id }}</span>
          </div>

          <strong class="image-review-title">
            {{ currentReviewImage.review_title || "Untitled review" }}
          </strong>

          <p class="image-review-text">
            {{ currentReviewImage.review_text || "No written review." }}
          </p>
        </section>
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

.search-box input {
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

.search-box input:focus {
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

.review-image-gallery {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}

.review-image-button {
  width: 58px;
  height: 58px;
  padding: 0;
  overflow: hidden;
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  cursor: zoom-in;
}

.review-image-button img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.review-image-button:hover {
  border-color: var(--color-primary);
}

.rating-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
}

.rating-filter-button {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  min-height: 40px;
  padding: 7px 11px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-text-secondary);
  font: inherit;
  font-size: var(--font-size-sm);
  cursor: pointer;
  white-space: nowrap;
}

.rating-filter-button span {
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
}

.rating-filter-button.active {
  border-color: var(--color-primary);
  background: var(--color-primary-light);
  color: var(--color-primary);
  font-weight: var(--font-weight-semibold);
}

.review-image-lightbox {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(0, 0, 0, 0.92);
}

.review-image-viewer {
  display: flex;
  flex-direction: column;
  width: min(1500px, 100%);
  max-height: calc(100vh - 40px);
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: var(--radius-lg);
  background: #151515;
  color: white;
}

.review-image-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 52px;
  padding: 5px 14px 5px 18px;
}

.image-counter {
  color: rgba(255, 255, 255, 0.8);
  font-size: var(--font-size-sm);
}

.review-image-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border: 1px solid rgba(255, 255, 255, 0.35);
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.08);
  color: white;
  font-size: 26px;
  line-height: 1;
  cursor: pointer;
}

.review-image-stage {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 180px;
  padding: 0 58px;
  background: #080808;
}

.review-image-stage img {
  display: block;
  max-width: 100%;
  max-height: min(65vh, 850px);
  object-fit: contain;
}

.review-image-nav {
  position: absolute;
  top: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 52px;
  transform: translateY(-50%);
  border: 1px solid rgba(255, 255, 255, 0.35);
  border-radius: var(--radius-md);
  background: rgba(0, 0, 0, 0.55);
  color: white;
  font-size: 22px;
  cursor: pointer;
}

.review-image-nav.previous {
  left: 10px;
}

.review-image-nav.next {
  right: 10px;
}

.review-image-nav:disabled {
  opacity: 0.25;
  cursor: not-allowed;
}

.review-image-details {
  max-height: 190px;
  overflow-y: auto;
  padding: 16px 20px 20px;
  background: #1d1d1d;
}

.image-review-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
}

.image-review-heading > div {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.image-review-heading strong,
.image-review-title {
  color: white;
}

.image-review-heading > div > span,
.image-review-rating {
  color: rgba(255, 255, 255, 0.65);
  font-size: var(--font-size-xs);
}

.image-review-rating {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin: 10px 0;
}

.image-review-rating .rating {
  font-size: 15px;
}

.image-review-title {
  display: block;
  margin-bottom: 5px;
  font-size: var(--font-size-sm);
}

.image-review-text {
  color: rgba(255, 255, 255, 0.8);
  font-size: var(--font-size-sm);
  line-height: 1.5;
  overflow-wrap: anywhere;
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

  .rating-filters {
    gap: 6px;
  }

  .rating-filter-button {
    flex: 1 1 auto;
    justify-content: center;
  }

  .review-image-lightbox {
    padding: 8px;
  }

  .review-image-viewer {
    max-height: calc(100vh - 16px);
  }

  .review-image-stage {
    padding: 0 42px;
  }

  .review-image-stage img {
    max-height: 55vh;
  }

  .review-image-details {
    max-height: 220px;
    padding: 13px;
  }

  .review-image-nav {
    width: 34px;
    height: 44px;
  }

  .review-image-nav.previous {
    left: 4px;
  }

  .review-image-nav.next {
    right: 4px;
  }

  .status-tabs {
    gap: 6px;
  }

  .status-tab {
    padding: 8px 10px;
  }
}
</style>
