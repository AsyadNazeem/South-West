<script setup>
import {ref,onMounted} from 'vue'
import api from '@/services/api'
import AccountPageHeader from '@/components/account/AccountPageHeader.vue'
import OrderThumbnail from '@/components/account/OrderThumbnail.vue'
defineProps({customer:Object,fullName:String})
const orders=ref([]), loading=ref(true), failed=ref(false)
async function load(){
  loading.value=true;failed.value=false
  try {orders.value=(await api.get('/customer-orders',{params:{page:1,limit:3}})).data.data}
  catch {failed.value=true}
  finally {loading.value=false}
}
const latestUnread = ref(null)
async function loadNotification() {
  try {
    const { data } = await api.get('/my/notifications')
    const notifications = Array.isArray(data?.data) ? data.data : data?.data?.data
    latestUnread.value = (notifications || [])
      .filter(notification => !notification.is_read)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0]
  } catch {
    latestUnread.value = null
  }
}
onMounted(loadNotification)
const shortcuts=[
  ['Warranty claims','Submit evidence or follow a claim','warranty-claims'],
  ['Saved addresses','Manage your delivery details','addresses'],
  ['My profile','View your contact information','personal-information'],
  ['Notifications','Read your account updates','notifications'],
]
const money=new Intl.NumberFormat('en-LK',{style:'currency',currency:'LKR',currencyDisplay:'code'})
onMounted(load)
</script>
<template>
  <section><AccountPageHeader :title="'Welcome back, '+(customer?.first_name || fullName)" description="Your purchases and account details, in one place."/>
    <section class="account-panel recent"><div class="row-head"><h2>Recent orders</h2><RouterLink to="/account/orders">View all orders →</RouterLink></div>
      <p v-if="loading" role="status">Loading recent orders…</p>
      <p v-else-if="failed" role="alert">Your recent orders couldn’t be loaded. <button @click="load">Try again</button></p>
      <div v-else-if="!orders.length" class="blank"><h3>No orders yet</h3><p>Your purchases will appear here once you place an order.</p><RouterLink class="account-cta" to="/shop">Browse products</RouterLink></div>
      <RouterLink v-for="o in orders" v-else :key="o.id" class="order" :to="{path:'/account/orders',query:{orderId:o.id}}">
        <OrderThumbnail :item="o.items?.[0]?.item"/><div class="summary"><strong>{{ o.items?.[0]?.item?.item_name || o.order_number }}</strong>
        <small>{{ o.order_number }} · {{ new Date(o.order_date).toLocaleDateString('en-GB') }}</small></div>
        <div class="amount"><span>{{ o.status.replaceAll('_',' ') }}</span><strong>{{ money.format(o.total_amount) }}</strong></div>
      </RouterLink>
    </section>
    <h2 class="links-title">Manage your account</h2>
    <div class="shortcuts"><RouterLink v-for="[name,help,path] in shortcuts" :key="path" :to="'/account/'+path"><div><strong>{{ name }}</strong><small>{{ path === 'notifications' && latestUnread?.title ? latestUnread.title : help }}</small></div><span aria-hidden="true">↗</span></RouterLink></div>
  </section>
</template>
<style scoped>
.row-head,.order,.shortcuts a{display:flex;align-items:center;justify-content:space-between;gap:1rem}
.row-head{border-bottom:1px solid var(--color-border-soft);padding-bottom:1rem;flex-wrap:wrap}.row-head h2,.links-title{margin:0;font:700 1.25rem var(--font-family-display)}.row-head a{color:var(--color-primary-light);font-weight:650;font-size:.88rem}
.order{padding:1rem 0;border-bottom:1px solid var(--color-border-soft);text-decoration:none;color:var(--color-text)}.order:last-child{border:0;padding-bottom:0}.summary{flex:1;min-width:0}.summary small,.shortcuts small{display:block;color:var(--color-text-muted);margin-top:.3rem}
.amount{display:grid;text-align:right;gap:.3rem;font-size:.85rem}.amount span{text-transform:capitalize;color:var(--color-primary-light)}.blank{padding:1.5rem 0 .4rem}.blank p{color:var(--color-text-muted)}
.links-title{margin:1.75rem 0 .9rem}.shortcuts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.8rem}.shortcuts a{padding:1.15rem;border:1px solid var(--color-border-soft);border-radius:8px;background:white;color:var(--color-primary);text-decoration:none}.shortcuts a:hover{border-color:var(--color-focus)}
@media(max-width:540px){.shortcuts{grid-template-columns:1fr}.order{flex-wrap:wrap;gap:.65rem}.amount{width:100%;display:flex;justify-content:space-between}.summary{flex-basis:50%}}
</style>
