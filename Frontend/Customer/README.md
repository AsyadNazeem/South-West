# Vue 3 + Vite

This template should help get you started developing with Vue 3 in Vite. The template uses Vue 3 `<script setup>` SFCs, check out the [script setup docs](https://v3.vuejs.org/api/sfc-script-setup.html#sfc-script-setup) to learn more.

Learn more about IDE Support for Vue in the [Vue Docs Scaling up Guide](https://vuejs.org/guide/scaling-up/tooling.html#ide-support).

## Analytics and sitemap

For the current pre-deployment setup, analytics is automatically accepted on app startup and Google Tag Manager container `GTM-WVVWN69R` loads without showing the consent prompt. Re-enable the `AnalyticsConsent` component and remove the startup acceptance in `src/main.js` before changing to a consent-based setup. Configure GA4 tags and events in the GTM container to send data to the intended Analytics property. Set `VITE_GTM_CONTAINER_ID` to use a different container ID, or set it to an empty value to disable GTM and use `VITE_GA_MEASUREMENT_ID` for direct GA4. Do not put personal or secret values in `VITE_*` variables.

Before a production build, `npm run sitemap:generate` can refresh `public/sitemap.xml` with product URLs from the public API. Set `VITE_API_URL` to the API base ending in `/api` for this command. The committed sitemap remains a valid static fallback. The generator includes available products and the existing category/brand directory pages; the app currently has no standalone category or brand URL routes.

After hosting the built files at the site root, open Google Search Console, verify `southwest.lk` with a DNS TXT record, submit `https://southwest.lk/sitemap.xml`, and request indexing for the homepage and key product URLs. Configure HTTPS and the preferred non-www domain redirects in the hosting panel before submission.
