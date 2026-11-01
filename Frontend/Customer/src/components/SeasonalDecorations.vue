<script setup>
import { computed } from 'vue'
import { useWebsiteTheme } from '../composables/useWebsiteTheme'

const { themeSlug, decorations, effects } = useWebsiteTheme()

const isChristmas = computed(() => themeSlug.value === 'christmas')
const isRamadan = computed(() => themeSlug.value === 'ramadan')
const isEid = computed(() => themeSlug.value === 'eid')
const isIslamicFestival = computed(() => isRamadan.value || isEid.value)

const showSnowfall = computed(() =>
  isChristmas.value && effects.value.snowfall === true
)

const showGarland = computed(() =>
  isChristmas.value && (decorations.value.trees || decorations.value.bells)
)

const showLanterns = computed(() =>
  isIslamicFestival.value && decorations.value.lanterns
)

const showCrescent = computed(() =>
  isIslamicFestival.value && decorations.value.crescent
)

// The band only takes up space when there is something to draw in it.
const hasArtwork = computed(() =>
  isChristmas.value || showLanterns.value || showCrescent.value
)

const snowflakes = Array.from({ length: 36 }, (_, i) => ({
  id: i,
  left: `${(i * 29 + (i % 3) * 7) % 100}%`,
  delay: `${(i % 12) * -1.7}s`,
  duration: `${11 + (i % 7)}s`,
  size: `${3 + (i % 5)}px`,
  opacity: (0.55 + (i % 4) * 0.12).toFixed(2),
  drift: `${(i % 2 ? 1 : -1) * (10 + (i % 5) * 6)}px`
}))
</script>

<template>
  <div
    v-if="hasArtwork"
    class="seasonal-artwork"
    :class="{
      'seasonal-artwork--christmas': isChristmas,
      'seasonal-artwork--ramadan': isRamadan,
      'seasonal-artwork--eid': isEid
    }"
    aria-hidden="true"
  >

    <!-- ================= Christmas ================= -->

    <!-- Garland: a seamless repeating swag, so it stays crisp on every screen width -->
    <svg
      v-if="showGarland"
      class="festive-garland"
      width="100%"
      height="44"
      focusable="false"
    >
      <defs>
        <radialGradient id="sw-glow">
          <stop offset="0" stop-color="#fff3bd" stop-opacity=".9" />
          <stop offset="1" stop-color="#fff3bd" stop-opacity="0" />
        </radialGradient>

        <!-- Rope -->
        <pattern id="sw-rope" width="240" height="44" patternUnits="userSpaceOnUse">
          <path d="M0 6Q120 56 240 6" fill="none" stroke="#b58a3d" stroke-width="2" transform="translate(0 -4)" />
          <path d="M0 6Q120 56 240 6" fill="none" stroke="#1f6a45" stroke-width="7" />
          <path d="M0 6Q120 56 240 6" fill="none" stroke="#3f9d6b" stroke-width="7" stroke-dasharray="1.5 5" />
          <path d="M0 6Q120 56 240 6" fill="none" stroke="#0e3b28" stroke-width="7" stroke-dasharray="1 9" stroke-dashoffset="3" />
          <path d="M0 6Q120 56 240 6" fill="none" stroke="#d9b66c" stroke-width="1.2" stroke-dasharray="1 7" transform="translate(0 -1)" />
        </pattern>

        <!-- Bows where two swags meet -->
        <pattern id="sw-knots" width="240" height="44" patternUnits="userSpaceOnUse" patternTransform="translate(-120 0)">
          <path d="M120 6C108 -3 105 15 120 6C135 -3 135 15 120 6Z" fill="#b8272f" stroke="#e6c36f" stroke-width="1" />
          <circle cx="120" cy="6" r="3" fill="#d9b66c" stroke="#a97f33" stroke-width=".8" />
        </pattern>

        <!-- Bulbs, in two groups so they can twinkle alternately -->
        <pattern id="sw-lights-a" width="240" height="44" patternUnits="userSpaceOnUse">
          <circle cx="29" cy="24" r="8" fill="url(#sw-glow)" />
          <rect x="27" y="17" width="4" height="3.5" rx="1" fill="#8a6a2a" />
          <circle cx="29" cy="24" r="3.4" fill="#ffd45c" />

          <circle cx="120" cy="38" r="8" fill="url(#sw-glow)" />
          <rect x="118" y="31" width="4" height="3.5" rx="1" fill="#8a6a2a" />
          <circle cx="120" cy="38" r="3.4" fill="#fff0b8" />

          <circle cx="211" cy="24" r="8" fill="url(#sw-glow)" />
          <rect x="209" y="17" width="4" height="3.5" rx="1" fill="#8a6a2a" />
          <circle cx="211" cy="24" r="3.4" fill="#ffd45c" />
        </pattern>

        <pattern id="sw-lights-b" width="240" height="44" patternUnits="userSpaceOnUse">
          <circle cx="72" cy="34" r="8" fill="url(#sw-glow)" />
          <rect x="70" y="27" width="4" height="3.5" rx="1" fill="#8a6a2a" />
          <circle cx="72" cy="34" r="3.4" fill="#ff6a5f" />

          <circle cx="168" cy="34" r="8" fill="url(#sw-glow)" />
          <rect x="166" y="27" width="4" height="3.5" rx="1" fill="#8a6a2a" />
          <circle cx="168" cy="34" r="3.4" fill="#ff6a5f" />
        </pattern>
      </defs>

      <rect width="100%" height="44" fill="url(#sw-rope)" />
      <rect class="lights lights-a" width="100%" height="44" fill="url(#sw-lights-a)" />
      <rect class="lights lights-b" width="100%" height="44" fill="url(#sw-lights-b)" />
      <rect width="100%" height="44" fill="url(#sw-knots)" />
    </svg>

    <!-- Hanging ornaments -->
    <div v-if="isChristmas" class="festive-hangers">

      <div
        v-if="decorations.trees"
        class="hanger"
        style="--x: 8%; --x-sm: 6%; --string: 42px; --w: 44px; --delay: -.7s"
      >
        <span class="hanger-string"></span>
        <svg viewBox="0 0 60 78" class="hanger-art">
          <path d="M30 0V12" stroke="#c9a45e" stroke-width="2"/>
          <path d="M30 12L15 32H23L10 47H24L16 61H44L36 47H50L37 32H45L30 12Z" fill="#17613c" stroke="#d7b66d" stroke-width="1.5"/>
          <path d="M27 61H33V72H27Z" fill="#a16c3b"/>
          <circle cx="30" cy="27" r="2.5" fill="#f1d28a"/>
          <circle cx="22" cy="43" r="2.5" fill="#c94742"/>
          <circle cx="39" cy="49" r="2.5" fill="#f1d28a"/>
          <path d="M30 5L27 10H33Z" fill="#e6c36f"/>
        </svg>
      </div>

      <div
        class="hanger"
        style="--x: 27%; --x-sm: 28%; --string: 46px; --w: 38px; --delay: -2.2s"
      >
        <span class="hanger-string"></span>
        <svg viewBox="0 0 58 78" class="hanger-art">
          <path d="M29 0V17" stroke="#c9a45e" stroke-width="2"/>
          <path d="M20 18Q29 11 38 18" fill="none" stroke="#d7b66d" stroke-width="2"/>
          <path d="M15 27Q29 15 43 27V47Q43 62 29 66Q15 62 15 47Z" fill="#b52e36" stroke="#e6c36f" stroke-width="2"/>
          <path d="M18 34H40M18 49H40" stroke="#e6c36f" stroke-width="2"/>
          <path d="M29 22V61" stroke="#e6c36f" stroke-width="1.5"/>
          <path d="M29 66V72" stroke="#c9a45e" stroke-width="2"/>
        </svg>
      </div>

      <div
        class="hanger"
        style="--x: 50%; --x-sm: 51%; --string: 48px; --w: 38px; --delay: -1.4s"
      >
        <span class="hanger-string"></span>
        <svg viewBox="0 0 58 78" class="hanger-art">
          <path d="M29 0V18" stroke="#c9a45e" stroke-width="2"/>
          <path d="M29 19L34 31L47 32L37 41L40 54L29 47L18 54L21 41L11 32L24 31Z" fill="#e5c36e" stroke="#aa7e36" stroke-width="1.5"/>
          <circle cx="29" cy="36" r="3" fill="#fff0c2"/>
        </svg>
      </div>

      <div
        class="hanger"
        style="--x: 73%; --x-sm: 74%; --string: 42px; --w: 40px; --delay: -3s"
      >
        <span class="hanger-string"></span>
        <svg viewBox="0 0 60 78" class="hanger-art">
          <path d="M30 0V15" stroke="#c9a45e" stroke-width="2"/>
          <path d="M21 20Q30 11 39 20L43 28H17Z" fill="#c93d3d" stroke="#e8c777" stroke-width="1.5"/>
          <path d="M17 28H43L40 51Q30 65 20 51Z" fill="#d6a944" stroke="#9b742d" stroke-width="2"/>
          <path d="M23 35H37M25 43H35" stroke="#fff0c2" stroke-width="2"/>
          <path d="M30 58V66" stroke="#c9a45e" stroke-width="2"/>
        </svg>
      </div>

      <div
        class="hanger"
        style="--x: 92%; --x-sm: 93%; --string: 46px; --w: 36px; --delay: -1.9s"
      >
        <span class="hanger-string"></span>
        <svg viewBox="0 0 58 78" class="hanger-art">
          <path d="M29 0V17" stroke="#c9a45e" stroke-width="2"/>
          <path d="M29 17L34 29L47 30L37 39L40 52L29 45L18 52L21 39L11 30L24 29Z" fill="#d7b15c" stroke="#f6df9c" stroke-width="1.5"/>
        </svg>
      </div>

    </div>

    <!-- Snowfall (falls behind the sticky header, over the page) -->
    <div v-if="showSnowfall" class="seasonal-snowfall">
      <span
        v-for="flake in snowflakes"
        :key="flake.id"
        class="seasonal-snowflake"
        :style="{
          left: flake.left,
          animationDelay: flake.delay,
          animationDuration: flake.duration,
          width: flake.size,
          height: flake.size,
          opacity: flake.opacity,
          '--drift': flake.drift
        }"
      />
    </div>


    <!-- ================= Ramadan / Eid ================= -->

    <!-- Gold rail with small diamonds -->
    <svg
      v-if="showLanterns || showCrescent"
      class="festive-rail"
      width="100%"
      height="16"
      focusable="false"
    >
      <defs>
        <pattern id="rail-pattern" width="28" height="16" patternUnits="userSpaceOnUse">
          <path d="M0 3H28" stroke="#c6a052" stroke-width="1.5" />
          <path d="M14 3L19 8.5L14 14L9 8.5Z" fill="#d9b66b" stroke="#a98535" stroke-width=".8" />
        </pattern>
      </defs>

      <rect width="100%" height="16" fill="url(#rail-pattern)" />
    </svg>

    <div v-if="isIslamicFestival" class="festive-hangers">

      <div
        v-if="showLanterns"
        class="hanger"
        style="--x: 12%; --x-sm: 12%; --string: 24px; --w: 40px; --delay: -1.5s"
      >
        <span class="hanger-string"></span>
        <svg viewBox="0 0 70 112" class="hanger-art lantern-art">
          <path d="M35 0V23" stroke="#c6a052" stroke-width="2"/>
          <path d="M25 24Q35 15 45 24L48 31H22Z" fill="#c6a052"/>
          <path d="M22 31H48L44 43L51 83L35 98L19 83L26 43Z" fill="#0b624b" stroke="#d9b66b" stroke-width="2"/>
          <path class="lantern-lit" d="M26 44H44L40 78L35 87L30 78Z" fill="#f2d68b" opacity=".88"/>
          <path d="M22 53H48M20 78H50" stroke="#e4c273" stroke-width="2"/>
          <path d="M35 98V106" stroke="#c6a052" stroke-width="2"/>
          <path d="M35 106L31 111H39Z" fill="#c6a052"/>
        </svg>
      </div>

      <div
        v-if="showLanterns"
        class="hanger"
        style="--x: 31%; --x-sm: 31%; --string: 30px; --w: 26px; --delay: -2.6s"
      >
        <span class="hanger-string"></span>
        <svg viewBox="0 0 40 44" class="hanger-art">
          <path d="M20 0V16" stroke="#c6a052" stroke-width="2"/>
          <path d="M20 16L22.1 22.9L28.5 19.5L25.1 25.9L32 28L25.1 30.1L28.5 36.5L22.1 33.1L20 40L17.9 33.1L11.5 36.5L14.9 30.1L8 28L14.9 25.9L11.5 19.5L17.9 22.9Z" fill="#e2c272" stroke="#a98535" stroke-width="1"/>
          <circle cx="20" cy="28" r="2.4" fill="#fff0bd"/>
        </svg>
      </div>

      <div
        v-if="showCrescent"
        class="hanger"
        style="--x: 50%; --x-sm: 50%; --string: 20px; --w: 50px; --delay: -3s"
      >
        <span class="hanger-string"></span>
        <svg viewBox="0 0 80 100" class="hanger-art crescent-art">
          <path d="M40 0V25" stroke="#c6a052" stroke-width="2"/>
          <path d="M48 30C20 28 15 65 40 77C56 84 72 71 73 55C65 65 51 65 42 56C32 47 35 35 48 30Z" fill="#d5ae5a" stroke="#f0d58d" stroke-width="1.5"/>
          <path class="crescent-star" d="M58 25L61 33L69 35L61 38L58 46L55 38L47 35L55 33Z" fill="#f1d68e"/>
        </svg>
      </div>

      <div
        v-if="showLanterns"
        class="hanger"
        style="--x: 69%; --x-sm: 69%; --string: 34px; --w: 26px; --delay: -.9s"
      >
        <span class="hanger-string"></span>
        <svg viewBox="0 0 40 44" class="hanger-art">
          <path d="M20 0V16" stroke="#c6a052" stroke-width="2"/>
          <path d="M20 16L22.1 22.9L28.5 19.5L25.1 25.9L32 28L25.1 30.1L28.5 36.5L22.1 33.1L20 40L17.9 33.1L11.5 36.5L14.9 30.1L8 28L14.9 25.9L11.5 19.5L17.9 22.9Z" fill="#e2c272" stroke="#a98535" stroke-width="1"/>
          <circle cx="20" cy="28" r="2.4" fill="#fff0bd"/>
        </svg>
      </div>

      <div
        v-if="showLanterns"
        class="hanger"
        style="--x: 88%; --x-sm: 87%; --string: 30px; --w: 40px; --delay: -.8s"
      >
        <span class="hanger-string"></span>
        <svg viewBox="0 0 70 112" class="hanger-art lantern-art">
          <path d="M35 0V23" stroke="#c6a052" stroke-width="2"/>
          <path d="M25 24Q35 15 45 24L48 31H22Z" fill="#c6a052"/>
          <path d="M22 31H48L44 43L51 83L35 98L19 83L26 43Z" fill="#a77b32" stroke="#e7cb83" stroke-width="2"/>
          <path class="lantern-lit" d="M26 44H44L40 78L35 87L30 78Z" fill="#fff0bd" opacity=".9"/>
          <path d="M22 53H48M20 78H50" stroke="#f5dfa1" stroke-width="2"/>
          <path d="M35 98V106" stroke="#c6a052" stroke-width="2"/>
        </svg>
      </div>

    </div>

  </div>
</template>

<style scoped>
/*
 * The decoration is a band that sits directly under the header.
 * It reserves its own space, so ornaments never cover the search bar,
 * the cart, the account menu or the page content.
 */
.seasonal-artwork {
  --band-h: 104px;

  position: relative;
  height: var(--band-h);
  overflow-x: clip;
  pointer-events: none;
}

/* ---------- Garland & rail ---------- */

.festive-garland,
.festive-rail {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 2;
  display: block;
  width: 100%;
}

.festive-garland {
  filter: drop-shadow(0 3px 2px rgb(0 0 0 / 14%));
}

.festive-rail {
  filter: drop-shadow(0 2px 1px rgb(0 0 0 / 12%));
}

.lights {
  animation: bulb-twinkle 2.6s ease-in-out infinite;
}

.lights-b {
  animation-delay: -1.3s;
}

@keyframes bulb-twinkle {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

/* ---------- Hanging ornaments ---------- */

.festive-hangers {
  position: absolute;
  inset: 0;
  z-index: 1;
}

.hanger {
  --scale: 1;
  --wpx: calc(var(--w, 40px) * var(--scale));

  position: absolute;
  top: 0;
  left: var(--x);
  display: flex;
  flex-direction: column;
  align-items: center;
  width: var(--wpx);
  margin-left: calc(var(--wpx) / -2);
  transform-origin: 50% 0;
  animation: ornament-sway 5.5s ease-in-out var(--delay, 0s) infinite;
  filter: drop-shadow(0 4px 3px rgb(0 0 0 / 16%));
}

.hanger-string {
  width: 1px;
  height: var(--string, 40px);
  background: linear-gradient(#b9934d, #e2c77e);
}

.hanger-art {
  display: block;
  width: var(--wpx);
  height: auto;
  overflow: visible;
}

@keyframes ornament-sway {
  0%, 100% { transform: rotate(-3deg); }
  50% { transform: rotate(3deg); }
}

/* Lanterns glow softly, like a candle */
.lantern-lit {
  animation: lantern-flicker 3.4s ease-in-out infinite alternate;
}

.seasonal-artwork--eid .lantern-lit {
  animation-duration: 2.6s;
}

@keyframes lantern-flicker {
  0% { opacity: 0.78; }
  100% { opacity: 1; }
}

.lantern-art,
.crescent-art {
  filter: drop-shadow(0 0 7px rgb(246 205 117 / 45%));
}

.crescent-star {
  transform-box: fill-box;
  transform-origin: center;
  animation: star-twinkle 3s ease-in-out infinite;
}

@keyframes star-twinkle {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(0.82); opacity: 0.7; }
}

/* ---------- Snowfall ---------- */

.seasonal-snowfall {
  position: fixed;
  inset: 0;
  z-index: 190; /* above the page, below the sticky header (200) */
  overflow: hidden;
  pointer-events: none;
}

.seasonal-snowflake {
  position: absolute;
  top: -12px;
  display: block;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 0 7px rgb(255 255 255 / 90%), 0 0 1px rgb(120 140 170 / 55%);
  will-change: transform;
  animation: seasonal-snow-fall linear infinite;
}

@keyframes seasonal-snow-fall {
  0% { transform: translate3d(0, -10px, 0); }
  50% { transform: translate3d(var(--drift, 16px), 50vh, 0); }
  100% { transform: translate3d(calc(var(--drift, 16px) * -0.6), 105vh, 0); }
}

/* ---------- Phones ---------- */

@media (max-width: 700px) {
  .seasonal-artwork {
    --band-h: 92px;
  }

  .hanger {
    --scale: 0.8;
    left: var(--x-sm, var(--x));
  }

  .hanger-string {
    height: calc(var(--string, 40px) * 0.92);
  }
}

/* ---------- Reduced motion ---------- */

@media (prefers-reduced-motion: reduce) {
  .hanger,
  .lights,
  .lantern-lit,
  .crescent-star {
    animation: none;
  }

  .seasonal-snowflake {
    display: none;
  }
}
</style>