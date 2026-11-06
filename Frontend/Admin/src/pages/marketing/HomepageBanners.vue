
<script setup>
import { getMediaUrl } from '@/utils/mediaUrl'
import { computed, onMounted, ref, watch } from 'vue'
import AppPagination from '@/components/common/AppPagination.vue'
import { useRouter } from 'vue-router'
import {
    ImagePlus,
    RefreshCw,
    Search,
    Pencil,
    Trash2,
    Eye,
    EyeOff,
    Image as ImageIcon,
    CalendarClock,
    AlertCircle,
} from 'lucide-vue-next'

import {
    getHomepageBanners,
    updateHomepageBannerStatus,
    deleteHomepageBanner,
} from '@/api/homepageBannerApi'

import { hasPermission } from '@/auth/authorization'
import { createRequestSequence } from '@/composables/useServerPagination.js'
const paginationRequestSequence = createRequestSequence()

const router = useRouter()

const banners = ref([])
const loading = ref(false)
const error = ref('')
const success = ref('')
const search = ref('')
const statusFilter = ref('all')
const actionId = ref(null)
const deletingId = ref(null)
const page = ref(1)
const pageSize = ref(25)
const pagination = ref({ total: 0, totalPages: 1 })
const summary = ref({ total: 0, active: 0, inactive: 0 })

const canCreate = computed(() =>
    hasPermission('homepage_banners.create')
)

const canUpdate = computed(() =>
    hasPermission('homepage_banners.update')
)

const canDelete = computed(() =>
    hasPermission('homepage_banners.delete')
)

function getBannerImageUrl(path) {
    return getMediaUrl(path)
}

const filteredBanners = computed(() => banners.value)

const activeCount = computed(() =>
    summary.value.active
)

const loadBanners = async () => {
    const requestId = paginationRequestSequence.begin()
    loading.value = true
    error.value = ''

    try {
        const response = await getHomepageBanners({
            page: page.value,
            pageSize: pageSize.value,
            search: search.value.trim(),
            status: statusFilter.value === 'all' ? undefined : statusFilter.value
        })
        if (!paginationRequestSequence.isCurrent(requestId)) return
        banners.value = response.data?.data || []
        pagination.value = response.data?.pagination || { total: banners.value.length, totalPages: 1 }
        summary.value = response.data?.summary || { total: pagination.value.total, active: 0, inactive: pagination.value.total }
    } catch (err) {
        if (!paginationRequestSequence.isCurrent(requestId)) return
        error.value =
            err.response?.data?.message ||
            'Unable to load homepage banners.'
    } finally {
        if (!paginationRequestSequence.isCurrent(requestId)) return
        loading.value = false
    }
}

watch([search, statusFilter], () => {
    page.value = 1
    loadBanners()
})

function changePage(nextPage) {
    page.value = nextPage
    loadBanners()
}

function changePageSize(nextSize) {
    pageSize.value = nextSize
    page.value = 1
    loadBanners()
}

const createBanner = () => {
    router.push('/admin/marketing/homepage-banners/create')
}

const editBanner = (id) => {
    router.push(`/admin/marketing/homepage-banners/edit/${id}`)
}

const toggleStatus = async (banner) => {
    const nextStatus = !banner.is_active
    const label = nextStatus ? 'activate' : 'deactivate'

    if (!window.confirm(`Are you sure you want to ${label} this banner?`)) {
        return
    }

    actionId.value = banner.id
    error.value = ''
    success.value = ''

    try {
        const response = await updateHomepageBannerStatus(
            banner.id,
            nextStatus
        )

        const updated = response.data?.data

        banners.value = banners.value.map((item) =>
            String(item.id) === String(banner.id)
                ? { ...item, ...(updated || {}), is_active: nextStatus }
                : item
        )

        success.value = `Banner ${nextStatus ? 'activated' : 'deactivated'} successfully.`
    } catch (err) {
        error.value =
            err.response?.data?.message ||
            `Unable to ${label} the banner.`
    } finally {
        actionId.value = null
    }
}

const removeBanner = async (banner) => {
    if (!window.confirm(
        `Delete "${banner.title || `Banner #${banner.id}`}"? This action cannot be undone.`
    )) {
        return
    }

    deletingId.value = banner.id
    error.value = ''
    success.value = ''

    try {
        await deleteHomepageBanner(banner.id)

        banners.value = banners.value.filter(
            (item) => String(item.id) !== String(banner.id)
        )

        success.value = 'Banner deleted successfully.'
    } catch (err) {
        error.value =
            err.response?.data?.message ||
            'Unable to delete the banner.'
    } finally {
        deletingId.value = null
    }
}

const formatDate = (value) => {
    if (!value) return 'Not scheduled'

    const date = new Date(value)

    if (Number.isNaN(date.getTime())) return 'Invalid date'

    return new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(date)
}

onMounted(loadBanners)
</script>

<template>
    <section class="banner-page">
        <header class="page-heading">
            <div>
                <div class="eyebrow">MARKETING / STOREFRONT</div>
                <h1>Homepage Banners</h1>
                <p>Manage the promotional banners displayed on your storefront.</p>
            </div>

            <div class="heading-actions">
                <button
                    class="button button-secondary"
                    type="button"
                    :disabled="loading"
                    @click="loadBanners"
                >
                    <RefreshCw :size="16" :class="{ spinning: loading }" />
                    Refresh
                </button>

                <button
                    v-if="canCreate"
                    class="button button-primary"
                    type="button"
                    :disabled="banners.length >= 10"
                    @click="createBanner"
                >
                    <ImagePlus :size="17" />
                    Add banner
                </button>
            </div>
        </header>

        <div v-if="error" class="notice notice-error" role="alert">
            <AlertCircle :size="18" />
            <span>{{ error }}</span>
            <button type="button" aria-label="Dismiss error" @click="error = ''">
                ×
            </button>
        </div>

        <div v-if="success" class="notice notice-success" role="status">
            <span>{{ success }}</span>
            <button type="button" aria-label="Dismiss message" @click="success = ''">
                ×
            </button>
        </div>

        <div class="stats-grid">
            <article class="stat-card">
                <div class="stat-icon">
                    <ImageIcon :size="20" />
                </div>
                <div>
                    <span>Total banners</span>
                    <strong>{{ summary.total }} <small>/ 10</small></strong>
                </div>
            </article>

            <article class="stat-card">
                <div class="stat-icon stat-icon-active">
                    <Eye :size="20" />
                </div>
                <div>
                    <span>Active banners</span>
                    <strong>{{ activeCount }}</strong>
                </div>
            </article>

            <article class="stat-card">
                <div class="stat-icon stat-icon-inactive">
                    <EyeOff :size="20" />
                </div>
                <div>
                    <span>Inactive banners</span>
                    <strong>{{ summary.inactive }}</strong>
                </div>
            </article>
        </div>

        <div class="toolbar">
            <label class="search-box">
                <Search :size="18" />
                <input
                    v-model="search"
                    type="search"
                    placeholder="Search banners..."
                />
            </label>

            <select v-model="statusFilter" aria-label="Filter by status">
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
            </select>

            <span class="result-count">
                {{ filteredBanners.length }} result{{ filteredBanners.length === 1 ? '' : 's' }}
            </span>
        </div>

        <div v-if="loading && !banners.length" class="state-card">
            <RefreshCw :size="25" class="spinning" />
            <strong>Loading banners...</strong>
            <span>Fetching your homepage banner collection.</span>
        </div>

        <div v-else-if="!filteredBanners.length" class="state-card">
            <div class="empty-icon">
                <ImageIcon :size="30" />
            </div>
            <strong>
                {{ search || statusFilter !== 'all' ? 'No matching banners' : 'No homepage banners yet' }}
            </strong>
            <span>
                {{ search || statusFilter !== 'all'
                    ? 'Try changing your search or filter.'
                    : 'Create a banner to promote products, offers, and campaigns.' }}
            </span>
            <button
                v-if="!search && statusFilter === 'all' && canCreate"
                class="button button-primary"
                type="button"
                @click="createBanner"
            >
                <ImagePlus :size="17" />
                Create your first banner
            </button>
        </div>

        <div v-else class="banner-list">
            <article
                v-for="banner in filteredBanners"
                :key="banner.id"
                class="banner-card"
            >
                <div class="banner-preview">
<img
    v-if="banner.image_url"
    :src="getBannerImageUrl(banner.image_url)"
    :alt="banner.title || 'Homepage banner'"
    loading="lazy"
/>
                    <div v-else class="image-placeholder">
                        <ImageIcon :size="30" />
                        <span>No image</span>
                    </div>

                    <span class="banner-order">#{{ banner.sort_order }}</span>
                </div>

                <div class="banner-details">
                    <div class="banner-title-row">
                        <div class="banner-title">
                            <h2>{{ banner.title || 'Untitled banner' }}</h2>
                            <p>{{ banner.subtitle || 'No subtitle provided' }}</p>
                        </div>

                        <span
                            class="status-pill"
                            :class="banner.is_active ? 'status-active' : 'status-inactive'"
                        >
                            <span class="status-dot"></span>
                            {{ banner.is_active ? 'Active' : 'Inactive' }}
                        </span>
                    </div>

                    <div class="banner-meta">
                        <span>
                            <CalendarClock :size="15" />
                            Starts: {{ formatDate(banner.start_at) }}
                        </span>
                        <span>
                            Ends: {{ formatDate(banner.end_at) }}
                        </span>
                    </div>

                    <div class="banner-link">
                        <span v-if="banner.button_text" class="button-preview">
                            {{ banner.button_text }}
                        </span>
                        <span class="link-text">
                            {{ banner.link_url || 'No destination link' }}
                        </span>
                    </div>

                    <div class="banner-actions">
                        <button
                            v-if="canUpdate"
                            class="button button-secondary button-small"
                            type="button"
                            @click="editBanner(banner.id)"
                        >
                            <Pencil :size="15" />
                            Edit
                        </button>

                        <button
                            v-if="canUpdate"
                            class="button button-secondary button-small"
                            type="button"
                            :disabled="actionId === banner.id"
                            @click="toggleStatus(banner)"
                        >
                            <RefreshCw
                                v-if="actionId === banner.id"
                                :size="15"
                                class="spinning"
                            />
                            <component
                                :is="banner.is_active ? EyeOff : Eye"
                                v-else
                                :size="15"
                            />
                            {{ banner.is_active ? 'Deactivate' : 'Activate' }}
                        </button>

                        <button
                            v-if="canDelete"
                            class="button button-danger button-small"
                            type="button"
                            :disabled="deletingId === banner.id"
                            @click="removeBanner(banner)"
                        >
                            <Trash2 :size="15" />
                            {{ deletingId === banner.id ? 'Deleting...' : 'Delete' }}
                        </button>
                    </div>
                </div>
            </article>
        </div>

        <AppPagination
            :page="page"
            :page-size="pageSize"
            :total="pagination.total"
        :total-pages="pagination.totalPages"
            :loading="loading"
            @update:page="changePage"
            @update:page-size="changePageSize"
        />

        <footer class="page-footer">
            <span>Homepage banner management</span>
            <span>{{ summary.total }} of 10 banners used</span>
        </footer>
    </section>
</template>

<style scoped>
.banner-page {
    --banner-border: var(--color-border, #e5e7eb);
    --banner-muted: var(--color-text-muted, #6b7280);
    color: var(--color-text, #172033);
    width: 100%;
    max-width: 1500px;
    margin: 0 auto;
}

.page-heading {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 24px;
    margin-bottom: 26px;
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
    letter-spacing: -0.8px;
    font-weight: 750;
}

.page-heading p {
    margin: 8px 0 0;
    color: var(--banner-muted);
    font-size: 14px;
}

.heading-actions,
.banner-actions {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 9px;
}

.button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 39px;
    padding: 0 14px;
    border: 1px solid transparent;
    border-radius: 9px;
    font: inherit;
    font-size: 13px;
    font-weight: 650;
    cursor: pointer;
    transition: background .15s ease, border-color .15s ease;
}

.button:disabled {
    opacity: .55;
    cursor: not-allowed;
}

.button-primary {
    color: #fff;
    background: var(--color-primary, #2563eb);
}

.button-primary:hover:not(:disabled) {
    filter: brightness(.94);
}

.button-secondary {
    color: var(--color-text, #273449);
    background: var(--color-surface, #fff);
    border-color: var(--banner-border);
}

.button-secondary:hover:not(:disabled) {
    background: var(--color-background, #f8fafc);
}

.button-danger {
    color: #b42318;
    background: #fff;
    border-color: #f1c6c2;
}

.button-danger:hover:not(:disabled) {
    background: #fff3f2;
}

.button-small {
    min-height: 33px;
    padding: 0 10px;
    font-size: 12px;
}

.notice {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 14px;
    margin-bottom: 18px;
    border: 1px solid;
    border-radius: 10px;
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

.notice-error {
    color: #b42318;
    background: #fff4f2;
    border-color: #f4c7c3;
}

.notice-success {
    color: #167647;
    background: #effaf3;
    border-color: #b7e4c7;
}

.stats-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 15px;
    margin-bottom: 24px;
}

.stat-card {
    display: flex;
    align-items: center;
    gap: 14px;
    min-height: 96px;
    padding: 19px;
    background: var(--color-surface, #fff);
    border: 1px solid var(--banner-border);
    border-radius: 13px;
}

.stat-icon {
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    flex-shrink: 0;
    border-radius: 11px;
    color: #3b5ccc;
    background: #eef2ff;
}

.stat-icon-active {
    color: #16804a;
    background: #e9f9ef;
}

.stat-icon-inactive {
    color: #737b8b;
    background: #f1f3f6;
}

.stat-card span {
    display: block;
    color: var(--banner-muted);
    font-size: 12px;
}

.stat-card strong {
    display: block;
    margin-top: 5px;
    font-size: 25px;
    line-height: 1.1;
}

.stat-card small {
    color: var(--banner-muted);
    font-size: 13px;
    font-weight: 500;
}

.toolbar {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
}

.search-box {
    display: flex;
    align-items: center;
    gap: 9px;
    width: min(100%, 360px);
    height: 41px;
    padding: 0 12px;
    color: var(--banner-muted);
    background: var(--color-surface, #fff);
    border: 1px solid var(--banner-border);
    border-radius: 9px;
}

.search-box input {
    width: 100%;
    min-width: 0;
    border: 0;
    outline: 0;
    background: transparent;
    color: inherit;
    font: inherit;
    font-size: 13px;
}

.toolbar select {
    height: 41px;
    padding: 0 32px 0 12px;
    border: 1px solid var(--banner-border);
    border-radius: 9px;
    color: inherit;
    background: var(--color-surface, #fff);
    font: inherit;
    font-size: 13px;
}

.result-count {
    margin-left: auto;
    color: var(--banner-muted);
    font-size: 12px;
}

.banner-list {
    display: grid;
    gap: 14px;
}

.banner-card {
    display: grid;
    grid-template-columns: minmax(230px, 31%) minmax(0, 1fr);
    overflow: hidden;
    background: var(--color-surface, #fff);
    border: 1px solid var(--banner-border);
    border-radius: 13px;
}

.banner-preview {
    position: relative;
    min-height: 190px;
    overflow: hidden;
    background: var(--color-background, #f3f5f9);
}

.banner-preview img {
    display: block;
    width: 100%;
    height: 100%;
    min-height: 190px;
    max-height: 250px;
    object-fit: cover;
}

.image-placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 190px;
    color: var(--banner-muted);
    font-size: 12px;
}

.banner-order {
    position: absolute;
    top: 11px;
    left: 11px;
    padding: 5px 9px;
    color: #fff;
    background: rgb(17 24 39 / 75%);
    border-radius: 7px;
    font-size: 11px;
    font-weight: 700;
}

.banner-details {
    display: flex;
    flex-direction: column;
    justify-content: center;
    min-width: 0;
    padding: 19px 21px;
}

.banner-title-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
}

.banner-title {
    min-width: 0;
}

.banner-title h2 {
    overflow-wrap: anywhere;
    margin: 0;
    font-size: 17px;
    font-weight: 700;
}

.banner-title p {
    margin: 6px 0 0;
    color: var(--banner-muted);
    font-size: 13px;
    line-height: 1.5;
}

.status-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
    padding: 6px 9px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 700;
}

.status-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: currentColor;
}

.status-active {
    color: #167647;
    background: #e9f9ef;
}

.status-inactive {
    color: #626c7c;
    background: #eef0f4;
}

.banner-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 9px 20px;
    margin-top: 17px;
    color: var(--banner-muted);
    font-size: 11px;
}

.banner-meta span {
    display: inline-flex;
    align-items: center;
    gap: 6px;
}

.banner-link {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
    margin-top: 15px;
    min-width: 0;
}

.button-preview {
    padding: 5px 9px;
    border: 1px solid var(--banner-border);
    border-radius: 6px;
    font-size: 11px;
    font-weight: 650;
}

.link-text {
    overflow: hidden;
    color: var(--banner-muted);
    font-size: 12px;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.banner-actions {
    padding-top: 15px;
    margin-top: 15px;
    border-top: 1px solid var(--banner-border);
}

.state-card {
    display: flex;
    align-items: center;
    flex-direction: column;
    gap: 11px;
    padding: 58px 20px;
    text-align: center;
    color: var(--banner-muted);
    background: var(--color-surface, #fff);
    border: 1px dashed var(--banner-border);
    border-radius: 13px;
}

.state-card strong {
    color: var(--color-text, #172033);
    font-size: 16px;
}

.state-card > span {
    font-size: 13px;
}

.empty-icon {
    display: grid;
    place-items: center;
    width: 58px;
    height: 58px;
    margin-bottom: 3px;
    border-radius: 16px;
    background: var(--color-background, #f3f5f9);
}

.page-footer {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    margin-top: 20px;
    color: var(--banner-muted);
    font-size: 11px;
}

.spinning {
    animation: spin .8s linear infinite;
}

@keyframes spin {
    to { transform: rotate(360deg); }
}

@media (max-width: 760px) {
    .page-heading {
        flex-direction: column;
    }

    .heading-actions {
        width: 100%;
    }

    .stats-grid {
        grid-template-columns: 1fr;
        gap: 10px;
    }

    .stat-card {
        min-height: 75px;
    }

    .toolbar {
        flex-wrap: wrap;
    }

    .search-box {
        width: 100%;
    }

    .toolbar select {
        flex: 1;
    }

    .result-count {
        margin-left: 0;
    }

    .banner-card {
        grid-template-columns: 1fr;
    }

    .banner-preview,
    .banner-preview img {
        min-height: 0;
        height: auto;
        aspect-ratio: 16 / 7;
    }

    .banner-details {
        padding: 16px;
    }

    .banner-title-row {
        flex-direction: column;
    }

    .page-footer {
        flex-direction: column;
    }
}

@media (prefers-reduced-motion: reduce) {
    .spinning {
        animation: none;
    }

    .button {
        transition: none;
    }
}
</style>
