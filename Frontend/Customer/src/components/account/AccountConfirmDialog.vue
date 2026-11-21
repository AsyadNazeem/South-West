<script setup>
import {onMounted,ref} from 'vue'
defineProps({title:String,description:String,confirmLabel:String,busy:Boolean})
defineEmits(['cancel','confirm'])
const dialog=ref(null)
onMounted(()=>dialog.value.showModal())
</script>
<template><dialog ref="dialog" :aria-label="title" @cancel.prevent="!busy && $emit('cancel')">
  <h2>{{ title }}</h2><p>{{ description }}</p>
  <div class="dialog-actions"><button type="button" autofocus :disabled="busy" @click="$emit('cancel')">Cancel</button>
    <button class="remove" type="button" :disabled="busy" @click="$emit('confirm')">{{ busy ? 'Removing…' : confirmLabel }}</button></div>
</dialog></template>
<style scoped>
dialog{width:min(25rem,calc(100% - 2rem));margin:auto;padding:1.5rem;color:var(--color-text);border:1px solid var(--color-border-soft);border-radius:var(--radius-lg)}dialog::backdrop{background:rgb(10 18 32 / 42%)}h2{margin:0;font:700 1.35rem var(--font-family-display)}p{color:var(--color-text-muted);line-height:1.5}.dialog-actions{display:flex;gap:.7rem;justify-content:flex-end;flex-wrap:wrap}button{min-height:44px;background:white;color:var(--color-primary);border:1px solid var(--color-border);border-radius:6px;padding:.6rem 1rem;font:inherit;cursor:pointer}.remove{background:var(--color-danger);color:white;border-color:var(--color-danger)}
</style>
