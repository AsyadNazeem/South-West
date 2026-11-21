<script setup>
import { ref, onBeforeUnmount } from 'vue'
const emit = defineEmits(['change'])
const items = ref([]), error = ref(''), picker = ref(null)
function choose(files) {
  const additions = Array.from(files)
  const all = [...items.value.map(i => i.file), ...additions]
  const photos = all.filter(f => ['image/webp','image/jpeg','image/png'].includes(f.type))
  const videos = all.filter(f => f.type.startsWith('video/'))
  error.value = ''
  if (all.length !== photos.length + videos.length || photos.length > 10 || videos.length > 1 ||
      photos.some(f => f.size > 3*1024*1024)) {
    error.value = 'Choose up to ten JPEG, PNG or WebP photos (3 MB each) and one video.'
  } else {
    items.value.push(...additions.map(file => ({ file, url: URL.createObjectURL(file) })))
    emit('change', all)
  }
  if (picker.value) picker.value.value = ''
}
function remove(i) {
  URL.revokeObjectURL(items.value[i].url)
  items.value.splice(i,1)
  emit('change', items.value.map(i => i.file))
}
onBeforeUnmount(() => items.value.forEach(i => URL.revokeObjectURL(i.url)))
</script>
<template>
  <fieldset @dragover.prevent @drop.prevent="choose($event.dataTransfer.files)">
    <legend>Evidence</legend><label>Drop files here or choose up to 10 JPEG, PNG or WebP photos (3 MB each) and one optional video (up to 10 seconds).
      <input ref="picker" type="file" multiple accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime" @change="choose($event.target.files)">
    </label><p v-if="error" role="alert">{{ error }}</p>
    <div class="previews"><figure v-for="(item,i) in items" :key="item.url">
      <video v-if="item.file.type.startsWith('video/')" :src="item.url" controls /><img v-else :src="item.url" alt="Selected evidence">
      <figcaption>{{ item.file.name }} <button type="button" @click="remove(i)">Remove</button></figcaption>
    </figure></div>
  </fieldset>
</template>
<style scoped>
fieldset{min-width:0;background:var(--color-store-bg);border:1px dashed var(--color-border);border-radius:.5rem;padding:1rem}.previews{display:flex;flex-wrap:wrap;gap:.6rem}figure{margin:0;width:9rem;overflow-wrap:anywhere}img,video{max-width:100%;max-height:8rem}input{display:block;max-width:100%;margin:.6rem 0}
input::file-selector-button{font:inherit;padding:.55rem .8rem;border-radius:6px;background:white;color:var(--color-primary);border:1px solid var(--color-border);margin-right:.65rem}figcaption{font-size:.84rem}legend{font-weight:700}
</style>
