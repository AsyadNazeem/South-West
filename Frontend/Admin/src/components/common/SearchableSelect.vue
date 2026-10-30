<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'

/*
 * options: [{ value, label, hint? }]
 * clearLabel: when set, adds a first option with an empty value
 *             (e.g. "Walk-in Customer")
 */
const props = defineProps({
  modelValue: { type: [String, Number], default: '' },
  options: { type: Array, default: () => [] },
  placeholder: { type: String, default: 'Select...' },
  clearLabel: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
  required: { type: Boolean, default: false }
})

const emit = defineEmits(['update:modelValue', 'change'])

const inputRef = ref(null)
const open = ref(false)
const query = ref('')
const highlighted = ref(0)
const listStyle = ref({})

const selected = computed(() =>
    props.options.find(
        option => String(option.value) === String(props.modelValue)
    )
)

const displayValue = computed(() => {
  if (open.value) return query.value

  if (selected.value) return selected.value.label

  // Empty value with a clear option (e.g. walk-in customer)
  if (props.clearLabel && (props.modelValue === '' || props.modelValue === null)) {
    return props.clearLabel
  }

  return ''
})

const filtered = computed(() => {
  const keyword = query.value.trim().toLowerCase()

  if (!keyword) {
    const all = props.clearLabel
        ? [{ value: '', label: props.clearLabel }, ...props.options]
        : props.options

    return all.slice(0, 100)
  }

  return props.options
      .filter(option =>
          [option.label, option.hint].some(value =>
              String(value || '').toLowerCase().includes(keyword)
          )
      )
      .slice(0, 100)
})

// The list is fixed-positioned so scrolling containers (like the items table) don't clip it
const place = () => {
  if (!inputRef.value) return

  const rect = inputRef.value.getBoundingClientRect()

  listStyle.value = {
    top: `${rect.bottom + 4}px`,
    left: `${rect.left}px`,
    width: `${rect.width}px`
  }
}

const openList = () => {
  if (props.disabled || open.value) return

  query.value = ''
  highlighted.value = 0
  place()
  open.value = true
}

const closeList = () => {
  open.value = false
}

const onInput = (event) => {
  query.value = event.target.value
  highlighted.value = 0

  if (!open.value) {
    place()
    open.value = true
  }
}

const choose = (option) => {
  emit('update:modelValue', option.value)
  emit('change', option)

  open.value = false
  inputRef.value?.blur()
}

const onKeydown = (event) => {
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    openList()
    highlighted.value = Math.min(highlighted.value + 1, filtered.value.length - 1)
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    highlighted.value = Math.max(highlighted.value - 1, 0)
  } else if (event.key === 'Enter') {
    if (open.value) {
      event.preventDefault()

      const option = filtered.value[highlighted.value]

      if (option) choose(option)
    }
  } else if (event.key === 'Escape') {
    closeList()
  }
}

const reposition = () => {
  if (open.value) place()
}

watch(open, (isOpen) => {
  if (isOpen) {
    window.addEventListener('scroll', reposition, true)
    window.addEventListener('resize', reposition)
  } else {
    window.removeEventListener('scroll', reposition, true)
    window.removeEventListener('resize', reposition)
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', reposition, true)
  window.removeEventListener('resize', reposition)
})
</script>

<template>
  <div class="searchable-select">

    <input
        ref="inputRef"
        type="text"
        autocomplete="off"
        :value="displayValue"
        :placeholder="placeholder"
        :disabled="disabled"
        :required="required"
        @focus="openList"
        @click="openList"
        @input="onInput"
        @keydown="onKeydown"
        @blur="closeList"
    />

    <span class="chevron">▾</span>

    <ul
        v-if="open"
        class="options"
        :style="listStyle"
        role="listbox"
    >
      <li
          v-for="(option, index) in filtered"
          :key="`${option.value}-${index}`"
          class="option"
          :class="{
            active: index === highlighted,
            selected: String(option.value) === String(modelValue)
          }"
          role="option"
          @mousedown.prevent="choose(option)"
          @mouseenter="highlighted = index"
      >
        <span class="option-label">{{ option.label }}</span>

        <small v-if="option.hint">{{ option.hint }}</small>
      </li>

      <li
          v-if="filtered.length === 0"
          class="no-results"
      >
        No results found
      </li>
    </ul>

  </div>
</template>

<style scoped>
.searchable-select {
  position: relative;
  width: 100%;
}

.searchable-select input {
  width: 100%;
  box-sizing: border-box;
  height: 40px;
  padding: 0 36px 0 var(--spacing-lg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  color: var(--color-text-primary);
  font-family: inherit;
  font-size: var(--font-size-md);
  outline: none;
  cursor: pointer;
  transition: border-color var(--transition-fast),
  box-shadow var(--transition-fast);
}

.searchable-select input::placeholder {
  color: var(--color-text-muted);
}

.searchable-select input:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-light);
  cursor: text;
}

.searchable-select input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.chevron {
  position: absolute;
  top: 50%;
  right: var(--spacing-md);
  transform: translateY(-50%);
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  pointer-events: none;
}

.options {
  position: fixed;
  z-index: 1000;
  max-height: 260px;
  margin: 0;
  padding: var(--spacing-xs, 4px);
  overflow-y: auto;
  list-style: none;
  background: var(--color-surface);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md, 0 8px 24px rgba(0, 0, 0, 0.12));
}

.option {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
  cursor: pointer;
}

.option small {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.option.active {
  background: var(--color-hover-bg);
}

.option.selected .option-label {
  color: var(--color-primary);
  font-weight: var(--font-weight-semibold);
}

.no-results {
  padding: var(--spacing-md);
  text-align: center;
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}
</style>
