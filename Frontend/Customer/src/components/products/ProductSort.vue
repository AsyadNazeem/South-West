<script setup>
const sortBy = defineModel('sortBy', { default: 'relevance' })

const options = [
  { value: 'relevance', label: 'Recommended' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
  { value: 'name_asc', label: 'Name: A to Z' },
]
</script>

<template>
  <label class="sort-control">
    <span class="sort-label">Sort by</span>

    <span class="select-wrap">
      <select v-model="sortBy">
        <option
            v-for="option in options"
            :key="option.value"
            :value="option.value"
        >
          {{ option.label }}
        </option>
      </select>
    </span>

  </label>
</template>

<style scoped>
.sort-control {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.sort-label {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  white-space: nowrap;
}

/* The chevron is drawn with a mask so it can use the theme colour */
.select-wrap {
  position: relative;
  display: inline-flex;
}

.select-wrap::after {
  position: absolute;
  top: 50%;
  right: var(--space-4);
  width: 14px;
  height: 14px;
  background: var(--color-primary);
  content: '';
  pointer-events: none;
  transform: translateY(-50%);
  mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E") center / contain no-repeat;
  -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E") center / contain no-repeat;
}

.sort-control select {
  box-sizing: border-box;
  height: 40px;
  min-width: 200px;
  padding: 0 40px 0 var(--space-4);
  border: var(--border-width-field) solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-text);
  font: inherit;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  appearance: none;
  cursor: pointer;
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}

.sort-control select:hover {
  border-color: var(--color-text-muted);
}

.sort-control select:focus {
  outline: none;
  border-color: var(--color-focus);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-focus-outline) 40%, transparent);
}

@media (max-width: 560px) {
  .sort-control select {
    min-width: 0;
  }
}
</style>
