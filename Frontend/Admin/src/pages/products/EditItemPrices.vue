<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import api from '@/api/axios'
import { hasPermission } from '@/auth/authorization'

const route = useRoute()
const data = ref(null)
const groups = ref([])
const busy = ref(false)
const error = ref('')
const failedVariant = ref(undefined)
const success = ref('')
const methods = { cash: 'COD', card: 'Card', koko: 'Koko', mintpay: 'Mintpay' }
const endpoint = computed(() => '/item-prices/item/' + route.params.itemId + '/management')

function draft(group, kind, type, saved = {}, currency = 'LKR') {
  const row = {
    kind, type, variant_id: group.id, id: saved.id ?? null,
    price: saved.price ?? '', currency: saved.currency ?? currency, is_active: saved.is_active ?? true
  }
  if (kind === 'schedule') {
    row.effective_from = saved.effective_from ?? null
    row.effective_to = saved.effective_to ?? null
  }
  return { ...row, original: JSON.stringify(row) }
}

function loadState(snapshot) {
  data.value = snapshot
  const variants = [...snapshot.variants]
  if ([...snapshot.prices, ...snapshot.payments].some(row => row.variant_id === null))
    variants.push({ id: null, variant_name: 'Item-level prices', is_active: true })
  groups.value = variants.map(group => {
    const own = row => String(row.variant_id) === String(group.id)
    const schedules = snapshot.prices.filter(own).map(p => draft(group, 'schedule', p.price_type.toLowerCase(), p))
    const saved = snapshot.payments.filter(own)
    const payments = saved.map(p => draft(group, 'payment', p.payment_method, p))
    for (const type of Object.keys(methods)) {
      if (!saved.some(p => p.payment_method === type))
        payments.push(draft(group, 'payment', type, {}, schedules.find(r => r.type === 'selling')?.currency))
    }
    return { ...group, schedules, payments, source: '' }
  })
}

watch(endpoint, async path => {
  busy.value = true
  data.value = null
  groups.value = []
  success.value = error.value = ''
  try {
    const response = await api.get(path)
    if (path === endpoint.value) loadState(response.data.data)
  } catch (e) {
    if (path === endpoint.value) error.value = e.response?.data?.message || 'Unable to retrieve prices.'
  } finally { if (path === endpoint.value) busy.value = false }
}, { immediate: true })

const missing = group => ['selling', 'cost'].filter(type => !group.schedules.some(row => row.type === type))
function expired(row) {
  const end = JSON.parse(row.original).effective_to
  return Boolean(row.id && end && Date.parse(end) < Date.now())
}
const copySources = computed(() => {
  const now = Date.now()
  return (data.value?.prices ?? []).filter(p => p.price_type.toLowerCase() === 'selling' && p.is_active && Number(p.price) > 0 &&
    (!p.effective_from || Date.parse(p.effective_from) <= now) && (!p.effective_to || Date.parse(p.effective_to) >= now) &&
    data.value.variants.some(v => v.id === p.variant_id && v.is_active))
})

function copy(group) {
  const source = copySources.value.find(p => p.id === group.source)
  if (!source || source.variant_id === group.id) return
  let selling = group.schedules.find(row => row.type === 'selling')
  if (selling?.id) return
  if (!selling) { selling = draft(group, 'schedule', 'selling'); group.schedules.push(selling) }
  selling.price = source.price
  selling.currency = source.currency
  for (const row of group.payments.filter(row => !row.id)) {
    const p = data.value.payments.find(p => p.variant_id === source.variant_id && p.payment_method === row.type &&
      p.currency === source.currency && p.is_active)
    row.price = p?.price ?? ''
    row.currency = source.currency
  }
}

const changes = computed(() => groups.value.flatMap(group => [...group.schedules, ...group.payments])
  .flatMap(({ original, ...row }) => {
    if (!row.id && row.price === '') return []
    return JSON.stringify(row) === original ? [] : [row]
  }))

function setTime(row, key, value) {
  row[key] = value ? new Date(value + 'Z').toISOString() : null
}

async function save() {
  if (busy.value || !changes.value.length) return
  const path = endpoint.value
  busy.value = true
  success.value = error.value = ''
  failedVariant.value = undefined
  try {
    const response = await api.put(path, { revision: data.value.revision, changes: changes.value })
    if (path !== endpoint.value) return
    loadState(response.data.data)
    success.value = 'Prices saved.'
  } catch (e) {
    if (path !== endpoint.value) return
    failedVariant.value = e.response?.data?.variant_id
    error.value = e.response?.data?.message || 'Unable to save prices.'
  } finally { if (path === endpoint.value) busy.value = false }
}
</script>

<template>
  <main class="edit-prices-page">
    <header class="page-header">
      <div><h1>Edit All Item Prices</h1><p v-if="data">{{ data.item.item_code }} · {{ data.item.item_name }}</p></div>
      <RouterLink class="secondary-button" :to="{ name: 'product-price' }">Back to item prices</RouterLink>
    </header>
    <p v-if="error" role="alert" class="message error">{{ error }}</p>
    <p v-if="success" role="status" class="message success">{{ success }}</p>
    <p v-if="busy && !data">Loading prices…</p>
    <form v-if="data" @submit.prevent="save">
      <p v-if="!groups.length">This item has no variants or item-level prices.</p>
      <section v-for="group in groups" :key="group.id ?? 'item'" class="price-card">
        <div class="variant-heading"><div>
          <h2>{{ group.variant_name }}</h2>
          <p>{{ group.variant_sku }} <span v-if="group.is_default"> · Default variant</span><span v-if="!group.is_active"> · Inactive variant</span></p>
        </div></div>
        <p v-if="error && failedVariant === group.id" class="error">{{ error }}</p>
        <fieldset :disabled="busy || !group.is_active">
          <div v-for="schedule in group.schedules" :key="schedule.id ?? schedule.type" class="checkout-section">
            <h3>{{ schedule.type }} price <small v-if="expired(schedule)"> · Expired</small><small v-else-if="!schedule.id"> · New</small></h3>
            <fieldset class="fields" :disabled="Boolean(expired(schedule))">
              <label>Amount<input v-model="schedule.price" type="text" inputmode="decimal" :required="Boolean(schedule.id)" pattern="[0-9]{1,13}([.][0-9]{1,2})?"></label>
              <label>Currency<input v-model="schedule.currency" required pattern="[A-Za-z]{3}" maxlength="3"></label>
              <label v-for="(label, key) in {effective_from:'Valid from (UTC)', effective_to:'Valid until (UTC)'}" :key="key">{{ label }}
                <input type="datetime-local" step="1" :value="schedule[key]?.slice(0,19)" @input="setTime(schedule,key,$event.target.value)">
              </label>
              <label>Status<select v-model="schedule.is_active"><option :value="true">Active</option><option :value="false">Inactive</option></select></label>
            </fieldset>
          </div>
          <div v-if="group.id && missing(group).length" class="missing">
            <p>Missing {{ missing(group).join(' and ') }} price{{ missing(group).length > 1 ? 's' : '' }}</p>
            <button v-if="group.is_active && hasPermission('products.create')" type="button" class="secondary-button"
              @click="group.schedules.push(...missing(group).map(t => draft(group,'schedule',t)))">{{ missing(group).length === 2 ? 'Add Prices' : 'Add Missing Price' }}</button>
          </div>
          <div v-if="group.id && group.is_active && hasPermission('products.create') && !group.schedules.some(schedule => schedule.id && schedule.type === 'selling') && copySources.some(payment => payment.variant_id !== group.id)" class="fields">
            <label>Copy prices from<select v-model="group.source" @change="copy(group)">
              <option disabled value="">Choose a variant</option>
              <option v-for="source in copySources.filter(source => source.variant_id !== group.id)" :key="source.id" :value="source.id">
                {{ data.variants.find(variant => variant.id === source.variant_id).variant_sku }} · {{ source.currency }} {{ source.price }}
              </option>
            </select></label>
          </div>
          <div v-if="group.schedules.some(schedule => schedule.type === 'selling') || group.payments.some(payment => payment.id)" class="checkout-section">
            <h3>Checkout-method prices</h3>
            <div v-for="payment in group.payments" :key="payment.id ?? payment.type" class="fields payment">
              <label>{{ methods[payment.type] }}<input v-model="payment.price" inputmode="decimal" placeholder="Missing price" pattern="[0-9]{1,13}([.][0-9]{1,2})?" :required="Boolean(payment.id)"></label>
              <label>Currency<input v-model="payment.currency" required pattern="[A-Za-z]{3}" maxlength="3"></label>
              <label>Status<select v-model="payment.is_active"><option :value="true">Active</option><option :value="false">Inactive</option></select></label>
            </div>
          </div>
        </fieldset>
      </section>
      <footer class="form-actions"><button class="primary-button" :disabled="busy || !changes.length">Save All Prices</button></footer>
    </form>
  </main>
</template>
<style scoped>
fieldset { border: 0; margin: 0; padding: 0; min-width: 0; }
.payment, .missing { margin: 12px 0; }
h3::first-letter { text-transform: uppercase; }
.edit-prices-page { padding: 24px; color: var(--color-text-primary); }
.page-header, .variant-heading, .form-actions { display: flex; justify-content: space-between; align-items: center; gap: 16px; }
.page-header { margin-bottom: 24px; }
.page-header h1 { margin: 0 0 6px; }
.page-header p, .variant-heading p, .hint { color: var(--color-text-secondary); }
.price-card { margin-bottom: 20px; padding: 22px; border: 1px solid var(--color-border-light); border-radius: var(--radius-lg); background: var(--color-surface); }
.variant-heading { margin-bottom: 20px; }
.variant-heading h2 { margin: 0 0 5px; font-size: 18px; }
.variant-heading p { margin: 0; }
.fields { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; }
.fields label { display: flex; flex-direction: column; gap: 7px; font-size: 14px; font-weight: 600; }
.fields input, .fields select { width: 100%; min-width: 0; box-sizing: border-box; height: 40px; padding: 8px 10px; border: 1px solid var(--color-border); border-radius: var(--radius-md); background: var(--color-surface); color: var(--color-text-primary); font: inherit; }
.status-field { display: flex; align-items: center; gap: 8px; white-space: nowrap; }
.checkout-section { margin-top: 24px; padding-top: 18px; border-top: 1px solid var(--color-border-light); }
.checkout-section h3 { margin: 0 0 16px; font-size: 16px; }
.hint { margin-bottom: 0; font-size: 13px; }
.form-actions { justify-content: flex-end; margin: 24px 0; }
.primary-button, .secondary-button { padding: 10px 16px; border-radius: var(--radius-md); cursor: pointer; font: inherit; }
.primary-button { border: 1px solid var(--color-primary); background: var(--color-primary); color: white; }
.secondary-button { border: 1px solid var(--color-border); background: var(--color-surface); color: var(--color-text-primary); }
.message { margin: 16px 0; }
.error { color: #dc2626; }
.success { color: #15803d; }
button:disabled { opacity: .6; cursor: not-allowed; }
@media (max-width: 600px) { .edit-prices-page { padding: 14px; } .page-header { align-items: flex-start; } .price-card { padding: 14px; } }
</style>
