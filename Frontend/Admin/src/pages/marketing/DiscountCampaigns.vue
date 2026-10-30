
<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
    getDiscountCampaigns,
    updateDiscountCampaignStatus,
    deleteDiscountCampaign
} from '../../api/discountCampaignApi'

const router = useRouter()

const campaigns = ref([])
const loading = ref(false)
const error = ref('')
const search = ref('')
const statusFilter = ref('all')
const updatingId = ref(null)

const statuses = [
    'draft',
    'scheduled',
    'active',
    'paused',
    'expired',
    'cancelled'
]

const filteredCampaigns = computed(() => {
    const query = search.value.trim().toLowerCase()

    return campaigns.value.filter(campaign => {
        const matchesSearch =
            !query ||
            campaign.campaign_name?.toLowerCase().includes(query) ||
            String(campaign.id).includes(query)

        const matchesStatus =
            statusFilter.value === 'all' ||
            campaign.status === statusFilter.value

        return matchesSearch && matchesStatus
    })
})

const stats = computed(() => ({
    total: campaigns.value.length,
    active: campaigns.value.filter(c => c.status === 'active').length,
    scheduled: campaigns.value.filter(c => c.status === 'scheduled').length,
    paused: campaigns.value.filter(c => c.status === 'paused').length
}))

function formatDate(value) {
    if (!value) return '—'

    return new Intl.DateTimeFormat('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    }).format(new Date(value))
}

function formatDiscount(campaign) {
    const value = Number(campaign.discount_value)

    if (campaign.discount_type === 'percentage') {
        return `${value}%`
    }

    return `Rs. ${value.toLocaleString('en-LK', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    })}`
}

function targetLabel(type) {
    const labels = {
        all_products: 'All products',
        selected_products: 'Selected products',
        category: 'Categories',
        brand: 'Brands'
    }

    return labels[type] || type || '—'
}

function campaignTargetNames(campaign) {
    if (campaign.target_type === 'selected_products') {
        return (campaign.campaignItems || [])
            .map(entry => entry.item?.item_name || `Item #${entry.item_id}`)
            .join(', ')
    }

    if (campaign.target_type === 'category') {
        return (campaign.campaignCategories || [])
            .map(entry => entry.category?.category_name || `Category #${entry.category_id}`)
            .join(', ')
    }

    if (campaign.target_type === 'brand') {
        return (campaign.campaignBrands || [])
            .map(entry => entry.brand?.brand_name || `Brand #${entry.brand_id}`)
            .join(', ')
    }

    return 'All products'
}

async function loadCampaigns() {
    loading.value = true
    error.value = ''

    try {
        const response = await getDiscountCampaigns()
        const result = response.data?.data
        campaigns.value = Array.isArray(result) ? result : []
    } catch (err) {
        error.value =
            err.response?.data?.message ||
            'Unable to load discount campaigns.'
    } finally {
        loading.value = false
    }
}

function createCampaign() {
    router.push('/admin/marketing/discount-campaigns/create')
}

function editCampaign(campaign) {
    router.push(
        `/admin/marketing/discount-campaigns/edit/${campaign.id}`
    )
}

async function changeStatus(campaign, event) {
    const status = event.target.value
    if (!status || status === campaign.status) return

    const previousStatus = campaign.status

    if (!window.confirm(
        `Change "${campaign.campaign_name}" from ${previousStatus} to ${status}?`
    )) {
        event.target.value = previousStatus
        return
    }

    updatingId.value = campaign.id
    error.value = ''

    try {
        await updateDiscountCampaignStatus(campaign.id, status)
        campaign.status = status
        await loadCampaigns()
    } catch (err) {
        event.target.value = previousStatus
        error.value =
            err.response?.data?.message ||
            'Unable to update campaign status.'
    } finally {
        updatingId.value = null
    }
}

async function removeCampaign(campaign) {
    const confirmed = window.confirm(
        `Permanently delete "${campaign.campaign_name}"? This cannot be undone.`
    )

    if (!confirmed) return

    updatingId.value = campaign.id
    error.value = ''

    try {
        await deleteDiscountCampaign(campaign.id)
        campaigns.value = campaigns.value.filter(
            item => item.id !== campaign.id
        )
    } catch (err) {
        error.value =
            err.response?.data?.message ||
            'Unable to delete campaign.'
    } finally {
        updatingId.value = null
    }
}

onMounted(loadCampaigns)
</script>

<template>
    <main class="campaign-page">
        <header class="page-header">
            <div>
                <p class="eyebrow">MARKETING</p>
                <h1>Discount Campaigns</h1>
                <p class="subtitle">
                    Create and manage product discounts and promotional pricing.
                </p>
            </div>

            <button class="primary-button" @click="createCampaign">
                <span>＋</span> Create campaign
            </button>
        </header>

        <section class="stats-grid">
            <article class="stat-card">
                <span>Total campaigns</span>
                <strong>{{ stats.total }}</strong>
            </article>

            <article class="stat-card">
                <span>Active</span>
                <strong>{{ stats.active }}</strong>
            </article>

            <article class="stat-card">
                <span>Scheduled</span>
                <strong>{{ stats.scheduled }}</strong>
            </article>

            <article class="stat-card">
                <span>Paused</span>
                <strong>{{ stats.paused }}</strong>
            </article>
        </section>

        <section class="campaign-panel">
            <div class="panel-heading">
                <div>
                    <h2>All campaigns</h2>
                    <p>Review campaign details, targeting and status.</p>
                </div>

                <button
                    class="secondary-button"
                    :disabled="loading"
                    @click="loadCampaigns"
                >
                    ↻ Refresh
                </button>
            </div>

            <div class="filters">
                <input
                    v-model="search"
                    type="search"
                    placeholder="Search by campaign name or ID..."
                    aria-label="Search campaigns"
                />

                <select v-model="statusFilter" aria-label="Filter by status">
                    <option value="all">All statuses</option>
                    <option
                        v-for="status in statuses"
                        :key="status"
                        :value="status"
                    >
                        {{ status.charAt(0).toUpperCase() + status.slice(1) }}
                    </option>
                </select>
            </div>

            <div v-if="error" class="error-message">
                {{ error }}
            </div>

            <div v-if="loading" class="state-message">
                Loading campaigns...
            </div>

            <div
                v-else-if="!filteredCampaigns.length"
                class="state-message"
            >
                <h3>No campaigns found</h3>
                <p>
                    {{
                        campaigns.length
                            ? 'Try changing your search or status filter.'
                            : 'Create your first discount campaign to get started.'
                    }}
                </p>
                <button
                    v-if="!campaigns.length"
                    class="primary-button"
                    @click="createCampaign"
                >
                    Create campaign
                </button>
            </div>

            <div v-else class="table-wrapper">
                <table>
                    <thead>
                        <tr>
                            <th>Campaign</th>
                            <th>Discount</th>
                            <th>Target</th>
                            <th>Duration</th>
                            <th>Status</th>
                            <th class="actions-heading">Actions</th>
                        </tr>
                    </thead>

                    <tbody>
                        <tr
                            v-for="campaign in filteredCampaigns"
                            :key="campaign.id"
                        >
                            <td>
                                <div class="campaign-name">
                                    {{ campaign.campaign_name }}
                                </div>
                                <div class="campaign-id">
                                    ID #{{ campaign.id }}
                                </div>
                            </td>

                            <td>
                                <strong class="discount-value">
                                    {{ formatDiscount(campaign) }}
                                </strong>
                                <div class="muted">
                                    {{
                                        campaign.discount_type === 'percentage'
                                            ? 'Percentage off'
                                            : 'Fixed amount off'
                                    }}
                                </div>
                            </td>

                            <td>
                                <span class="target-type">
                                    {{ targetLabel(campaign.target_type) }}
                                </span>
                                <div
                                    v-if="campaign.target_type !== 'all_products'"
                                    class="muted target-names"
                                    :title="campaignTargetNames(campaign)"
                                >
                                    {{ campaignTargetNames(campaign) || 'No targets' }}
                                </div>
                            </td>

                            <td>
                                <div>{{ formatDate(campaign.start_date) }}</div>
                                <div class="muted">
                                    to {{ formatDate(campaign.end_date) }}
                                </div>
                            </td>

                            <td>
                                <span
                                    class="status-pill"
                                    :class="`status-${campaign.status}`"
                                >
                                    {{ campaign.status }}
                                </span>
                            </td>

                            <td>
                                <div class="actions">
                                    <button
                                        class="text-button"
                                        :disabled="updatingId === campaign.id"
                                        @click="editCampaign(campaign)"
                                    >
                                        Edit
                                    </button>

                                    <select
                                        :value="campaign.status"
                                        :disabled="updatingId === campaign.id"
                                        aria-label="Change campaign status"
                                        @change="changeStatus(campaign, $event)"
                                    >
                                        <option
                                            v-for="status in statuses"
                                            :key="status"
                                            :value="status"
                                        >
                                            {{ status }}
                                        </option>
                                    </select>

                                    <button
                                        class="delete-button"
                                        :disabled="updatingId === campaign.id"
                                        @click="removeCampaign(campaign)"
                                    >
                                        Delete
                                    </button>
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <footer v-if="!loading && filteredCampaigns.length" class="table-footer">
                Showing {{ filteredCampaigns.length }} of
                {{ campaigns.length }} campaigns
            </footer>
        </section>
    </main>
</template>

<style scoped>
.campaign-page {
    width: 100%;
    max-width: 1600px;
    margin: 0 auto;
    font-family: var(--font-family);
    color: var(--color-text-primary);
}

/* =========================
   Page header
   ========================= */

.page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--spacing-lg);
    margin-bottom: var(--spacing-2xl);
}

.eyebrow {
    margin: 0 0 6px;
    color: var(--color-text-muted);
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-bold);
    letter-spacing: 1.4px;
}

.page-header h1 {
    margin: 0;
    font-size: var(--font-size-2xl);
    font-weight: var(--font-weight-bold);
    color: var(--color-text-primary);
}

.subtitle {
    margin: 5px 0 0;
    font-size: var(--font-size-md);
    color: var(--color-text-secondary);
}

/* =========================
   Buttons
   ========================= */

.primary-button,
.secondary-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-sm);
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

.primary-button {
    border: none;
    background: var(--color-primary);
    color: var(--color-text-light);
}

.primary-button:hover:not(:disabled) {
    background: var(--color-primary-hover);
}

.secondary-button {
    border: 1px solid var(--color-border-light);
    background: var(--color-surface);
    color: var(--color-text-secondary);
}

.secondary-button:hover:not(:disabled) {
    background: var(--color-hover-bg);
    color: var(--color-text-primary);
}

button:focus-visible {
    outline: none;
    box-shadow: 0 0 0 3px var(--color-primary-light);
}

button:disabled,
select:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

/* =========================
   Stats
   ========================= */

.stats-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: var(--spacing-lg);
    margin-bottom: var(--spacing-xl);
}

.stat-card,
.campaign-panel {
    background: var(--color-surface);
    border: 1px solid var(--color-border-light);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-sm);
}

.stat-card {
    padding: var(--spacing-xl);
}

.stat-card span {
    display: block;
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
}

.stat-card strong {
    display: block;
    margin-top: var(--spacing-sm);
    font-size: var(--font-size-2xl);
    font-weight: var(--font-weight-bold);
    color: var(--color-text-primary);
}

/* =========================
   Panel
   ========================= */

.campaign-panel {
    overflow: hidden;
}

.panel-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--spacing-lg);
    padding: var(--spacing-xl) var(--spacing-2xl);
    border-bottom: 1px solid var(--color-border-light);
}

.panel-heading h2 {
    margin: 0;
    font-size: var(--font-size-xl);
    font-weight: var(--font-weight-bold);
    color: var(--color-text-primary);
}

.panel-heading p {
    margin: 5px 0 0;
    font-size: var(--font-size-md);
    color: var(--color-text-secondary);
}

/* =========================
   Filters
   ========================= */

.filters {
    display: flex;
    gap: var(--spacing-md);
    padding: var(--spacing-lg) var(--spacing-2xl);
}

.filters input,
.filters select,
.actions select {
    box-sizing: border-box;
    min-width: 0;
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

.filters input,
.filters select {
    height: 40px;
    padding: 0 var(--spacing-lg);
}

.filters input {
    flex: 1;
}

.filters select {
    min-width: 160px;
}

.filters input::placeholder {
    color: var(--color-text-muted);
}

.filters input:focus,
.filters select:focus,
.actions select:focus {
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px var(--color-primary-light);
}

/* =========================
   Table
   ========================= */

.table-wrapper {
    overflow-x: auto;
}

table {
    width: 100%;
    border-collapse: collapse;
    text-align: left;
}

th {
    background: var(--color-submenu-bg);
    color: var(--color-text-secondary);
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-bold);
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

th,
td {
    padding: var(--spacing-lg) var(--spacing-xl);
    border-bottom: 1px solid var(--color-border-light);
    vertical-align: middle;
}

td {
    font-size: var(--font-size-sm);
    color: var(--color-text-primary);
}

tbody tr {
    transition: background var(--transition-fast);
}

tbody tr:hover {
    background: var(--color-hover-bg);
}

.campaign-name {
    font-weight: var(--font-weight-semibold);
    color: var(--color-text-primary);
}

.campaign-id,
.muted {
    margin-top: 5px;
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
}

.discount-value {
    font-size: var(--font-size-md);
    font-weight: var(--font-weight-bold);
    color: var(--color-primary);
}

.target-type {
    font-weight: var(--font-weight-semibold);
}

.target-names {
    max-width: 200px;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
}

/* =========================
   Status pills
   ========================= */

.status-pill {
    display: inline-block;
    padding: 5px 10px;
    border-radius: 999px;
    background: #f1f5f9;
    color: #475569;
    font-size: 11px;
    font-weight: 700;
    text-transform: capitalize;
}

.status-draft {
    background: #f1f5f9;
    color: #475569;
}

.status-active {
    background: #dcfce7;
    color: #166534;
}

.status-scheduled {
    background: #dbeafe;
    color: #1d4ed8;
}

.status-paused {
    background: #fef3c7;
    color: #92400e;
}

.status-expired,
.status-cancelled {
    background: #fee2e2;
    color: #991b1b;
}

/* =========================
   Row actions
   ========================= */

.actions {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
    min-width: 290px;
}

.actions select {
    height: 32px;
    max-width: 110px;
    padding: 0 var(--spacing-sm);
    font-size: var(--font-size-xs);
    text-transform: capitalize;
}

.text-button,
.delete-button {
    padding: 4px 8px;
    border: 0;
    border-radius: var(--radius-lg);
    background: transparent;
    font-family: inherit;
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-bold);
    cursor: pointer;
    transition: background var(--transition-fast),
    color var(--transition-fast);
}

.text-button {
    color: var(--color-primary);
}

.text-button:hover:not(:disabled) {
    background: var(--color-primary-light);
}

.delete-button {
    color: var(--color-danger);
}

.delete-button:hover:not(:disabled) {
    background: var(--color-danger-bg);
}

/* =========================
   Messages + footer
   ========================= */

.error-message {
    margin: 0 var(--spacing-2xl) var(--spacing-lg);
    padding: var(--spacing-md) var(--spacing-lg);
    border: 1px solid var(--color-danger-light);
    border-radius: var(--radius-lg);
    background: var(--color-danger-bg);
    color: var(--color-danger);
    font-size: var(--font-size-md);
}

.state-message {
    padding: 48px var(--spacing-2xl);
    text-align: center;
    color: var(--color-text-muted);
}

.state-message h3 {
    margin: 0 0 var(--spacing-sm);
    color: var(--color-text-primary);
}

.state-message p {
    margin-bottom: var(--spacing-xl);
    font-size: var(--font-size-md);
}

.table-footer {
    padding: var(--spacing-md) var(--spacing-2xl);
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
}

/* =========================
   Responsive
   ========================= */

@media (max-width: 900px) {
    .stats-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .page-header {
        align-items: flex-start;
    }
}

@media (max-width: 768px) {
    .panel-heading {
        padding: var(--spacing-xl);
    }

    .filters {
        padding: var(--spacing-lg) var(--spacing-xl);
    }

    .error-message {
        margin: 0 var(--spacing-xl) var(--spacing-lg);
    }

    .table-footer {
        padding: var(--spacing-md) var(--spacing-xl);
    }
}

@media (max-width: 560px) {
    .page-header {
        flex-direction: column;
    }

    .page-header .primary-button {
        width: 100%;
    }

    .filters {
        flex-direction: column;
    }

    .filters select {
        width: 100%;
    }
}
</style>
