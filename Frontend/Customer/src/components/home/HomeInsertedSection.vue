<script setup>
import HomeBrand from './HomeBrand.vue'
import HomeCategory from './HomeCategory.vue'
import HomeDiscount from './HomeDiscount.vue'
import HomePromoBanner from './HomePromoBanner.vue'

defineProps({
  sectionKey: { type: String, required: true },
  categories: { type: Array, default: () => [] },
  categoriesLoading: { type: Boolean, default: false },
  products: { type: Array, default: () => [] },
  promoBanner1: { type: Object, default: null },
  promoBanner2: { type: Object, default: null },
})

defineEmits(['select-category'])
</script>

<template>
  <div class="home-inserted-section">
    <HomeCategory
      v-if="sectionKey === 'shop_categories'"
      :categories="categories"
      :loading="categoriesLoading"
      @select-category="$emit('select-category', $event)"
    />

    <HomeBrand
      v-else-if="sectionKey === 'shop_brands'"
    />

    <HomeDiscount
      v-else-if="sectionKey === 'discount_products'"
      :products="products"
      mode="discount"
    />

    <HomeDiscount
      v-else-if="sectionKey === 'top_rated_products'"
      mode="top-rated"
    />

    <HomePromoBanner
      v-else-if="sectionKey === 'promo_banner_1' && promoBanner1"
      :banner="promoBanner1"
    />

    <HomePromoBanner
      v-else-if="sectionKey === 'promo_banner_2' && promoBanner2"
      :banner="promoBanner2"
    />
  </div>
</template>
