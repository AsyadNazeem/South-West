<script setup>
import { computed } from 'vue'

/*
 * choices: [{ key, name, specs: [{ label, value }], options: [{ inStock }] }]
 * colors:  [{ name, hex, available }]
 */
const props = defineProps({
  label: { type: String, default: 'Choose variant' },
  choices: { type: Array, default: () => [] },
  showChoices: { type: Boolean, default: true },
  selectedKey: { type: String, default: '' },
  selectedName: { type: String, default: '' },
  colors: { type: Array, default: () => [] },
  selectedColor: { type: String, default: '' },
  swatchStyle: { type: Function, default: () => ({}) }
})

const emit = defineEmits(['select-choice', 'select-color'])

const isChoiceAvailable = choice =>
  choice.options.some(option => option.inStock)

const choiceCaption = choice =>
  choice.specs.map(spec => spec.label).join(' · ')

const isColorSelected = color =>
  props.selectedColor.toLowerCase() === color.name.toLowerCase()

const hasChoices = computed(() => props.showChoices && props.choices.length > 0)
</script>

<template>
  <div class="variant-selector">

    <!-- Step 1: specification / length -->
    <fieldset v-if="hasChoices" class="vs-group">

      <legend class="vs-legend">
        <span class="vs-legend-title">{{ label }}</span>
        <span v-if="selectedName" class="vs-legend-value">{{ selectedName }}</span>
      </legend>

      <div class="vs-choices">

        <button
          v-for="choice in choices"
          :key="choice.key"
          type="button"
          class="vs-choice"
          :class="{
            selected: selectedKey === choice.key,
            unavailable: !isChoiceAvailable(choice)
          }"
          :disabled="!isChoiceAvailable(choice)"
          :aria-pressed="selectedKey === choice.key"
          @click="emit('select-choice', choice.key)"
        >

          <span class="vs-check" aria-hidden="true">
            <svg viewBox="0 0 16 16">
              <path d="M3.5 8.5l3 3 6-6.5" />
            </svg>
          </span>

          <span class="vs-choice-title">{{ choice.name }}</span>

          <span v-if="choiceCaption(choice)" class="vs-choice-caption">
            {{ choiceCaption(choice) }}
          </span>

          <span v-if="!isChoiceAvailable(choice)" class="vs-choice-stock">
            Out of stock
          </span>

        </button>

      </div>

    </fieldset>

    <!-- Step 2: colour -->
    <fieldset v-if="colors.length" class="vs-group">

      <legend class="vs-legend">
        <span class="vs-legend-title">Colour</span>
        <span v-if="selectedColor" class="vs-legend-value">{{ selectedColor }}</span>
      </legend>

      <div class="vs-swatches">

        <button
          v-for="color in colors"
          :key="color.name"
          type="button"
          class="vs-swatch"
          :class="{
            selected: isColorSelected(color),
            unavailable: !color.available
          }"
          :disabled="!color.available"
          :aria-pressed="isColorSelected(color)"
          :aria-label="color.name + (!color.available ? ', unavailable for this option' : '')"
          :title="color.name + (!color.available ? ' - unavailable for this option' : '')"
          @click="emit('select-color', color)"
        >
          <span class="vs-swatch-circle" :style="swatchStyle(color)"></span>
          <span class="vs-swatch-name">{{ color.name }}</span>
        </button>

      </div>

    </fieldset>

  </div>
</template>

<style scoped>
.variant-selector {
  display: grid;
  gap: 22px;
  margin: 22px 0;
}

.vs-group {
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}

/* Legend */

.vs-legend {
  display: flex;
  align-items: baseline;
  gap: 10px;
  padding: 0;
  margin-bottom: 12px;
}

.vs-legend-title {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--color-text, #172033);
}

.vs-legend-value {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-primary, #1f4a8a);
  font-variant-numeric: tabular-nums;
}

/* Specification / length cards */

.vs-choices {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(124px, 1fr));
  gap: 10px;
}

.vs-choice {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  min-height: 72px;
  padding: 14px 16px;
  border: 1px solid var(--color-border-soft, #d8dee8);
  border-radius: 10px;
  background: var(--color-surface, #fff);
  color: var(--color-text, #172033);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    background 0.15s ease,
    box-shadow 0.15s ease;
}

@media (hover: hover) {
  .vs-choice:hover:not(:disabled):not(.selected) {
    border-color: var(--color-text-muted, #8790a0);
  }
}

.vs-choice.selected {
  border-color: var(--color-primary, #1f4a8a);
  background: color-mix(in srgb, var(--color-primary, #1f4a8a) 6%, var(--color-surface, #fff));
  box-shadow: 0 0 0 1px var(--color-primary, #1f4a8a);
}

.vs-choice:focus-visible {
  outline: 2px solid var(--color-primary, #1f4a8a);
  outline-offset: 2px;
}

.vs-choice-title {
  font-size: 17px;
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: -0.01em;
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}

.vs-choice.selected .vs-choice-title {
  color: var(--color-primary, #1f4a8a);
}

.vs-choice-caption {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--color-text-muted, #687386);
}

.vs-choice-stock {
  margin-top: 2px;
  font-size: 11px;
  font-weight: 600;
  color: #b42318;
}

/* Check badge on the selected card */

.vs-check {
  position: absolute;
  top: 8px;
  right: 8px;
  display: grid;
  place-items: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--color-primary, #1f4a8a);
  opacity: 0;
  transform: scale(0.6);
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.vs-check svg {
  width: 12px;
  height: 12px;
  fill: none;
  stroke: #fff;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.vs-choice.selected .vs-check {
  opacity: 1;
  transform: scale(1);
}

.vs-choice.unavailable {
  border-style: dashed;
  background: var(--color-surface-muted, #f8f9fb);
  color: var(--color-text-muted, #8790a0);
  cursor: not-allowed;
}

.vs-choice.unavailable .vs-choice-title {
  text-decoration: line-through;
}

/* Colour swatches */

.vs-swatches {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.vs-swatch {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  min-width: 64px;
  padding: 8px 6px;
  border: 1px solid transparent;
  border-radius: 10px;
  background: transparent;
  color: inherit;
  font: inherit;
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease;
}

.vs-swatch-circle {
  position: relative;
  display: block;
  width: 34px;
  height: 34px;
  overflow: hidden;
  border: 1px solid rgb(0 0 0 / 18%);
  border-radius: 50%;
  box-shadow: inset 0 0 0 2px rgb(255 255 255 / 35%);
  transition: transform 0.15s ease;
}

.vs-swatch-name {
  max-width: 84px;
  font-size: 11px;
  line-height: 1.3;
  text-align: center;
  color: var(--color-text-muted, #687386);
  overflow-wrap: anywhere;
}

@media (hover: hover) {
  .vs-swatch:hover:not(:disabled) .vs-swatch-circle {
    transform: scale(1.08);
  }
}

.vs-swatch.selected {
  border-color: var(--color-primary, #1f4a8a);
  background: color-mix(in srgb, var(--color-primary, #1f4a8a) 6%, var(--color-surface, #fff));
}

.vs-swatch.selected .vs-swatch-name {
  color: var(--color-primary, #1f4a8a);
  font-weight: 700;
}

.vs-swatch:focus-visible {
  outline: 2px solid var(--color-primary, #1f4a8a);
  outline-offset: 2px;
}

.vs-swatch.unavailable {
  cursor: not-allowed;
}

.vs-swatch.unavailable .vs-swatch-circle {
  opacity: 0.45;
}

.vs-swatch.unavailable .vs-swatch-circle::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    to top right,
    transparent calc(50% - 1px),
    rgb(0 0 0 / 55%) 50%,
    transparent calc(50% + 1px)
  );
}

.vs-swatch.unavailable .vs-swatch-name {
  text-decoration: line-through;
}

@media (max-width: 600px) {
  .vs-choices {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (prefers-reduced-motion: reduce) {
  .vs-choice,
  .vs-check,
  .vs-swatch,
  .vs-swatch-circle {
    transition: none;
  }
}
</style>