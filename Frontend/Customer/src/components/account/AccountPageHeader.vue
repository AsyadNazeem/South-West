<script setup>
defineProps({ title: {type:String,required:true}, description: String })
</script>
<template>
  <header class="account-page-heading">
    <div><h1>{{ title }}</h1><p v-if="description">{{ description }}</p></div>
    <slot />
  </header>
</template>
<style scoped>
.account-page-heading{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:1rem;margin:0 0 clamp(1.25rem,3vw,2rem)}
.account-page-heading h1{font:700 clamp(1.7rem,3vw,2.6rem)/1.12 var(--font-family-display);letter-spacing:-.035em;color:var(--color-primary);margin:0}
.account-page-heading p{margin:.55rem 0 0;color:var(--color-text-muted);font-size:.95rem;line-height:1.6}
</style>
