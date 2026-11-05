<script setup>
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
import {
    getCampaignFrames,
    createCampaignFrame,
    updateCampaignFrame,
    updateCampaignFrameStatus,
    deleteCampaignFrame,
} from '@/api/campaignFrameApi'

const frames = ref([])
const loading = ref(false)
const saving = ref(false)
const error = ref('')
const success = ref('')

const name = ref('')
const file = ref(null)
const preview = ref('')
const fileInput = ref(null)

const editingId = ref(null)
const editingName = ref('')
const replacementFile = ref(null)
const replacementPreview = ref('')

const activeFrames = computed(() =>
    frames.value.filter(frame => frame.is_active)
)

const inactiveFrames = computed(() =>
    frames.value.filter(frame => !frame.is_active)
)

function responseArray(response) {
    const result = response?.data?.data
    return Array.isArray(result) ? result : []
}

import { getMediaUrl } from '@/utils/mediaUrl'

function imageUrl(frame) {
    const value = frame.image_url || frame.image_path || ''

    if (!value) return ''
    if (/^https?:\/\//i.test(value)) return value

    return getMediaUrl(value)
}

function revokePreview(value) {
    if (value && value.startsWith('blob:')) {
        URL.revokeObjectURL(value)
    }
}

function clearMessages() {
    error.value = ''
    success.value = ''
}

async function loadFrames() {
    loading.value = true
    error.value = ''

    try {
        const response = await getCampaignFrames()
        frames.value = responseArray(response)
    } catch (err) {
        error.value =
            err.response?.data?.message ||
            'Unable to load campaign frames.'
    } finally {
        loading.value = false
    }
}

function selectFile(event) {
    clearMessages()

    const selected = event.target.files?.[0] || null
    file.value = null
    revokePreview(preview.value)
    preview.value = ''

    if (!selected) return

    if (!['image/png', 'image/webp'].includes(selected.type)) {
        error.value = 'Only PNG and WebP images are supported.'
        event.target.value = ''
        return
    }

    if (selected.size > 2 * 1024 * 1024) {
        error.value = 'The image must not exceed 2 MB.'
        event.target.value = ''
        return
    }

    file.value = selected
    preview.value = URL.createObjectURL(selected)
}

function selectReplacement(event) {
    clearMessages()

    const selected = event.target.files?.[0] || null
    replacementFile.value = null
    revokePreview(replacementPreview.value)
    replacementPreview.value = ''

    if (!selected) return

    if (!['image/png', 'image/webp'].includes(selected.type)) {
        error.value = 'Only PNG and WebP images are supported.'
        event.target.value = ''
        return
    }

    if (selected.size > 2 * 1024 * 1024) {
        error.value = 'The image must not exceed 2 MB.'
        event.target.value = ''
        return
    }

    replacementFile.value = selected
    replacementPreview.value = URL.createObjectURL(selected)
}

async function uploadFrame() {
    clearMessages()

    if (!name.value.trim()) {
        error.value = 'Enter a name for this frame.'
        return
    }

    if (!file.value) {
        error.value = 'Choose a PNG or WebP frame image.'
        return
    }

    saving.value = true

    try {
        await createCampaignFrame(name.value.trim(), file.value)

        name.value = ''
        file.value = null
        revokePreview(preview.value)
        preview.value = ''

        if (fileInput.value) fileInput.value.value = ''

        success.value = 'Campaign frame uploaded successfully.'
        await loadFrames()
    } catch (err) {
        error.value =
            err.response?.data?.message ||
            'Unable to upload campaign frame.'
    } finally {
        saving.value = false
    }
}

function startEditing(frame) {
    clearMessages()
    editingId.value = frame.id
    editingName.value = frame.name
    replacementFile.value = null
    revokePreview(replacementPreview.value)
    replacementPreview.value = ''
}

function cancelEditing() {
    editingId.value = null
    editingName.value = ''
    replacementFile.value = null
    revokePreview(replacementPreview.value)
    replacementPreview.value = ''
}

async function saveFrame(frame) {
    clearMessages()

    if (!editingName.value.trim()) {
        error.value = 'Frame name cannot be empty.'
        return
    }

    saving.value = true

    try {
        await updateCampaignFrame(frame.id, {
            name: editingName.value.trim(),
            file: replacementFile.value,
        })

        cancelEditing()
        success.value = 'Campaign frame updated successfully.'
        await loadFrames()
    } catch (err) {
        error.value =
            err.response?.data?.message ||
            'Unable to update campaign frame.'
    } finally {
        saving.value = false
    }
}

async function toggleStatus(frame) {
    clearMessages()
    saving.value = true

    try {
        await updateCampaignFrameStatus(frame.id, !frame.is_active)
        success.value = frame.is_active
            ? 'Campaign frame deactivated.'
            : 'Campaign frame activated.'
        await loadFrames()
    } catch (err) {
        error.value =
            err.response?.data?.message ||
            'Unable to update frame status.'
    } finally {
        saving.value = false
    }
}

async function removeFrame(frame) {
    clearMessages()

    if (Number(frame.usage_count) > 0) {
        error.value =
            'This frame is assigned to campaigns. Remove it from those campaigns before deleting it.'
        return
    }

    if (!window.confirm(`Delete "${frame.name}" permanently?`)) return

    saving.value = true

    try {
        await deleteCampaignFrame(frame.id)
        success.value = 'Campaign frame deleted.'
        await loadFrames()
    } catch (err) {
        error.value =
            err.response?.data?.message ||
            'Unable to delete campaign frame.'
    } finally {
        saving.value = false
    }
}

onMounted(loadFrames)

onBeforeUnmount(() => {
    revokePreview(preview.value)
    revokePreview(replacementPreview.value)
})
</script>

<template>
    <main class="frames-page">
        <header class="page-header">
            <div>
                <p class="eyebrow">MARKETING</p>
                <h1>Campaign Frames</h1>
                <p class="subtitle">
                    Upload and manage reusable transparent frames for product cards.
                </p>
            </div>

            <button class="secondary-button" type="button" @click="loadFrames">
                Refresh
            </button>
        </header>

        <div v-if="error" class="notice error-notice" role="alert">
            {{ error }}
        </div>

        <div v-if="success" class="notice success-notice" role="status">
            {{ success }}
        </div>

        <section class="panel upload-panel">
            <div class="panel-heading">
                <h2>Upload a new frame</h2>
                <p>
                    Upload a transparent PNG or WebP image. The same frame can
                    be reused across multiple campaigns.
                </p>
            </div>

            <form class="upload-form" @submit.prevent="uploadFrame">
                <div class="field">
                    <label for="frame-name">Frame name</label>
                    <input
                        id="frame-name"
                        v-model="name"
                        type="text"
                        maxlength="120"
                        placeholder="e.g. Gold Corner Frame"
                    />
                </div>

                <div class="field">
                    <label for="frame-file">Frame image</label>
                    <input
                        id="frame-file"
                        ref="fileInput"
                        type="file"
                        accept="image/png,image/webp"
                        @change="selectFile"
                    />
                    <small>PNG or WebP, maximum 2 MB. Transparent background recommended.</small>
                </div>

                <div v-if="preview" class="upload-preview">
                    <span>Preview</span>
                    <div class="preview-image">
                        <img :src="preview" alt="New campaign frame preview" />
                    </div>
                </div>

                <div class="upload-actions">
                    <button class="primary-button" type="submit" :disabled="saving">
                        {{ saving ? 'Uploading...' : 'Upload frame' }}
                    </button>
                </div>
            </form>
        </section>

        <section class="frames-section">
            <div class="section-heading">
                <div>
                    <h2>Active frames</h2>
                    <p>{{ activeFrames.length }} active frames available for campaigns</p>
                </div>
            </div>

            <div v-if="loading" class="panel state-message">
                Loading campaign frames...
            </div>

            <div v-else-if="!activeFrames.length" class="panel empty-state">
                No active frames yet. Upload your first frame above.
            </div>

            <div v-else class="frames-grid">
                <article v-for="frame in activeFrames" :key="frame.id" class="frame-card">
                    <div class="frame-preview">
                        <img :src="imageUrl(frame)" :alt="frame.name" />
                    </div>

                    <div class="frame-content">
                        <template v-if="editingId === frame.id">
                            <label :for="`edit-name-${frame.id}`">Frame name</label>
                            <input
                                :id="`edit-name-${frame.id}`"
                                v-model="editingName"
                                maxlength="120"
                            />

                            <label class="replace-label" :for="`replace-${frame.id}`">
                                Replace image (optional)
                            </label>
                            <input
                                :id="`replace-${frame.id}`"
                                type="file"
                                accept="image/png,image/webp"
                                @change="selectReplacement"
                            />

                            <div v-if="replacementPreview" class="replacement-preview">
                                <img :src="replacementPreview" alt="Replacement preview" />
                            </div>

                            <div class="card-actions">
                                <button class="primary-button" :disabled="saving" @click="saveFrame(frame)">
                                    Save
                                </button>
                                <button class="secondary-button" :disabled="saving" @click="cancelEditing">
                                    Cancel
                                </button>
                            </div>
                        </template>

                        <template v-else>
                            <div class="frame-title-row">
                                <h3>{{ frame.name }}</h3>
                                <span class="status-pill active">Active</span>
                            </div>

                            <p class="usage">
                                Used by {{ Number(frame.usage_count || 0) }} campaigns
                            </p>

                            <div class="card-actions">
                                <button class="secondary-button" :disabled="saving" @click="startEditing(frame)">
                                    Edit
                                </button>
                                <button class="secondary-button" :disabled="saving" @click="toggleStatus(frame)">
                                    Deactivate
                                </button>
                                <button
                                    class="danger-button"
                                    :disabled="saving || Number(frame.usage_count) > 0"
                                    :title="Number(frame.usage_count) > 0 ? 'Remove this frame from campaigns before deleting' : 'Delete frame'"
                                    @click="removeFrame(frame)"
                                >
                                    Delete
                                </button>
                            </div>
                        </template>
                    </div>
                </article>
            </div>
        </section>

        <section v-if="inactiveFrames.length" class="frames-section">
            <div class="section-heading">
                <div>
                    <h2>Inactive frames</h2>
                    <p>These frames are not available for new campaign assignments.</p>
                </div>
            </div>

            <div class="frames-grid">
                <article v-for="frame in inactiveFrames" :key="frame.id" class="frame-card inactive-card">
                    <div class="frame-preview">
                        <img :src="imageUrl(frame)" :alt="frame.name" />
                    </div>

                    <div class="frame-content">
                        <div class="frame-title-row">
                            <h3>{{ frame.name }}</h3>
                            <span class="status-pill inactive">Inactive</span>
                        </div>

                        <p class="usage">
                            Used by {{ Number(frame.usage_count || 0) }} campaigns
                        </p>

                        <div class="card-actions">
                            <button class="secondary-button" :disabled="saving" @click="toggleStatus(frame)">
                                Activate
                            </button>
                            <button
                                class="danger-button"
                                :disabled="saving || Number(frame.usage_count) > 0"
                                @click="removeFrame(frame)"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </article>
            </div>
        </section>
    </main>
</template>

<style scoped>
.frames-page {
    width: 100%;
    max-width: 1200px;
    margin: 0 auto;
    padding: 24px;
    color: var(--color-text, #20242b);
}

.page-header,
.section-heading,
.frame-title-row,
.upload-actions,
.card-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
}

.page-header {
    margin-bottom: 24px;
}

.eyebrow {
    margin: 0 0 6px;
    color: var(--color-primary, #2563eb);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: .1em;
}

h1, h2, h3, p {
    margin-top: 0;
}

h1 {
    margin-bottom: 6px;
    font-size: 28px;
}

.subtitle,
.panel-heading p,
.section-heading p,
.usage {
    color: var(--color-text-muted, #6b7280);
}

.panel,
.frame-card {
    border: 1px solid var(--color-border, #e5e7eb);
    border-radius: 12px;
    background: var(--color-surface, #fff);
}

.panel {
    margin-bottom: 28px;
    padding: 22px;
}

.panel-heading {
    margin-bottom: 20px;
}

.panel-heading h2,
.section-heading h2 {
    margin-bottom: 5px;
    font-size: 18px;
}

.panel-heading p,
.section-heading p {
    margin-bottom: 0;
    font-size: 13px;
}

.upload-form {
    display: grid;
    grid-template-columns: minmax(220px, 1fr) minmax(260px, 1.5fr);
    gap: 18px;
}

.field {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.field label,
.frame-content label {
    font-size: 13px;
    font-weight: 600;
}

input[type="text"],
.field input:not([type="file"]),
.frame-content input:not([type="file"]) {
    width: 100%;
    min-height: 42px;
    padding: 9px 12px;
    border: 1px solid var(--color-border, #d1d5db);
    border-radius: 7px;
    background: var(--color-surface, #fff);
    color: inherit;
}

input[type="file"] {
    max-width: 100%;
    font-size: 13px;
}

small {
    color: var(--color-text-muted, #6b7280);
    font-size: 12px;
}

.upload-preview {
    grid-column: 1 / -1;
    display: flex;
    align-items: center;
    gap: 16px;
    font-size: 13px;
    font-weight: 600;
}

.preview-image,
.replacement-preview {
    display: grid;
    place-items: center;
    width: 120px;
    height: 120px;
    overflow: hidden;
    border: 1px solid var(--color-border, #e5e7eb);
    border-radius: 8px;
    background-color: #f3f4f6;
    background-image:
        linear-gradient(45deg, #e5e7eb 25%, transparent 25%),
        linear-gradient(-45deg, #e5e7eb 25%, transparent 25%),
        linear-gradient(45deg, transparent 75%, #e5e7eb 75%),
        linear-gradient(-45deg, transparent 75%, #e5e7eb 75%);
    background-size: 16px 16px;
    background-position: 0 0, 0 8px, 8px -8px, -8px 0;
}

.preview-image img,
.replacement-preview img {
    width: 100%;
    height: 100%;
    object-fit: contain;
}

.upload-actions {
    grid-column: 1 / -1;
    justify-content: flex-start;
}

.frames-section {
    margin-top: 30px;
}

.section-heading {
    margin-bottom: 14px;
}

.frames-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 16px;
}

.frame-card {
    overflow: hidden;
}

.frame-preview {
    display: grid;
    place-items: center;
    aspect-ratio: 1 / 1;
    padding: 16px;
    background-color: #f3f4f6;
    background-image:
        linear-gradient(45deg, #e5e7eb 25%, transparent 25%),
        linear-gradient(-45deg, #e5e7eb 25%, transparent 25%),
        linear-gradient(45deg, transparent 75%, #e5e7eb 75%),
        linear-gradient(-45deg, transparent 75%, #e5e7eb 75%);
    background-size: 20px 20px;
    background-position: 0 0, 0 10px, 10px -10px, -10px 0;
}

.frame-preview img {
    width: 100%;
    height: 100%;
    object-fit: contain;
}

.frame-content {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
}

.frame-title-row h3 {
    margin: 0;
    overflow-wrap: anywhere;
    font-size: 15px;
}

.status-pill {
    flex: 0 0 auto;
    padding: 4px 9px;
    border-radius: 20px;
    font-size: 11px;
    font-weight: 700;
}

.status-pill.active {
    background: #dcfce7;
    color: #166534;
}

.status-pill.inactive {
    background: #f3f4f6;
    color: #4b5563;
}

.usage {
    margin: 0;
    font-size: 12px;
}

.card-actions {
    flex-wrap: wrap;
    justify-content: flex-start;
    margin-top: 4px;
}

button {
    min-height: 36px;
    padding: 8px 12px;
    border: 1px solid transparent;
    border-radius: 7px;
    cursor: pointer;
    font-size: 12px;
    font-weight: 600;
}

button:disabled {
    cursor: not-allowed;
    opacity: .5;
}

.primary-button {
    background: var(--color-primary, #2563eb);
    color: white;
}

.secondary-button {
    border-color: var(--color-border, #d1d5db);
    background: var(--color-surface, #fff);
    color: inherit;
}

.danger-button {
    border-color: #fecaca;
    background: #fff;
    color: #b91c1c;
}

.notice {
    margin-bottom: 16px;
    padding: 12px 14px;
    border-radius: 8px;
    font-size: 13px;
}

.error-notice {
    background: #fef2f2;
    color: #b91c1c;
}

.success-notice {
    background: #f0fdf4;
    color: #166534;
}

.state-message,
.empty-state {
    padding: 30px;
    color: var(--color-text-muted, #6b7280);
    text-align: center;
}

.inactive-card {
    opacity: .78;
}

@media (max-width: 650px) {
    .frames-page {
        padding: 16px;
    }

    .page-header {
        align-items: flex-start;
    }

    .upload-form {
        grid-template-columns: 1fr;
    }

    .upload-preview,
    .upload-actions {
        grid-column: 1;
    }
}
</style>
