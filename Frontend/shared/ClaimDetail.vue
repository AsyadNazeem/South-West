<script setup>
import { badgeClass } from './warrantyStatus.js'
import { ref, watch, onBeforeUnmount } from 'vue'
const props = defineProps({ detail: Object, api: Function, base: String, admin: Boolean, files: Boolean })
const previews = ref({}), error = ref('')
let generation = 0
function reset() {
  generation++
  Object.values(previews.value).forEach(URL.revokeObjectURL)
  previews.value = {}
  error.value = ''
}
// Load authorized thumbnails only when the corresponding gallery row enters view.
const observers = new WeakMap()
const vThumbnail = {
  mounted(el, { value: file }) {
    if (!props.files || file.mime !== 'image/webp') return
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        observer.disconnect()
        read(file, false, true)
      }
    })
    observers.set(el, observer)
    observer.observe(el)
  },
  unmounted(el) { observers.get(el)?.disconnect() }
}
const fmtDate = v => new Date(v).toLocaleDateString('en-GB')
const fmtDateTime = v => new Date(v).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

watch(() => props.detail, reset)
onBeforeUnmount(reset)
async function openFullImage(file) {
  const tab = window.open('', '_blank')
  if (tab) tab.opener = null
  try {
    const { data } = await props.api.get(props.base + '/files/' + file.id, {
      responseType: 'blob',
      params: { preview: '1' }
    })
    const url = URL.createObjectURL(data)
    if (tab && !tab.closed) {
      tab.location.replace(url)
    } else {
      const a = document.createElement('a')
      a.href = url
      a.target = '_blank'
      a.rel = 'noopener'
      a.click()
    }
    setTimeout(() => URL.revokeObjectURL(url), 60000)
  } catch {
    if (tab && !tab.closed) tab.close()
    error.value = 'Unable to open evidence.'
  }
}

async function read(file, download = false, automatic = false) {
  const gen = generation
  try {
    const { data } = await props.api.get(props.base + '/files/' + file.id, { responseType: 'blob', params: download ? undefined : automatic ? { thumbnail: '1' } : { preview: '1' } })
    if (gen !== generation) return
    const url = URL.createObjectURL(data)
    if (download) {
      const a = document.createElement('a')
      a.href = url
      a.download = 'evidence-' + file.id + (file.mime === 'image/webp' ? '.webp' : '.webm')
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } else {
      if (previews.value[file.id]) URL.revokeObjectURL(previews.value[file.id])
      previews.value[file.id] = url
    }
  } catch { error.value = 'Unable to retrieve evidence.' }
}
</script>
<template>
  <article v-if="detail" class="claim-detail">
    <header class="head">
      <div class="head-id">
        <h2>{{ detail.claim.reference }}</h2>
        <span class="muted">
          Submitted {{ fmtDate(detail.claim.created_at) }}<template v-if="admin"> · Reviewer {{ detail.claim.reviewer?.email || 'Unassigned' }}</template>
        </span>
      </div>
      <span class="status" :class="badgeClass(detail.claim.status)">{{ detail.claim.status }}</span>
    </header>

    <div class="split">
      <!-- Left: the claim -->
      <div class="col main">
        <section>
          <h3>Purchase</h3>
          <dl class="rows">
            <div><dt>Product</dt><dd>{{ detail.claim.product }}</dd></div>
            <div><dt>Purchaser</dt><dd>{{ detail.claim.customer_name }}</dd></div>
            <div v-if="admin && detail.claim.customer">
              <dt>Account</dt>
              <dd>{{ detail.claim.customer.first_name }} {{ detail.claim.customer.last_name }}<small>{{ detail.claim.customer.email }}</small></dd>
            </div>
            <div><dt>Order / invoice</dt><dd>{{ detail.claim.order_number }} / {{ detail.claim.invoice_number || '—' }}</dd></div>
            <div><dt>Phone</dt><dd>{{ detail.claim.phone }}</dd></div>
            <div><dt>Warranty</dt><dd>{{ detail.claim.eligibility }}</dd></div>
          </dl>
        </section>

        <section>
          <h3>Claim reason</h3>
          <p class="reason">{{ detail.claim.reason }}</p>
        </section>

        <section>
          <h3>Evidence</h3>
          <p v-if="!detail.evidence.length" class="muted">No evidence uploaded.</p>
          <ul v-else class="evidence">
            <li
              v-for="f in detail.evidence"
              :key="f.id"
              v-thumbnail="f"
              class="tile"
              :class="{ wide: f.mime !== 'image/webp' && previews[f.id] }"
            >
              <div class="tile-media">
                <a v-if="previews[f.id] && f.mime === 'image/webp'" href="#" aria-label="View full-size photo" @click.prevent="openFullImage(f)">
                  <img :src="previews[f.id]" alt="Submitted evidence">
                </a>
                <video v-else-if="previews[f.id]" :src="previews[f.id]" controls />
                <svg v-else class="tile-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path :d="f.mime === 'image/webp' ? 'M4 5h16v14H4z M4 16l5-5 4 4 3-3 4 4 M9 9.5h.01' : 'M4 6h12v12H4z M16 10l5-3v10l-5-3'" />
                </svg>
              </div>
              <div class="tile-meta">
                <span class="tile-name">{{ f.mime === 'image/webp' ? 'Photo' : 'Video' }} {{ f.id }}</span>
                <small class="muted">{{ f.request_id ? 'Request ' + f.request_id : 'Initial submission' }}</small>
                <span v-if="files" class="tile-actions">
                  <button v-if="!previews[f.id]" type="button" class="link-button" @click="read(f)">Preview</button>
                  <button v-if="admin" type="button" class="link-button" @click="read(f, true)">Download</button>
                </span>
              </div>
            </li>
          </ul>
          <p v-if="error" role="alert" class="alert">{{ error }}</p>
        </section>
      </div>

      <!-- Right: what happened -->
      <div class="col side">
        <section v-if="detail.requests.length">
          <h3>Evidence requests</h3>
          <div class="requests">
            <div v-for="r in detail.requests" :key="r.id" class="request">
              <div class="request-head">
                <strong>Request {{ r.id }}</strong>
                <span class="status" :class="r.status === 'open' ? 'warning' : 'success'">{{ r.status }}</span>
              </div>
              <span class="muted">Requested {{ fmtDateTime(r.created_at) }}<template v-if="admin"> · Staff {{ r.requested_by }}</template></span>
              <p>{{ r.reason }}</p>
              <p v-if="r.instructions" class="muted">{{ r.instructions }}</p>
              <p v-if="r.response" class="response"><span class="muted">Received {{ fmtDateTime(r.answered_at) }}</span><br>{{ r.response }}</p>
            </div>
          </div>
        </section>

        <section>
          <h3>Activity</h3>
          <ol class="timeline">
            <li v-for="(h, i) in detail.history" :key="i">
              <div class="tl-head">
                <strong>{{ h.event }}</strong>
                <span class="status" :class="badgeClass(h.new_status)">{{ h.new_status }}</span>
              </div>
              <time class="muted">{{ fmtDateTime(h.created_at) }}<template v-if="admin">{{ h.staff_id ? ' · Staff ' + h.staff_id : ' · Customer ' + h.customer_id }}</template></time>
              <p v-if="h.message">{{ h.message }}</p>
              <p v-if="h.internal_note" class="internal"><strong>Internal note</strong><br>{{ h.internal_note }}</p>
            </li>
          </ol>
        </section>
      </div>
    </div>
  </article>
</template>
<style scoped>
.claim-detail {
  --cd-text: var(--color-text-primary, var(--color-text));
  --cd-muted: var(--color-text-secondary, var(--color-text-muted));
  --cd-surface: var(--color-surface);
  --cd-soft: var(--color-surface-muted, var(--color-background));
  --cd-border: var(--color-border);
  --cd-primary: var(--color-primary);
  --cd-tint: color-mix(in srgb, var(--cd-primary) 5%, var(--cd-surface));
  overflow: hidden; overflow-wrap: anywhere;
  background: var(--cd-surface); color: var(--cd-text);
  border: 1px solid var(--cd-border); border-radius: var(--radius-lg, 8px); box-shadow: var(--shadow-sm, none);
}
.claim-detail h2 { margin: 0; font-size: 15px; font-weight: 700; }
.claim-detail h3 { margin: 0 0 10px; color: var(--cd-muted); font-size: 12px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; }
.claim-detail p { margin: 0; white-space: pre-line; }
.muted { color: var(--cd-muted); font-size: 12px; }

/* Header */
.head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 18px; border-bottom: 1px solid var(--cd-border); }
.head-id { display: grid; gap: 2px; min-width: 0; }

/* Two halves */
.split { display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr); }
.col { display: flex; flex-direction: column; gap: 20px; min-width: 0; padding: 18px; }
.side { background: var(--cd-tint); border-left: 1px solid var(--cd-border); }

/* Status */
.status { display: inline-flex; align-items: center; gap: 6px; flex-shrink: 0; color: var(--cd-muted); font-size: 12px; font-weight: 600; white-space: nowrap; }
.status::before { content: ''; width: 6px; height: 6px; flex-shrink: 0; border-radius: 50%; background: currentColor; }
.status.success { color: #15803d; }
.status.warning { color: #b45309; }
.status.danger { color: #b42318; }
.status.info { color: var(--cd-primary); }

/* Purchase rows */
.rows { display: grid; gap: 8px; margin: 0; }
.rows > div { display: grid; grid-template-columns: 100px minmax(0, 1fr); gap: 10px; font-size: 13px; }
.rows dt { color: var(--cd-muted); }
.rows dd { margin: 0; font-weight: 500; }
.rows dd small { display: block; margin-top: 1px; color: var(--cd-muted); font-size: 12px; font-weight: 400; }
.reason { font-size: 13px; line-height: 1.55; }

/* Evidence thumbnails */
.evidence { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 10px; margin: 0; padding: 0; list-style: none; }
.tile { display: grid; align-content: start; gap: 6px; min-width: 0; }
.tile.wide { grid-column: 1 / -1; }
.tile-media { display: grid; place-items: center; aspect-ratio: 4 / 3; overflow: hidden; background: var(--cd-soft); border: 1px solid var(--cd-border); border-radius: var(--radius-md, 6px); }
.tile.wide .tile-media { aspect-ratio: auto; }
.tile-media a { display: block; width: 100%; height: 100%; }
.tile-media img { display: block; width: 100%; height: 100%; object-fit: cover; }
.tile-media video { display: block; width: 100%; max-height: 320px; }
.tile-icon { width: 24px; height: 24px; fill: none; stroke: var(--cd-muted); stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
.tile-meta { display: grid; gap: 1px; min-width: 0; }
.tile-name { font-size: 12px; font-weight: 600; }
.tile-meta small { font-size: 11px; }
.tile-actions { display: flex; gap: 10px; margin-top: 2px; }
.link-button { padding: 0; background: none; border: 0; color: var(--cd-primary); font: 600 12px/1.4 inherit; cursor: pointer; }
.link-button:hover { text-decoration: underline; }
.link-button:focus-visible { outline: 2px solid var(--cd-primary); outline-offset: 2px; }

/* Evidence requests */
.requests { display: grid; gap: 10px; }
.request { display: grid; gap: 4px; padding: 12px 14px; background: var(--cd-surface); border: 1px solid var(--cd-border); border-radius: var(--radius-md, 6px); font-size: 13px; }
.request-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.request p { margin-top: 4px; line-height: 1.5; }
.response { padding: 8px 10px; background: var(--cd-soft); border-radius: 6px; }

/* Activity timeline */
.timeline { position: relative; margin: 0; padding: 0 0 0 18px; list-style: none; }
.timeline::before { content: ''; position: absolute; top: 6px; bottom: 6px; left: 4px; width: 2px; background: var(--cd-border); }
.timeline li { position: relative; padding-bottom: 14px; font-size: 13px; }
.timeline li:last-child { padding-bottom: 0; }
.timeline li::before { content: ''; position: absolute; top: 4px; left: -18px; width: 10px; height: 10px; border-radius: 50%; background: var(--cd-primary); box-shadow: 0 0 0 3px var(--cd-tint); }
.tl-head { display: flex; align-items: center; flex-wrap: wrap; gap: 6px 10px; }
.timeline time { display: block; margin: 2px 0 4px; }
.timeline p { margin-top: 4px; line-height: 1.5; }
.internal { padding: 8px 10px; background: var(--cd-surface); border-left: 2px solid var(--cd-primary); border-radius: 4px; font-size: 12px; }

.alert { margin-top: 10px; padding: 8px 12px; background: #fef2f2; color: #b42318; border: 1px solid #fecaca; border-radius: 6px; font-size: 12px; }

@media (max-width: 760px) {
  .split { grid-template-columns: minmax(0, 1fr); }
  .side { border-left: 0; border-top: 1px solid var(--cd-border); }
  .col { padding: 14px; }
  .head { padding: 12px 14px; }
  .rows > div { grid-template-columns: 1fr; gap: 2px; }
}
</style>