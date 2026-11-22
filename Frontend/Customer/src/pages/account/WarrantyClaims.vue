<script setup>
import AccountPageHeader from '@/components/account/AccountPageHeader.vue'
import { accountFeedback } from '@/utils/accountFeedback'
import { badgeClass } from '../../../../shared/warrantyStatus.js'
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '@/services/api'
import ClaimUpload from '@/components/account/ClaimUpload.vue'
import ClaimDetail from '../../../../shared/ClaimDetail.vue'
const route = useRoute(), router = useRouter()
const home = '/account/warranty-claims', base = '/my/warranty-claims'
const current = computed(() => route.params.claim || '')
const list = ref([]), page = ref(1), count = ref(0), detail = ref(null), purchase = ref(null)
const number = ref(''), item = ref(''), phone = ref(''), reason = ref(''), files = ref([])
const error = ref(''), success = ref(''), busy = ref(false), progress = ref(0)
const request = computed(() => detail.value?.requests.find(r => r.status === 'open'))
const loading = ref(false)
const agreed = ref(false)

// Terms shown on the new-claim page
const TERMS = [
  {
    title: 'Making a claim',
    items: [
      'An invoice is required for every warranty claim.',
      'Video proof is compulsory for all warranty claims.',
      'Memory products must be sent to our physical store at Unity Plaza.',
      'Accessories can be claimed through the website.',
      'Products must be returned with their original accessories, packaging and relevant documentation.',
    ],
  },
  {
    title: 'Not covered',
    note: 'Warranty applies only to technical faults. The following may not be covered, subject to the applicable warranty terms:',
    items: [
      'Physical damage',
      'Liquid damage',
      'Misuse',
      'Burn marks',
      'Unauthorized repairs',
      'Electrical damage caused by improper use',
      'Tampering',
    ],
  },
  {
    title: 'Refunds',
    items: ['No cash refunds.'],
  },
  {
    title: 'Orders',
    items: [
      'We reserve the right to decline or cancel orders due to stock unavailability.',
      'If a product becomes unavailable after an order is placed, we will inform the customer and discuss the available options, including a refund where applicable.',
    ],
  },
]

// Up to 3 evidence photos per claim card, loaded when the card scrolls into view
const PREVIEW_COUNT = 3
const previews = ref({})   // claim id -> [{ id, url }]
const extra = ref({})      // claim id -> photos beyond the first 3
const requested = new Set()

function clearPreviews() {
  Object.values(previews.value).flat().forEach(p => URL.revokeObjectURL(p.url))
  previews.value = {}
  extra.value = {}
  requested.clear()
}

async function loadPreviews(claim) {
  if (requested.has(claim.id)) return
  requested.add(claim.id)
  const token = version
  try {
    let evidence = claim.evidence
    if (!evidence) {
      const { data } = await api.get(base + '/' + claim.id)
      evidence = data.evidence || []
    }
    const photos = evidence.filter(f => f.mime === 'image/webp')
    const loaded = await Promise.all(photos.slice(0, PREVIEW_COUNT).map(async f => {
      const { data } = await api.get(base + '/' + claim.id + '/files/' + f.id, { responseType: 'blob', params: { thumbnail: '1' } })
      return { id: f.id, url: URL.createObjectURL(data) }
    }))
    if (token !== version) { loaded.forEach(p => URL.revokeObjectURL(p.url)); return }
    previews.value = { ...previews.value, [claim.id]: loaded }
    extra.value = { ...extra.value, [claim.id]: Math.max(0, photos.length - loaded.length) }
  } catch {
    previews.value = { ...previews.value, [claim.id]: [] }
  }
}

const vLazyPreview = {
  mounted(el, { value: claim }) {
    const io = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) { io.disconnect(); loadPreviews(claim) }
    })
    io.observe(el)
    el._io = io
  },
  unmounted(el) { el._io?.disconnect() }
}
onBeforeUnmount(clearPreviews)

let key, version = 0
async function load() {
  loading.value = true
  const token = ++version
  clearPreviews()
  detail.value = null; purchase.value = null; error.value = ''; reason.value = ''; files.value = []
  number.value = ''; item.value = ''; agreed.value = false; key = crypto.randomUUID()
  try {
    if (current.value === 'new') return
    const id = current.value
    const { data } = await api.get(id ? base + '/' + id : base, { params: id ? {} : { page: page.value } })
    if (version !== token) return
    if (id) detail.value = data
    else { list.value = data.rows; count.value = data.count }
  } catch (e) { if (version === token) error.value = accountFeedback(e,'Unable to load claims.') }
  finally { if (version === token) loading.value = false }
}

watch([current,page], load, { immediate: true })
async function lookup() {
  error.value = ''; busy.value = true; purchase.value = null
  const entered = number.value
  try {
    const { data } = await api.get(base + '/purchase', { params: { number: entered } })
    if (entered === number.value) { purchase.value = data; item.value = ''; phone.value = data.phone || '' }
  } catch (e) { error.value = accountFeedback(e, 'Unable to verify purchase.') }
  finally { busy.value = false }
}
async function send() {
  error.value = ''; success.value = ''
  const initial = current.value === 'new'
  if (!files.value.length || (initial && !files.value.some(f => f.type.startsWith('image/')))) {
    error.value = initial ? 'Add at least one evidence photo.' : 'Add the requested evidence.'; return
  }
  busy.value = true; progress.value = 0
  const form = new FormData()
  if (initial) {
    for (const [k,v] of Object.entries({ number: number.value, order_item_id: item.value, phone: phone.value, reason: reason.value })) form.append(k,v)
  } else form.append('explanation',reason.value)
  files.value.forEach(f => form.append(f.type.startsWith('image/') ? 'photos' : 'video',f))
  try {
    const url = initial ? base : base + '/' + current.value + '/requests/' + request.value.id
    const { data } = await api.post(url,form,{ headers: { 'Content-Type': 'multipart/form-data', 'Idempotency-Key': key },
      timeout: 180000, onUploadProgress: e => { if (e.total) progress.value = Math.round(e.loaded*100/e.total) } })
    success.value = (initial ? 'Claim submitted · ' : 'Additional evidence received · ') + data.reference
    if (initial) await router.push(home + '/' + data.id)
    else await load()
  } catch (e) { error.value = accountFeedback(e, 'Unable to submit. Please retry.') }
  finally { busy.value = false }
}
</script>
<template>
  <section class="claims">
    <RouterLink v-if="current" :to="home" class="back-link">← All warranty claims</RouterLink>

    <AccountPageHeader
      :title="current === 'new' ? 'Submit warranty claim' : current ? 'Warranty claim details' : 'Warranty claims'"
      :description="current === 'new' ? 'Start with the number on your order or invoice.' : current ? '' : 'Follow a claim or request help with a purchased product.'">
      <RouterLink v-if="!current" :to="home + '/new'" class="btn primary">Submit warranty claim</RouterLink>
    </AccountPageHeader>

    <p v-if="success" role="status" class="notice success">{{ success }}</p>
    <p v-if="error" role="alert" class="notice error">{{ error }}</p>

    <div v-if="loading" class="claim-list" aria-busy="true" aria-label="Loading warranty claims">
      <div v-for="n in 2" :key="n" class="claim-card" aria-hidden="true">
        <div class="col"><div class="skeleton-line short"></div><div class="skeleton-line"></div></div>
        <div class="col side"><div class="skeleton-line"></div><div class="skeleton-line short"></div></div>
      </div>
    </div>

    <template v-if="!current && !loading && !error">
      <div v-if="!list.length" class="state">
        <h3>No warranty claims yet</h3>
        <p class="muted">When you submit one, you can track its progress here.</p>
        <RouterLink :to="home + '/new'" class="btn primary">Submit warranty claim</RouterLink>
      </div>

      <div v-else class="claim-list">
        <article v-for="c in list" :key="c.id" class="claim-card">
          <div class="col">
            <header class="claim-top">
              <div class="claim-id">
                <RouterLink :to="home + '/' + c.id" class="claim-title">{{ c.product }}</RouterLink>
                <span class="muted">{{ c.reference }}</span>
              </div>
              <span class="status" :class="badgeClass(c.status)">{{ c.status }}</span>
            </header>

            <p v-if="c.status === 'More Evidence Required'" class="claim-note">We need more evidence to continue with this claim.</p>

            <div v-lazy-preview="c" class="thumbs">
              <template v-if="previews[c.id]?.length">
                <RouterLink v-for="p in previews[c.id]" :key="p.id" :to="home + '/' + c.id" class="thumb" aria-label="View claim">
                  <img :src="p.url" alt="Evidence photo">
                </RouterLink>
                <RouterLink v-if="extra[c.id]" :to="home + '/' + c.id" class="thumb more">+{{ extra[c.id] }}</RouterLink>
              </template>
              <template v-else-if="!previews[c.id]">
                <span v-for="n in 3" :key="n" class="thumb skeleton" aria-hidden="true"></span>
              </template>
            </div>
          </div>

          <div class="col side">
            <dl class="rows">
              <div><dt>Order</dt><dd>{{ c.order_number }}</dd></div>
              <div v-if="c.invoice_number"><dt>Invoice</dt><dd>{{ c.invoice_number }}</dd></div>
              <div><dt>Submitted</dt><dd>{{ new Date(c.created_at).toLocaleDateString('en-GB') }}</dd></div>
            </dl>
            <RouterLink :to="home + '/' + c.id" class="cta" :class="{ urgent: c.status === 'More Evidence Required' }">
              {{ c.status === 'More Evidence Required' ? 'Respond to request' : 'View claim' }} →
            </RouterLink>
          </div>
        </article>
      </div>

      <div v-if="page > 1 || page * 20 < count" class="pager">
        <button class="btn" :disabled="page <= 1" @click="page--">Previous</button>
        <span>Page {{ page }}</span>
        <button class="btn" :disabled="page * 20 >= count" @click="page++">Next</button>
      </div>
    </template>

    <!-- New claim: terms -->
    <section v-if="current === 'new'" class="terms" aria-labelledby="terms-title">
      <h2 id="terms-title">Warranty terms</h2>
      <p class="muted">Please read these before submitting a claim.</p>
      <div class="terms-grid">
        <div v-for="group in TERMS" :key="group.title" class="terms-group">
          <h3>{{ group.title }}</h3>
          <p v-if="group.note" class="terms-note">{{ group.note }}</p>
          <ul>
            <li v-for="line in group.items" :key="line">{{ line }}</li>
          </ul>
        </div>
      </div>
    </section>

    <!-- New claim: verify purchase -->
    <form v-if="current === 'new'" class="lookup" @submit.prevent="lookup">
      <div class="col">
        <h2>Verify purchase</h2>
        <p class="muted">We use it to find your purchase and check which items are covered.</p>
      </div>
      <div class="col side">
        <label>Order or invoice number *
          <input v-model.trim="number" maxlength="100" required placeholder="Order or invoice reference" @input="purchase=null">
        </label>
        <button class="btn primary" :disabled="busy">{{ busy ? 'Checking…' : 'Verify purchase' }}</button>
      </div>
    </form>

    <p v-if="request" class="request-alert">More evidence is needed. <a href="#claim-response">Respond to the request ↓</a></p>
    <ClaimDetail v-if="detail" :detail="detail" :api="api" :base="base + '/' + current" files />

    <!-- Claim details / additional evidence -->
    <form v-if="purchase || request" id="claim-response" class="claim-form" @submit.prevent="send">
      <div class="col">
        <h2>{{ request ? 'Additional evidence' : 'Claim details' }}</h2>
        <p v-if="request" class="request-text">{{ request.reason }} {{ request.instructions }}</p>
        <template v-if="purchase">
          <label>Purchased customer name<input :value="purchase.customer_name" readonly></label>
          <label>Product purchased *
            <select v-model="item" required>
              <option disabled value="">Choose a purchased item</option>
              <option v-for="p in purchase.products" :key="p.order_item_id" :value="p.order_item_id" :disabled="!p.allowed">
                {{ p.product }} · line {{ p.order_item_id }} · {{ p.label }}</option>
            </select>
          </label>
          <label>Phone number *<input v-model.trim="phone" required maxlength="30" type="tel"></label>
        </template>
      </div>

      <div class="col side">
        <label>{{ request ? 'Response to evidence request' : 'Warranty claim reason' }} *
          <textarea v-model.trim="reason" required maxlength="2000" rows="4" />
        </label>
        <ClaimUpload @change="files=$event" />
        <progress v-if="busy" aria-label="Upload progress" :value="progress" max="100" />

        <label v-if="purchase" class="agree">
          <input v-model="agreed" type="checkbox" required>
          <span>I have read and agree to the warranty terms. *</span>
        </label>

        <button class="btn primary" :disabled="busy">{{ busy ? 'Submitting…' : request ? 'Send additional evidence' : 'Submit claim' }}</button>
      </div>
    </form>
  </section>
</template>
<style scoped>
.claims { min-width: 0; overflow-wrap: anywhere; color: var(--color-text); }
.muted { color: var(--color-text-muted); font-size: 12px; }
button:disabled { cursor: not-allowed; opacity: .55; }
.back-link { display: inline-block; margin-bottom: 10px; color: var(--color-text-muted); font-size: 13px; font-weight: 500; text-decoration: none; }
.back-link:hover { color: var(--color-primary); }

/* Buttons */
.btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 36px; padding: 0 14px; background: var(--color-surface); color: var(--color-text); border: 1px solid var(--color-border); border-radius: var(--radius-md); font: 600 13px/1 var(--font-family-base); text-decoration: none; white-space: nowrap; cursor: pointer; transition: border-color .15s ease, color .15s ease; }
.btn:hover:not(:disabled) { border-color: var(--color-primary); color: var(--color-primary); }
.btn.primary { background: var(--color-primary); border-color: var(--color-primary); color: var(--color-on-primary); }
.btn.primary:hover:not(:disabled) { background: var(--color-primary-hover); border-color: var(--color-primary-hover); color: var(--color-on-primary); }
.btn:focus-visible, a:focus-visible { outline: 2px solid var(--color-focus-outline); outline-offset: 2px; }

/* Notices */
.notice { margin: 0 0 14px; padding: 10px 14px; border-radius: var(--radius-md); font-size: 13px; }
.notice.success { background: #ecfdf3; color: #166534; border: 1px solid #bbf7d0; }
.notice.error { background: #fef2f2; color: #b42318; border: 1px solid #fecaca; }

/* Two-half cards (list, lookup, form) */
.claim-list { display: grid; gap: 12px; }
.claim-card, .lookup, .claim-form { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); min-width: 0; overflow: hidden; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-lg); box-shadow: var(--shadow-sm); }
.lookup, .claim-form { margin-top: 4px; }
.claim-form { margin-top: 16px; }
.col { display: flex; flex-direction: column; gap: 12px; min-width: 0; padding: 16px 18px; }
.side { background: color-mix(in srgb, var(--color-primary) 5%, var(--color-surface)); border-left: 1px solid var(--color-border); }
.claim-card .side { gap: 10px; }

/* Claim list */
.claim-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.claim-id { display: grid; gap: 2px; min-width: 0; }
.claim-title { color: var(--color-text); font-size: 14px; font-weight: 700; text-decoration: none; overflow-wrap: anywhere; }
.claim-title:hover { color: var(--color-primary); }
.claim-note { margin: 0; color: var(--color-text-muted); font-size: 12px; line-height: 1.45; }

.thumbs { display: flex; gap: 8px; margin-top: auto; }
.thumb { display: grid; place-items: center; flex: none; width: 64px; height: 64px; overflow: hidden; background: var(--color-surface-muted); border: 1px solid var(--color-border); border-radius: var(--radius-md); }
.thumb img { display: block; width: 100%; height: 100%; object-fit: cover; }
.thumb.more { color: var(--color-primary); font-size: 13px; font-weight: 700; text-decoration: none; }
.thumb.more:hover { background: color-mix(in srgb, var(--color-primary) 6%, var(--color-surface)); border-color: var(--color-primary); }
.thumb.skeleton { border: 0; background: var(--color-border); animation: pulse 1.4s ease-in-out infinite; }

.status { display: inline-flex; align-items: center; gap: 6px; flex-shrink: 0; color: var(--color-text-muted); font-size: 12px; font-weight: 600; white-space: nowrap; }
.status::before { content: ''; width: 6px; height: 6px; flex-shrink: 0; border-radius: 50%; background: currentColor; }
.status.success { color: #15803d; }
.status.warning { color: #b45309; }
.status.danger { color: #b42318; }
.status.info { color: var(--color-primary); }

.rows { display: grid; gap: 8px; margin: 0; }
.rows > div { display: grid; grid-template-columns: 72px minmax(0, 1fr); gap: 10px; font-size: 13px; }
.rows dt { color: var(--color-text-muted); }
.rows dd { margin: 0; font-weight: 500; overflow-wrap: anywhere; }

.cta { margin-top: auto; color: var(--color-primary); font-size: 13px; font-weight: 600; text-decoration: none; }
.cta:hover { text-decoration: underline; }
.cta.urgent { align-self: flex-start; padding: 8px 12px; background: var(--color-primary); color: var(--color-on-primary); border-radius: var(--radius-md); }
.cta.urgent:hover { background: var(--color-primary-hover); text-decoration: none; }

/* Empty state, pager */
.state { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 40px 20px; text-align: center; background: var(--color-surface); border: 1px solid var(--color-border-soft); border-radius: var(--radius-lg); }
.state h3 { margin: 0; font-family: var(--font-family-display); font-size: 16px; }
.state .muted { margin-bottom: 10px; font-size: 13px; }
.pager { display: flex; align-items: center; justify-content: flex-end; gap: 12px; margin-top: 16px; color: var(--color-text-muted); font-size: 13px; }

/* Warranty terms */
.terms { margin-bottom: 12px; padding: 18px 20px; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-lg); box-shadow: var(--shadow-sm); }
.terms h2 { margin: 0 0 2px; font-family: var(--font-family-display); font-size: 16px; font-weight: 700; }
.terms-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px 32px; margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--color-border-soft); }
.terms-group h3 { margin: 0 0 8px; color: var(--color-text-muted); font-size: 12px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; }
.terms-note { margin: 0 0 6px; color: var(--color-text-muted); font-size: 12px; line-height: 1.5; }
.terms ul { margin: 0; padding-left: 16px; font-size: 13px; line-height: 1.55; }
.terms li + li { margin-top: 4px; }

/* Forms */
.lookup h2, .claim-form h2 { margin: 0; font-family: var(--font-family-display); font-size: 16px; font-weight: 700; }
.request-text { margin: 0; padding-left: 10px; border-left: 2px solid var(--color-primary); color: var(--color-text-muted); font-size: 13px; line-height: 1.5; white-space: pre-line; }
.claims label { display: grid; gap: 6px; color: var(--color-text-label); font-size: 12px; font-weight: 600; }
.claims input, .claims select, .claims textarea { width: 100%; min-width: 0; max-width: 100%; height: 40px; padding: 0 12px; background: var(--color-surface); color: var(--color-text); border: 1px solid var(--color-border); border-radius: var(--radius-md); font: 400 14px var(--font-family-base); transition: border-color .15s ease, box-shadow .15s ease; }
.claims textarea { height: auto; min-height: 100px; padding: 10px 12px; resize: vertical; }
.claims input::placeholder, .claims textarea::placeholder { color: var(--color-text-muted); }
.claims input:read-only { background: var(--color-surface-muted); color: var(--color-text-muted); }
.claims input:focus, .claims select:focus, .claims textarea:focus { outline: none; border-color: var(--color-focus); box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-focus) 16%, transparent); }
.lookup .btn, .claim-form .btn { min-height: 40px; align-self: flex-start; }
progress { width: 100%; height: 6px; accent-color: var(--color-primary); }

/* Agreement checkbox */
.claims label.agree { display: flex; align-items: flex-start; gap: 10px; color: var(--color-text); font-size: 13px; font-weight: 500; cursor: pointer; }
.claims .agree input { flex: none; width: 16px; height: 16px; margin: 2px 0 0; padding: 0; accent-color: var(--color-primary); }

.request-alert { margin: 0 0 12px; padding: 10px 14px; background: color-mix(in srgb, var(--color-primary) 6%, var(--color-surface)); border: 1px solid var(--color-border); border-left: 3px solid var(--color-primary); border-radius: var(--radius-md); font-size: 13px; }
.request-alert a { color: var(--color-primary); font-weight: 600; }

/* Loading */
.skeleton-line { height: 11px; background: var(--color-border); border-radius: 4px; animation: pulse 1.4s ease-in-out infinite; }
.skeleton-line.short { width: 40%; }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: .5; } }

@media (pointer: coarse) { .claims input:not([type=checkbox]), .claims select, .claims textarea { font-size: 16px; } }
@media (max-width: 760px) {
  .claim-card, .lookup, .claim-form { grid-template-columns: minmax(0, 1fr); }
  .side { border-left: 0; border-top: 1px solid var(--color-border); }
  .col { padding: 14px; }
  .terms { padding: 14px; }
  .terms-grid { grid-template-columns: minmax(0, 1fr); gap: 16px; }
}
@media (prefers-reduced-motion: reduce) { .skeleton-line, .thumb.skeleton { animation: none; } }
</style>