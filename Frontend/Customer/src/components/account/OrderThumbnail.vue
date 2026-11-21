<script>
// Product media is absent from historical order lines. Resolve visible products once per page session.
const imageRequests = new Map()
</script>
<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import api from '@/services/api'
import {getResponsiveImageUrl} from '@/utils/mediaUrl'
const props=defineProps({item:Object})
const element=ref(null), src=ref('')
let observer, visible=false, sequence=0
async function load(){
  const current=++sequence
  const id=props.item?.public_id
  src.value=''
  if(!id || !visible)return
  if(!imageRequests.has(id)){
    const request=api.get('/store/products',{params:{publicId:id}}).then(({data})=>{
      const rows=data?.data?.products ?? data?.data ?? data?.products ?? data
      const item=Array.isArray(rows) && rows.find(p=>p.public_id===id)
      return getResponsiveImageUrl(item?.images?.find(i=>i.is_primary) || item?.images?.[0] || item?.image_url)
    }).catch(()=>{imageRequests.delete(id);return ''})
    if(imageRequests.size>=100)imageRequests.delete(imageRequests.keys().next().value)
    imageRequests.set(id,request)
  }
  const url=await imageRequests.get(id)
  if(current===sequence)src.value=url
}
onMounted(()=>{
  observer=new IntersectionObserver(([entry])=>{if(entry.isIntersecting){visible=true;observer.disconnect();load()}})
  observer.observe(element.value)
})
watch(()=>props.item?.public_id,load)
onBeforeUnmount(()=>{sequence++;observer?.disconnect()})
</script>
<template><span ref="element" class="thumb" aria-hidden="true"><img v-if="src" :src="src" alt="" @error="src=''"><svg v-else viewBox="0 0 24 24"><path d="m3 7 9-4 9 4v11l-9 4-9-4z M3 7l9 4 9-4 M12 11v11"/></svg></span></template>
<style scoped>.thumb{display:inline-grid;place-items:center;width:54px;height:54px;flex:none;border:1px solid var(--color-border-soft);background:var(--color-surface-muted);border-radius:8px;overflow:hidden}.thumb img{width:100%;height:100%;object-fit:contain;background:white}.thumb svg{width:23px;fill:none;stroke:var(--color-text-muted);stroke-width:1.5;stroke-linejoin:round}</style>
