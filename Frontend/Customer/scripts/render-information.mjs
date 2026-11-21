// Built with Vite SSR so the static document uses the same Vue templates as the client.
import { readFile, writeFile } from 'node:fs/promises'
import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'
import { informationRoutes } from '../src/router/informationRoutes.js'
import { escapeHtml, updateCanonical, updateMeta } from './htmlMeta.mjs'

const template = await readFile('dist/index.html', 'utf8')
const manifest = JSON.parse(await readFile('dist/.vite/ssr-manifest.json', 'utf8'))
const origin = 'https://southwest.lk'
const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    ...informationRoutes,
    // RouterLink also resolves destinations outside this set, such as /shop.
    { path: '/:pathMatch(.*)*', component: {} },
  ],
})
for (const { path, meta } of informationRoutes) {
  await router.push(path)
  const app = createSSRApp({ render: () => h(RouterView) })
  app.use(router)
  const context = {}
  const content = await renderToString(app, context)
  const styles = new Set([...context.modules].flatMap(id => manifest[id] || [])
    .filter(file => file.endsWith('.css')))
  const canonical = origin + path
  let html = updateCanonical(template, canonical)
    .replace(/<title>.*?<\/title>/s, () => `<title>${escapeHtml(meta.title)}</title>`)
  for (const [attribute, key, value] of [
    ['name', 'description', meta.description],
    ['name', 'robots', meta.index ? 'index, follow' : 'noindex, nofollow'],
    ['property', 'og:url', canonical],
    ['property', 'og:title', meta.title],
    ['property', 'og:description', meta.description],
    ['name', 'twitter:title', meta.title],
    ['name', 'twitter:description', meta.description],
    ['name', 'twitter:image', origin + '/SWShareImage.png'],
  ]) {
    html = updateMeta(html, attribute, key, value)
  }
  const css = [...styles].map(file => `<link rel="stylesheet" href="${escapeHtml(file)}">`).join('\n')
  html = html.replace('</head>', () => css + '\n</head>')
    .replace('<div id="app"></div>', () => `<div id="app">${content}</div>`)
  await writeFile('dist' + path + '.html', html)
}
console.log(`Generated ${informationRoutes.length} static information pages.`)
