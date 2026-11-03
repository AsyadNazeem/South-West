<script setup>
import { computed, nextTick, ref, watch } from 'vue'

const props = defineProps({
  modelValue: { type: [String, Number], default: '' },
  options: { type: Array, default: () => [] },
  id: { type: String, default: '' },
  placeholder: { type: String, default: 'Search or select' },
  emptyText: { type: String, default: 'No results found' },
  disabled: { type: Boolean, default: false },
  invalid: { type: Boolean, default: false },
  describedby: { type: String, default: '' },
  getValue: { type: Function, default: option => option.id },
  getLabel: { type: Function, default: option => option.name ?? String(option.id) },
})

const emit = defineEmits(['update:modelValue', 'blur'])

const listId = `ss-${Math.random().toString(36).slice(2, 8)}`
const listEl = ref(null)
const open = ref(false)
const query = ref('')
const active = ref(-1)

const items = computed(() =>
  props.options.map(option => ({
    value: props.getValue(option),
    label: String(props.getLabel(option)),
  }))
)

const selectedLabel = computed(
  () =>
    items.value.find(item => String(item.value) === String(props.modelValue))
      ?.label || ''
)

const results = computed(() => {
  const q = query.value.trim().toLowerCase()

  if (!q) {
    return items.value.map(item => ({
      ...item,
      before: item.label,
      match: '',
      after: '',
    }))
  }

  return items.value
    .map(item => {
      const index = item.label.toLowerCase().indexOf(q)
      if (index === -1) return null

      return {
        ...item,
        rank: index === 0 ? 0 : 1,
        before: item.label.slice(0, index),
        match: item.label.slice(index, index + q.length),
        after: item.label.slice(index + q.length),
      }
    })
    .filter(Boolean)
    .sort((a, b) => a.rank - b.rank)
})

function isSelected(item) {
  return String(item.value) === String(props.modelValue)
}

function scrollToActive() {
  nextTick(() => {
    listEl.value?.children[active.value]?.scrollIntoView({ block: 'nearest' })
  })
}

function openList() {
  if (props.disabled || open.value) return

  query.value = ''
  open.value = true
  active.value = Math.max(results.value.findIndex(isSelected), 0)
  scrollToActive()
}

function closeList() {
  open.value = false
  query.value = ''
}

function choose(item) {
  emit('update:modelValue', item.value)
  closeList()
}

function onInput(event) {
  const wasOpen = open.value

  if (!wasOpen) openList()

  query.value = wasOpen ? event.target.value : ''
  active.value = 0
}

function onKeydown(event) {
  const count = results.value.length

  if (!open.value) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      openList()
    } else if (
      event.key.length === 1 &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey
    ) {
      event.preventDefault()
      openList()
      query.value = event.key
      active.value = 0
    }
    return
  }

  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    if (!count) return

    const step = event.key === 'ArrowDown' ? 1 : -1
    active.value = (active.value + step + count) % count
    scrollToActive()
  } else if (event.key === 'Enter') {
    event.preventDefault()
    if (results.value[active.value]) choose(results.value[active.value])
  } else if (event.key === 'Escape') {
    event.preventDefault()
    closeList()
  }
}

function onBlur() {
  closeList()
  emit('blur')
}

watch(
  () => props.disabled,
  isDisabled => {
    if (isDisabled) closeList()
  }
)
</script>

<template>
  <div class="ss">
    <input
      :id="id || undefined"
      class="ss-input"
      :class="{ invalid, 'is-open': open }"
      type="text"
      role="combobox"
      autocomplete="off"
      autocapitalize="off"
      spellcheck="false"
      :value="open ? query : selectedLabel"
      :placeholder="open && selectedLabel ? selectedLabel : placeholder"
      :disabled="disabled"
      :aria-expanded="open"
      aria-haspopup="listbox"
      aria-autocomplete="list"
      :aria-controls="listId"
      :aria-activedescendant="open && results.length ? `${listId}-${active}` : undefined"
      :aria-invalid="invalid || undefined"
      :aria-describedby="describedby || undefined"
      @focus="openList"
      @click="openList"
      @input="onInput"
      @keydown="onKeydown"
      @blur="onBlur"
    />

    <svg
      class="ss-chevron"
      :class="{ open }"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="m6 9 6 6 6-6"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>

    <div v-if="open" class="ss-panel" @mousedown.prevent>
      <ul v-if="results.length" :id="listId" ref="listEl" class="ss-list" role="listbox">
        <li
          v-for="(item, index) in results"
          :id="`${listId}-${index}`"
          :key="item.value"
          class="ss-option"
          :class="{ active: index === active, selected: isSelected(item) }"
          role="option"
          :aria-selected="isSelected(item)"
          @mousemove="active = index"
          @click="choose(item)"
        >
          <span class="ss-label">{{ item.before }}<mark v-if="item.match">{{ item.match }}</mark>{{ item.after }}</span>

          <svg v-if="isSelected(item)" class="ss-check" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="m5 12.5 4.5 4.5L19 7.5"
              stroke="currentColor"
              stroke-width="2.4"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </li>
      </ul>

      <div v-else class="ss-empty">
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="11" cy="11" r="6.5" stroke="currentColor" stroke-width="1.8" />
          <path d="m16 16 4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
        </svg>
        <p>{{ emptyText }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ss {
  position: relative;
}

/* Input */
.ss-input {
  width: 100%;
  min-height: 48px;
  padding: 11px 44px 11px 14px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-text);
  font: inherit;
  font-weight: var(--font-weight-normal);
  text-overflow: ellipsis;
  box-sizing: border-box;
  cursor: pointer;
  transition:
    border-color var(--transition-fast),
    box-shadow var(--transition-fast),
    background-color var(--transition-fast);
}

.ss-input::placeholder {
  color: var(--color-text-muted);
}

@media (hover: hover) {
  .ss-input:hover:not(:focus):not(:disabled) {
    border-color: var(--color-text-muted);
  }
}

.ss-input:focus {
  border-color: var(--color-primary);
  outline: 2px solid transparent; /* keeps a visible ring in forced-colors mode */
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--color-focus-outline) 35%, transparent);
  cursor: text;
}

.ss-input.invalid {
  border-color: var(--color-danger);
}

.ss-input.invalid:focus {
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--color-danger) 22%, transparent);
}

.ss-input:disabled {
  background: var(--color-surface-muted);
  cursor: not-allowed;
  opacity: 0.6;
}

/* Chevron */
.ss-chevron {
  position: absolute;
  top: 50%;
  right: 14px;
  width: 18px;
  height: 18px;
  color: var(--color-text-muted);
  pointer-events: none;
  transform: translateY(-50%);
  transition: transform var(--transition-fast), color var(--transition-fast);
}

.ss-input:focus ~ .ss-chevron {
  color: var(--color-primary);
}

.ss-chevron.open {
  transform: translateY(-50%) rotate(180deg);
}

/* Dropdown panel */
.ss-panel {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  left: 0;
  z-index: 20;
  overflow: hidden;
  border: 1px solid var(--color-border-soft, var(--color-border));
  border-radius: var(--radius-md);
  background: var(--color-surface);
  box-shadow:
    0 2px 6px rgb(0 0 0 / 6%),
    0 16px 36px rgb(0 0 0 / 14%);
  transform-origin: top center;
  animation: ss-pop 140ms ease-out;
}

@keyframes ss-pop {
  from {
    opacity: 0;
    transform: translateY(-4px) scale(0.99);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

.ss-list {
  max-height: 264px;
  margin: 0;
  padding: 6px;
  overflow-y: auto;
  overscroll-behavior: contain;
  list-style: none;
  scrollbar-width: thin;
  scrollbar-color: var(--color-border) transparent;
}

/* Options */
.ss-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  min-height: 42px;
  padding: 9px 12px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: var(--font-size-sm);
  line-height: 1.35;
  transition: background-color 80ms ease;
}

.ss-option + .ss-option {
  margin-top: 2px;
}

.ss-option.active {
  background: var(--color-surface-muted);
}

.ss-option.selected {
  background: color-mix(in srgb, var(--color-primary) 9%, transparent);
  color: var(--color-primary);
  font-weight: var(--font-weight-semibold);
}

.ss-option.selected.active {
  background: color-mix(in srgb, var(--color-primary) 14%, transparent);
}

.ss-label {
  min-width: 0;
  overflow-wrap: anywhere;
}

.ss-option mark {
  padding: 0 1px;
  border-radius: 3px;
  background: color-mix(in srgb, var(--color-primary) 18%, transparent);
  color: inherit;
  font-weight: var(--font-weight-bold);
}

.ss-check {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

/* Empty state */
.ss-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  padding: 20px 12px;
  color: var(--color-text-muted);
  text-align: center;
}

.ss-empty svg {
  width: 22px;
  height: 22px;
  opacity: 0.7;
}

.ss-empty p {
  margin: 0;
  font-size: var(--font-size-sm);
}

@media (max-width: 640px) {
  /* 16px stops iOS zooming into the field on focus */
  .ss-input {
    font-size: 16px;
  }

  .ss-option {
    min-height: 46px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .ss-input,
  .ss-chevron,
  .ss-option {
    transition: none;
  }

  .ss-panel {
    animation: none;
  }
}
</style>