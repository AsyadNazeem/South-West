<script setup>
import { computed } from 'vue'
import {
  getMediaUrl,
  getResponsiveImageSrcSet,
} from '@/utils/mediaUrl'

const props = defineProps({
  banner: {
    type: Object,
    default: null,
  },
})

const hasBanner = computed(() => Boolean(props.banner?.image_url))

const destination = computed(() => {
  const url = props.banner?.link_url
  if (typeof url !== 'string') return null

  const trimmed = url.trim()
  if (!trimmed) return null

  return trimmed.startsWith('/') || /^https?:\/\//i.test(trimmed)
    ? trimmed
    : null
})

const external = computed(() =>
  /^https?:\/\//i.test(destination.value || '')
)

const desktopSrcset = computed(() =>
  getResponsiveImageSrcSet(props.banner?.responsive_images) || undefined
)

const mobileSrcset = computed(() =>
  getResponsiveImageSrcSet(props.banner?.mobile_responsive_images) ||
  (props.banner?.mobile_image_url
    ? getMediaUrl(props.banner.mobile_image_url)
    : undefined)
)
</script>

<template>
  <section
    v-if="hasBanner"
    class="home-promo-banner"
    :aria-label="banner.title || 'Store promotion'"
  >
    <component
      :is="destination ? 'a' : 'div'"
      class="home-promo-banner__link"
      v-bind="destination
        ? {
            href: destination,
            target: external ? '_blank' : undefined,
            rel: external ? 'noopener noreferrer' : undefined,
          }
        : {}"
    >
      <picture>
        <source
          v-if="banner.mobile_image_url"
          :srcset="mobileSrcset"
          media="(max-width: 650px)"
          sizes="100vw"
        />

        <img
          :src="getMediaUrl(banner.image_url)"
          :srcset="desktopSrcset"
          sizes="(min-width: 1532px) 1440px, 94vw"
          :alt="banner.title || 'Store promotion'"
          class="home-promo-banner__image"
          loading="lazy"
          decoding="async"
        />
      </picture>

      <div
        v-if="banner.title || banner.subtitle || (destination && banner.button_text)"
        class="home-promo-banner__content"
      >
        <h2 v-if="banner.title">{{ banner.title }}</h2>
        <p v-if="banner.subtitle">{{ banner.subtitle }}</p>
        <span v-if="destination && banner.button_text" class="home-promo-banner__button">
          {{ banner.button_text }}
        </span>
      </div>
    </component>
  </section>
</template>

<style scoped>
.home-promo-banner {
  width: 100%;
  margin: 24px 0;
}

.home-promo-banner__link {
  position: relative;
  display: block;
  width: 100%;
  overflow: hidden;
  border-radius: 14px;
  background: #e9edf2;
  isolation: isolate;
}

.home-promo-banner__image {
  display: block;
  width: 100%;
  aspect-ratio: 6 / 1;
  object-fit: cover;
}

.home-promo-banner__content {
  position: absolute;
  inset: 0;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  gap: 8px;
  padding: clamp(12px, 3vw, 36px);
  color: #fff;
  background: linear-gradient(
    90deg,
    rgba(0, 0, 0, 0.65),
    rgba(0, 0, 0, 0) 75%
  );
}

.home-promo-banner__content h2 {
  margin: 0;
  font-size: clamp(16px, 2vw, 28px);
  font-weight: 750;
}

.home-promo-banner__content p {
  margin: 0;
  font-size: clamp(12px, 1.2vw, 16px);
}

.home-promo-banner__button {
  display: inline-flex;
  align-items: center;
  margin-top: 4px;
  padding: 7px 14px;
  border-radius: 7px;
  background: #fff;
  color: #111827;
  font-size: 13px;
  font-weight: 700;
}

a.home-promo-banner__link:focus-visible {
  outline: 3px solid #2563eb;
  outline-offset: 3px;
}

@media (max-width: 650px) {
  .home-promo-banner {
    margin: 16px 0;
  }

  .home-promo-banner__image {
    aspect-ratio: 3 / 1;
  }

  .home-promo-banner__content {
    gap: 4px;
    padding: 12px;
  }

  .home-promo-banner__content p {
    display: none;
  }

  .home-promo-banner__button {
    padding: 5px 10px;
    font-size: 11px;
  }
}

@media (prefers-reduced-motion: no-preference) {
  a.home-promo-banner__link:hover .home-promo-banner__image {
    filter: brightness(0.92);
  }
}
</style>
