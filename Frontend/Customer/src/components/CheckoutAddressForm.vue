<script setup>
/*
 * One address form for the checkout page.
 *
 *   mode="delivery"  guest delivery details (contact + address + district/area)
 *   mode="billing"   billing address (name, phone, address, country)
 *
 * `details` is the reactive object from the checkout page
 * (guestDetails or the billing details). The fields are edited in place,
 * so the page's existing watchers, quote and validation keep working.
 */
const props = defineProps({
  details: { type: Object, required: true },
  mode: { type: String, default: 'delivery' },
  districts: { type: Array, default: () => [] },
  areas: { type: Array, default: () => [] }
})

const isDelivery = props.mode === 'delivery'

// Browsers use "billing ..." tokens to autofill the right saved address.
const ac = token => (isDelivery ? token : `billing ${token}`)
</script>

<template>
  <div class="checkout-address-form">

    <!-- Contact -->
    <fieldset class="group">
      <legend class="group-title">
        {{ isDelivery ? 'Contact information' : 'Billing contact' }}
      </legend>

      <div class="grid">

        <label class="field span-3">
          <span class="label">Full name <b class="req">*</b></span>
          <input
            v-model="details.recipient_name"
            type="text"
            maxlength="150"
            :autocomplete="ac('name')"
            :placeholder="isDelivery ? 'Your full name' : 'Name on the invoice'"
          />
        </label>

        <label class="field span-3">
          <span class="label">Phone number <b class="req">*</b></span>
          <input
            v-model="details.phone"
            type="tel"
            inputmode="tel"
            maxlength="30"
            :autocomplete="ac('tel')"
            placeholder="e.g. 0771234567"
          />
          <small v-if="isDelivery" class="hint">The courier may call this number.</small>
        </label>

        <label v-if="isDelivery" class="field span-6">
          <span class="label">Email address <b class="req">*</b></span>
          <input
            v-model="details.customer_email"
            type="email"
            inputmode="email"
            maxlength="255"
            autocomplete="email"
            placeholder="you@example.com"
          />
          <small class="hint">We will send your order updates to this email.</small>
        </label>

      </div>
    </fieldset>

    <!-- Address -->
    <fieldset class="group">
      <legend class="group-title">
        {{ isDelivery ? 'Delivery address' : 'Billing address' }}
      </legend>

      <div class="grid">

        <label class="field span-6">
          <span class="label">Address line 1 <b class="req">*</b></span>
          <input
            v-model="details.address_line_1"
            type="text"
            maxlength="255"
            :autocomplete="ac('address-line1')"
            placeholder="House number, street name"
          />
        </label>

        <label class="field span-6">
          <span class="label">Address line 2 <em class="optional">(optional)</em></span>
          <input
            v-model="details.address_line_2"
            type="text"
            maxlength="255"
            :autocomplete="ac('address-line2')"
            placeholder="Apartment, building, landmark"
          />
        </label>

        <label class="field span-2">
          <span class="label">City <b class="req">*</b></span>
          <input
            v-model="details.city"
            type="text"
            maxlength="100"
            :autocomplete="ac('address-level2')"
            placeholder="City"
          />
        </label>

        <label class="field span-2">
          <span class="label">Province <em class="optional">(optional)</em></span>
          <input
            v-model="details.state"
            type="text"
            maxlength="100"
            :autocomplete="ac('address-level1')"
            placeholder="Province"
          />
        </label>

        <label class="field span-2 postal">
          <span class="label">Postal code <em class="optional">(optional)</em></span>
          <input
            v-model="details.postal_code"
            type="text"
            inputmode="numeric"
            maxlength="20"
            :autocomplete="ac('postal-code')"
            placeholder="Postal code"
          />
        </label>

        <!-- Delivery only: the area decides the delivery charge -->
        <template v-if="isDelivery">

          <label class="field span-3">
            <span class="label">District <b class="req">*</b></span>
            <select v-model="details.district_id">
              <option value="">Select district</option>
              <option
                v-for="district in districts"
                :key="district.id"
                :value="String(district.id)"
              >
                {{ district.district_name }}
              </option>
            </select>
          </label>

          <label class="field span-3">
            <span class="label">Delivery area <b class="req">*</b></span>
            <select
              v-model="details.area_id"
              :disabled="!details.district_id || !areas.length"
            >
              <option value="">
                {{ details.district_id ? 'Select delivery area' : 'Select a district first' }}
              </option>
              <option
                v-for="area in areas"
                :key="area.id"
                :value="String(area.id)"
              >
                {{ area.area_name }}
              </option>
            </select>
            <small class="hint">Your delivery charge is worked out from this area.</small>
          </label>

        </template>

        <!-- Billing only -->
        <label v-else class="field span-6">
          <span class="label">Country <b class="req">*</b></span>
          <input
            v-model="details.country"
            type="text"
            maxlength="100"
            autocomplete="billing country-name"
          />
        </label>

      </div>

      <p v-if="isDelivery" class="country-note">
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z"
            stroke="currentColor"
            stroke-width="1.7"
            stroke-linejoin="round"
          />
          <circle cx="12" cy="10" r="2.3" stroke="currentColor" stroke-width="1.7" />
        </svg>
        Delivering within Sri Lanka
      </p>
    </fieldset>

  </div>
</template>

<style scoped>
.checkout-address-form {
  display: grid;
  gap: var(--space-6);
}

/* ---------- Groups ---------- */

.group {
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}

.group-title {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  width: 100%;
  margin: 0 0 var(--space-4);
  padding: 0;
  color: var(--color-primary);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-bold);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

/* A fine rule that runs to the end of the heading */
.group-title::after {
  flex: 1;
  height: 1px;
  background: var(--color-border-soft);
  content: '';
}

/* ---------- Grid: six columns, fields span 2, 3 or 6 ---------- */

.grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: var(--space-4);
}

.span-2 { grid-column: span 2; }
.span-3 { grid-column: span 3; }
.span-6 { grid-column: span 6; }

/* ---------- Fields ---------- */

.field {
  display: flex;
  flex-direction: column;
  gap: 7px;
  min-width: 0;
  margin: 0;
}

.label {
  color: var(--color-text);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  line-height: 1.4;
}

.req {
  color: var(--color-danger);
  font-weight: var(--font-weight-bold);
}

.optional {
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
  font-style: normal;
  font-weight: var(--font-weight-normal);
}

.field input,
.field select {
  display: block;
  width: 100%;
  min-width: 0;
  min-height: 46px;
  box-sizing: border-box;
  padding: 10px 14px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-text);
  font: inherit;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-normal);
  line-height: 1.4;
  transition:
    border-color var(--transition-fast),
    box-shadow var(--transition-fast),
    background var(--transition-fast);
}

.field input::placeholder {
  color: var(--color-text-muted);
  opacity: 0.8;
}

@media (hover: hover) {
  .field input:hover:not(:disabled):not(:focus),
  .field select:hover:not(:disabled):not(:focus) {
    border-color: var(--color-text-muted);
  }
}

.field input:focus,
.field select:focus {
  outline: 0;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 18%, transparent);
}

/* Only shows after the customer has typed in or left the field */
.field input:user-invalid,
.field select:user-invalid {
  border-color: var(--color-danger);
}

/* Browser autofill keeps the card's look */
.field input:-webkit-autofill {
  -webkit-box-shadow: 0 0 0 100px var(--color-surface) inset;
  -webkit-text-fill-color: var(--color-text);
}

/* ---------- Selects ---------- */

.field select {
  padding-right: 40px;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23697386' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 14px center;
  background-size: 16px;
  cursor: pointer;
}

.field select:disabled {
  background-color: var(--color-surface-muted);
  color: var(--color-text-muted);
  cursor: not-allowed;
}

.hint {
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
  line-height: 1.5;
}

/* ---------- Country note ---------- */

.country-note {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin: var(--space-4) 0 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
}

.country-note svg {
  width: 15px;
  height: 15px;
  color: var(--color-primary);
}

/* ---------- Responsive ---------- */

@media (max-width: 760px) {
  .span-2 {
    grid-column: span 3;
  }

  /* Postal code takes a full row when three fields no longer fit */
  .postal {
    grid-column: span 6;
  }
}

@media (max-width: 560px) {
  .grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .span-2,
  .span-3,
  .span-6,
  .postal {
    grid-column: auto;
  }

  /* 16px stops iOS Safari from zooming the page on focus */
  .field input,
  .field select {
    font-size: 16px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .field input,
  .field select {
    transition: none;
  }
}
</style>