<script setup>
import { computed } from 'vue'
import CategoryProductRail from './CategoryProductRail.vue'

const props = defineProps({
  // Root categories to show a rail for
  categories: { type: Array, default: () => [] },
  // Flat list of every category (roots + children)
  allCategories: { type: Array, default: () => [] },
  // Safety cap so the homepage doesn't render dozens of rails
  max: { type: Number, default: 8 },
  insertedSections: { type: Array, default: () => [] },
})

const visibleCategories = computed(() => props.categories.slice(0, props.max))
const sectionsAfterRow = row =>
  props.insertedSections.filter(section => {
    const configuredRow = section.settings?.after_category_row
    const lastAvailableRow = visibleCategories.value.length

    if (!lastAvailableRow) return false

    return Math.min(configuredRow, lastAvailableRow) === row
  })

defineEmits(['select-category'])
</script>

<template>
  <div class="category-rails">
    <template v-for="(category, index) in visibleCategories" :key="category.id">
      <CategoryProductRail
        :category="category"
        :all-categories="allCategories"
        @select-category="$emit('select-category', $event)"
      />
      <template
        v-for="section in sectionsAfterRow(index + 1)"
        :key="section.section_key"
      >
        <div
          v-if="[
            'hero_banner',
            'shopping_benefits',
            'just_for_you'
          ].includes(section.section_key)"
          :id="`homepage-insert-${section.section_key}`"
          class="home-insertion-target"
        ></div>
        <slot
          v-else
          name="inserted-section"
          :section="section"
        />
      </template>
    </template>
  </div>
</template>
