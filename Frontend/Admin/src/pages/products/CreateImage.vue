<script setup>
import {computed, nextTick, onBeforeUnmount, onMounted, ref} from 'vue'
import {useRoute, useRouter} from 'vue-router'
import Multiselect from 'vue-multiselect'
import 'vue-multiselect/dist/vue-multiselect.css'
import api from '@/api/axios'
import Cropper from 'cropperjs'
import 'cropperjs/dist/cropper.css'

// ==========================================
// Config
// ==========================================

const MAX_IMAGES = 10
const MAX_IMAGE_SIZE = 5 * 1024 * 1024
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png']

const MAX_VIDEO_SIZE = 15 * 1024 * 1024
const MAX_VIDEO_SECONDS = 30
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime']

const IMAGE_ENDPOINT = '/item-images'
const VIDEO_ENDPOINT = '/item-videos'

const LIST_ROUTE = '/admin/products/item-images'

const route = useRoute()
const router = useRouter()

// Edit mode: route param is the product (item) id
const isEditMode = computed(() => Boolean(route.params.id))
const routeItemId = computed(() => route.params.id)

// Image cropper
const cropModalOpen = ref(false)
const cropSourceUrl = ref('')
const cropImage = ref(null)
const currentCropFile = ref(null)
const cropQueue = ref([])

const cropperInstance = ref(null)

import { getMediaUrl } from '@/utils/mediaUrl'

const fileUrl = (url) => getMediaUrl(url)

// ==========================================
// State
// ==========================================

const loading = ref(false)
const pageLoading = ref(false)
const errorMessage = ref('')
const errorBox = ref(null)

const items = ref([])
const itemsLoading = ref(false)
const selectedItem = ref(null)

// Already saved media (edit mode)
const existingImages = ref([])
const existingVideo = ref(null)
const busyKey = ref(null)

// New files
const images = ref([])
const primaryImageId = ref(null)
const imageErrors = ref([])

const video = ref(null)
const videoError = ref('')

const uploadedImageIds = ref(new Set())
const videoUploaded = ref(false)

const form = ref({
  alt_text: '',
  is_active: true
})

let nextImageId = 0

// ==========================================
// Computed
// ==========================================

const hasUploads = computed(
    () => uploadedImageIds.value.size > 0 || videoUploaded.value
)

const totalToUpload = computed(
    () => images.value.length + (video.value ? 1 : 0)
)

const uploadedCount = computed(
    () => uploadedImageIds.value.size + (videoUploaded.value ? 1 : 0)
)

const totalImageCount = computed(
    () => existingImages.value.length + images.value.length
)

// Existing main image shows as main only if no new image was picked as main
const existingMainActive = computed(() => primaryImageId.value === null)

// ==========================================
// Helpers
// ==========================================

const itemLabel = (item) => `${item.item_code} - ${item.item_name}`

const formatSize = (bytes) => `${(bytes / (1024 * 1024)).toFixed(1)} MB`

const formatDuration = (seconds) => `${Math.round(seconds)} sec`

const showError = async (message) => {
  errorMessage.value = message

  await nextTick()

  errorBox.value?.scrollIntoView({behavior: 'smooth', block: 'center'})
}

const getVideoDuration = (file) =>
    new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file)
      const element = document.createElement('video')

      element.preload = 'metadata'

      element.onloadedmetadata = () => {
        URL.revokeObjectURL(url)
        resolve(element.duration)
      }

      element.onerror = () => {
        URL.revokeObjectURL(url)
        reject(new Error('Unreadable video'))
      }

      element.src = url
    })

// ==========================================
// Load items
// ==========================================

const loadItems = async () => {
  try {
    itemsLoading.value = true

    const response = await api.get('/items')

    items.value = (response.data.data || []).sort((a, b) => {
      const dateA = new Date(a.created_at || 0).getTime()
      const dateB = new Date(b.created_at || 0).getTime()

      return dateB - dateA
    })
  } catch (error) {
    console.error('Failed to load items:', error)

    errorMessage.value =
        error.response?.data?.message ||
        'Failed to load products.'
  } finally {
    itemsLoading.value = false
  }
}

// ==========================================
// Load existing media (edit mode)
// ==========================================

const loadExistingMedia = async () => {
  const sameItem = (record) =>
      Number(record.item_id) === Number(routeItemId.value)

  const [imageResult, videoResult] = await Promise.allSettled([
    api.get(IMAGE_ENDPOINT),
    api.get(VIDEO_ENDPOINT)
  ])

  if (imageResult.status !== 'fulfilled') {
    throw imageResult.reason
  }

  existingImages.value = (imageResult.value.data.data || [])
      .filter(sameItem)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))

  const altTextImage =
      existingImages.value.find(image => image.is_primary) ||
      existingImages.value[0]

  form.value.alt_text = altTextImage?.alt_text || ''

  existingVideo.value =
      videoResult.status === 'fulfilled'
          ? (videoResult.value.data.data || []).find(sameItem) || null
          : null

  // Make sure the product is selected, even if /items didn't include it
  if (!selectedItem.value) {
    selectedItem.value =
        items.value.find(item => Number(item.id) === Number(routeItemId.value)) ||
        existingImages.value[0]?.item ||
        existingVideo.value?.item ||
        null
  }
}

onMounted(async () => {
  await loadItems()

  if (!isEditMode.value) return

  try {
    pageLoading.value = true

    selectedItem.value =
        items.value.find(item => Number(item.id) === Number(routeItemId.value)) ||
        null

    await loadExistingMedia()
  } catch (error) {
    console.error('Failed to load product media:', error)

    errorMessage.value =
        error.response?.data?.message ||
        'Failed to load product media.'
  } finally {
    pageLoading.value = false
  }
})

// ==========================================
// Existing media actions (edit mode)
// ==========================================

const setExistingMain = async (image) => {
  try {
    busyKey.value = `image-${image.id}`

    await api.put(`${IMAGE_ENDPOINT}/${image.id}`, {is_primary: true})

    // A new image may have been picked as main — existing one wins now
    primaryImageId.value = null

    await loadExistingMedia()
  } catch (error) {
    console.error('Failed to set main image:', error)

    await showError(
        error.response?.data?.message || 'Failed to set the main image.'
    )
  } finally {
    busyKey.value = null
  }
}

const removeExistingImage = async (image) => {
  if (!confirm('Are you sure you want to delete this image?')) return

  try {
    busyKey.value = `image-${image.id}`

    await api.delete(`${IMAGE_ENDPOINT}/${image.id}`)

    existingImages.value = existingImages.value.filter(
        item => item.id !== image.id
    )
  } catch (error) {
    console.error('Failed to delete image:', error)

    await showError(
        error.response?.data?.message || 'Failed to delete the image.'
    )
  } finally {
    busyKey.value = null
  }
}

const removeExistingVideo = async () => {
  if (!existingVideo.value) return

  if (!confirm('Are you sure you want to delete this video?')) return

  try {
    busyKey.value = `video-${existingVideo.value.id}`

    await api.delete(`${VIDEO_ENDPOINT}/${existingVideo.value.id}`)

    existingVideo.value = null
  } catch (error) {
    console.error('Failed to delete video:', error)

    await showError(
        error.response?.data?.message || 'Failed to delete the video.'
    )
  } finally {
    busyKey.value = null
  }
}

// ==========================================
// New images
// ==========================================


const destroyCropper = () => {
  if (cropperInstance.value) {
    cropperInstance.value.destroy()
    cropperInstance.value = null
  }
}

const openNextCrop = async () => {
  destroyCropper()

  if (cropSourceUrl.value) {
    URL.revokeObjectURL(cropSourceUrl.value)
    cropSourceUrl.value = ''
  }

  if (!cropQueue.value.length) {
    cropModalOpen.value = false
    currentCropFile.value = null
    return
  }

  currentCropFile.value = cropQueue.value.shift()
  cropSourceUrl.value = URL.createObjectURL(currentCropFile.value)
  cropModalOpen.value = true

  await nextTick()

  if (!cropImage.value) return

  cropperInstance.value = new Cropper(cropImage.value, {
    aspectRatio: 1,
    viewMode: 1,
    autoCropArea: 1,
    responsive: true,
    background: false,
    checkOrientation: true,
    zoomable: true,
    movable: true,
    rotatable: true,
    scalable: false
  })
}

const handleImagesChange = async (event) => {
  const files = Array.from(event.target.files || [])
  event.target.value = ''
  imageErrors.value = []

  if (!files.length) return

  const problems = []
  const accepted = []

  for (const file of files) {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      problems.push(`${file.name}: only PNG and JPG images are allowed.`)
      continue
    }

    if (file.size > MAX_IMAGE_SIZE) {
      problems.push(`${file.name}: image must be smaller than 5MB.`)
      continue
    }

    const duplicate = [
      ...images.value.map(image => image.file),
      ...cropQueue.value,
      ...accepted
    ].some(existing =>
        existing.name === file.name &&
        existing.size === file.size &&
        existing.lastModified === file.lastModified
    )

    if (duplicate) {
      problems.push(`${file.name}: already added.`)
      continue
    }

    if (
        totalImageCount.value + cropQueue.value.length + accepted.length
        >= MAX_IMAGES
    ) {
      problems.push(`You can upload a maximum of ${MAX_IMAGES} images.`)
      break
    }

    accepted.push(file)
  }

  imageErrors.value = problems
  cropQueue.value.push(...accepted)

  if (!cropModalOpen.value && accepted.length) {
    await openNextCrop()
  }
}

const saveCroppedImage = async () => {
  if (!cropperInstance || !currentCropFile.value) return

  try {
    const canvas = cropperInstance.value.getCroppedCanvas({
      width: 1200,
      height: 1200,
      imageSmoothingEnabled: true,
      imageSmoothingQuality: 'high'
    })

    if (!canvas) {
      imageErrors.value = ['Unable to crop this image. Please try another image.']
      return
    }

    const blob = await new Promise(resolve => {
      canvas.toBlob(resolve, 'image/jpeg', 0.92)
    })

    if (!blob) {
      imageErrors.value = ['Unable to process this image. Please try again.']
      return
    }

    const original = currentCropFile.value
    const croppedFile = new File(
        [blob],
        `${original.name.replace(/\.[^.]+$/, '')}-cropped.jpg`,
        {
          type: 'image/jpeg',
          lastModified: Date.now()
        }
    )

    const image = {
      id: ++nextImageId,
      file: croppedFile,
      previewUrl: URL.createObjectURL(croppedFile)
    }

    images.value.push(image)

    if (!primaryImageId.value && existingImages.value.length === 0) {
      primaryImageId.value = image.id
    }

    destroyCropper()

    if (cropSourceUrl.value) {
      URL.revokeObjectURL(cropSourceUrl.value)
      cropSourceUrl.value = ''
    }

    currentCropFile.value = null
    await openNextCrop()
  } catch (error) {
    console.error('Image cropping failed:', error)
    imageErrors.value = ['Image cropping failed. Please try again.']
  }
}

const cancelCurrentCrop = async () => {
  destroyCropper()

  if (cropSourceUrl.value) {
    URL.revokeObjectURL(cropSourceUrl.value)
    cropSourceUrl.value = ''
  }

  currentCropFile.value = null
  await openNextCrop()
}


const removeImage = (imageId) => {
  const image = images.value.find(item => item.id === imageId)

  if (!image) return

  URL.revokeObjectURL(image.previewUrl)

  images.value = images.value.filter(item => item.id !== imageId)

  if (primaryImageId.value === imageId) {
    primaryImageId.value =
        existingImages.value.length === 0
            ? images.value[0]?.id ?? null
            : null
  }
}

const setPrimaryImage = (imageId) => {
  primaryImageId.value = imageId
}

// ==========================================
// New video
// ==========================================

const clearVideo = () => {
  if (video.value) {
    URL.revokeObjectURL(video.value.previewUrl)
  }

  video.value = null
}

const handleVideoChange = async (event) => {
  const file = event.target.files?.[0]

  event.target.value = ''
  videoError.value = ''

  if (!file) return

  if (!ALLOWED_VIDEO_TYPES.includes(file.type)) {
    videoError.value = 'Only MP4, WebM or MOV videos are allowed.'
    return
  }

  if (file.size > MAX_VIDEO_SIZE) {
    videoError.value = 'Video must be smaller than 15MB.'
    return
  }

  let duration

  try {
    duration = await getVideoDuration(file)
  } catch (error) {
    videoError.value = 'Could not read this video file.'
    return
  }

  if (!Number.isFinite(duration)) {
    videoError.value = 'Could not read the video length.'
    return
  }

  if (duration >= MAX_VIDEO_SECONDS) {
    videoError.value = 'Video must be shorter than 30 seconds.'
    return
  }

  clearVideo()

  video.value = {
    file,
    duration,
    previewUrl: URL.createObjectURL(file)
  }
}

// ==========================================
// Submit
// ==========================================

const submitForm = async () => {
  loading.value = true
  errorMessage.value = ''

  try {
    if (!selectedItem.value) {
      await showError('Please select a product.')
      return
    }

    if (!isEditMode.value && !images.value.length) {
      await showError('Please add at least one image.')
      return
    }

    const itemId = selectedItem.value.id
    const altText = form.value.alt_text.trim()
    const sortOffset = existingImages.value.length

    // Images
    for (const [index, image] of images.value.entries()) {
      if (uploadedImageIds.value.has(image.id)) continue

      const formData = new FormData()

      formData.append('item_id', itemId)
      formData.append('image', image.file)
      formData.append('alt_text', altText)
      formData.append('sort_order', sortOffset + index + 1)
      formData.append('is_primary', image.id === primaryImageId.value)
      formData.append('is_active', form.value.is_active)

      await api.post(IMAGE_ENDPOINT, formData)

      uploadedImageIds.value.add(image.id)
    }

    // Video
    if (video.value && !videoUploaded.value) {
      const formData = new FormData()

      formData.append('item_id', itemId)
      formData.append('video', video.value.file)
      formData.append('is_active', form.value.is_active)

      await api.post(VIDEO_ENDPOINT, formData)

      videoUploaded.value = true
    }

    alert(
        isEditMode.value
            ? 'Media updated successfully.'
            : 'Media uploaded successfully.'
    )

    router.push(LIST_ROUTE)
  } catch (error) {
    console.error('Failed to upload media:', error)

    const reason =
        error.response?.data?.message ||
        error.message ||
        'Failed to upload media.'

    await showError(
        hasUploads.value
            ? `${reason} (${uploadedCount.value} of ${totalToUpload.value} files uploaded. Submit again to retry the rest.)`
            : reason
    )
  } finally {
    loading.value = false
  }
}

const goBack = () => {
  router.push(LIST_ROUTE)
}

onBeforeUnmount(() => {
  destroyCropper()

  if (cropSourceUrl.value) {
    URL.revokeObjectURL(cropSourceUrl.value)
  }

  images.value.forEach(image => URL.revokeObjectURL(image.previewUrl))
  clearVideo()
})
</script>

<template>
  <div class="media-form-page">

    <!-- Header -->
    <div class="form-header">
      <div>
        <h1>{{ isEditMode ? 'Edit Product Media' : 'Add Product Media' }}</h1>
        <p>
          {{
            isEditMode
                ? 'Manage the existing images and video, or add new files.'
                : 'Upload images and an optional video for a product.'
          }}
        </p>
      </div>

      <button
          type="button"
          class="btn-secondary"
          @click="goBack"
          :disabled="loading"
      >
        Cancel
      </button>
    </div>

    <!-- Error -->
    <div
        v-if="errorMessage"
        ref="errorBox"
        class="error-message"
    >
      {{ errorMessage }}
    </div>

    <!-- Loading -->
    <div
        v-if="pageLoading"
        class="empty-media"
    >
      Loading product media...
    </div>

    <!-- Form -->
    <form
        v-else
        class="media-form"
        @submit.prevent="submitForm"
    >

      <!-- Product -->
      <section class="form-section">

        <div class="section-header">
          <h2>Product</h2>
          <p>Search and select the product these files belong to.</p>
        </div>

        <div class="form-group">
          <label for="item">
            Product
            <span>*</span>
          </label>

          <Multiselect
              id="item"
              v-model="selectedItem"
              :options="items"
              :custom-label="itemLabel"
              track-by="id"
              :loading="itemsLoading"
              :disabled="hasUploads || loading || isEditMode"
              :options-limit="200"
              :show-labels="false"
              placeholder="Search by item code or name..."
          >
            <template #noResult>
              No products found.
            </template>

            <template #noOptions>
              No products available.
            </template>
          </Multiselect>
        </div>

      </section>

      <!-- Images -->
      <section class="form-section">

        <div class="section-header">
          <h2>Images</h2>
          <p>
            Add up to {{ MAX_IMAGES }} PNG or JPG images (max 5MB each) and
            choose the main image.
          </p>
        </div>

        <div class="form-group">
          <label for="images">
            {{ isEditMode ? 'Add More Images' : 'Product Images' }}
            <span v-if="!isEditMode">*</span>
          </label>

          <input
              id="images"
              type="file"
              accept="image/png,image/jpeg"
              multiple
              :disabled="loading || totalImageCount >= MAX_IMAGES"
              @change="handleImagesChange"
          />

          <small>
            {{ totalImageCount }} / {{ MAX_IMAGES }} images.
          </small>
        </div>

        <!-- Image errors -->
        <div
            v-if="imageErrors.length"
            class="inline-error"
        >
          <div
              v-for="message in imageErrors"
              :key="message"
          >
            {{ message }}
          </div>
        </div>

        <!-- Existing images -->
        <span
            v-if="existingImages.length"
            class="group-label"
        >
          Current images
        </span>

        <div
            v-if="existingImages.length"
            class="image-grid"
        >
          <div
              v-for="image in existingImages"
              :key="`db-${image.id}`"
              class="image-tile"
              :class="{ 'is-primary': image.is_primary && existingMainActive }"
          >

            <div class="image-thumb">
              <img
                  :src="fileUrl(image.url)"
                  :alt="image.alt_text || image.file_name"
              />

              <span
                  v-if="image.is_primary && existingMainActive"
                  class="image-badge"
              >
                Main
              </span>

              <button
                  type="button"
                  class="image-remove"
                  title="Delete image"
                  :disabled="loading || busyKey === `image-${image.id}`"
                  @click="removeExistingImage(image)"
              >
                ×
              </button>
            </div>

            <button
                type="button"
                class="main-button"
                :disabled="
                  loading ||
                  busyKey === `image-${image.id}` ||
                  (image.is_primary && existingMainActive)
                "
                @click="setExistingMain(image)"
            >
              {{
                image.is_primary && existingMainActive
                    ? 'Main image'
                    : 'Set as main'
              }}
            </button>

          </div>
        </div>

        <!-- New images -->
        <span
            v-if="existingImages.length && images.length"
            class="group-label"
        >
          New images
        </span>

        <div
            v-if="images.length"
            class="image-grid"
        >
          <div
              v-for="(image, index) in images"
              :key="image.id"
              class="image-tile"
              :class="{ 'is-primary': image.id === primaryImageId }"
          >

            <div class="image-thumb">
              <img
                  :src="image.previewUrl"
                  :alt="form.alt_text || `Image ${index + 1}`"
              />

              <span
                  v-if="image.id === primaryImageId"
                  class="image-badge"
              >
                Main
              </span>

              <span
                  v-if="uploadedImageIds.has(image.id)"
                  class="image-badge uploaded-badge"
              >
                Uploaded
              </span>

              <button
                  v-if="!uploadedImageIds.has(image.id)"
                  type="button"
                  class="image-remove"
                  title="Remove image"
                  :disabled="loading"
                  @click="removeImage(image.id)"
              >
                ×
              </button>
            </div>

            <button
                type="button"
                class="main-button"
                :disabled="
                  loading ||
                  hasUploads ||
                  image.id === primaryImageId
                "
                @click="setPrimaryImage(image.id)"
            >
              {{
                image.id === primaryImageId
                    ? 'Main image'
                    : 'Set as main'
              }}
            </button>

          </div>
        </div>

        <div
            v-if="!existingImages.length && !images.length"
            class="empty-media"
        >
          No images added yet.
        </div>

      </section>

      <!-- Video -->
      <section class="form-section">

        <div class="section-header">
          <h2>Video</h2>
          <p>
            Optionally add one video shorter than 30 seconds and smaller
            than 15MB (MP4, WebM or MOV).
          </p>
        </div>

        <!-- Existing video -->
        <div
            v-if="existingVideo"
            class="video-preview"
        >
          <video
              :src="fileUrl(existingVideo.url)"
              controls
              preload="metadata"
          ></video>

          <div class="video-meta">
            <strong>{{ existingVideo.file_name }}</strong>

            <small>Current video</small>

            <button
                type="button"
                class="remove-button"
                :disabled="loading || busyKey === `video-${existingVideo.id}`"
                @click="removeExistingVideo"
            >
              Delete video
            </button>
          </div>
        </div>

        <div
            v-if="!video && !existingVideo"
            class="form-group"
        >
          <label for="video">
            Product Video
          </label>

          <input
              id="video"
              type="file"
              accept="video/mp4,video/webm,video/quicktime"
              :disabled="loading"
              @change="handleVideoChange"
          />
        </div>

        <div
            v-if="videoError"
            class="inline-error"
        >
          {{ videoError }}
        </div>

        <div
            v-if="video"
            class="video-preview"
        >
          <video
              :src="video.previewUrl"
              controls
              preload="metadata"
          ></video>

          <div class="video-meta">
            <strong>{{ video.file.name }}</strong>

            <small>
              {{ formatDuration(video.duration) }} •
              {{ formatSize(video.file.size) }}
              <span v-if="videoUploaded">• Uploaded</span>
            </small>

            <button
                v-if="!videoUploaded"
                type="button"
                class="remove-button"
                :disabled="loading"
                @click="clearVideo"
            >
              Remove
            </button>
          </div>
        </div>

      </section>

      <!-- Settings -->
      <section class="form-section">

        <div class="section-header">
          <h2>Settings</h2>
          <p>Configure how new files are used for the product.</p>
        </div>

        <div class="form-group">
          <label for="alt_text">
            Alt Text
          </label>

          <input
              id="alt_text"
              v-model="form.alt_text"
              type="text"
              placeholder="e.g. Kingston 16GB DDR4 RAM"
              maxlength="255"
              :disabled="loading || hasUploads"
          />

          <small>
            Applied to all newly added images. Used for accessibility and SEO.
          </small>
        </div>

        <div class="checkbox-group">
          <label>
            <input
                v-model="form.is_active"
                type="checkbox"
                :disabled="loading || hasUploads"
            />

            <span>Active</span>
          </label>

          <small>
            Inactive media will not be shown on the product.
          </small>
        </div>

      </section>

      <!-- Actions -->
      <div class="form-actions">

        <button
            type="button"
            class="btn-secondary"
            @click="goBack"
            :disabled="loading"
        >
          Cancel
        </button>

        <button
            type="submit"
            class="btn-primary"
            :disabled="loading"
        >
          {{
            loading
                ? `Uploading ${uploadedCount} of ${totalToUpload}...`
                : isEditMode
                    ? 'Save Changes'
                    : 'Upload'
          }}
        </button>

      </div>

    </form>

  </div>

  <div v-if="cropModalOpen" class="crop-modal-overlay">
    <section
        class="crop-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="crop-modal-title"
    >
      <h2 id="crop-modal-title">Crop product image</h2>

      <p class="crop-help">
        Recommended size: 1200 × 1200 px.
        Drag to position the image and zoom as needed.
      </p>

      <p v-if="currentCropFile" class="crop-filename">
        {{ currentCropFile.name }}
      </p>

      <div class="crop-image-container">
        <img
            v-if="cropSourceUrl"
            ref="cropImage"
            :src="cropSourceUrl"
            alt="Image to crop"
        />
      </div>

      <div class="crop-actions">
        <button
            type="button"
            class="btn-secondary"
            :disabled="loading"
            @click="cancelCurrentCrop"
        >
          Skip image
        </button>

        <button
            type="button"
            class="btn-primary"
            :disabled="loading || !cropperInstance"
            @click="saveCroppedImage"
        >
          Use cropped image
        </button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.media-form-page {
  width: 100%;
  max-width: 1100px;
  margin: 0 auto;
  font-family: var(--font-family);
}

/* =========================
   Header
   ========================= */

.form-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-lg);
  margin-bottom: var(--spacing-2xl);
}

.form-header h1 {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
}

.form-header p {
  margin-top: 5px;
  font-size: var(--font-size-md);
  color: var(--color-text-secondary);
}

/* =========================
   Form / Sections
   ========================= */

.media-form {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xl);
}

.form-section {
  padding: var(--spacing-2xl);
  background: var(--color-surface);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
}

.section-header {
  margin-bottom: var(--spacing-xl);
}

.section-header h2 {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
}

.section-header p {
  margin-top: 5px;
  font-size: var(--font-size-md);
  color: var(--color-text-secondary);
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.form-group + .checkbox-group {
  margin-top: var(--spacing-xl);
}

/* =========================
   Labels / Inputs
   ========================= */

.form-group label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.form-group label span {
  color: var(--color-danger);
}

.form-group input {
  width: 100%;
  box-sizing: border-box;
  height: 40px;
  padding: 0 var(--spacing-lg);
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

.form-group input[type="file"] {
  height: auto;
  padding: 8px var(--spacing-lg);
  cursor: pointer;
}

.form-group input::placeholder {
  color: var(--color-text-muted);
}

.form-group input:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-light);
}

.form-group input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.form-group small,
.checkbox-group small {
  font-size: var(--font-size-xs);
  line-height: 1.5;
  color: var(--color-text-muted);
}

/* =========================
   Searchable Select (vue-multiselect)
   ========================= */

.form-group :deep(.multiselect) {
  min-height: 40px;
  font-family: inherit;
  font-size: var(--font-size-md);
  color: var(--color-text-primary);
}

.form-group :deep(.multiselect__tags) {
  min-height: 40px;
  padding: 7px 40px 0 var(--spacing-lg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  transition: border-color var(--transition-fast),
  box-shadow var(--transition-fast);
}

.form-group :deep(.multiselect--active .multiselect__tags) {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-light);
}

.form-group :deep(.multiselect--disabled) {
  opacity: 0.6;
}

.form-group :deep(.multiselect__input),
.form-group :deep(.multiselect__single) {
  min-height: 20px;
  margin-bottom: 0;
  padding: 0;
  background: transparent;
  color: var(--color-text-primary);
  font-family: inherit;
  font-size: var(--font-size-md);
}

.form-group :deep(.multiselect__placeholder) {
  margin-bottom: 0;
  padding-top: 0;
  color: var(--color-text-muted);
}

.form-group :deep(.multiselect__select) {
  height: 38px;
  right: 4px;
}

.form-group :deep(.multiselect__content-wrapper) {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  box-shadow: var(--shadow-sm);
  z-index: 1000;
}

.form-group :deep(.multiselect__content) {
  padding: 0;
}

.form-group :deep(.multiselect__option) {
  padding: 10px var(--spacing-lg);
  min-height: 0;
  font-size: var(--font-size-md);
  color: var(--color-text-primary);
}

.form-group :deep(.multiselect__option--highlight),
.form-group :deep(.multiselect__option--highlight::after) {
  background: var(--color-primary);
  color: var(--color-text-light);
}

.form-group :deep(.multiselect__option--selected) {
  background: var(--color-hover-bg);
  font-weight: var(--font-weight-semibold);
}

.form-group :deep(.multiselect__option--selected.multiselect__option--highlight) {
  background: var(--color-primary);
  color: var(--color-text-light);
}

.form-group :deep(.multiselect__spinner) {
  background: var(--color-surface);
}

/* =========================
   Image Previews
   ========================= */

.image-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: var(--spacing-md);
  margin-top: var(--spacing-xl);
}

.image-tile {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
}

.image-tile.is-primary {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px var(--color-primary-light);
}

.image-thumb {
  position: relative;
  width: 100%;
  aspect-ratio: 1 / 1;
  background: var(--color-hover-bg);
}

.image-thumb img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.image-badge {
  position: absolute;
  top: 6px;
  left: 6px;
  padding: 2px 8px;
  border-radius: var(--radius-lg);
  background: var(--color-primary);
  color: var(--color-text-light);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
}

.uploaded-badge {
  top: auto;
  bottom: 6px;
  background: var(--color-success-bg);
  color: var(--color-success);
}

.image-remove {
  position: absolute;
  top: 6px;
  right: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
}

.image-remove:hover:not(:disabled) {
  background: var(--color-danger);
}

.image-remove:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.main-button {
  height: 32px;
  border: none;
  border-top: 1px solid var(--color-border-light);
  background: var(--color-surface);
  color: var(--color-text-secondary);
  font-family: inherit;
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
  transition: background var(--transition-fast),
  color var(--transition-fast);
}

.main-button:hover:not(:disabled) {
  background: var(--color-hover-bg);
  color: var(--color-text-primary);
}

.main-button:disabled {
  cursor: default;
}

.is-primary .main-button {
  background: var(--color-primary-light);
  color: var(--color-primary);
}

.empty-media {
  margin-top: var(--spacing-xl);
  padding: var(--spacing-lg);
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-lg);
  text-align: center;
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

/* =========================
   Video Preview
   ========================= */

.video-preview {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-lg);
}

.video-preview video {
  width: 240px;
  max-width: 100%;
  max-height: 180px;
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-lg);
  background: #000;
}

.video-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  min-width: 0;
}

.video-meta strong {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--font-size-md);
  color: var(--color-text-primary);
}

.video-meta small {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.remove-button {
  padding: 0;
  border: none;
  background: transparent;
  color: var(--color-danger);
  font-family: inherit;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
}

.remove-button:hover:not(:disabled) {
  text-decoration: underline;
}

/* =========================
   Checkbox
   ========================= */

.checkbox-group {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.checkbox-group label {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  cursor: pointer;
}

.checkbox-group input[type="checkbox"] {
  width: 16px;
  height: 16px;
  cursor: pointer;
  accent-color: var(--color-primary);
}

/* =========================
   Errors
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

.inline-error {
  margin-top: var(--spacing-md);
  padding: var(--spacing-md) var(--spacing-lg);
  border: 1px solid var(--color-danger-light);
  border-radius: var(--radius-lg);
  background: var(--color-danger-bg);
  color: var(--color-danger);
  font-size: var(--font-size-sm);
}

/* =========================
   Actions / Buttons
   ========================= */

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-md);
}

.btn-primary,
.btn-secondary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 40px;
  padding: 0 var(--spacing-xl);
  border-radius: var(--radius-lg);
  font-family: inherit;
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
  white-space: nowrap;
  cursor: pointer;
  transition: background var(--transition-fast),
  color var(--transition-fast),
  border-color var(--transition-fast);
}

.btn-primary {
  border: none;
  background: var(--color-primary);
  color: var(--color-text-light);
}

.btn-primary:hover:not(:disabled) {
  background: var(--color-primary-hover);
}

.btn-secondary {
  border: 1px solid var(--color-border-light);
  background: var(--color-surface);
  color: var(--color-text-secondary);
}

.btn-secondary:hover:not(:disabled) {
  background: var(--color-hover-bg);
  color: var(--color-text-primary);
}

.btn-primary:disabled,
.btn-secondary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.crop-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgb(0 0 0 / 65%);
}

.crop-modal {
  width: 100%;
  max-width: 760px;
  max-height: 90vh;
  overflow-y: auto;
  padding: 24px;
  border-radius: 12px;
  background: var(--color-surface);
  color: var(--color-text-primary);
}

.crop-modal h2 {
  margin: 0 0 8px;
}

.crop-help,
.crop-filename {
  margin: 8px 0;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

.crop-image-container {
  width: 100%;
  height: min(55vh, 500px);
  margin: 16px 0;
  background: #222;
}

.crop-image-container img {
  display: block;
  max-width: 100%;
}

.crop-actions {
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 12px;
}

/* =========================
   Responsive
   ========================= */

@media (max-width: 768px) {
  .form-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .form-section {
    padding: var(--spacing-xl);
  }

  .image-grid {
    grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
  }

  .video-preview {
    flex-direction: column;
  }

  .video-preview video {
    width: 100%;
  }

  .form-actions {
    flex-direction: column-reverse;
  }

  .btn-primary,
  .btn-secondary {
    width: 100%;
  }
}
</style>
