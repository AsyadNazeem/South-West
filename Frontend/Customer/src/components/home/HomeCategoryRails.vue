<script setup>
import { computed } from 'vue'
import CategoryProductRail from './CategoryProductRail.vue'
import HomePromoBanner from './HomePromoBanner.vue'

const props = defineProps({
  // Root categories to show a rail for
  categories: { type: Array, default: () => [] },
  // Flat list of every category (roots + children)
  allCategories: { type: Array, default: () => [] },
  // Safety cap so the homepage doesn't render dozens of rails
  max: { type: Number, default: 8 },
  promoBanner: { type: Object, default: null },
})

const visibleCategories = computed(() => props.categories.slice(0, props.max))
const promoInsertIndex = computed(() => Math.ceil(visibleCategories.value.length / 2))

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
      <HomePromoBanner
        v-if="promoBanner && index + 1 === promoInsertIndex"
        :banner="promoBanner"
      />
    </template>
  </div>
</template>
