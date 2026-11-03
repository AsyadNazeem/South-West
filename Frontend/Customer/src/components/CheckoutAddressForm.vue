<script setup>
import { computed, reactive } from 'vue'
import SearchableSelect from './SearchableSelect.vue'

const props = defineProps({
  mode: { type: String, default: 'delivery' }, // 'delivery' | 'billing'
  details: { type: Object, required: true },
  districts: { type: Array, default: () => [] },
  areas: { type: Array, default: () => [] },
})

const isBilling = computed(() => props.mode === 'billing')
const touched = reactive({})
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Adjust these keys if your districts/areas API uses different field names
const optionLabel = option =>
  option.name || option.district_name || option.area_name || String(option.id)

const sections = computed(() => {
  const billing = isBilling.value
  const hasDistrict = Boolean(props.details.district_id)

  const name = {
    key: 'recipient_name',
    label: billing ? 'Full name' : 'Recipient name',
    autocomplete: 'name',
    placeholder: 'e.g. Nimal Perera',
    required: true,
    wide: !billing,
  }
  const email = {
    key: 'customer_email',
    label: 'Email address',
    type: 'email',
    inputmode: 'email',
    autocomplete: 'email',
    placeholder: 'you@example.com',
    required: true,
    help: 'Order updates will be sent here.',
  }
  const phone = {
    key: 'phone',
    label: 'Phone number',
    type: 'tel',
    inputmode: 'tel',
    autocomplete: 'tel',
    placeholder: '07X XXX XXXX',
    required: true,
    help: billing ? '' : 'The courier may call this number.',
  }
  const line1 = {
    key: 'address_line_1',
    label: 'Address line 1',
    autocomplete: 'address-line1',
    placeholder: 'House / apartment number and street',
    required: true,
    wide: true,
  }
  const line2 = {
    key: 'address_line_2',
    label: 'Address line 2',
    autocomplete: 'address-line2',
    placeholder: 'Landmark, building or floor',
    wide: true,
  }
  const district = {
    key: 'district_id',
    label: 'District',
    type: 'select',
    required: true,
    options: props.districts,
    placeholder: 'Search or select district',
    emptyText: 'No districts found',
  }
  const area = {
    key: 'area_id',
    label: 'Delivery area',
    type: 'select',
    required: true,
    options: props.areas,
    disabled: !hasDistrict,
    placeholder: hasDistrict ? 'Search or select area' : 'Select a district first',
    emptyText: 'No areas available for this district',
    help: 'Your delivery charge is based on district and area.',
  }
  const city = {
    key: 'city',
    label: 'City / Town',
    autocomplete: 'address-level2',
    required: true,
  }
  const postal = {
    key: 'postal_code',
    label: 'Postal code',
    autocomplete: 'postal-code',
  }
  const state = {
    key: 'state',
    label: 'Province',
    autocomplete: 'address-level1',
  }
  const country = {
    key: 'country',
    label: 'Country',
    autocomplete: 'country-name',
    required: billing,
    readonly: !billing,
    help: billing ? '' : 'Delivery is available within Sri Lanka.',
  }

  return billing
    ? [
        {
          id: 'billing',
          fields: [name, phone, line1, line2, city, postal, state, country],
        },
      ]
    : [
        { id: 'contact', title: 'Contact details', fields: [name, email, phone] },
        {
          id: 'address',
          title: 'Delivery address',
          fields: [line1, line2, district, area, city, postal, state, country],
        },
      ]
})

const fieldId = field => `${props.mode}-${field.key}`
const messageId = field => `${fieldId(field)}-message`

function autocompleteFor(field) {
  return `${isBilling.value ? 'billing' : 'shipping'} ${field.autocomplete}`
}

function errorFor(field) {
  if (!touched[field.key]) return ''

  const value = String(props.details[field.key] ?? '').trim()

  if (field.required && !value) {
    return field.type === 'select'
      ? `Please select a ${field.label.toLowerCase()}.`
      : `${field.label} is required.`
  }

  if (field.type === 'email' && value && !emailPattern.test(value)) {
    return 'Enter a valid email address.'
  }

  return ''
}

function describedBy(field) {
  return errorFor(field) || field.help ? messageId(field) : undefined
}

function touch(field) {
  touched[field.key] = true
}

function selectOption(field, value) {
  props.details[field.key] = value
  touched[field.key] = true

  // The page's watcher clears the area when the district changes
  if (field.key === 'district_id') touched.area_id = false
}
</script>

<template>
  <div class="checkout-address-form">
    <section
      v-for="section in sections"
      :key="section.id"
      class="form-section"
      :aria-labelledby="section.title ? `${mode}-${section.id}-title` : undefined"
    >
      <h3 v-if="section.title" :id="`${mode}-${section.id}-title`" class="form-section-title">
        {{ section.title }}
      </h3>

      <div class="form-grid">
        <div
          v-for="field in section.fields"
          :key="field.key"
          class="form-field"
          :class="{ 'span-2': field.wide, 'has-error': errorFor(field) }"
        >
          <label :for="fieldId(field)">
            <span class="label-text">{{ field.label }}</span>
            <span v-if="field.required" class="required" aria-hidden="true">*</span>
            <span v-else-if="!field.readonly" class="optional">Optional</span>
          </label>

          <SearchableSelect
            v-if="field.type === 'select'"
            :id="fieldId(field)"
            :model-value="details[field.key]"
            :options="field.options"
            :get-label="optionLabel"
            :placeholder="field.placeholder"
            :empty-text="field.emptyText"
            :disabled="field.disabled"
            :invalid="Boolean(errorFor(field))"
            :describedby="describedBy(field)"
            @update:model-value="selectOption(field, $event)"
            @blur="touch(field)"
          />

          <input
            v-else
            :id="fieldId(field)"
            v-model="details[field.key]"
            :type="field.type || 'text'"
            :inputmode="field.inputmode"
            :autocomplete="autocompleteFor(field)"
            :placeholder="field.placeholder"
            :readonly="field.readonly"
            :aria-required="field.required || undefined"
            :aria-invalid="Boolean(errorFor(field)) || undefined"
            :aria-describedby="describedBy(field)"
            @blur="touch(field)"
          />

          <p v-if="errorFor(field)" :id="messageId(field)" class="field-error" role="alert">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2" />
              <path d="M12 7.5v5.5M12 16.5v.01" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" />
            </svg>
            <span>{{ errorFor(field) }}</span>
          </p>
          <p v-else-if="field.help" :id="messageId(field)" class="field-help">
            {{ field.help }}
          </p>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.checkout-address-form {
  display: grid;
  gap: var(--space-7, calc(var(--space-6) * 1.25));
  width: 100%;
}

/* Sections */
.form-section {
  display: grid;
  gap: var(--space-5);
  min-width: 0;
}

.form-section + .form-section {
  padding-top: var(--space-7, calc(var(--space-6) * 1.25));
  border-top: 1px solid var(--color-border-soft);
}

.form-section-title {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin: 0;
  color: var(--color-text);
  font-family: var(--font-family-display);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-bold);
  line-height: 1.3;
}

.form-section-title::before {
  content: '';
  width: 4px;
  height: 1.1em;
  border-radius: 2px;
  background: var(--color-primary);
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-5) var(--space-4);
}

/* Fields */
.form-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.form-field.span-2 {
  grid-column: 1 / -1;
}

.form-field > label {
  display: flex;
  align-items: baseline;
  gap: 4px;
  color: var(--color-text);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
}

.required {
  color: var(--color-danger);
}

.optional {
  margin-left: auto;
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-normal);
}

.form-field input {
  width: 100%;
  min-width: 0;
  min-height: 48px;
  padding: 11px 14px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-text);
  font: inherit;
  font-weight: var(--font-weight-normal);
  box-sizing: border-box;
  transition:
    border-color var(--transition-fast),
    box-shadow var(--transition-fast),
    background-color var(--transition-fast);
}

.form-field input::placeholder {
  color: var(--color-text-muted);
  opacity: 0.8;
}

@media (hover: hover) {
  .form-field input:hover:not(:focus):not([readonly]) {
    border-color: var(--color-text-muted);
  }
}

.form-field input:focus {
  border-color: var(--color-primary);
  outline: 2px solid transparent; /* keeps a visible ring in forced-colors mode */
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--color-focus-outline) 35%, transparent);
}

.form-field input[readonly] {
  background: var(--color-surface-muted);
  color: var(--color-text-muted);
  cursor: default;
}

.form-field input[readonly]:focus {
  border-color: var(--color-border);
  box-shadow: none;
}

/* Error state */
.form-field.has-error input {
  border-color: var(--color-danger);
  background: color-mix(in srgb, var(--color-danger) 4%, var(--color-surface));
}

.form-field.has-error input:focus {
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--color-danger) 22%, transparent);
}

/* Help + error text */
.field-help,
.field-error {
  margin: 0;
  font-size: var(--font-size-xs);
  line-height: 1.5;
}

.field-help {
  color: var(--color-text-muted);
}

.field-error {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  color: var(--color-danger);
  font-weight: var(--font-weight-medium);
}

.field-error svg {
  flex-shrink: 0;
  width: 14px;
  height: 14px;
  margin-top: 2px;
}

@media (max-width: 640px) {
  .form-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  /* 16px stops iOS zooming into the field on focus */
  .form-field input {
    font-size: 16px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .form-field input {
    transition: none;
  }
}
</style>