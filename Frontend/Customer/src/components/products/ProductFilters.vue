<script setup>
import { computed, reactive } from 'vue'

const filters = defineModel('filters', {
  default: () => ({
    minPrice: 0,
    maxPrice: 100000,
    minRating: 0,
    brands: [],
    warranties: [],
    colors: [],
    inStock: false,
  }),
})

const props = defineProps({
  minAvailablePrice: { type: Number, default: 0 },
  maxAvailablePrice: { type: Number, default: 100000 },
  brands: { type: Array, default: () => [] },
  warrantyOptions: { type: Array, default: () => [] },
  colors: { type: Array, default: () => [] },
})

const emit = defineEmits(['apply', 'reset'])

// Long lists show this many items until "View more" is pressed.
const PREVIEW_COUNT = 5
const expanded = reactive({})

const ratings = [5, 4, 3, 2, 1]

const priceMin = computed(() => Number(props.minAvailablePrice))
const priceMax = computed(() => Math.max(Number(props.maxAvailablePrice), priceMin.value + 1))

const minPrice = computed(() => Number(filters.value.minPrice ?? priceMin.value))
const maxPrice = computed(() => Number(filters.value.maxPrice ?? priceMax.value))

const lowerPercent = computed(() =>
    ((minPrice.value - priceMin.value) / (priceMax.value - priceMin.value)) * 100,
)
const upperPercent = computed(() =>
    ((maxPrice.value - priceMin.value) / (priceMax.value - priceMin.value)) * 100,
)

function visibleItems(key, items) {
  return expanded[key] ? items : items.slice(0, PREVIEW_COUNT)
}

function hasMore(items) {
  return items.length > PREVIEW_COUNT
}

function toggleExpanded(key) {
  expanded[key] = !expanded[key]
}

function isSelected(key, value) {
  return (filters.value[key] || []).includes(value)
}

function toggleOption(key, value) {
  const current = filters.value[key] || []
  filters.value[key] = current.includes(value)
      ? current.filter(item => item !== value)
      : [...current, value]
}

function updateMinPrice(value) {
  filters.value.minPrice = Math.min(Number(value), maxPrice.value)
}

function updateMaxPrice(value) {
  filters.value.maxPrice = Math.max(Number(value), minPrice.value)
}

function selectRating(rating) {
  // Choosing the active rating again clears it.
  filters.value.minRating = Number(filters.value.minRating) === rating ? 0 : rating
}

function clearFilters() {
  filters.value.minPrice = priceMin.value
  filters.value.maxPrice = priceMax.value
  filters.value.minRating = 0
  filters.value.brands = []
  filters.value.warranties = []
  filters.value.colors = []
  filters.value.inStock = false
  emit('reset')
}

function formatPrice(value) {
  return Number(value).toLocaleString('en-LK', { maximumFractionDigits: 0 })
}
</script>

<template>
  <aside class="filters">
    <div class="filters-head">
      <h2>Filters</h2>
      <button type="button" class="text-link" @click="clearFilters">Clear all</button>
    </div>

    <!-- Price -->
    <section class="group">
      <h3>Price</h3>

      <p class="range-values">
        Rs. {{ formatPrice(minPrice) }} – Rs. {{ formatPrice(maxPrice) }}
      </p>

      <div
          class="range-track"
          :style="{
            '--range-start': `${lowerPercent}%`,
            '--range-end': `${upperPercent}%`,
          }"
      >
        <input
            class="range-input"
            type="range"
            :min="priceMin"
            :max="priceMax"
            :step="100"
            :value="minPrice"
            aria-label="Minimum price"
            @input="updateMinPrice($event.target.value)"
        />
        <input
            class="range-input"
            type="range"
            :min="priceMin"
            :max="priceMax"
            :step="100"
            :value="maxPrice"
            aria-label="Maximum price"
            @input="updateMaxPrice($event.target.value)"
        />
      </div>

      <button type="button" class="text-link apply" @click="emit('apply')">
        Apply price
      </button>
    </section>

    <!-- Rating -->
    <section class="group">
      <h3>Customer rating</h3>
      <ul class="options">
        <li v-for="rating in ratings" :key="rating">
          <label class="option" :class="{ selected: Number(filters.minRating) === rating }">
            <input
                type="radio"
                name="minimum-rating"
                :checked="Number(filters.minRating) === rating"
                @click="selectRating(rating)"
            />
            <span class="stars" aria-hidden="true">
              {{ '★'.repeat(rating) }}{{ '☆'.repeat(5 - rating) }}
            </span>
            <span>& up</span>
          </label>
        </li>
      </ul>
    </section>

    <!-- Brand -->
    <section v-if="brands.length" class="group">
      <h3>Brand</h3>
      <ul class="options">
        <li v-for="brand in visibleItems('brands', brands)" :key="brand.id ?? brand">
          <label class="option" :class="{ selected: isSelected('brands', brand) }">
            <input
                type="checkbox"
                :checked="isSelected('brands', brand)"
                @change="toggleOption('brands', brand)"
            />
            <span>{{ brand.name ?? brand }}</span>
          </label>
        </li>
      </ul>
      <button
          v-if="hasMore(brands)"
          type="button"
          class="view-more"
          @click="toggleExpanded('brands')"
      >
        {{ expanded.brands ? 'View less' : 'View more' }}
      </button>
    </section>

    <!-- Warranty -->
    <section v-if="warrantyOptions.length" class="group">
      <h3>Warranty</h3>
      <ul class="options">
        <li v-for="warranty in visibleItems('warranties', warrantyOptions)" :key="warranty.id ?? warranty">
          <label class="option" :class="{ selected: isSelected('warranties', warranty) }">
            <input
                type="checkbox"
                :checked="isSelected('warranties', warranty)"
                @change="toggleOption('warranties', warranty)"
            />
            <span>{{ warranty.name ?? warranty }}</span>
          </label>
        </li>
      </ul>
      <button
          v-if="hasMore(warrantyOptions)"
          type="button"
          class="view-more"
          @click="toggleExpanded('warranties')"
      >
        {{ expanded.warranties ? 'View less' : 'View more' }}
      </button>
    </section>

    <!-- Colour -->
    <section v-if="colors.length" class="group">
      <h3>Colour</h3>
      <ul class="options">
        <li v-for="color in visibleItems('colors', colors)" :key="color.id ?? color.name ?? color">
          <label class="option" :class="{ selected: isSelected('colors', color) }">
            <input
                type="checkbox"
                :checked="isSelected('colors', color)"
                @change="toggleOption('colors', color)"
            />
            <span
                class="swatch"
                :style="{ backgroundColor: color.hex ?? 'transparent' }"
                aria-hidden="true"
            />
            <span>{{ color.name ?? color }}</span>
          </label>
        </li>
      </ul>
      <button
          v-if="hasMore(colors)"
          type="button"
          class="view-more"
          @click="toggleExpanded('colors')"
      >
        {{ expanded.colors ? 'View less' : 'View more' }}
      </button>
    </section>

    <!-- Availability -->
    <section class="group">
      <h3>Availability</h3>
      <ul class="options">
        <li>
          <label class="option" :class="{ selected: filters.inStock }">
            <input v-model="filters.inStock" type="checkbox" />
            <span>In stock only</span>
          </label>
        </li>
      </ul>
    </section>
  </aside>
</template>

<style scoped>
/* No container: the filters sit directly on the page background. */
.filters {
  width: 100%;
  padding: 0;
  border: 0;
  background: none;
  box-shadow: none;
  color: var(--color-text);
}

.filters-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding-bottom: var(--space-4);
}

.filters-head h2 {
  margin: 0;
  color: var(--color-primary);
  font-family: var(--font-family-display);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-bold);
}

/* Sections are separated by a thin line, like the reference */
.group {
  padding: var(--space-5) 0;
  border-top: 1px solid var(--color-border-soft);
}

.group h3 {
  margin: 0 0 var(--space-3);
  color: var(--color-primary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
}

.options {
  display: grid;
  gap: 2px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.option {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: 4px 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
  line-height: var(--line-height-base);
  cursor: pointer;
}

.option.selected {
  color: var(--color-text);
  font-weight: var(--font-weight-medium);
}

.option input {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  margin: 0;
  accent-color: var(--color-primary);
  cursor: pointer;
}

.stars {
  color: var(--color-primary);
  letter-spacing: 1px;
  white-space: nowrap;
}

.swatch {
  width: 12px;
  height: 12px;
  flex-shrink: 0;
  border: 1px solid var(--color-border);
  border-radius: 50%;
}

.view-more {
  margin-top: var(--space-2);
  padding: 0;
  border: 0;
  background: none;
  color: var(--color-accent-deep);
  font: inherit;
  font-size: 11px;
  font-weight: var(--font-weight-semibold);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  cursor: pointer;
}

.text-link {
  padding: 0;
  border: 0;
  background: none;
  color: var(--color-primary);
  font: inherit;
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
}

.apply {
  display: block;
  margin-top: var(--space-4);
}

/* Price range */
.range-values {
  margin: 0 0 var(--space-4);
  color: var(--color-text);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
}

.range-track {
  position: relative;
  height: 2px;
  margin: 8px 6px;
  background: linear-gradient(
      to right,
      var(--color-border) 0%,
      var(--color-border) var(--range-start),
      var(--color-primary) var(--range-start),
      var(--color-primary) var(--range-end),
      var(--color-border) var(--range-end),
      var(--color-border) 100%
  );
}

.range-input {
  position: absolute;
  top: -8px;
  left: -6px;
  width: calc(100% + 12px);
  height: 18px;
  margin: 0;
  appearance: none;
  background: none;
  pointer-events: none;
}

.range-input::-webkit-slider-thumb {
  width: 14px;
  height: 14px;
  appearance: none;
  border: 0;
  border-radius: 50%;
  background: var(--color-primary);
  cursor: pointer;
  pointer-events: auto;
}

.range-input::-moz-range-thumb {
  width: 14px;
  height: 14px;
  border: 0;
  border-radius: 50%;
  background: var(--color-primary);
  cursor: pointer;
  pointer-events: auto;
}

.option input:focus-visible,
.view-more:focus-visible,
.text-link:focus-visible,
.range-input:focus-visible {
  outline: 2px solid var(--color-focus-outline);
  outline-offset: 2px;
}
</style>
