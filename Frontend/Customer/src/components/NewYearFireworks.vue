<script setup>
import { useWebsiteTheme } from '@/composables/useWebsiteTheme'

const { effects } = useWebsiteTheme()
</script>

<template>
  <div class="new-year-sky">
    <div v-if="effects.fireworks !== false" class="sky-bursts" aria-hidden="true">
      <i v-for="n in 4" :key="n" />
    </div>
    <p class="new-year-greeting">
      <span>Happy</span>
      <em>New Year</em>
    </p>
  </div>
  <div v-if="effects.fireworks !== false" class="new-year-margins" aria-hidden="true">
    <i /><i />
  </div>
</template>

<style scoped>
.new-year-sky {
  position: relative;
  display: grid;
  place-items: center;
  overflow: hidden;
  height: clamp(106px, 10vw, 146px);
  border-bottom: 1px solid #bc9e60;
  background: #06102b url('/themes/new-year/sky.webp') center 48% / cover no-repeat;
  pointer-events: none;
}
.new-year-greeting {
  position: relative;
  display: grid;
  justify-items: center;
  gap: 4px;
  color: #fff2d7;
  text-shadow: 0 2px 12px #091026;
}
.new-year-greeting span {
  display: flex;
  align-items: center;
  gap: 12px;
  color: #efcf8e;
  font-size: 11px;
  font-weight: 650;
  letter-spacing: .32em;
  text-transform: uppercase;
}
.new-year-greeting span::before, .new-year-greeting span::after {
  content: '';
  width: 32px;
  height: 1px;
  background: #b09258;
}
.new-year-greeting em { font: italic clamp(42px, 4.4vw, 70px)/1 Georgia, serif; }
.sky-bursts, .new-year-margins { position: absolute; inset: 0; overflow: hidden; pointer-events: none; }
.new-year-margins { position: fixed; z-index: 8; }
.sky-bursts i, .new-year-margins i {
  position: absolute;
  width: clamp(54px, 7vw, 118px);
  aspect-ratio: 1;
  background: url('/themes/new-year/burst.webp') center / contain no-repeat;
  opacity: .8;
}
.sky-bursts i:nth-child(1) { left: 17%; top: 5%; --delay: -1s; }
.sky-bursts i:nth-child(2) { left: 30%; top: 38%; width: 52px; --delay: -4s; }
.sky-bursts i:nth-child(3) { right: 19%; top: 10%; --delay: -3s; }
.sky-bursts i:nth-child(4) { right: 31%; top: 22%; width: 44px; --delay: -6s; }
.new-year-margins i { width: clamp(25px, 4vw, 74px); opacity: 0; }
.new-year-margins i:first-child { left: -2%; top: 54%; --delay: -3s; }
.new-year-margins i:last-child { right: -2%; top: 76%; --delay: -9s; }
@media (prefers-reduced-motion: no-preference) {
  .sky-bursts i { animation: new-year-bloom 7s ease-out var(--delay) infinite; }
  .new-year-margins i { animation: new-year-bloom 13s ease-out var(--delay) infinite; }
}
@keyframes new-year-bloom {
  0%, 60%, 100% { opacity: 0; transform: scale(.18); }
  12% { opacity: .92; transform: scale(.70); }
  38% { opacity: .55; transform: translateY(3px) scale(1); }
  59% { opacity: 0; transform: translateY(9px) scale(1.08); }
}
@media (max-width: 650px) {
  .new-year-sky { height: 86px; }
  .new-year-greeting em { font-size: 39px; }
  .sky-bursts i:nth-child(1) { left: 6%; }
  .sky-bursts i:nth-child(3) { right: 6%; }
  .sky-bursts i:nth-child(even), .new-year-margins i:last-child { display: none; }
}
</style>
