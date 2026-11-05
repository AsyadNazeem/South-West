
<script setup>
import { getMediaUrl } from '../../utils/mediaUrl'
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import Cropper from 'cropperjs'
import 'cropperjs/dist/cropper.css'
import { useRoute, useRouter } from 'vue-router'
import {
    ArrowLeft,
    ImagePlus,
    Upload,
    X,
    Save,
    LoaderCircle,
    AlertCircle,
    CalendarClock,
    Eye,
} from 'lucide-vue-next'

import {
    getHomepageBanner,
    createHomepageBanner,
    updateHomepageBanner,
} from '../../api/homepageBannerApi'

import { hasPermission } from '../../auth/authorization'

const route = useRoute()
const router = useRouter()

const isEditing = computed(() => Boolean(route.params.id))
const bannerId = computed(() => route.params.id)

const loading = ref(false)
const saving = ref(false)
const error = ref('')
const success = ref('')

const imageInput = ref(null)
const imageFile = ref(null)
const imagePreview = ref('')
const existingImageUrl = ref('')
const originalImagePath = ref('')

const mobileImageInput = ref(null)
const mobileImageFile = ref(null)
const mobileImagePreview = ref('')
const existingMobileImageUrl = ref('')

const cropModalOpen = ref(false)
const cropImageElement = ref(null)
const cropperInstance = ref(null)
const cropSourceUrl = ref('')
const cropSourceFile = ref(null)
const cropTarget = ref('desktop')
const MAX_IMAGE_SIZE = 5 * 1024 * 1024


const form = reactive({
    title: '',
    subtitle: '',
    button_text: '',
    link_url: '',
    sort_order: 0,
    is_active: false,
    start_at: '',
    end_at: '',
})

const canCreate = computed(() =>
    hasPermission('homepage_banners.create')
)

const canUpdate = computed(() =>
    hasPermission('homepage_banners.update')
)

const pageTitle = computed(() =>
    isEditing.value ? 'Edit homepage banner' : 'Create homepage banner'
)

const pageDescription = computed(() =>
    isEditing.value
        ? 'Update your banner content and storefront visibility.'
        : 'Create a promotional banner for your storefront.'
)

const canSave = computed(() =>
    isEditing.value ? canUpdate.value : canCreate.value
)

function getBannerImageUrl(path) {
    return getMediaUrl(path)
}

const toLocalDateTime = (value) => {
    if (!value) return ''

    const date = new Date(value)

    if (Number.isNaN(date.getTime())) return ''

    const localDate = new Date(
        date.getTime() - date.getTimezoneOffset() * 60_000
    )

    return localDate.toISOString().slice(0, 16)
}

const toISOStringOrNull = (value) => {
    if (!value) return ''

    const date = new Date(value)

    if (Number.isNaN(date.getTime())) {
        throw new Error('Please provide a valid scheduling date.')
    }

    return date.toISOString()
}

const loadBanner = async () => {
    if (!isEditing.value) return

    loading.value = true
    error.value = ''

    try {
        const response = await getHomepageBanner(bannerId.value)
        const banner = response.data?.data

        if (!banner) {
            throw new Error('Banner details were not returned by the server.')
        }

        form.title = banner.title || ''
        form.subtitle = banner.subtitle || ''
        form.button_text = banner.button_text || ''
        form.link_url = banner.link_url || ''
        form.sort_order = Number(banner.sort_order ?? 0)
        form.is_active = Boolean(banner.is_active)
        form.start_at = toLocalDateTime(banner.start_at)
        form.end_at = toLocalDateTime(banner.end_at)

existingImageUrl.value = getBannerImageUrl(banner.image_url)
originalImagePath.value = banner.image_path || ''
imagePreview.value = existingImageUrl.value

        existingMobileImageUrl.value = banner.mobile_image_url
            ? getBannerImageUrl(banner.mobile_image_url)
            : ''
        mobileImagePreview.value = existingMobileImageUrl.value
    } catch (err) {
        error.value =
            err.response?.data?.message ||
            err.message ||
            'Unable to load the banner.'
    } finally {
        loading.value = false
    }
}

const openImagePicker = () => {
    imageInput.value?.click()
}

const openMobileImagePicker = () => {
    mobileImageInput.value?.click()
}

const destroyCropper = () => {
    if (cropperInstance.value) {
        cropperInstance.value.destroy()
        cropperInstance.value = null
    }
}

const closeCropModal = () => {
    destroyCropper()
    cropModalOpen.value = false

    if (cropSourceUrl.value) {
        URL.revokeObjectURL(cropSourceUrl.value)
        cropSourceUrl.value = ''
    }

    cropSourceFile.value = null
}

const initializeCropper = async () => {
    await nextTick()

    const image = cropImageElement.value
    if (!image) return

    try {
        await image.decode()
    } catch {
        error.value = 'Unable to load this image. Please choose another file.'
        closeCropModal()
        return
    }

    destroyCropper()

    cropperInstance.value = new Cropper(image, {
        aspectRatio: cropTarget.value === 'desktop' ? 3 / 1 : 4 / 3,
        viewMode: 1,
        autoCropArea: 1,
        responsive: true,
        background: false,
        movable: true,
        zoomable: true,
        scalable: false,
        rotatable: false,
        checkOrientation: true,
        guides: true,
        center: true,
        highlight: false,
        cropBoxMovable: false,
        cropBoxResizable: false,
        toggleDragModeOnDblclick: false,
    })
}

const startImageCrop = async (file, target) => {
    error.value = ''

    if (!['image/jpeg', 'image/png'].includes(file.type)) {
        error.value = 'Only JPG and PNG images are allowed.'
        return
    }

    if (file.size > MAX_IMAGE_SIZE) {
        error.value = 'Each image must not exceed 5 MB.'
        return
    }

    closeCropModal()

    cropTarget.value = target
    cropSourceFile.value = file
    cropSourceUrl.value = URL.createObjectURL(file)
    cropModalOpen.value = true

    await initializeCropper()
}

const onImageSelected = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    await startImageCrop(file, 'desktop')
    event.target.value = ''
}

const onMobileImageSelected = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    await startImageCrop(file, 'mobile')
    event.target.value = ''
}

const applyImageCrop = async () => {
    if (!cropperInstance.value || !cropSourceFile.value) return

    error.value = ''

    const isDesktop = cropTarget.value === 'desktop'

    const canvas = cropperInstance.value.getCroppedCanvas({
        width: isDesktop ? 1800 : 1200,
        height: isDesktop ? 600 : 900,
        imageSmoothingEnabled: true,
        imageSmoothingQuality: 'high',
        fillColor: '#ffffff',
    })

    if (!canvas) {
        error.value = 'Unable to crop this image. Please try another image.'
        return
    }

    const qualities = [0.9, 0.85, 0.8, 0.75, 0.7]
    let blob = null

    for (const quality of qualities) {
        blob = await new Promise((resolve) => {
            canvas.toBlob(resolve, 'image/jpeg', quality)
        })

        if (blob && blob.size <= MAX_IMAGE_SIZE) break
    }

    if (!blob || blob.size > MAX_IMAGE_SIZE) {
        error.value = 'The cropped image is still larger than 5 MB. Please use a smaller image.'
        return
    }

    const originalName = cropSourceFile.value.name.replace(/\.[^.]+$/, '')
    const croppedFile = new File(
        [blob],
        `${originalName}-cropped.jpg`,
        { type: 'image/jpeg', lastModified: Date.now() }
    )

    const previewUrl = URL.createObjectURL(croppedFile)

    if (cropTarget.value === 'desktop') {
        if (imagePreview.value?.startsWith('blob:')) {
            URL.revokeObjectURL(imagePreview.value)
        }

        imageFile.value = croppedFile
        imagePreview.value = previewUrl
    } else {
        if (mobileImagePreview.value?.startsWith('blob:')) {
            URL.revokeObjectURL(mobileImagePreview.value)
        }

        mobileImageFile.value = croppedFile
        mobileImagePreview.value = previewUrl
    }

    closeCropModal()
}

const removeSelectedImage = () => {
    imageFile.value = null

    if (imagePreview.value?.startsWith('blob:')) {
        URL.revokeObjectURL(imagePreview.value)
    }

    imagePreview.value = existingImageUrl.value

    if (imageInput.value) imageInput.value.value = ''
}

const removeSelectedMobileImage = () => {
    mobileImageFile.value = null

    if (mobileImagePreview.value?.startsWith('blob:')) {
        URL.revokeObjectURL(mobileImagePreview.value)
    }

    mobileImagePreview.value = existingMobileImageUrl.value

    if (mobileImageInput.value) mobileImageInput.value.value = ''
}

const validateForm = () => {
    if (!isEditing.value && !imageFile.value) {
        return 'Please select a banner image.'
    }

    if (
        !isEditing.value &&
        !canCreate.value
    ) {
        return 'You do not have permission to create banners.'
    }

    if (
        isEditing.value &&
        !canUpdate.value
    ) {
        return 'You do not have permission to update banners.'
    }

    if (form.title.length > 150) {
        return 'Title cannot exceed 150 characters.'
    }

    if (form.subtitle.length > 255) {
        return 'Subtitle cannot exceed 255 characters.'
    }

    if (form.button_text.length > 60) {
        return 'Button text cannot exceed 60 characters.'
    }

    if (
        !Number.isInteger(Number(form.sort_order)) ||
        Number(form.sort_order) < 0
    ) {
        return 'Sort order must be a non-negative whole number.'
    }

    if (
        form.start_at &&
        form.end_at &&
        new Date(form.end_at) < new Date(form.start_at)
    ) {
        return 'End date must be the same as or later than the start date.'
    }

    if (form.link_url.trim()) {
        const link = form.link_url.trim()

        if (
            /^(javascript|data|vbscript):/i.test(link) ||
            link.startsWith('//')
        ) {
            return 'Please enter a safe destination link.'
        }

        if (/^https?:\/\//i.test(link)) {
            try {
                const parsed = new URL(link)

                if (!['http:', 'https:'].includes(parsed.protocol)) {
                    return 'Please enter a valid destination link.'
                }
            } catch {
                return 'Please enter a valid destination link.'
            }
        } else if (!link.startsWith('/')) {
            return 'Use a relative path beginning with / or a full HTTP(S) URL.'
        }
    }

    return ''
}

const submitForm = async () => {
    error.value = ''
    success.value = ''

    const validationMessage = validateForm()

    if (validationMessage) {
        error.value = validationMessage
        return
    }

    saving.value = true

    try {
        const payload = new FormData()

        payload.append('title', form.title.trim())
        payload.append('subtitle', form.subtitle.trim())
        payload.append('button_text', form.button_text.trim())
        payload.append('link_url', form.link_url.trim())
        payload.append('sort_order', String(Number(form.sort_order)))
        payload.append('is_active', String(form.is_active))
        payload.append('start_at', toISOStringOrNull(form.start_at))
        payload.append('end_at', toISOStringOrNull(form.end_at))

        if (imageFile.value) {
            payload.append('image', imageFile.value)
        }

        if (mobileImageFile.value) {
            payload.append('mobile_image', mobileImageFile.value)
        }

        if (isEditing.value) {
            await updateHomepageBanner(bannerId.value, payload)
            success.value = 'Homepage banner updated successfully.'
        } else {
            await createHomepageBanner(payload)
            success.value = 'Homepage banner created successfully.'
        }

        router.push('/admin/marketing/homepage-banners')
    } catch (err) {
        error.value =
            err.response?.data?.message ||
            err.message ||
            'Unable to save the homepage banner.'
    } finally {
        saving.value = false
    }
}

const goBack = () => {
    router.push('/admin/marketing/homepage-banners')
}

onMounted(loadBanner)

onBeforeUnmount(() => {
    destroyCropper()

    if (cropSourceUrl.value) URL.revokeObjectURL(cropSourceUrl.value)
    if (imagePreview.value?.startsWith('blob:')) URL.revokeObjectURL(imagePreview.value)
    if (mobileImagePreview.value?.startsWith('blob:')) URL.revokeObjectURL(mobileImagePreview.value)
})
</script>

<template>
    <section class="banner-form-page">
        <button class="back-button" type="button" @click="goBack">
            <ArrowLeft :size="17" />
            Back to banners
        </button>

        <header class="page-heading">
            <div>
                <div class="eyebrow">MARKETING / STOREFRONT</div>
                <h1>{{ pageTitle }}</h1>
                <p>{{ pageDescription }}</p>
            </div>

            <span class="form-badge">
                {{ isEditing ? `Banner #${bannerId}` : 'New banner' }}
            </span>
        </header>

        <div v-if="error" class="notice notice-error" role="alert">
            <AlertCircle :size="18" />
            <span>{{ error }}</span>
            <button type="button" aria-label="Dismiss error" @click="error = ''">
                ×
            </button>
        </div>

        <div v-if="loading" class="state-card">
            <LoaderCircle class="spinner" :size="25" />
            <strong>Loading banner...</strong>
        </div>

        <form v-else class="banner-form" @submit.prevent="submitForm">
            <div class="form-main">
                <section class="form-card">
                    <div class="section-heading">
                        <div class="section-icon">
                            <ImagePlus :size="19" />
                        </div>
                        <div>
                            <h2>Banner image</h2>
                            <p>Use a high-quality JPG or PNG image, up to 5 MB. Desktop: 3:1 crop.</p>
                        </div>
                    </div>

                    <input
                        ref="imageInput"
                        class="hidden-input"
                        type="file"
                        accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                        @change="onImageSelected"
                    />

                    <div
                        class="image-dropzone"
                        :class="{ 'has-image': imagePreview }"
                        @click="openImagePicker"
                    >
                       <img
    v-if="imagePreview"
    :src="imagePreview"
    alt="Banner preview"
    class="image-preview"
/>

                        <div v-else class="upload-placeholder">
                            <div class="upload-icon">
                                <Upload :size="24" />
                            </div>
                            <strong>Choose a banner image</strong>
                            <span>JPG or PNG · Maximum 5 MB</span>
                        </div>

                        <div v-if="imagePreview" class="image-overlay">
                            <Upload :size="17" />
                            Change image
                        </div>
                    </div>

                    <div v-if="imagePreview" class="image-file-row">
                        <div class="file-info">
                            <ImagePlus :size="17" />
                            <div>
                                <strong>
                                    {{ imageFile?.name || 'Current banner image' }}
                                </strong>
                                <span>
                                    {{ imageFile
                                        ? `${(imageFile.size / 1024 / 1024).toFixed(2)} MB`
                                        : 'Existing uploaded image' }}
                                </span>
                            </div>
                        </div>

                        <button
                            v-if="imageFile"
                            type="button"
                            class="icon-button"
                            aria-label="Discard selected image"
                            @click="removeSelectedImage"
                        >
                            <X :size="17" />
                        </button>
                    </div>

                    <p class="field-help">
                        {{ isEditing
                            ? 'Leave the current image unchanged, or choose a replacement.'
                            : 'An image is required to create a banner.' }}
                    </p>
                    <div class="mobile-banner-upload">
                        <div class="section-heading">
                            <div class="section-icon">
                                <ImagePlus :size="19" />
                            </div>
                            <div>
                                <h2>Mobile banner image</h2>
                                <p>Optional. Recommended 4:3 landscape layout.</p>
                            </div>
                        </div>

                        <input
                            ref="mobileImageInput"
                            class="hidden-input"
                            type="file"
                            accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                            @change="onMobileImageSelected"
                        />

                        <div
                            class="image-dropzone"
                            :class="{ 'has-image': mobileImagePreview }"
                            @click="openMobileImagePicker"
                        >
                            <img
                                v-if="mobileImagePreview"
                                :src="mobileImagePreview"
                                alt="Mobile banner preview"
                                class="image-preview"
                            />

                            <div v-else class="upload-placeholder">
                                <div class="upload-icon">
                                    <Upload :size="24" />
                                </div>
                                <strong>Choose a mobile banner image</strong>
                                <span>JPG or PNG · Maximum 5 MB</span>
                            </div>

                            <div v-if="mobileImagePreview" class="image-overlay">
                                <Upload :size="17" />
                                Change mobile image
                            </div>
                        </div>

                        <div v-if="mobileImagePreview" class="image-file-row">
                            <div class="file-info">
                                <ImagePlus :size="17" />
                                <div>
                                    <strong>
                                        {{ mobileImageFile?.name || 'Current mobile banner image' }}
                                    </strong>
                                    <span>
                                        {{ mobileImageFile
                                            ? `${(mobileImageFile.size / 1024 / 1024).toFixed(2)} MB`
                                            : 'Existing uploaded image' }}
                                    </span>
                                </div>
                            </div>

                            <button
                                v-if="mobileImageFile"
                                type="button"
                                class="icon-button"
                                aria-label="Discard selected mobile image"
                                @click="removeSelectedMobileImage"
                            >
                                <X :size="17" />
                            </button>
                        </div>

                        <p class="field-help">
                            {{ mobileImagePreview
                                ? 'Leave the current mobile image unchanged, or choose a replacement.'
                                : 'No separate mobile image. The desktop banner will be used on mobile.' }}
                        </p>
                    </div>
                </section>

                <section class="form-card">
                    <div class="section-heading">
                        <div class="section-icon">
                            <Eye :size="19" />
                        </div>
                        <div>
                            <h2>Banner content</h2>
                            <p>Choose the text customers will see on your storefront.</p>
                        </div>
                    </div>

                    <div class="field">
                        <label for="banner-title">Title</label>
                        <input
                            id="banner-title"
                            v-model="form.title"
                            type="text"
                            maxlength="150"
                            placeholder="e.g. Upgrade your setup"
                        />
                        <div class="field-footer">
                            <span>Optional</span>
                            <span>{{ form.title.length }}/150</span>
                        </div>
                    </div>

                    <div class="field">
                        <label for="banner-subtitle">Subtitle</label>
                        <textarea
                            id="banner-subtitle"
                            v-model="form.subtitle"
                            maxlength="255"
                            rows="3"
                            placeholder="Add a short description or promotional message"
                        ></textarea>
                        <div class="field-footer">
                            <span>Optional</span>
                            <span>{{ form.subtitle.length }}/255</span>
                        </div>
                    </div>

                    <div class="two-columns">
                        <div class="field">
                            <label for="banner-button">Button text</label>
                            <input
                                id="banner-button"
                                v-model="form.button_text"
                                type="text"
                                maxlength="60"
                                placeholder="Shop Now"
                            />
                            <div class="field-footer">
                                <span>Optional</span>
                                <span>{{ form.button_text.length }}/60</span>
                            </div>
                        </div>

                        <div class="field">
                            <label for="banner-link">Destination link</label>
                            <input
                                id="banner-link"
                                v-model="form.link_url"
                                type="text"
                                maxlength="1000"
                                placeholder="/shop"
                            />
                            <div class="field-footer">
                                <span>Use a path or HTTP(S) URL</span>
                            </div>
                        </div>
                    </div>
                </section>

                <section class="form-card">
                    <div class="section-heading">
                        <div class="section-icon">
                            <CalendarClock :size="19" />
                        </div>
                        <div>
                            <h2>Schedule and ordering</h2>
                            <p>Control when the banner is displayed and its position.</p>
                        </div>
                    </div>

                    <div class="two-columns">
                        <div class="field">
                            <label for="banner-start">Start date and time</label>
                            <input
                                id="banner-start"
                                v-model="form.start_at"
                                type="datetime-local"
                            />
                            <div class="field-footer">
                                <span>Blank means immediately</span>
                            </div>
                        </div>

                        <div class="field">
                            <label for="banner-end">End date and time</label>
                            <input
                                id="banner-end"
                                v-model="form.end_at"
                                type="datetime-local"
                            />
                            <div class="field-footer">
                                <span>Blank means no end date</span>
                            </div>
                        </div>
                    </div>

                    <div class="field order-field">
                        <label for="banner-order">Display order</label>
                        <input
                            id="banner-order"
                            v-model.number="form.sort_order"
                            type="number"
                            min="0"
                            step="1"
                        />
                        <div class="field-footer">
                            <span>Lower numbers appear first.</span>
                        </div>
                    </div>
                </section>
            </div>

            <aside class="form-sidebar">
                <section class="form-card status-card">
                    <h2>Publication status</h2>
                    <p>Inactive banners are hidden from the public storefront.</p>

                    <label class="toggle-row">
                        <span class="toggle-copy">
                            <strong>{{ form.is_active ? 'Active' : 'Inactive' }}</strong>
                            <small>
                                {{ form.is_active
                                    ? 'Eligible to appear on the storefront'
                                    : 'Hidden from the storefront' }}
                            </small>
                        </span>

                        <input
                            v-model="form.is_active"
                            class="toggle-input"
                            type="checkbox"
                        />
                        <span class="toggle-track"></span>
                    </label>
                </section>

                <section class="form-card preview-card">
                    <h2>Quick preview</h2>

                    <div class="preview-banner">
                        <img
                            v-if="imagePreview"
                            :src="imagePreview"
                            alt=""
                        />
                        <div v-else class="preview-image-placeholder">
                            <ImagePlus :size="24" />
                        </div>

                        <div class="preview-shade"></div>

                        <div class="preview-content">
                            <span class="preview-kicker">SOUTH-WEST</span>
                            <strong>{{ form.title || 'Your banner title' }}</strong>
                            <p>{{ form.subtitle || 'Your banner subtitle appears here.' }}</p>
                            <span v-if="form.button_text" class="preview-button">
                                {{ form.button_text }}
                            </span>
                        </div>
                    </div>

                    <p class="preview-help">
                        Preview only. Your storefront layout may differ.
                    </p>
                </section>

                <section class="form-card tips-card">
                    <h2>Helpful tips</h2>
                    <ul>
                        <li>Use clear images that work well on wide screens.</li>
                        <li>Keep titles short and easy to read.</li>
                        <li>Check your destination link before publishing.</li>
                        <li>Use dates to schedule limited-time campaigns.</li>
                    </ul>
                </section>
            </aside>

            <div class="form-actions">
                <button
                    type="button"
                    class="button button-secondary"
                    :disabled="saving"
                    @click="goBack"
                >
                    Cancel
                </button>

                <button
                    type="submit"
                    class="button button-primary"
                    :disabled="saving || !canSave"
                >
                    <LoaderCircle v-if="saving" class="spinner" :size="17" />
                    <Save v-else :size="17" />
                    {{ saving
                        ? 'Saving...'
                        : isEditing
                            ? 'Save changes'
                            : 'Create banner' }}
                </button>
            </div>
        </form>

        <div
            v-if="cropModalOpen"
            class="crop-modal-overlay"
            @click.self="closeCropModal"
        >
            <div class="crop-modal" role="dialog" aria-modal="true" aria-label="Crop banner image">
                <div class="crop-modal-header">
                    <div>
                        <h2>Crop banner image</h2>
                        <p>Adjust the image position and zoom. The crop ratio is fixed for each banner type.</p>
                    </div>
                    <button type="button" class="crop-close-button" @click="closeCropModal">
                        <X :size="20" />
                    </button>
                </div>

                <div class="crop-image-container">
                    <img
                        ref="cropImageElement"
                        :src="cropSourceUrl"
                        alt="Image to crop"
                    />
                </div>

                <div class="crop-modal-footer">
                    <span>Output: {{ cropTarget === 'desktop' ? '1800 × 600' : '1200 × 900' }} px · Maximum 5 MB</span>
                    <div class="crop-modal-actions">
                        <button type="button" class="button button-secondary" @click="closeCropModal">
                            Cancel
                        </button>
                        <button type="button" class="button button-primary" @click="applyImageCrop">
                            Apply crop
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </section>
</template>

<style scoped>
.banner-form-page {
    --form-border: var(--color-border, #e5e7eb);
    --form-muted: var(--color-text-muted, #6b7280);
    color: var(--color-text, #172033);
    width: 100%;
    max-width: 1500px;
    margin: 0 auto;
}

.back-button {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    margin-bottom: 18px;
    padding: 0;
    color: var(--form-muted);
    background: transparent;
    border: 0;
    font: inherit;
    font-size: 13px;
    cursor: pointer;
}

.back-button:hover {
    color: var(--color-primary, #2563eb);
}

.page-heading {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 20px;
    margin-bottom: 25px;
}

.eyebrow {
    margin-bottom: 8px;
    color: var(--color-primary, #2563eb);
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 1.3px;
}

.page-heading h1 {
    margin: 0;
    font-size: clamp(25px, 3vw, 32px);
    letter-spacing: -.8px;
}

.page-heading p {
    margin: 8px 0 0;
    color: var(--form-muted);
    font-size: 14px;
}

.form-badge {
    padding: 7px 11px;
    color: var(--form-muted);
    background: var(--color-surface, #fff);
    border: 1px solid var(--form-border);
    border-radius: 8px;
    font-size: 12px;
    white-space: nowrap;
}

.banner-form {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(260px, 330px);
    gap: 20px;
}

.form-main,
.form-sidebar {
    display: flex;
    flex-direction: column;
    gap: 18px;
    min-width: 0;
}

.form-sidebar {
    align-self: start;
}

.form-card {
    min-width: 0;
    padding: 22px;
    background: var(--color-surface, #fff);
    border: 1px solid var(--form-border);
    border-radius: 13px;
}

.section-heading {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 22px;
}

.section-icon {
    display: grid;
    place-items: center;
    width: 42px;
    height: 42px;
    flex-shrink: 0;
    color: #3b5ccc;
    background: #eef2ff;
    border-radius: 11px;
}

.section-heading h2,
.form-card > h2 {
    margin: 0;
    font-size: 15px;
    font-weight: 750;
}

.section-heading p,
.status-card > p {
    margin: 5px 0 0;
    color: var(--form-muted);
    font-size: 12px;
    line-height: 1.5;
}

.hidden-input {
    display: none;
}

.image-dropzone {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 235px;
    overflow: hidden;
    background: var(--color-background, #f8fafc);
    border: 1px dashed #b7c0d0;
    border-radius: 11px;
    cursor: pointer;
}

.image-dropzone:hover {
    border-color: var(--color-primary, #2563eb);
}

.image-dropzone.has-image {
    min-height: 0;
    border-style: solid;
    border-color: var(--form-border);
}

.image-preview {
    display: block;
    width: 100%;
    max-height: 360px;
    object-fit: contain;
    background: #f5f6f8;
}

.upload-placeholder {
    display: flex;
    align-items: center;
    flex-direction: column;
    gap: 9px;
    padding: 30px;
    text-align: center;
}

.upload-icon {
    display: grid;
    place-items: center;
    width: 52px;
    height: 52px;
    margin-bottom: 5px;
    color: #3b5ccc;
    background: #eef2ff;
    border-radius: 14px;
}

.upload-placeholder strong {
    font-size: 14px;
}

.upload-placeholder span {
    color: var(--form-muted);
    font-size: 12px;
}

.image-overlay {
    position: absolute;
    right: 12px;
    bottom: 12px;
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 9px 12px;
    color: #fff;
    background: rgb(17 24 39 / 85%);
    border-radius: 8px;
    font-size: 12px;
    font-weight: 650;
}

.image-file-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-top: 13px;
}

.file-info {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
    color: var(--form-muted);
}

.file-info > div {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
}

.file-info strong {
    overflow: hidden;
    color: var(--color-text, #172033);
    font-size: 12px;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.file-info span,
.field-help {
    color: var(--form-muted);
    font-size: 11px;
}

.icon-button {
    display: grid;
    place-items: center;
    width: 34px;
    height: 34px;
    flex-shrink: 0;
    color: #b42318;
    background: #fff3f2;
    border: 1px solid #f4c7c3;
    border-radius: 8px;
    cursor: pointer;
}

.field-help {
    margin: 12px 0 0;
    line-height: 1.5;
}

.field {
    min-width: 0;
    margin-bottom: 18px;
}

.field:last-child {
    margin-bottom: 0;
}

.field label {
    display: block;
    margin-bottom: 7px;
    font-size: 12px;
    font-weight: 700;
}

.field input,
.field textarea {
    display: block;
    width: 100%;
    min-width: 0;
    padding: 11px 12px;
    color: var(--color-text, #172033);
    background: var(--color-surface, #fff);
    border: 1px solid var(--form-border);
    border-radius: 8px;
    outline: none;
    font: inherit;
    font-size: 13px;
    box-sizing: border-box;
}

.field textarea {
    resize: vertical;
    line-height: 1.5;
}

.field input:focus,
.field textarea:focus {
    border-color: var(--color-primary, #2563eb);
    box-shadow: 0 0 0 3px rgb(37 99 235 / 10%);
}

.field-footer {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    margin-top: 6px;
    color: var(--form-muted);
    font-size: 10px;
}

.two-columns {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 15px;
}

.order-field {
    max-width: 220px;
}

.status-card > p {
    margin-bottom: 18px;
}

.toggle-row {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    cursor: pointer;
}

.toggle-copy {
    display: flex;
    flex-direction: column;
    gap: 5px;
}

.toggle-copy strong {
    font-size: 13px;
}

.toggle-copy small {
    color: var(--form-muted);
    font-size: 11px;
    line-height: 1.5;
}

.toggle-input {
    position: absolute;
    width: 42px;
    height: 25px;
    right: 0;
    opacity: 0;
    cursor: pointer;
}

.toggle-track {
    position: relative;
    display: block;
    width: 42px;
    height: 25px;
    flex-shrink: 0;
    background: #d2d7e0;
    border-radius: 99px;
    transition: background .2s ease;
}

.toggle-track::after {
    position: absolute;
    top: 3px;
    left: 3px;
    width: 19px;
    height: 19px;
    content: "";
    background: #fff;
    border-radius: 50%;
    box-shadow: 0 1px 3px rgb(0 0 0 / 15%);
    transition: transform .2s ease;
}

.toggle-input:checked + .toggle-track {
    background: #238454;
}

.toggle-input:checked + .toggle-track::after {
    transform: translateX(17px);
}

.toggle-input:focus-visible + .toggle-track {
    outline: 3px solid rgb(37 99 235 / 30%);
    outline-offset: 2px;
}

.preview-card {
    overflow: hidden;
}

.preview-card > h2 {
    margin-bottom: 15px;
}

.preview-banner {
    position: relative;
    display: flex;
    align-items: flex-end;
    aspect-ratio: 3 / 1;
    min-height: 0;
    overflow: hidden;
    color: #fff;
    background: #344054;
    border-radius: 9px;
}

.preview-banner > img,
.preview-image-placeholder,
.preview-shade {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
}

.preview-banner > img {
    object-fit: cover;
}

.preview-image-placeholder {
    display: grid;
    place-items: center;
    color: #aab3c4;
    background: #e9edf4;
}

.preview-shade {
    background: linear-gradient(
        180deg,
        rgb(0 0 0 / 5%) 10%,
        rgb(0 0 0 / 78%) 100%
    );
}

.preview-content {
    position: relative;
    z-index: 1;
    padding: 18px;
}

.preview-kicker {
    display: block;
    margin-bottom: 9px;
    font-size: 9px;
    font-weight: 800;
    letter-spacing: 1.6px;
}

.preview-content > strong {
    display: block;
    font-size: 21px;
    line-height: 1.2;
    overflow-wrap: anywhere;
}

.preview-content p {
    margin: 9px 0 13px;
    font-size: 11px;
    line-height: 1.5;
    overflow-wrap: anywhere;
}

.preview-button {
    display: inline-block;
    padding: 8px 11px;
    color: #172033;
    background: #fff;
    border-radius: 5px;
    font-size: 10px;
    font-weight: 750;
}

.preview-help {
    margin: 12px 0 0;
    color: var(--form-muted);
    font-size: 10px;
    line-height: 1.5;
}

.tips-card ul {
    display: grid;
    gap: 12px;
    margin: 15px 0 0;
    padding-left: 17px;
    color: var(--form-muted);
    font-size: 12px;
    line-height: 1.55;
}

.form-actions {
    grid-column: 1 / -1;
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    padding: 17px 0 4px;
    border-top: 1px solid var(--form-border);
}

.button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 40px;
    padding: 0 15px;
    border: 1px solid transparent;
    border-radius: 9px;
    font: inherit;
    font-size: 13px;
    font-weight: 650;
    cursor: pointer;
}

.button:disabled {
    opacity: .55;
    cursor: not-allowed;
}

.button-primary {
    color: #fff;
    background: var(--color-primary, #2563eb);
}

.button-secondary {
    color: var(--color-text, #273449);
    background: var(--color-surface, #fff);
    border-color: var(--form-border);
}

.notice {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 14px;
    margin-bottom: 18px;
    border: 1px solid #f4c7c3;
    border-radius: 10px;
    color: #b42318;
    background: #fff4f2;
    font-size: 13px;
}

.notice span {
    flex: 1;
}

.notice button {
    border: 0;
    background: transparent;
    cursor: pointer;
    font-size: 20px;
}

.state-card {
    display: flex;
    align-items: center;
    flex-direction: column;
    gap: 12px;
    padding: 60px 20px;
    color: var(--form-muted);
    background: var(--color-surface, #fff);
    border: 1px dashed var(--form-border);
    border-radius: 12px;
}

.state-card strong {
    color: var(--color-text, #172033);
}

.spinner {
    animation: spin .8s linear infinite;
}

@keyframes spin {
    to { transform: rotate(360deg); }
}

@media (max-width: 1000px) {
    .banner-form {
        grid-template-columns: minmax(0, 1fr);
    }

    .form-sidebar {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        align-items: start;
    }

    .tips-card {
        grid-column: 1 / -1;
    }


}

@media (max-width: 600px) {
    .page-heading {
        flex-direction: column;
    }

    .form-card {
        padding: 16px;
    }

    .two-columns,
    .form-sidebar {
        grid-template-columns: 1fr;
    }

    .tips-card {
        grid-column: auto;
    }

    .form-actions {
        position: sticky;
        bottom: 0;
        z-index: 5;
        padding: 12px;
        margin: 0 -4px;
        background: var(--color-surface, #fff);
    }

    .form-actions .button {
        flex: 1;
    }
}

@media (prefers-reduced-motion: reduce) {
    .spinner,
    .toggle-track,
    .toggle-track::after {
        animation: none;
        transition: none;
    }
}

.crop-modal-overlay {
    position: fixed;
    inset: 0;
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    background: rgba(15, 23, 42, 0.72);
}

.crop-modal {
    width: min(760px, 100%);
    max-height: 92vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: var(--color-surface, #fff);
    border-radius: 14px;
    box-shadow: 0 24px 70px rgba(0, 0, 0, 0.25);
}

.crop-modal-header,
.crop-modal-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 16px 20px;
}

.crop-modal-header {
    border-bottom: 1px solid var(--form-border);
}

.crop-modal-header h2 {
    margin: 0;
    font-size: 18px;
}

.crop-modal-header p {
    margin: 5px 0 0;
    color: var(--form-muted);
    font-size: 13px;
}

.crop-close-button {
    display: grid;
    place-items: center;
    width: 36px;
    height: 36px;
    border: 0;
    border-radius: 8px;
    background: transparent;
    cursor: pointer;
}

.crop-image-container {
    width: 100%;
    height: min(58vh, 520px);
    min-height: 240px;
    overflow: hidden;
    background: #111827;
}

.crop-image-container img {
    display: block;
    max-width: 100%;
}

.crop-modal-footer {
    border-top: 1px solid var(--form-border);
}

.crop-modal-footer > span {
    color: var(--form-muted);
    font-size: 12px;
}

.crop-modal-actions {
    display: flex;
    gap: 10px;
}

@media (max-width: 600px) {
    .crop-modal-overlay {
        padding: 10px;
    }

    .crop-modal-header,
    .crop-modal-footer {
        padding: 12px;
    }

    .crop-modal-footer {
        align-items: stretch;
        flex-direction: column;
    }

    .crop-modal-actions {
        width: 100%;
    }

    .crop-modal-actions button {
        flex: 1;
    }

    .crop-image-container {
        height: 48vh;
    }
}

</style>
