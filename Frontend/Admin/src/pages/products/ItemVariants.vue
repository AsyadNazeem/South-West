<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import api from '../../api/axios'

const router = useRouter()

const items = ref([])
const variants = ref([])
const loading = ref(false)
const error = ref('')
const success = ref('')

const search = ref('')
const statusFilter = ref('all')
const defaultFilter = ref('all')

const expandedItemIds = ref(new Set())

function getData(response) {
  const payload = response?.data

  if (Array.isArray(payload)) return payload

  const data = payload?.data

  return Array.isArray(data) ? data : (data?.rows || data?.items || [])
}

// ==========================================
// Search & Filters
// ==========================================

const filteredVariants = computed(() => {
  const term = search.value.trim().toLowerCase()

  return variants.value.filter(v => {
    const matchesSearch =
      !term ||
      [
        v.variant_sku,
        v.variant_name,
        v.qb_item_code,
        v.item?.item_code,
        v.item?.item_name
      ].some(x => String(x || '').toLowerCase().includes(term))

    const matchesStatus =
      statusFilter.value === 'all' ||
      (statusFilter.value === 'active'
        ? Boolean(v.is_active)
        : !v.is_active)

    const matchesDefault =
      defaultFilter.value === 'all' ||
      (defaultFilter.value === 'default'
        ? Boolean(v.is_default)
        : !v.is_default)

    return matchesSearch && matchesStatus && matchesDefault
  })
})

const groupedVariants = computed(() => {
  const groups = new Map()

  for (const variant of filteredVariants.value) {
    const item = variant.item || {}
    const id = String(variant.item_id ?? item.id ?? '')

    if (!id) continue

    if (!groups.has(id)) {
      groups.set(id, {
        id,
        item_code: item.item_code || variant.item_code || '-',
        item_name: item.item_name || variant.item_name || 'Unnamed item',
        variants: []
      })
    }

    groups.get(id).variants.push(variant)
  }

  return [...groups.values()]
})

function resetFilters() {
  search.value = ''
  statusFilter.value = 'all'
  defaultFilter.value = 'all'
}

// ==========================================
// Expand / collapse
// ==========================================

function toggleItem(itemId) {
  const next = new Set(expandedItemIds.value)
  const id = String(itemId)

  if (next.has(id)) next.delete(id)
  else next.add(id)

  expandedItemIds.value = next
}

// ==========================================
// Navigation
// ==========================================

function createVariant() {
  router.push('/admin/products/item-variants/create')
}

function editAllVariants(group) {
  router.push(
    `/admin/products/item-variants/create?bulkEdit=1&itemId=${encodeURIComponent(group.id)}`
  )
}

function editVariant(variant) {
  // The edit page can be implemented separately.
  router.push(`/admin/products/item-variants/edit/${variant.id}`)
}

// ==========================================
// Load
// ==========================================

async function loadAllVariants() {
  loading.value = true
  error.value = ''

  try {
    const itemResponse = await api.get('/items')
    items.value = getData(itemResponse)

    const results = await Promise.all(
      items.value.map(async item => {
        const response = await api.get(`/items/${item.id}/variants`)

        return getData(response).map(v => ({
          ...v,
          item: {
            id: item.id,
            item_code: item.item_code,
            item_name: item.item_name
          }
        }))
      })
    )

    variants.value = results
      .flat()
      .sort((a, b) =>
        String(a.variant_sku || '').localeCompare(
          String(b.variant_sku || '')
        )
      )
  } catch (e) {
    error.value =
      e.response?.data?.message ||
      'Failed to load registered variants.'
  } finally {
    loading.value = false
  }
}

async function deactivateVariant(variant) {
  if (!confirm(`Deactivate variant ${variant.variant_sku}?`)) return

  error.value = ''
  success.value = ''

  try {
    await api.put(
      `/items/${variant.item_id}/variants/${variant.id}`,
      { is_active: false }
    )

    success.value = 'Variant deactivated successfully.'

    await loadAllVariants()
  } catch (e) {
    error.value =
      e.response?.data?.message ||
      'Failed to deactivate variant.'
  }
}

onMounted(loadAllVariants)
</script>

<template>
  <div class="page-container">

    <!-- Header -->
    <div class="page-header">

      <div>
        <h1>Item Variants</h1>

        <p>View and manage all registered item variants.</p>
      </div>

      <button
        type="button"
        class="primary-button"
        @click="createVariant"
      >
        + Create Variant
      </button>

    </div>


    <!-- Error -->
    <div
      v-if="error"
      class="error-state"
    >
      <span>{{ error }}</span>

      <button
        type="button"
        class="action-button"
        @click="loadAllVariants"
      >
        Try Again
      </button>
    </div>


    <!-- Success -->
    <div
      v-if="success"
      class="success-state"
    >
      {{ success }}
    </div>


    <!-- Filters -->
    <div class="filter-card">

      <div class="search-box">
        <input
          v-model.trim="search"
          type="search"
          placeholder="Search SKU, variant, item code, item name..."
          aria-label="Search variants"
        />
      </div>

      <select
        v-model="statusFilter"
        aria-label="Filter by status"
      >
        <option value="all">All Statuses</option>
        <option value="active">Active</option>
        <option value="inactive">Inactive</option>
      </select>

      <select
        v-model="defaultFilter"
        aria-label="Filter default variants"
      >
        <option value="all">All Variants</option>
        <option value="default">Default Only</option>
        <option value="nondefault">Non-default</option>
      </select>

      <button
        type="button"
        class="action-button refresh"
        :disabled="loading"
        @click="resetFilters"
      >
        Reset
      </button>

    </div>


    <!-- Table -->
    <div class="table-card">

      <!-- Loading -->
      <div
        v-if="loading"
        class="empty-state"
      >
        Loading registered variants...
      </div>


      <!-- Empty -->
      <div
        v-else-if="filteredVariants.length === 0"
        class="empty-state"
      >
        <strong>No variants found</strong>

        <span>
          {{
            variants.length
              ? 'No variants match your filters.'
              : 'No variants have been registered yet.'
          }}
        </span>

        <button
          v-if="!variants.length"
          type="button"
          class="primary-button"
          @click="createVariant"
        >
          Create Variant
        </button>
      </div>


      <!-- Table -->
      <div
        v-else
        class="table-container"
      >

        <table>

          <thead>
          <tr>
            <th class="col-toggle">#</th>
            <th>Variant SKU</th>
            <th>Variant Name</th>
            <th>Item Code</th>
            <th>Item Name</th>
            <th>QuickBooks Code</th>
            <th>Default</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
          </thead>

          <tbody>

          <template
            v-for="group in groupedVariants"
            :key="group.id"
          >

            <!-- Item group row -->
            <tr
              class="item-group-row"
              :class="{ expanded: expandedItemIds.has(group.id) }"
              @click="toggleItem(group.id)"
            >

              <td class="col-toggle">
                <button
                  type="button"
                  class="expand-button"
                  :class="{ open: expandedItemIds.has(group.id) }"
                  :aria-expanded="expandedItemIds.has(group.id)"
                  :aria-label="expandedItemIds.has(group.id) ? 'Collapse variants' : 'Expand variants'"
                  @click.stop="toggleItem(group.id)"
                >
                  <svg viewBox="0 0 16 16" aria-hidden="true">
                    <path d="M6 3.5l4.5 4.5L6 12.5" />
                  </svg>
                </button>
              </td>

              <td colspan="4">
                <strong class="group-name">{{ group.item_name }}</strong>

                <span class="group-code">{{ group.item_code }}</span>
              </td>

              <td>
                <span class="count-pill">
                  {{ group.variants.length }}
                  variant{{ group.variants.length === 1 ? '' : 's' }}
                </span>
              </td>

              <td>
                <span
                  class="count-pill"
                  :class="group.variants.some(v => v.is_default) ? 'primary' : ''"
                >
                  {{ group.variants.filter(v => v.is_default).length }} default
                </span>
              </td>

              <td>
                <span
                  class="count-pill"
                  :class="group.variants.some(v => v.is_active) ? 'success' : 'danger'"
                >
                  {{ group.variants.filter(v => v.is_active).length }} active
                </span>
              </td>

              <td>
                <div class="action-buttons">

                  <button
                    type="button"
                    class="action-button edit"
                    @click.stop="editAllVariants(group)"
                  >
                    Edit All
                  </button>

                  <button
                    type="button"
                    class="action-button"
                    @click.stop="toggleItem(group.id)"
                  >
                    {{ expandedItemIds.has(group.id) ? 'Collapse' : 'Expand' }}
                  </button>

                </div>
              </td>

            </tr>

            <!-- Variant rows -->
            <tr
              v-for="(variant, index) in group.variants"
              v-show="expandedItemIds.has(group.id)"
              :key="variant.id"
              class="group-variant-row"
              :class="{ 'row-inactive': !variant.is_active }"
            >

              <td class="col-toggle">{{ index + 1 }}</td>

              <td>
                <strong>{{ variant.variant_sku }}</strong>
              </td>

              <td>{{ variant.variant_name }}</td>

              <td>{{ variant.item?.item_code || variant.item_code || '-' }}</td>

              <td>{{ variant.item?.item_name || variant.item_name || '-' }}</td>

              <td>{{ variant.qb_item_code || '-' }}</td>

              <td>
                <span
                  class="status-badge"
                  :class="variant.is_default ? 'default' : 'neutral'"
                >
                  {{ variant.is_default ? 'Default' : 'No' }}
                </span>
              </td>

              <td>
                <span
                  class="status-badge"
                  :class="variant.is_active ? 'active' : 'inactive'"
                >
                  {{ variant.is_active ? 'Active' : 'Inactive' }}
                </span>
              </td>

              <td>
                <div class="action-buttons">

                  <button
                    type="button"
                    class="action-button edit"
                    @click="editVariant(variant)"
                  >
                    Edit
                  </button>

                  <button
                    type="button"
                    class="action-button delete"
                    :disabled="!variant.is_active"
                    @click="deactivateVariant(variant)"
                  >
                    Deactivate
                  </button>

                </div>
              </td>

            </tr>

          </template>

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

.primary-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 10px var(--spacing-lg);
  border: none;
  border-radius: var(--radius-lg);
  background: var(--color-primary);
  color: var(--color-text-light);
  font-family: inherit;
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
  text-decoration: none;
  white-space: nowrap;
  cursor: pointer;
  transition: background var(--transition-fast);
}

.primary-button:hover {
  background: var(--color-primary-hover);
}

.action-buttons {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
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

.action-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.action-button.refresh {
  height: 40px;
  padding: 0 var(--spacing-lg);
  border-radius: var(--radius-lg);
  font-size: var(--font-size-md);
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
  box-sizing: border-box;
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
  min-width: 160px;
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

tbody tr:last-child td {
  border-bottom: none;
}

.col-toggle {
  width: 56px;
}

/* ---- Item group rows ---- */

.item-group-row {
  background: var(--color-hover-bg);
  cursor: pointer;
  transition: background var(--transition-fast);
}

.item-group-row:hover {
  background: var(--color-primary-light);
}

.item-group-row td {
  padding-top: 12px;
  padding-bottom: 12px;
}

/* Accent bar on the left of an expanded group */
.item-group-row.expanded > td:first-child {
  box-shadow: inset 3px 0 0 var(--color-primary);
}

.group-name {
  font-size: var(--font-size-md);
}

.group-code {
  display: inline-block;
  margin-left: var(--spacing-md);
  padding: 2px 10px;
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-full);
  background: var(--color-surface);
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  letter-spacing: 0.02em;
  vertical-align: middle;
}

.expand-button {
  display: inline-grid;
  place-items: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: background var(--transition-fast),
  color var(--transition-fast),
  border-color var(--transition-fast);
}

.expand-button:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.expand-button svg {
  width: 14px;
  height: 14px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
  transition: transform var(--transition-fast);
}

.expand-button.open svg {
  transform: rotate(90deg);
}

.expand-button:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

/* ---- Variant rows ---- */

.group-variant-row {
  background: var(--color-surface);
  transition: background var(--transition-fast);
}

.group-variant-row:hover {
  background: var(--color-surface-hover);
}

.group-variant-row > td:first-child {
  padding-left: var(--spacing-2xl);
  box-shadow: inset 3px 0 0 var(--color-primary-light);
  color: var(--color-text-muted);
}

.group-variant-row.row-inactive td:not(:last-child) {
  opacity: 0.6;
}

/* =========================
   Badges
   ========================= */

.status-badge,
.count-pill {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: var(--radius-full);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  white-space: nowrap;
}

.status-badge.default,
.count-pill.primary {
  background: var(--color-primary-light);
  color: var(--color-primary);
}

.status-badge.neutral,
.count-pill {
  background: var(--color-surface);
  color: var(--color-text-secondary);
  border: 1px solid var(--color-border-light);
}

.status-badge.neutral {
  background: var(--color-hover-bg);
  border-color: transparent;
}

.status-badge.active,
.count-pill.success {
  background: var(--color-success-bg);
  color: var(--color-success);
  border-color: transparent;
}

.status-badge.inactive,
.count-pill.danger {
  background: var(--color-danger-bg);
  color: var(--color-danger);
  border-color: transparent;
}

.count-pill.primary {
  border-color: transparent;
}

/* =========================
   States
   ========================= */

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-sm);
  padding: 50px var(--spacing-xl);
  text-align: center;
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.empty-state strong {
  font-size: var(--font-size-md);
  color: var(--color-text-primary);
}

.empty-state .primary-button {
  margin-top: var(--spacing-md);
}

.error-state,
.success-state {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-lg);
  margin-bottom: var(--spacing-lg);
  padding: var(--spacing-md) var(--spacing-lg);
  border-radius: var(--radius-lg);
  font-size: var(--font-size-sm);
}

.error-state {
  background: var(--color-danger-bg);
  color: var(--color-danger);
}

.success-state {
  background: var(--color-success-bg);
  color: var(--color-success);
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

  .page-header {
    align-items: flex-start;
  }

  .filter-card select {
    width: 100%;
  }

  .error-state {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>