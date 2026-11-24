<script setup>
import { computed, ref, watch, onBeforeUnmount } from 'vue'
import { useWebsiteTheme } from '@/composables/useWebsiteTheme'

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

// Deterministic positions avoid layout changes on every render.
const snowflakes = Array.from({ length: 90 }, (_, i) => {
  const layer = i % 3
  const size = layer === 0 ? 2 + (i % 3)
    : layer === 1 ? 4 + (i % 3)
    : 7 + (i % 4)

  return {
    id: i,
    left: `${(i * 37.17 + 11) % 100}%`,
    delay: `${-((i * 3.71) % 24).toFixed(2)}s`,
    duration: `${layer === 0 ? 22 + (i % 8)
      : layer === 1 ? 15 + (i % 7)
      : 10 + (i % 5)}s`,
    size: `${size}px`,
    opacity: layer === 0 ? 0.48 : layer === 1 ? 0.75 : 0.95,
    drift: `${((i % 2 ? 1 : -1) * (35 + (i % 9) * 12))}px`,
    layer
  }
})

// Randomized Santa flight controller
const santaFlight = ref(null)

let santaAnimation = null
let santaTimer = null
let santaDirection = 1

const randomBetween = (min, max) =>
  min + Math.random() * (max - min)

function stopSantaFlight() {
  clearTimeout(santaTimer)
  santaAnimation?.cancel()
  santaAnimation = null
}

function flySanta() {
  const element = santaFlight.value

  if (!element || !isChristmas.value ||
      effects.value.santaFlight === false ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return
  }

  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight
  const width = element.offsetWidth
  const height = element.offsetHeight

  const minY = Math.min(150, viewportHeight * 0.25)
  const maxY = Math.max(minY, viewportHeight - height - 40)

  const startY = randomBetween(minY, maxY)
  const middleY = randomBetween(minY, maxY)
  const endY = randomBetween(minY, maxY)

  const left = -width - 200
  const right = viewportWidth + 200

  const startX = santaDirection === 1 ? left : right
  const endX = santaDirection === 1 ? right : left
  const facing = santaDirection

  const duration = randomBetween(6000, 10000)

  const transform = (x, y) =>
    `translate3d(${x}px, ${y}px, 0) scaleX(${facing})`

  santaAnimation = element.animate([
    {
      transform: transform(startX, startY),
      offset: 0
    },
    {
      transform: transform(
        (startX + endX) / 2,
        middleY
      ),
      offset: 0.5
    },
    {
      transform: transform(endX, endY),
      offset: 1
    }
  ], {
    duration,
    easing: 'linear',
    fill: 'both'
  })

  santaAnimation.onfinish = () => {
    santaDirection *= -1

    santaTimer = setTimeout(() => {
      santaAnimation?.cancel()
      flySanta()
    }, randomBetween(1000, 3000))
  }
}

watch(santaFlight, (element) => {
  stopSantaFlight()

  if (element) {
    santaDirection = Math.random() > 0.5 ? 1 : -1
    flySanta()
  }
}, { flush: 'post' })

onBeforeUnmount(stopSantaFlight)

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

    <!-- Photorealistic Christmas garland -->
    <div v-if="showGarland" class="christmas-realistic-garland">
      <img
        src="/themes/christmas/decorations/christmas-garland.webp"
        alt=""
        decoding="async"
        draggable="false"
      />
    </div>

    <!-- Flying Santa and reindeer -->
    <Teleport to="body">
      <div
        v-if="isChristmas && effects.santaFlight !== false"
        class="christmas-santa-sky"
        aria-hidden="true"
      >
        <div ref="santaFlight" class="christmas-santa-flight">
          <div class="christmas-santa-float">
            <div class="christmas-santa-trail">
              <span v-for="n in 12" :key="n"
               :style="{ '--i': n }"
              />
            </div>
            <img
              src="/themes/christmas/decorations/santa-sleigh.webp"
              alt=""
              width="1000"
              height="334"
              decoding="async"
              draggable="false"
            />
          </div>
        </div>
      </div>
    </Teleport>

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


    <template v-if="isRamadan">
      <template v-if="showLanterns">
        <img class="ramadan-festoon" src="/themes/ramadan/decorations/ramadan-header.webp" alt="" />
        <img
          v-for="id in ['01', '02', '03']"
          :key="id"
          class="ramadan-lantern"
          :class="['lantern-' + id, { swaying: effects.lanternSway }]"
          :src="`/themes/ramadan/decorations/ramadan-lantern-${id}.webp`"
          alt=""
        />
        <span
          v-for="(position, index) in [15, 34, 66, 85]"
          :key="position"
          class="ramadan-star"
          :style="{ '--position': position + '%', '--drop': index % 2 ? '20%' : '39%', '--phase': -index * 1.7 + 's' }"
        >
          <img src="/themes/ramadan/decorations/ramadan-star.webp" alt="" />
        </span>
        <i v-for="x in [10, 22, 31, 69, 80, 90]" :key="x" class="ramadan-spark"
          :style="{ left: x + '%', top: (25 + x % 43) + '%', '--phase': -(x % 7) + 's' }" />
      </template>
      <img v-if="showCrescent" class="ramadan-moon" src="/themes/ramadan/decorations/ramadan-crescent.webp" alt="" />
    </template>

    <template v-if="isEid">
      <template v-if="showLanterns">
        <img class="eid-festoon" src="/themes/eid/decorations/eid-header.webp" alt="" />
        <img v-for="side in ['left', 'right']" :key="side" :class="['eid-garland', side]"
          src="/themes/eid/decorations/eid-garland.webp" alt="" />
        <img v-for="name in ['lantern', 'star', 'hanging-ornament']" :key="name"
          :class="['eid-pendant', 'eid-' + name, { sway: effects.ornamentSway !== false }]"
          :src="`/themes/eid/decorations/eid-${name}.webp`" alt="" />
      </template>
      <img v-if="showCrescent" class="eid-crescent" src="/themes/eid/decorations/eid-crescent.webp" alt="" />
    </template>

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

/* ---------- Realistic layered snowfall ---------- */

.seasonal-snowfall {
  position: fixed;
  inset: 0;
  z-index: 190;
  overflow: hidden;
  pointer-events: none;
  contain: layout paint;
}

.seasonal-snowflake {
  position: absolute;
  top: -16px;
  display: block;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, #fff 0%, #f5faff 48%, #d5e5f4 100%);
  box-shadow: 0 0 5px rgb(255 255 255 / 65%);
  animation: seasonal-snow-fall linear infinite;
}

.seasonal-snowflake:nth-child(3n + 1) {
  filter: blur(0.5px);
}

.seasonal-snowflake:nth-child(3n + 3) {
  box-shadow: 0 0 9px rgb(255 255 255 / 80%);
}

@keyframes seasonal-snow-fall {
  0% {
    transform: translate3d(0, -20px, 0);
  }
  25% {
    transform: translate3d(calc(var(--drift) * 0.6), 26vh, 0);
  }
  50% {
    transform: translate3d(var(--drift), 53vh, 0);
  }
  75% {
    transform: translate3d(calc(var(--drift) * 0.35), 80vh, 0);
  }
  100% {
    transform: translate3d(calc(var(--drift) * -0.3), 110vh, 0);
  }
}

@media (max-width: 700px) {
  .seasonal-snowflake:nth-child(2n) {
    display: none;
  }
}

/* ---------- Phones ---------- */

@media (max-width: 700px) {
  .seasonal-artwork {
    --band-h: 92px;
  }
}

/* ---------- Reduced motion ---------- */

@media (prefers-reduced-motion: reduce) {
  .seasonal-snowflake {
    display: none;
  }
}

/* ---------- Photorealistic Christmas decorations ---------- */

.seasonal-artwork--christmas {
  height: 0;
}

.seasonal-artwork--christmas:has(.christmas-realistic-garland) {
  height: 110px;
}

.christmas-realistic-garland {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  user-select: none;
  background-image: url('/themes/christmas/decorations/christmas-garland.webp');
  background-repeat: repeat-x;
  background-size: auto 150px;
  background-position: center -22px;
}

.christmas-realistic-garland img {
  display: none;
}

@media (max-width: 700px) {
  .seasonal-artwork--christmas:has(.christmas-realistic-garland) {
    height: 82px;
  }

  .christmas-realistic-garland {
    background-size: auto 112px;
    background-position: center -16px;
  }
}


/* ---------- Flying Santa and reindeer ---------- */

.christmas-santa-sky {
  position: fixed;
  inset: 0;
  z-index: 185;
  overflow: hidden;
  pointer-events: none;
  user-select: none;
}

.christmas-santa-flight {
  --santa-width: 420px;
  position: absolute;
  top: 0;
  left: 0;
  width: var(--santa-width);
  transform: translateX(-200%);
}

.christmas-santa-float {
  position: relative;
  animation: christmas-santa-bob 4s ease-in-out infinite;
}

.christmas-santa-float img {
  position: relative;
  display: block;
  width: 100%;
  height: auto;
  filter: drop-shadow(0 5px 8px rgb(0 0 0 / 18%));
}

.christmas-santa-trail {
  position: absolute;
  top: 65%;
  left: 0;
}

.christmas-santa-trail span {
  position: absolute;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #fff0b0;
  box-shadow: 0 0 8px 2px #ffc85c;
  animation: christmas-santa-sparkle 1.8s linear infinite;
  animation-delay: calc(var(--i) * -0.15s);
}

@keyframes christmas-santa-bob {
  0%, 100% {
    transform: translateY(0) rotate(-1deg);
  }
  50% {
    transform: translateY(-22px) rotate(1deg);
  }
}

@keyframes christmas-santa-sparkle {
  0% {
    transform: translate(0, 0) scale(1);
    opacity: 0.9;
  }
  100% {
    transform: translate(
      calc(var(--i) * -13px),
      calc(var(--i) * 3px - 18px)
    ) scale(0.2);
    opacity: 0;
  }
}

@media (max-width: 700px) {
  .christmas-santa-flight {
    --santa-width: 240px;
    top: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .christmas-santa-sky {
    display: none;
  }
}

.seasonal-artwork--ramadan {
  --band-h: clamp(106px, 6vw, 110px);
  --lantern-height: clamp(84px, 5vw, 90px);
  --moon-height: clamp(68px, 4vw, 80px);
  --festoon-width: min(40%, calc(var(--band-h) * 3.29));
  overflow: hidden;
  background: radial-gradient(ellipse at 50% 0%, #194d3c, var(--color-primary-hover) 84%);
  box-shadow: inset 0 -1px rgb(212 175 55 / 55%);
  user-select: none;
}

.ramadan-festoon, .ramadan-lantern, .ramadan-moon, .ramadan-star {
  position: absolute;
  display: block;
  translate: -50% 0;
}
.ramadan-festoon {
  top: 0;
  left: 50%;
  width: var(--festoon-width);
  height: auto;
}
.ramadan-lantern {
  top: 0;
  height: var(--lantern-height);
  width: auto;
  transform-origin: center top;
  filter: drop-shadow(0 3px 5px rgb(255 187 77 / 25%));
}
.lantern-01 { left: 5%; --period: 5.8s; --phase: -2s; }
.lantern-02 { left: 26%; height: calc(var(--lantern-height) * .79); --period: 7.1s; --phase: -5s; }
.lantern-03 { left: 74%; height: calc(var(--lantern-height) * .91); --period: 6.4s; --phase: -1s; }
.ramadan-moon {
  top: 9%;
  left: 94%;
  height: var(--moon-height);
  width: auto;
}
.ramadan-star {
  left: var(--position);
  top: 0;
  height: var(--drop);
  width: 1px;
  background: rgb(222 188 108 / 64%);
}
.ramadan-star:nth-of-type(2) {
  left: min(var(--position), calc(50% - var(--festoon-width) / 2 - 12px));
}
.ramadan-star:nth-of-type(3) {
  left: max(var(--position), calc(50% + var(--festoon-width) / 2 + 12px));
}
.ramadan-star img {
  position: absolute;
  top: 100%;
  left: 50%;
  translate: -50% 0;
  width: clamp(10px, 1.2vw, 19px);
  height: auto;
}
.ramadan-spark {
  position: absolute;
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: #ffe1a1;
  box-shadow: 0 0 4px #d6af63;
  opacity: .55;
}

@media (prefers-reduced-motion: no-preference) {
  .ramadan-lantern.swaying { animation: ramadan-sway var(--period) ease-in-out var(--phase) infinite alternate; }
  .ramadan-star img, .ramadan-spark { animation: ramadan-twinkle 4.8s ease-in-out var(--phase) infinite alternate; }
}
@keyframes ramadan-sway {
  from { transform: rotate(-3deg); }
  to { transform: rotate(3deg); }
}
@keyframes ramadan-twinkle {
  from { opacity: .55; }
  to { opacity: 1; }
}

@media (max-width: 1024px) {
  .seasonal-artwork--ramadan {
    --band-h: clamp(75px, 8.5vw, 85px);
    --lantern-height: clamp(58px, 7vw, 65px);
    --moon-height: 54px;
  }
}
@media (max-width: 650px) {
  .seasonal-artwork--ramadan {
    --band-h: clamp(55px, 15vw, 65px);
    --lantern-height: clamp(39px, 11vw, 50px);
    --moon-height: clamp(34px, 9vw, 46px);
    --festoon-width: min(46%, calc(var(--band-h) * 3.25));
  }
  .ramadan-star:first-of-type { left: 20%; }
  .ramadan-star:last-of-type { left: 80%; }
  .lantern-01 { left: 8%; }
  .ramadan-moon { left: 91%; }
  .lantern-02, .lantern-03, .ramadan-star:nth-of-type(2), .ramadan-star:nth-of-type(3),
  .ramadan-spark:nth-of-type(even) { display: none; }
}
</style>
