<script setup>
import { badgeClass } from '../../../../shared/warrantyStatus.js'
import { computed, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import api from '@/api/axios'
import AppPagination from '@/components/common/AppPagination.vue'
import { hasPermission } from '@/auth/authorization'
import ClaimDetail from '../../../../shared/ClaimDetail.vue'
const route = useRoute()
const base = '/admin/warranty-claims', home = '/admin/sales/warranty-claims'
const current = computed(() => route.params.claim)
const can = action => hasPermission('warranty_claims.' + action)
const filters = reactive({ q:'', status:'', from:'', to:'', sort:'created_at', direction:'desc' })
const page = ref(1), count = ref(0), rows = ref([]), statuses = ref([]), detail = ref(null)
const loading = ref(false), saved = ref(''), confirming = ref(false)
const reviewers = ref([]), error = ref(''), busy = ref(false), dialog = ref(null), action = ref('')
const form = ref({}), actionError = ref('')
let generation = 0
async function load() {
  loading.value = true
  const version = ++generation
  error.value = ''; detail.value = null
  try {
    if (current.value) {
      const { data } = await api.get(base + '/' + current.value)
      if (version === generation) detail.value = data
    } else {
      const { data } = await api.get(base, { params: { ...filters, page: page.value } })
      if (version === generation) { rows.value = data.rows; count.value = data.count; statuses.value = data.statuses }
    }
  } catch(e) { if (version === generation) error.value = e.response?.data?.message || 'Unable to load claims.' }
  finally { if (version === generation) loading.value = false }
}
watch(current, () => { saved.value = '' })
watch([current,page],load,{immediate:true})
function search() { if (page.value === 1) load(); else page.value = 1 }
async function openAction(name) {
  confirming.value = false; saved.value = ''; action.value = name; form.value = {}; actionError.value = ''
  if (name === 'assign') {
    try { reviewers.value = (await api.get(base + '/staff')).data }
    catch { error.value = 'Unable to load reviewers.'; return }
    form.value.assigned_staff_id = detail.value.claim.assigned_staff_id || null
  }
  dialog.value.showModal()
}
async function save() {
  if (busy.value) return
  if (action.value === 'status' && !confirming.value) { confirming.value = true; return }
  busy.value = true
  try {
    await api.post(base + '/' + current.value + '/' + action.value,form.value)
    saved.value = action.value === 'status' ? 'Status change saved.' : action.value === 'request' ? 'Evidence request saved.' : 'Changes saved.'
    dialog.value.close()
    await load()
  } catch(e) { actionError.value = e.response?.data?.message || 'Unable to save changes.' }
  finally { busy.value = false }
}
async function download() {
  busy.value = true
  try {
    const { data } = await api.get(base + '/' + current.value + '/archive',{ responseType:'blob' })
    const url = URL.createObjectURL(data), a = document.createElement('a')
    a.href = url; a.download = 'warranty-' + current.value + '.zip'; a.click()
    setTimeout(() => URL.revokeObjectURL(url),1000)
  } catch { error.value = 'Unable to download archive.' }
  finally { busy.value = false }
}
const hasActions = computed(() => detail.value && (can('review') || can('assign') || can('download_evidence') ||
  (can('update_status') && detail.value.transitions.length) ||
  (can('request_evidence') && ['Under Review','Evidence Submitted'].includes(detail.value.claim.status))))
const deliveryLabel = { pending:'Queued for delivery', sending:'Sending', sent:'Accepted by mail server', failed:'Delivery failed' }
const labels = { status:'Update status', request:'Request more evidence', assign:'Assign reviewer', note:'Add internal note' }
</script>
<template>
  <main class="warranty">
    <RouterLink v-if="current" :to="home" class="back-link">← All warranty claims</RouterLink>

    <header class="page-header">
      <h1>{{ current ? 'Warranty claim details' : 'Warranty claims' }}</h1>
      <p v-if="!current && !loading">{{ count }} matching claims</p>
    </header>

    <p v-if="error" role="alert" class="alert">{{ error }}</p>

    <p v-if="loading" role="status">Loading warranty claims…</p>
    <p v-if="saved" role="status">{{ saved }}</p>
    <template v-if="!current">
      <form class="card filters" @submit.prevent="search">
        <label class="grow">Search<input v-model="filters.q" maxlength="100" type="search" placeholder="Search by name, reference or phone..."></label>
        <label>Status<select v-model="filters.status"><option value="">All statuses</option><option v-for="s in statuses" :key="s">{{ s }}</option></select></label>
        <label>From<input v-model="filters.from" type="date"></label>
        <label>Through<input v-model="filters.to" type="date"></label>
        <label>Sort by<select v-model="filters.sort"><option value="created_at">Submitted</option><option value="reference">Reference</option>
          <option value="customer_name">Customer</option><option value="status">Status</option></select></label>
        <label>Direction<select v-model="filters.direction"><option value="desc">Descending</option><option value="asc">Ascending</option></select></label>
        <button class="primary">Apply</button>
      </form>

      <div v-if="!loading && !error" class="card table-card">
        <div class="scroll">
          <table>
            <thead><tr><th v-for="h in ['Claim reference','Customer','Product','Order','Submitted','Status','Reviewer','Action']" :key="h">{{ h }}</th></tr></thead>
            <tbody>
              <tr v-for="c in rows" :key="c.id">
                <td><RouterLink class="ref" :to="home+'/'+c.id">{{ c.reference }}</RouterLink></td>
                <td>{{ c.customer_name }}</td>
                <td>{{ c.product }}</td>
                <td>{{ c.order_number }}</td>
                <td>{{ new Date(c.created_at).toLocaleDateString('en-GB') }}</td>
                <td><span class="badge" :class="badgeClass(c.status)">{{ c.status }}</span></td>
                <td>{{ c.reviewer?.email || 'Unassigned' }}</td>
                <td><RouterLink class="ref" :to="home+'/'+c.id">View Claim</RouterLink></td>
              </tr>
              <tr v-if="!rows.length"><td colspan="8" class="empty">No claims match these filters.</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <AppPagination v-if="!error" v-model:page="page" :page-size="20" :page-size-options="[20]" :total="count" :loading="loading" />
    </template>

    <template v-if="detail">
      <h2 v-if="hasActions">Admin actions</h2>
      <div v-if="hasActions" class="actions">
        <button v-if="can('update_status') && detail.transitions.length" class="primary" @click="openAction('status')">Update status</button>
        <button v-if="can('request_evidence') && ['Under Review','Evidence Submitted'].includes(detail.claim.status)" @click="openAction('request')">Request more evidence</button>
        <button v-if="can('assign')" @click="openAction('assign')">Assign reviewer</button>
        <button v-if="can('review')" @click="openAction('note')">Add internal note</button>
        <button v-if="can('download_evidence')" :disabled="busy" @click="download">Download evidence ZIP</button>
      </div>
      <section v-if="detail.customerMail?.length" class="card delivery">
        <strong>Latest customer email</strong>
        <span>{{ deliveryLabel[detail.customerMail[0].state] }} · Attempts {{ detail.customerMail[0].attempts }}</span>
        <span v-if="detail.customerMail[0].last_error">Last attempt · {{ detail.customerMail[0].last_error }}</span>
        <button type="button" @click="load">Refresh delivery state</button>
      </section>
      <ClaimDetail :detail="detail" :api="api" :base="base+'/'+current" admin :files="can('download_evidence')" />
    </template>

    <dialog ref="dialog">
      <form @submit.prevent="save">
        <h2>{{ labels[action] }}</h2>
        <template v-if="action==='status'">
          <p>Current status · {{ detail?.claim.status }}</p>
          <label>New status<select :disabled="confirming" v-model="form.status" required><option v-for="s in detail?.transitions" :key="s">{{ s }}</option></select></label>
          <label>Message to customer<textarea v-model.trim="form.message" :readonly="confirming" :required="form.status==='Rejected'" maxlength="2000" /></label>
        </template>
        <label v-if="['status','note'].includes(action)">Internal staff note<textarea v-model.trim="form.internal_note" :readonly="confirming" :required="action==='note'" maxlength="2000" /></label>
        <template v-if="action==='request'">
          <label>Reason for request<textarea v-model.trim="form.reason" required maxlength="2000" /></label>
          <label>Evidence instructions<textarea v-model.trim="form.instructions" maxlength="2000" /></label>
        </template>
        <label v-if="action==='assign'">Reviewer<select v-model="form.assigned_staff_id"><option :value="null">Unassigned</option><option v-for="u in reviewers" :key="u.id" :value="u.id">{{ u.email }}</option></select></label>
        <p v-if="actionError" role="alert" class="alert">{{ actionError }}</p>
        <div class="dialog-actions">
          <button type="button" @click="dialog.close()">Cancel</button>
          <button v-if="confirming" type="button" :disabled="busy" @click="confirming=false">Edit</button>
          <button class="primary" :disabled="busy">{{ busy ? 'Saving…' : action === 'status' ? (confirming ? 'Confirm status change' : 'Review change') : action === 'request' ? 'Send evidence request' : 'Save' }}</button>
        </div>
      </form>
    </dialog>
  </main>
</template>
<style scoped>
.warranty { min-width: 0; color: var(--color-text-primary); font-size: var(--font-size-md); }

/* Header */
.page-header { margin-bottom: var(--spacing-2xl); }
.page-header h1 { margin: 0 0 var(--spacing-sm); font-size: var(--font-size-2xl); font-weight: var(--font-weight-bold); }
.page-header p { margin: 0; color: var(--color-text-secondary); }
.back-link { display: inline-block; margin-bottom: var(--spacing-lg); color: var(--color-primary); font-size: var(--font-size-sm); font-weight: var(--font-weight-medium); }
.back-link:hover { color: var(--color-primary-hover); }

/* Cards */
.card { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-xl); box-shadow: var(--shadow-sm); }
.filters { display: flex; flex-wrap: wrap; align-items: flex-end; gap: var(--spacing-lg); padding: var(--spacing-xl); margin-bottom: var(--spacing-xl); }
.grow { flex: 1; min-width: 220px; }
.table-card { overflow: hidden; margin-bottom: var(--spacing-xl); }
.pager { display: flex; align-items: center; justify-content: space-between; gap: var(--spacing-lg); padding: var(--spacing-lg) var(--spacing-xl); font-size: var(--font-size-sm); color: var(--color-text-secondary); }
.pager > div { display: flex; align-items: center; gap: var(--spacing-sm); }
.page-info { padding: 0 var(--spacing-xs); color: var(--color-text-primary); font-weight: var(--font-weight-medium); }

/* Form controls */
.warranty label { display: grid; gap: var(--spacing-xs); color: var(--color-text-secondary); font-size: var(--font-size-xs); font-weight: var(--font-weight-semibold); text-transform: uppercase; letter-spacing: .04em; }
.warranty input, .warranty select, .warranty textarea { width: 100%; height: 40px; padding: 0 var(--spacing-md); background: var(--color-surface); color: var(--color-text-primary); border: 1px solid var(--color-border); border-radius: var(--radius-lg); font-size: var(--font-size-md); text-transform: none; letter-spacing: 0; transition: border-color var(--transition-fast), box-shadow var(--transition-fast); }
.warranty textarea { height: auto; min-height: 90px; padding: var(--spacing-md); resize: vertical; }
.warranty input::placeholder { color: var(--color-text-muted); }
.warranty input:focus, .warranty select:focus, .warranty textarea:focus { outline: none; border-color: var(--color-primary); box-shadow: 0 0 0 3px var(--color-primary-light); }

/* Buttons */
.warranty button { height: 36px; padding: 0 var(--spacing-lg); background: var(--color-surface); color: var(--color-text-primary); border: 1px solid var(--color-border); border-radius: var(--radius-lg); font-size: var(--font-size-sm); font-weight: var(--font-weight-medium); white-space: nowrap; transition: background var(--transition-fast), border-color var(--transition-fast); }
.warranty button:hover:not(:disabled) { background: var(--color-surface-hover); }
.warranty button.primary { background: var(--color-primary); border-color: var(--color-primary); color: var(--color-text-light); }
.warranty button.primary:hover:not(:disabled) { background: var(--color-primary-hover); border-color: var(--color-primary-hover); }
.warranty button:disabled { color: var(--color-text-muted); background: var(--color-surface-hover); cursor: not-allowed; }
.warranty button.primary:disabled { color: var(--color-text-muted); border-color: var(--color-border); }
.actions { display: flex; flex-wrap: wrap; gap: var(--spacing-sm); margin-bottom: var(--spacing-xl); }

/* Table */
.delivery { display:flex; flex-wrap:wrap; align-items:center; gap:var(--spacing-lg); padding:var(--spacing-lg); margin-bottom:var(--spacing-lg) }
.scroll { overflow-x: auto; }
.warranty table { width: 100%; border-collapse: collapse; }
.warranty th { padding: var(--spacing-md) var(--spacing-lg); text-align: left; white-space: nowrap; color: var(--color-text-secondary); background: var(--color-background); border-bottom: 1px solid var(--color-border); font-size: var(--font-size-xs); font-weight: var(--font-weight-bold); text-transform: uppercase; letter-spacing: .05em; }
.warranty td { padding: var(--spacing-lg); text-align: left; vertical-align: middle; border-bottom: 1px solid var(--color-border); font-size: var(--font-size-md); }
.warranty tbody tr:last-child td { border-bottom: none; }
.warranty tbody tr:hover { background: var(--color-surface-hover); }
.ref { font-weight: var(--font-weight-bold); }
.ref:hover { color: var(--color-primary); }
.empty { padding: var(--spacing-4xl) !important; text-align: center !important; color: var(--color-text-muted); }

/* Status badges */
.badge { display: inline-block; padding: var(--spacing-xs) 10px; border-radius: var(--radius-full); font-size: var(--font-size-xs); font-weight: var(--font-weight-semibold); white-space: nowrap; background: var(--color-surface-hover); color: var(--color-text-secondary); }
.badge.success { background: var(--color-success-light); color: var(--color-success); }
.badge.warning { background: var(--color-warning-light); color: var(--color-warning); }
.badge.danger { background: var(--color-danger-light); color: var(--color-danger); }
.badge.info { background: var(--color-info-light); color: var(--color-info); }

/* Alerts */
.alert { margin: 0 0 var(--spacing-lg); padding: var(--spacing-md) var(--spacing-lg); background: var(--color-danger-bg); color: var(--color-danger); border: 1px solid var(--color-danger-light); border-radius: var(--radius-lg); font-size: var(--font-size-sm); }

/* Dialog */
.warranty dialog { width: min(32rem, 94vw); margin: auto; padding: var(--spacing-2xl); background: var(--color-surface); color: var(--color-text-primary); border: 1px solid var(--color-border); border-radius: var(--radius-xl); box-shadow: var(--shadow-lg); }
.warranty dialog::backdrop { background: var(--color-overlay); }
.warranty dialog form { display: grid; gap: var(--spacing-lg); }
.warranty dialog h2 { margin: 0; font-size: var(--font-size-xl); font-weight: var(--font-weight-semibold); }
.dialog-actions { display: flex; justify-content: flex-end; gap: var(--spacing-sm); }

@media (max-width: 760px) {
  .filters { padding: var(--spacing-lg); }
  .pager { flex-direction: column; align-items: flex-start; }
}
</style>
