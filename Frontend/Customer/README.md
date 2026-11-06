# Vue 3 + Vite

This template should help get you started developing with Vue 3 in Vite. The template uses Vue 3 `<script setup>` SFCs, check out the [script setup docs](https://v3.vuejs.org/api/sfc-script-setup.html#sfc-script-setup) to learn more.

Learn more about IDE Support for Vue in the [Vue Docs Scaling up Guide](https://vuejs.org/guide/scaling-up/tooling.html#ide-support).

## Analytics and sitemap

Set `VITE_GA_MEASUREMENT_ID` in the customer frontend build environment to enable GA4. The ID is optional; analytics remains disabled if it is missing. Visitors must accept the analytics prompt before the gtag script is loaded. Do not put personal or secret values in `VITE_*` variables.

Before a production build, `npm run sitemap:generate` can refresh `public/sitemap.xml` with product URLs from the public API. Set `VITE_API_URL` to the API base ending in `/api` for this command. The committed sitemap remains a valid static fallback. The generator includes available products and the existing category/brand directory pages; the app currently has no standalone category or brand URL routes.

After hosting the built files at the site root, open Google Search Console, verify `southwest.lk` with a DNS TXT record, submit `https://southwest.lk/sitemap.xml`, and request indexing for the homepage and key product URLs. Configure HTTPS and the preferred non-www domain redirects in the hosting panel before submission.
