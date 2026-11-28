<script setup>
import { computed, onMounted, ref } from 'vue'

const props = defineProps({
  items: {
    type: Array,
    required: true
  },
  settings: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['cancel', 'confirm'])

const dialog = ref(null)
const confirmed = ref(false)

function formatPrice(value) {
  return `Rs. ${Number(value).toLocaleString('en-LK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`
}

const contacts = computed(() =>
  [
    {
      phone: props.settings.primary_phone,
      whatsapp: props.settings.primary_whatsapp
    },
    {
      phone: props.settings.secondary_phone,
      whatsapp: props.settings.secondary_whatsapp
    }
  ].filter(contact => contact.phone)
)

function internationalPhone(phone) {
  const digits = String(phone).replace(/[^\d+]/g, '').replace(/^\+/, '')

  return digits.startsWith('0')
    ? '94' + digits.slice(1)
    : digits
}

function whatsappUrl(phone) {
  const products = props.items.map(item =>
    [
      item.name,
      item.variant,
      `Qty: ${item.quantity}`,
      formatPrice(item.unit_price)
    ].filter(Boolean).join(' | ')
  ).join('\n')

  const message =
    'Hello South West, I would like to confirm stock availability for the following products before placing my order:\n\n' +
    products +
    '\n\nPlease confirm availability. Thank you.'

  return `https://wa.me/${internationalPhone(phone)}?text=${encodeURIComponent(message)}`
}

onMounted(() => dialog.value?.showModal())

// A click on the dimmed backdrop lands on the dialog element itself
function onDialogClick(event) {
  if (event.target === dialog.value) emit('cancel')
}

function confirm() {
  if (confirmed.value) emit('confirm')
}
</script>

<template>
  <Teleport to="body">
    <dialog
      ref="dialog"
      class="stock-dialog"
      aria-labelledby="stock-dialog-title"
      @cancel.prevent="emit('cancel')"
      @click="onDialogClick"
    >
      <div class="dialog-heading">
        <h2 id="stock-dialog-title">Confirm stock availability</h2>

        <button
          type="button"
          class="close-button"
          aria-label="Close"
          @click="emit('cancel')"
        >
          &times;
        </button>
      </div>

      <p class="description">
        Please contact us to confirm stock before ordering products
        priced above {{ formatPrice(settings.threshold) }}.
      </p>

      <ul class="product-list">
        <li v-for="(item, index) in items" :key="index" class="product-row">
          <div class="product-info">
            <strong>{{ item.name }}</strong>
            <span v-if="item.variant">{{ item.variant }}</span>
          </div>

          <span class="product-price">
            {{ formatPrice(item.unit_price) }} &times; {{ item.quantity }}
          </span>
        </li>
      </ul>

      <div class="contact-list">
        <div
          v-for="contact in contacts"
          :key="contact.phone"
          class="contact-row"
        >
          <strong class="contact-number">{{ contact.phone }}</strong>

          <div class="contact-actions">
            <a
              class="call-button"
              :href="'tel:+' + internationalPhone(contact.phone)"
            >
              Call
            </a>

            <a
              v-if="contact.whatsapp"
              class="whatsapp-button"
              :href="whatsappUrl(contact.phone)"
              target="_blank"
              rel="noopener noreferrer"
            >
              WhatsApp
            </a>
          </div>
        </div>
      </div>

      <label class="confirmation-check">
        <input v-model="confirmed" type="checkbox" />
        <span>I have contacted South West and confirmed stock availability.</span>
      </label>

      <div class="dialog-actions">
        <button type="button" class="cancel-button" @click="emit('cancel')">
          Cancel
        </button>

        <button
          type="button"
          class="confirm-button"
          :disabled="!confirmed"
          @click="confirm"
        >
          Confirm &amp; Place Order
        </button>
      </div>
    </dialog>
  </Teleport>
</template>

<style scoped>
.stock-dialog {
  box-sizing: border-box;
  width: min(420px, calc(100% - 32px));
  max-height: calc(100dvh - 32px);
  overflow-y: auto;
  margin: auto;
  padding: 20px;
  background: var(--color-surface, #fff);
  color: var(--color-text, #172033);
  border: 1px solid var(--color-border-soft, #e6eaf0);
  border-radius: 14px;
  box-shadow: 0 16px 48px rgb(0 0 0 / 22%);
  font: inherit;
}

.stock-dialog::backdrop {
  background: rgb(10 18 32 / 55%);
}

.dialog-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}

h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  line-height: 1.3;
}

.close-button {
  width: 36px;
  height: 36px;
  margin-right: -8px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--color-text-muted, #5b6677);
  font-size: 24px;
  line-height: 1;
  cursor: pointer;
}

.close-button:hover {
  color: var(--color-text, #172033);
}

.description {
  margin: 0 0 16px;
  color: var(--color-text-muted, #5b6677);
  font-size: 14px;
  line-height: 1.6;
}

/* Products */
.product-list {
  max-height: 150px;
  margin: 0 0 16px;
  padding: 0;
  overflow-y: auto;
  list-style: none;
  border: 1px solid var(--color-border-soft, #e6eaf0);
  border-radius: 10px;
}

.product-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  font-size: 13px;
}

.product-row + .product-row {
  border-top: 1px solid var(--color-border-soft, #e6eaf0);
}

.product-info {
  display: grid;
  gap: 2px;
  min-width: 0;
  overflow-wrap: anywhere;
}

.product-info span {
  color: var(--color-text-muted, #5b6677);
}

.product-price {
  flex-shrink: 0;
  color: var(--color-primary);
  font-weight: 600;
  white-space: nowrap;
}

/* Contacts */
.contact-list {
  margin-bottom: 16px;
  border: 1px solid var(--color-border-soft, #e6eaf0);
  border-radius: 10px;
}

.contact-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px;
  padding: 10px 12px;
}

.contact-row + .contact-row {
  border-top: 1px solid var(--color-border-soft, #e6eaf0);
}

.contact-number {
  font-size: 16px;
  font-variant-numeric: tabular-nums;
}

.contact-actions {
  display: flex;
  gap: 8px;
}

.contact-actions a {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 36px;
  padding: 0 14px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  text-decoration: none;
}

.call-button {
  border: 1px solid var(--color-primary);
  color: var(--color-primary);
}

.call-button:hover {
  background: var(--color-primary);
  color: var(--color-on-primary, #fff);
}

.whatsapp-button {
  border: 1px solid #168447;
  background: #168447;
  color: #fff;
}

.whatsapp-button:hover {
  background: #11693a;
  border-color: #11693a;
}

/* Confirmation */
.confirmation-check {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-bottom: 16px;
  font-size: 13px;
  line-height: 1.5;
  cursor: pointer;
}

.confirmation-check input {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  margin: 1px 0 0;
  accent-color: var(--color-primary);
}

/* Buttons */
.dialog-actions {
  display: flex;
  gap: 10px;
}

.confirm-button,
.cancel-button {
  min-height: 44px;
  padding: 0 16px;
  border-radius: 8px;
  font: inherit;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.cancel-button {
  flex: 0 0 auto;
  border: 1px solid var(--color-border, #d5dbe3);
  background: transparent;
  color: var(--color-text, #172033);
}

.cancel-button:hover {
  background: var(--color-surface-muted, #f3f5f8);
}

.confirm-button {
  flex: 1;
  border: 1px solid var(--color-primary);
  background: var(--color-primary);
  color: var(--color-on-primary, #fff);
}

.confirm-button:hover:not(:disabled) {
  background: var(--color-primary-hover, var(--color-primary));
}

.confirm-button:disabled {
  opacity: .45;
  cursor: not-allowed;
}

button:focus-visible,
a:focus-visible,
input:focus-visible {
  outline: 2px solid var(--color-focus-outline, var(--color-primary));
  outline-offset: 2px;
}

@media (max-width: 400px) {
  .stock-dialog {
    padding: 16px;
  }

  .dialog-actions {
    flex-direction: column-reverse;
  }

  .cancel-button {
    flex: none;
  }
}
</style>