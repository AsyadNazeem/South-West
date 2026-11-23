<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
defineProps({fullName:String})
const route = useRoute()
const open = ref(false)
const trigger = ref(null)
const sections = [
  ['', 'Overview', 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z'],
  ['orders','My orders','M3 7l9-4 9 4v11l-9 4-9-4z M3 7l9 4 9-4 M12 11v11'],
  ['warranty-claims','Warranty claims','M12 2l8 3v6c0 5-4 9-8 11-4-2-8-6-8-11V5z M8.5 12l2.5 2.5 4.5-5'],
  ['wishlist','Wishlist','M12 21l-8-8C-1 6 7 1 12 7c5-6 13-1 8 6z'],
  ['notifications','Notifications','M4 17h16l-2-3V9a6 6 0 0 0-12 0v5z M10 20a2 2 0 0 0 4 0'],
  ['reviews','My reviews','M3 4h18v13H9l-6 4z M7 9h10 M7 12h6'],
  ['returns','Warranty & Order Support','M8 4L3 9l5 5 M3 9h11a6 6 0 0 1 0 12'],
  ['addresses','Saved addresses','M12 22s8-8 8-13a8 8 0 0 0-16 0c0 5 8 13 8 13z M15 9a3 3 0 1 1-6 0 3 3 0 0 1 6 0'],
  ['personal-information','My profile','M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M4 21v-2a8 6 0 0 1 16 0v2'],
  ['change-password','Account security','M5 10h14v11H5z M8 10V7a4 4 0 1 1 8 0v3 M12 14v3'],
]
const current = computed(()=>route.path.split('/')[2] || '')
const activeLabel = computed(()=>sections.find(([key])=>key===current.value)?.[1])
watch(()=>route.fullPath,()=>{ open.value=false })
function closeMenu(){ if(open.value){open.value=false; trigger.value?.focus()} }
function logout(){window.dispatchEvent(new Event('customer-request-logout'))}
</script>
<template>
  <aside class="account-nav" @keydown.esc="closeMenu">
    <div class="identity">
      <span class="avatar" aria-hidden="true">{{ fullName?.trim().split(/\s+/).slice(0,2).map(s=>s[0]).join('') }}</span>
      <div class="who"><strong>{{ fullName }}</strong><small>My account</small></div>
    </div>

    <button ref="trigger" class="menu-trigger" type="button" :aria-expanded="open" aria-controls="account-links" @click="open=!open">
      <span>Account menu</span><strong>{{ activeLabel }}</strong><span aria-hidden="true">{{ open ? '▴' : '▾' }}</span>
    </button>

    <nav id="account-links" aria-label="Account navigation" :class="{open}">
      <RouterLink
        v-for="[key,label,icon] in sections"
        :key="key"
        :title="label"
        :class="{ active: key===current, 'group-start': key==='addresses' }"
        :aria-current="key===current?'page':undefined"
        :to="key?'/account/'+key:'/account'"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true"><path :d="icon"/></svg>
        <span>{{ label }}</span>
      </RouterLink>
      <button class="logout group-start" type="button" @click="logout">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 3H4v18h6 M9 12h12 M17 8l4 4-4 4"/></svg>
        <span>Log out</span>
      </button>
    </nav>
  </aside>
</template>
<style scoped>
.account-nav { align-self: start; overflow: hidden; background: var(--color-surface); border: 1px solid var(--color-border-soft); border-radius: 12px; }

/* Identity */
.identity { display: flex; align-items: center; gap: 12px; padding: 20px 16px; border-bottom: 1px solid var(--color-border-soft); }
.avatar { flex: none; display: grid; place-items: center; width: 40px; height: 40px; border-radius: 50%; background: var(--color-primary); color: var(--color-on-primary); font-size: 14px; font-weight: 700; letter-spacing: .02em; text-transform: uppercase; }
.who { min-width: 0; }
.who strong { display: block; overflow: hidden; color: var(--color-text); font-size: 15px; font-weight: 700; line-height: 1.3; text-overflow: ellipsis; white-space: nowrap; }
.who small { display: block; margin-top: 2px; color: var(--color-text-muted); font-size: 13px; }

/* Links */
nav { display: grid; gap: 2px; padding: 8px; }
.menu-trigger { display: none; }
nav a, .logout { position: relative; display: flex; align-items: center; gap: 12px; width: 100%; min-height: 42px; padding: 0 12px; color: var(--color-text-muted); font: 500 14px/1 var(--font-family-base); text-align: left; text-decoration: none; background: none; border: 0; border-radius: 8px; transition: background .15s ease, color .15s ease; }
nav a span, .logout span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
nav a:hover, .logout:hover { background: var(--color-store-bg); color: var(--color-text); }
nav a:focus-visible, .logout:focus-visible { outline: 2px solid var(--color-focus); outline-offset: -2px; }

/* Active page */
nav a.active { background: var(--color-surface-muted); color: var(--color-primary); font-weight: 600; }
nav a.active::before { content: ''; position: absolute; left: 0; top: 10px; bottom: 10px; width: 3px; border-radius: 0 3px 3px 0; background: var(--color-primary); }

/* Divider before "Saved addresses" and "Log out" */
.group-start { margin-top: 13px; }
.group-start::after { content: ''; position: absolute; top: -7px; left: 12px; right: 12px; height: 1px; background: var(--color-border-soft); }
.logout { cursor: pointer; }
.logout:hover { background: #fef2f2; color: #b42318; }

/* Icons */
svg { flex: none; width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }

/* Mobile */
@media (max-width: 850px) {
  .identity, nav { display: none; }
  .menu-trigger { display: flex; align-items: center; gap: 12px; width: 100%; padding: 14px 16px; background: var(--color-surface); color: var(--color-primary); border: 0; font: inherit; text-align: left; cursor: pointer; }
  .menu-trigger strong { margin-left: auto; font-size: 14px; font-weight: 600; }
  .menu-trigger span:first-child { color: var(--color-text-muted); font-size: 13px; }
  nav.open { display: grid; border-top: 1px solid var(--color-border-soft); }
}
</style>
