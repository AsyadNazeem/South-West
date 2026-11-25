import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import test from 'node:test'
import { preview } from 'vite'
import { informationRoutes } from '../src/router/informationRoutes.js'

const root = fileURLToPath(new URL('../', import.meta.url))
const headings = {
  '/contact': 'Contact Us',
  '/faq': 'Frequently Asked Questions',
  '/shipping': 'Shipping Information',
  '/returns': 'Return and Warranty Policy',
  '/about': 'Technology Shopping, Made Simple',
  '/privacy-policy': 'Privacy Policy',
  '/terms': 'Terms & Conditions',
}
const site = 'https://southwest.lk'

test('the seven information routes retain their sitemap entries and production rewrite', async () => {
  assert.deepEqual(informationRoutes.map(route => route.path).sort(), Object.keys(headings).sort())
  const sitemap = await readFile(path.join(root, 'public/sitemap.xml'), 'utf8')
  const config = await readFile(path.join(root, 'public/.htaccess'), 'utf8')
  const rule = config.match(/RewriteRule (\S+) \$1\.html \[END\]/)[1]
  for (const route of informationRoutes) {
    assert.equal(sitemap.split(`<loc>${site}${route.path}</loc>`).length, 2)
    assert.match(route.path.slice(1), new RegExp(rule))
  }
})

// Compare crawler-visible content (including closed FAQ answers), links, and all SEO tags.
async function snapshot(page) {
  return page.evaluate(() => {
    const main = document.querySelector('main.contact-page, main.information-page').cloneNode(true)
    // Remote contact details and FAQ answers settle after mount. Assert their
    // respective states separately, then compare the invariant page content.
    main.querySelector('.status-panel')?.remove()
    main.querySelector('.faq-state')?.remove()
    main.querySelector('.faq-list')?.remove()
    return {
      text: main.textContent.replace(/\s+/g, ' ').trim(),
      links: Array.from(main.querySelectorAll('a'), link => [link.textContent.trim(), link.getAttribute('href')]),
      title: document.title,
      canonical: Array.from(document.querySelectorAll('link[rel=canonical]'), link => link.href),
      metadata: Array.from(document.head.querySelectorAll('meta[name],meta[property]'))
        .map(tag => [tag.getAttribute('property') || tag.name, tag.content])
        .filter(([key]) => /^(description|robots|og:|twitter:)/.test(key))
        .sort(([a], [b]) => a.localeCompare(b)),
      schemas: Array.from(document.querySelectorAll('script[type="application/ld+json"]'), tag => tag.textContent),
    }
  })
}

test('information pages work before JavaScript, on refresh and through footer navigation', {
  skip: !process.env.PLAYWRIGHT_MODULE || !process.env.CHROME_BIN,
  timeout: 120000,
}, async t => {
  const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE)
  const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN })
  t.after(() => browser.close())
  async function serve(outDir) {
    const server = await preview({ root, build: { outDir }, preview: { host: '127.0.0.1', port: 0 } })
    t.after(() => server.close())
    return new URL(server.resolvedUrls.local[0]).origin
  }
  const origin = await serve('dist')
  const previous = process.env.INFORMATION_BASELINE_DIST
  const baseline = previous && await serve(previous)
  const staticPage = await browser.newPage({ javaScriptEnabled: false })
  const page = await browser.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()) })
  for (const tab of [page, staticPage]) {
    await tab.route('**/*', route => {
      const url = new URL(route.request().url())
      if ([origin, baseline].includes(url.origin)) return route.continue()
      if (route.request().method() === 'OPTIONS') return route.fulfill({
        status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' },
      })
      if (url.pathname.endsWith('/store/faqs')) return route.fulfill({
        headers: { 'access-control-allow-origin': '*' },
        json: { data: [{ question: 'Fixture question?', answer: 'Fixture answer.' }] },
      })
      if (url.hostname.startsWith('api.')) return route.fulfill({
        headers: { 'access-control-allow-origin': '*' }, json: { data: [] },
      })
      return route.fulfill({ status: 200, body: '', contentType: url.pathname.includes('css') ? 'text/css' : 'text/plain' })
    })
  }
  const sitemap = await readFile(path.join(root, 'dist/sitemap.xml'), 'utf8')
  for (const route of informationRoutes) {
    const contact = route.path === '/contact'
    const main = contact ? '.contact-page' : '.information-page'
    const container = contact ? '.contact-shell' : '.information-container'
    const url = origin + route.path
    assert.equal(sitemap.split(`<loc>${site}${route.path}</loc>`).length, 2)
    const response = await staticPage.goto(url)
    assert.equal(response.status(), 200)
    assert.equal(staticPage.url(), url)
    assert.equal(await staticPage.locator('h1').textContent(), headings[route.path])
    if (contact || route.path === '/faq') await staticPage.getByRole('status').first().waitFor()
    const expected = await snapshot(staticPage)
    assert.deepEqual(expected.canonical, [site + route.path])
    assert.equal(expected.title, route.meta.title)
    const meta = Object.fromEntries(expected.metadata)
    assert.equal(meta.description, route.meta.description)
    assert.equal(meta.robots, 'index, follow')
    assert.equal(meta['og:url'], site + route.path)
    assert.equal(meta['og:title'], route.meta.title)
    assert.equal(meta['og:description'], route.meta.description)
    assert.equal(await staticPage.locator(container).evaluate(el => getComputedStyle(el).maxWidth === '1040px' || el.clientWidth <= 1040), true)
    for (const [, href] of expected.links) {
      assert.ok([...Object.keys(headings), '/', '/shop', '/account/orders', '/account/warranty-claims/new'].includes(href), href)
    }
    if (baseline) {
      await page.goto(baseline + route.path)
      await page.locator('.app-footer').waitFor()
      await page.locator(main).waitFor()
      assert.deepEqual(await snapshot(page), expected, 'Previous rendered page differs at ' + route.path)
    }
    for (const width of [375, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      await page.goto(url)
      await page.reload()
      await page.locator('.app-footer').waitFor()
      await page.locator(main).waitFor()
      if (contact) await page.getByText(/customer support email.*being finalised/).waitFor()
      if (route.path === '/faq') {
        const answer = page.locator('details', { hasText: 'Fixture question?' })
        await answer.locator('summary').click()
        assert.equal(await answer.locator('.faq-answer p').innerText(), 'Fixture answer.')
      }
      assert.deepEqual(await snapshot(page), expected)
      assert.ok(await page.locator(main).evaluate(el => el.scrollWidth <= innerWidth))
    }
    const next = informationRoutes[(informationRoutes.indexOf(route) + 1) % informationRoutes.length]
    await page.locator(`.app-footer a[href="${next.path}"]`).first().click()
    await page.getByRole('heading', { level: 1, name: headings[next.path], exact: true }).waitFor()
    assert.equal(page.url(), origin + next.path)
  }
  assert.deepEqual(errors, [])
})
