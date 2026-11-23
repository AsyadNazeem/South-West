<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { AlertCircle, CheckCircle2, RefreshCw, X } from 'lucide-vue-next'
import { hasPermission } from '@/auth/authorization'
import {
    getFaqs, createFaq, updateFaq,
    updateFaqStatus, deleteFaq,
} from '@/api/faqApi'

const faqs = ref([])
const loading = ref(false)
const saving = ref(false)
const busyId = ref(null)
const error = ref('')
const success = ref('')
const search = ref('')
const statusFilter = ref('all')
const editingId = ref(null)
const formVisible = ref(false)

const canCreate = computed(() => hasPermission('faqs.create'))
const canUpdate = computed(() => hasPermission('faqs.update'))
const canDelete = computed(() => hasPermission('faqs.delete'))

const emptyForm = () => ({
    question: '',
    answer: '',
    category: '',
    link_url: '',
    link_text: '',
    sort_order: 0,
    is_active: true,
})

const form = reactive(emptyForm())

const activeCount = computed(() =>
    faqs.value.filter(faq => faq.is_active).length
)

const filteredFaqs = computed(() => {
    const query = search.value.trim().toLowerCase()

    return faqs.value.filter(faq => {
        if (statusFilter.value === 'active' && !faq.is_active) return false
        if (statusFilter.value === 'inactive' && faq.is_active) return false

        if (!query) return true

        return [faq.question, faq.answer, faq.category]
            .some(value => String(value || '').toLowerCase().includes(query))
    })
})

async function loadFaqs() {
    loading.value = true
    error.value = ''

    try {
        const response = await getFaqs()
        faqs.value = response.data?.data || []
    } catch (err) {
        error.value = err.response?.data?.message || 'Unable to load FAQs.'
    } finally {
        loading.value = false
    }
}

function openCreate() {
    if (!canCreate.value) return

    editingId.value = null
    Object.assign(form, emptyForm())
    error.value = ''
    formVisible.value = true
}

function openEdit(faq) {
    if (!canUpdate.value) return

    editingId.value = faq.id
    Object.assign(form, {
        question: faq.question || '',
        answer: faq.answer || '',
        category: faq.category || '',
        link_url: faq.link_url || '',
        link_text: faq.link_text || '',
        sort_order: faq.sort_order ?? 0,
        is_active: Boolean(faq.is_active),
    })

    error.value = ''
    formVisible.value = true
}

function closeForm() {
    if (saving.value) return
    formVisible.value = false
    editingId.value = null
}

async function saveFaq() {
    if (saving.value) return
    if (editingId.value === null && !canCreate.value) return
    if (editingId.value !== null && !canUpdate.value) return

    error.value = ''
    success.value = ''

    const payload = {
        question: form.question.trim(),
        answer: form.answer.trim(),
        category: form.category.trim() || null,
        link_url: form.link_url.trim() || null,
        link_text: form.link_text.trim() || null,
        sort_order: Number(form.sort_order),
        is_active: form.is_active,
    }

    if (!payload.question || !payload.answer) {
        error.value = 'Question and answer are required.'
        return
    }

    if (!Number.isSafeInteger(payload.sort_order) || payload.sort_order < 0) {
        error.value = 'Display order must be a non-negative integer.'
        return
    }

    saving.value = true

    try {
        if (editingId.value === null) {
            await createFaq(payload)
            success.value = 'FAQ created successfully.'
        } else {
            await updateFaq(editingId.value, payload)
            success.value = 'FAQ updated successfully.'
        }

        formVisible.value = false
        editingId.value = null
        await loadFaqs()
    } catch (err) {
        error.value = err.response?.data?.message || 'Unable to save FAQ.'
    } finally {
        saving.value = false
    }
}

async function toggleStatus(faq) {
    if (!canUpdate.value || busyId.value !== null) return

    const nextStatus = !faq.is_active
    const action = nextStatus ? 'activate' : 'deactivate'

    if (!window.confirm(`Are you sure you want to ${action} this FAQ?`)) return

    busyId.value = faq.id
    error.value = ''
    success.value = ''

    try {
        await updateFaqStatus(faq.id, nextStatus)
        success.value = `FAQ ${nextStatus ? 'activated' : 'deactivated'} successfully.`
        await loadFaqs()
    } catch (err) {
        error.value = err.response?.data?.message || `Unable to ${action} FAQ.`
    } finally {
        busyId.value = null
    }
}

async function removeFaq(faq) {
    if (!canDelete.value || busyId.value !== null) return

    if (!window.confirm(
        `Delete "${faq.question}"? This action cannot be undone.`
    )) return

    busyId.value = faq.id
    error.value = ''
    success.value = ''

    try {
        await deleteFaq(faq.id)
        success.value = 'FAQ deleted successfully.'
        await loadFaqs()
    } catch (err) {
        error.value = err.response?.data?.message || 'Unable to delete FAQ.'
    } finally {
        busyId.value = null
    }
}

onMounted(loadFaqs)
</script>

<template>
    <div class="page-container">

        <!-- Header -->
        <div class="page-header">
            <div>
                <h1>FAQ Management</h1>
                <p>Manage the questions and answers displayed on your storefront.</p>
            </div>

            <div class="header-actions">
                <button class="secondary-button" type="button" :disabled="loading" @click="loadFaqs">
                    <RefreshCw :size="15" :class="{ spinning: loading }" />
                    Refresh
                </button>
                <button v-if="canCreate" class="primary-button" type="button" @click="openCreate">
                    + Add FAQ
                </button>
            </div>
        </div>

        <!-- Notices -->
        <div v-if="error" class="error-state" role="alert">
            <AlertCircle :size="16" />
            <span>{{ error }}</span>
            <button type="button" class="dismiss" aria-label="Dismiss error" @click="error = ''">
                <X :size="14" />
            </button>
        </div>

        <div v-if="success" class="success-state" role="status">
            <CheckCircle2 :size="16" />
            <span>{{ success }}</span>
            <button type="button" class="dismiss" aria-label="Dismiss message" @click="success = ''">
                <X :size="14" />
            </button>
        </div>

        <!-- Stats -->
        <div class="stats-grid">
            <article class="stat-card">
                <span>Total FAQs</span>
                <strong>{{ faqs.length }}</strong>
            </article>
            <article class="stat-card">
                <span>Active FAQs</span>
                <strong>{{ activeCount }}</strong>
            </article>
            <article class="stat-card">
                <span>Inactive FAQs</span>
                <strong>{{ faqs.length - activeCount }}</strong>
            </article>
        </div>

        <!-- Filters -->
        <div class="filter-card">
            <div class="search-box">
                <input v-model="search" type="text" placeholder="Search question, answer, category..." />
            </div>

            <select v-model="statusFilter" aria-label="Filter FAQs by status">
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
            </select>

            <span class="result-count">{{ filteredFaqs.length }} FAQs</span>
        </div>

        <!-- Table -->
        <div class="table-card">

            <div v-if="loading && !faqs.length" class="empty-state">
                Loading FAQs...
            </div>

            <div v-else-if="!filteredFaqs.length" class="empty-state">
                No FAQs found.
            </div>

            <div v-else class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Order</th>
                            <th>Question</th>
                            <th>Category</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>

                    <tbody>
                        <tr v-for="faq in filteredFaqs" :key="faq.id">
                            <td>{{ faq.sort_order }}</td>

                            <td class="question-cell">
                                <strong>{{ faq.question }}</strong>
                                <span class="answer-preview">{{ faq.answer }}</span>
                            </td>

                            <td>{{ faq.category || 'General' }}</td>

                            <td>
                                <span class="status-badge" :class="faq.is_active ? 'active' : 'inactive'">
                                    {{ faq.is_active ? 'Active' : 'Inactive' }}
                                </span>
                            </td>

                            <td>
                                <div class="action-buttons">
                                    <button
                                        v-if="canUpdate"
                                        type="button"
                                        class="action-button edit"
                                        :disabled="busyId !== null"
                                        @click="openEdit(faq)"
                                    >
                                        Edit
                                    </button>

                                    <button
                                        v-if="canUpdate"
                                        type="button"
                                        class="action-button"
                                        :disabled="busyId !== null"
                                        @click="toggleStatus(faq)"
                                    >
                                        {{ faq.is_active ? 'Deactivate' : 'Activate' }}
                                    </button>

                                    <button
                                        v-if="canDelete"
                                        type="button"
                                        class="action-button delete"
                                        :disabled="busyId !== null"
                                        @click="removeFaq(faq)"
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

        <!-- Add / edit modal -->
        <div v-if="formVisible" class="modal-backdrop" @click.self="closeForm">
            <div class="faq-modal" role="dialog" aria-modal="true" aria-labelledby="faq-form-title">
                <div class="modal-heading">
                    <h2 id="faq-form-title">{{ editingId === null ? 'Add FAQ' : 'Edit FAQ' }}</h2>
                    <button type="button" class="modal-close" aria-label="Close form" :disabled="saving" @click="closeForm">
                        <X :size="18" />
                    </button>
                </div>

                <form class="faq-form" @submit.prevent="saveFaq">
                    <label>
                        Question *
                        <input v-model="form.question" required maxlength="500" placeholder="Enter the question" />
                    </label>

                    <label>
                        Answer *
                        <textarea v-model="form.answer" required rows="5" placeholder="Enter the answer"></textarea>
                    </label>

                    <div class="form-grid">
                        <label>
                            Category
                            <input v-model="form.category" maxlength="100" placeholder="e.g. Delivery" />
                        </label>
                        <label>
                            Display order
                            <input v-model.number="form.sort_order" type="number" min="0" step="1" required />
                        </label>
                    </div>

                    <div class="form-grid">
                        <label>
                            Related link URL
                            <input v-model="form.link_url" maxlength="1000" placeholder="/returns or https://example.com" />
                        </label>
                        <label>
                            Related link text
                            <input v-model="form.link_text" maxlength="150" placeholder="Read more" />
                        </label>
                    </div>

                    <label class="checkbox-label">
                        <input v-model="form.is_active" type="checkbox" />
                        Active (visible to customers)
                    </label>

                    <div class="form-actions">
                        <button type="button" class="secondary-button" :disabled="saving" @click="closeForm">
                            Cancel
                        </button>
                        <button type="submit" class="primary-button" :disabled="saving">
                            {{ saving ? 'Saving...' : 'Save FAQ' }}
                        </button>
                    </div>
                </form>
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
    margin: 0;
    font-size: var(--font-size-2xl);
    font-weight: var(--font-weight-bold);
    color: var(--color-text-primary);
}

.page-header p {
    margin: 5px 0 0;
    font-size: var(--font-size-md);
    color: var(--color-text-secondary);
}

.header-actions {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
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
    padding: 10px var(--spacing-lg);
    border-radius: var(--radius-lg);
    font-family: inherit;
    font-size: var(--font-size-md);
    font-weight: var(--font-weight-semibold);
    white-space: nowrap;
    cursor: pointer;
    transition: background var(--transition-fast),
    border-color var(--transition-fast),
    color var(--transition-fast);
}

.primary-button {
    border: 1px solid var(--color-primary);
    background: var(--color-primary);
    color: var(--color-text-light);
}

.primary-button:hover:not(:disabled) {
    border-color: var(--color-primary-hover);
    background: var(--color-primary-hover);
}

.secondary-button {
    border: 1px solid var(--color-border);
    background: var(--color-surface);
    color: var(--color-text-secondary);
}

.secondary-button:hover:not(:disabled) {
    background: var(--color-hover-bg);
    color: var(--color-text-primary);
}

.primary-button:disabled,
.secondary-button:disabled,
.action-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

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
    white-space: nowrap;
    cursor: pointer;
    transition: background var(--transition-fast),
    color var(--transition-fast),
    border-color var(--transition-fast);
}

.action-button:hover:not(:disabled) {
    background: var(--color-hover-bg);
    color: var(--color-text-primary);
}

.action-button.edit:hover:not(:disabled) {
    background: var(--color-primary-light);
    border-color: var(--color-primary-light);
    color: var(--color-primary);
}

.action-button.delete:hover:not(:disabled) {
    background: var(--color-danger-bg);
    border-color: var(--color-danger-light);
    color: var(--color-danger);
}

/* =========================
   Notices
   ========================= */

.error-state,
.success-state {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
    margin-bottom: var(--spacing-lg);
    padding: var(--spacing-md) var(--spacing-lg);
    border-radius: var(--radius-lg);
    font-size: var(--font-size-sm);
}

.error-state span,
.success-state span {
    flex: 1;
}

.error-state {
    background: var(--color-danger-bg);
    color: var(--color-danger);
}

.success-state {
    background: var(--color-success-bg);
    color: var(--color-success);
}

.dismiss {
    display: grid;
    place-items: center;
    padding: var(--spacing-xs);
    border: 0;
    border-radius: var(--radius-sm);
    background: transparent;
    color: inherit;
    cursor: pointer;
    opacity: 0.7;
    transition: opacity var(--transition-fast);
}

.dismiss:hover {
    opacity: 1;
}

/* =========================
   Stats
   ========================= */

.stats-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--spacing-lg);
    margin-bottom: var(--spacing-lg);
}

.stat-card {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
    padding: var(--spacing-xl);
    background: var(--color-surface);
    border: 1px solid var(--color-border-light);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-sm);
}

.stat-card span {
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
}

.stat-card strong {
    font-size: var(--font-size-2xl);
    font-weight: var(--font-weight-bold);
    color: var(--color-text-primary);
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

.result-count {
    margin-left: auto;
    font-size: var(--font-size-sm);
    color: var(--color-text-muted);
    white-space: nowrap;
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

.question-cell {
    max-width: 440px;
}

.question-cell strong {
    display: block;
}

.answer-preview {
    display: -webkit-box;
    margin-top: var(--spacing-xs);
    max-width: 420px;
    line-height: 1.5;
    color: var(--color-text-muted);
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
}

/* =========================
   Status Badge
   ========================= */

.status-badge {
    display: inline-flex;
    align-items: center;
    padding: 4px 10px;
    border-radius: var(--radius-full);
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-semibold);
    text-transform: capitalize;
    white-space: nowrap;
}

.status-badge.active {
    background: var(--color-success-bg);
    color: var(--color-success);
}

.status-badge.inactive {
    background: var(--color-hover-bg);
    color: var(--color-text-secondary);
}

/* =========================
   Empty state
   ========================= */

.empty-state {
    padding: 50px var(--spacing-xl);
    text-align: center;
    font-size: var(--font-size-sm);
    color: var(--color-text-muted);
}

/* =========================
   Modal
   ========================= */

.modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--spacing-xl);
    background: var(--color-overlay);
}

.faq-modal {
    width: min(100%, 680px);
    max-height: 90vh;
    overflow-y: auto;
    padding: var(--spacing-2xl);
    background: var(--color-surface);
    border: 1px solid var(--color-border-light);
    border-radius: var(--radius-xl);
    box-shadow: var(--shadow-lg);
}

.modal-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--spacing-md);
    margin-bottom: var(--spacing-xl);
    padding-bottom: var(--spacing-lg);
    border-bottom: 1px solid var(--color-border-light);
}

.modal-heading h2 {
    margin: 0;
    font-size: var(--font-size-xl);
    font-weight: var(--font-weight-bold);
    color: var(--color-text-primary);
}

.modal-close {
    display: grid;
    place-items: center;
    padding: var(--spacing-sm);
    border: 0;
    border-radius: var(--radius-md);
    background: transparent;
    color: var(--color-text-secondary);
    cursor: pointer;
    transition: background var(--transition-fast), color var(--transition-fast);
}

.modal-close:hover:not(:disabled) {
    background: var(--color-hover-bg);
    color: var(--color-text-primary);
}

.modal-close:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

/* =========================
   Form
   ========================= */

.faq-form {
    display: grid;
    gap: var(--spacing-lg);
}

.faq-form label {
    display: grid;
    gap: var(--spacing-sm);
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-semibold);
    color: var(--color-text-primary);
}

.faq-form input:not([type="checkbox"]),
.faq-form textarea {
    width: 100%;
    box-sizing: border-box;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    background: var(--color-surface);
    color: var(--color-text-primary);
    font-family: inherit;
    font-size: var(--font-size-md);
    font-weight: var(--font-weight-normal);
    outline: none;
    transition: border-color var(--transition-fast),
    box-shadow var(--transition-fast);
}

.faq-form input:not([type="checkbox"]) {
    height: 40px;
    padding: 0 var(--spacing-lg);
}

.faq-form textarea {
    padding: var(--spacing-md) var(--spacing-lg);
    line-height: 1.5;
    resize: vertical;
}

.faq-form input::placeholder,
.faq-form textarea::placeholder {
    color: var(--color-text-muted);
}

.faq-form input:not([type="checkbox"]):focus,
.faq-form textarea:focus {
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px var(--color-primary-light);
}

.form-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--spacing-lg);
}

.faq-form .checkbox-label {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
    font-weight: var(--font-weight-medium);
    cursor: pointer;
}

.faq-form .checkbox-label input {
    width: 16px;
    height: 16px;
    margin: 0;
    accent-color: var(--color-primary);
    cursor: pointer;
}

.form-actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--spacing-md);
    margin-top: var(--spacing-sm);
    padding-top: var(--spacing-lg);
    border-top: 1px solid var(--color-border-light);
}

/* =========================
   Animations
   ========================= */

.spinning {
    animation: spin 1s linear infinite;
}

@keyframes spin {
    to { transform: rotate(360deg); }
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

    .result-count {
        margin-left: 0;
    }
}

@media (max-width: 700px) {
    .page-header,
    .filter-card {
        flex-direction: column;
        align-items: stretch;
    }

    .page-header {
        align-items: flex-start;
    }

    .header-actions {
        width: 100%;
    }

    .header-actions > * {
        flex: 1;
    }

    .filter-card select {
        width: 100%;
    }

    .stats-grid,
    .form-grid {
        grid-template-columns: 1fr;
    }

    .faq-modal {
        padding: var(--spacing-lg);
    }
}
</style>
