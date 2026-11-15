<script setup>
import CategoryProductRail from './CategoryProductRail.vue'

defineProps({
  // Root categories to show a rail for
  categories: { type: Array, default: () => [] },
  // Flat list of every category (roots + children)
  allCategories: { type: Array, default: () => [] },
  // Safety cap so the homepage doesn't render dozens of rails
  max: { type: Number, default: 8 },
})

defineEmits(['select-category'])
</script>

<template>
  <div class="category-rails">
    <CategoryProductRail
      v-for="category in categories.slice(0, max)"
      :key="category.id"
      :category="category"
      :all-categories="allCategories"
      @select-category="$emit('select-category', $event)"
    />
  </div>
</template>