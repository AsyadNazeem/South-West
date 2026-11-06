<template>
  <div class="table-pagination" aria-label="Table pagination">
    <div class="summary">
      {{ totalItems === 0 ? 'Showing 0 of 0' : `Showing ${firstItem}–${lastItem} of ${totalItems}` }}
    </div>
    <label class="page-size">
      Rows per page
      <select :value="currentPageSize" :disabled="loading" @change="onPageSizeChange">
        <option v-for="size in validPageSizeOptions" :key="size" :value="size">{{ size }}</option>
      </select>
    </label>
    <div class="controls">
      <button type="button" :disabled="loading || currentPage <= 1" @click="emitPage(currentPage - 1)">Previous</button>
      <span>Page {{ currentPage }} of {{ pageCount }}</span>
      <button type="button" :disabled="loading || currentPage >= pageCount" @click="emitPage(currentPage + 1)">Next</button>
    </div>
  </div>
</template>

<script setup>
import { computed, watch } from 'vue'

const props = defineProps({
  page: { type: Number, required: true },
  pageSize: { type: Number, required: true },
  total: { type: Number, default: 0 },
  totalPages: { type: Number, default: null },
  pageSizeOptions: { type: Array, default: () => [10, 25, 50, 100] },
  loading: { type: Boolean, default: false }
})
const emit = defineEmits(['update:page', 'update:pageSize'])

const validPageSizeOptions = computed(() => {
  const options = [...new Set(props.pageSizeOptions.map(Number).filter(value => Number.isInteger(value) && value > 0))]
  return options.length ? options : [10, 25, 50, 100]
})
const totalItems = computed(() => Number.isFinite(Number(props.total)) ? Math.max(0, Math.floor(Number(props.total))) : 0)
const currentPageSize = computed(() => {
  const value = Number(props.pageSize)
  return Number.isInteger(value) && validPageSizeOptions.value.includes(value) ? value : validPageSizeOptions.value[0]
})
const pageCount = computed(() => {
  const supplied = Number(props.totalPages)
  if (props.totalPages !== null && props.totalPages !== undefined && Number.isInteger(supplied) && supplied >= 0) return Math.max(1, supplied)
  return Math.max(1, Math.ceil(totalItems.value / currentPageSize.value))
})
const currentPage = computed(() => {
  const value = Number(props.page)
  const validPage = Number.isInteger(value) && value > 0 ? value : 1
  return Math.min(validPage, pageCount.value)
})
const firstItem = computed(() => totalItems.value === 0 ? 0 : (currentPage.value - 1) * currentPageSize.value + 1)
const lastItem = computed(() => Math.min(currentPage.value * currentPageSize.value, totalItems.value))

function emitPage(value) {
  if (props.loading || !Number.isInteger(value) || value < 1 || value > pageCount.value || value === currentPage.value) return
  emit('update:page', value)
}

function onPageSizeChange(event) {
  const value = Number(event.target.value)
  if (props.loading || !validPageSizeOptions.value.includes(value) || value === currentPageSize.value) return
  emit('update:pageSize', value)
}

watch(() => [currentPage.value, props.loading], ([value, loading]) => {
  if (!loading && value !== props.page) emit('update:page', value)
})

watch(() => [currentPageSize.value, props.loading], ([value, loading]) => {
  if (!loading && value !== props.pageSize) emit('update:pageSize', value)
})
</script>

<style scoped>
.table-pagination{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:14px 16px;color:#64748b;font-size:13px}.page-size,.controls{display:flex;align-items:center;gap:9px}.page-size select{border:1px solid #d9e0e8;border-radius:6px;padding:6px 8px;background:white;color:#334155}.controls button{border:1px solid #d9e0e8;border-radius:6px;background:white;padding:7px 11px;color:#334155;cursor:pointer}.controls button:disabled,.page-size select:disabled{opacity:.45;cursor:not-allowed}@media(max-width:620px){.table-pagination{align-items:flex-start;flex-direction:column}.controls{width:100%;justify-content:space-between;flex-wrap:wrap}.summary{max-width:100%;overflow-wrap:anywhere}}
</style>
