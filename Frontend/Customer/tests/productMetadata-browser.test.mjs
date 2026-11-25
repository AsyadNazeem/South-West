import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import test from 'node:test'
import { productMetadata } from '../src/utils/productSeo.js'

const dist = new URL('../dist/', import.meta.url)
const origin = 'https://store.test'

// Use the built application shell and real static generator with two fixed API records.
async function buildFixtures(t) {
  const directory = await mkdtemp(join(tmpdir(), 'sw-product-head-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  await mkdir(join(directory, 'dist'))
  await writeFile(join(directory, 'dist/index.html'), await readFile(new URL('app-shell.html', dist)))
  const products = ['Reader & Stand', 'Reader XL'].map((item_name, i) => ({
    id: i + 1, item_name, slug: 'reader-' + i, public_id: '12345678-1111-2222-3333-44444444444' + i,
    description: '<p>Interface: USB-C &amp; HDMI</p>', in_stock: false,
  }))
  const script = new URL('../scripts/generate-sitemap.mjs', import.meta.url)
  const setup = `globalThis.fetch = async input => Response.json(new URL(input).pathname.endsWith('/variants')
    ? {data: []} : {data: ${JSON.stringify(products)}, pagination: {hasMore: false}})
    await import(${JSON.stringify(script.href)})`
  const run = spawnSync(process.execPath, ['--input-type=module', '-e', setup], {
    cwd: directory, encoding: 'utf8', env: { ...process.env, VITE_API_URL: 'https://fixture.test/api' },
  })
  assert.equal(run.status, 0, run.stderr)
  return pathToFileURL(join(directory, 'dist') + '/')
}

async function readHead(page, html) {
  return page.evaluate(source => {
    const doc = source ? new DOMParser().parseFromString(source, 'text/html') : document
    const fields = ['description', 'og:title', 'og:description', 'og:url', 'og:image',
      'og:type', 'twitter:title', 'twitter:description', 'twitter:image']
    return {
      title: doc.title,
      canonical: [...doc.querySelectorAll('link[rel=canonical]')].map(node => node.getAttribute('href')),
      ...Object.fromEntries(fields.map(key => [key, doc.querySelector(
        `meta[${key.startsWith('og:') ? 'property' : 'name'}="${key}"]`)?.content])),
    }
  }, html)
}

test('built product heads match hydration, related-product navigation and refresh', {
  skip: !process.env.CHROME_BIN || !process.env.PLAYWRIGHT_MODULE,
  timeout: 120000,
}, async t => {
  const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE)
  const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN })
  t.after(() => browser.close())
  const page = await browser.newPage()
  const generated = await buildFixtures(t)
  const files = (await readdir(new URL('product/', generated))).filter(file => file.endsWith('.html')).sort()
  assert.ok(files.length >= 2, 'build at least two controlled product fixtures')
  const fixtures = []
  for (const file of files.slice(0, 2)) {
    const html = await readFile(new URL('product/' + file, generated), 'utf8')
    const { product, variants } = JSON.parse(html.match(/id="southwest-product-data" type="application\/json">([^<]+)</)[1])
    const meta = productMetadata(product)
    const head = await readHead(page, html)
    assert.deepEqual(head, {
      title: meta.title, canonical: [meta.canonicalUrl], description: meta.description,
      'og:title': meta.title, 'og:description': meta.description, 'og:url': meta.canonicalUrl,
      'og:image': meta.image, 'og:type': 'product', 'twitter:title': meta.title,
      'twitter:description': meta.description, 'twitter:image': meta.image,
    })
    fixtures.push({ product, variants, meta, head, html })
  }
  let catalogMode = 'available'
  let releaseCatalog
  let catalogGate = null

  const noJsContext = await browser.newContext({
    javaScriptEnabled: false,
  })
  t.after(() => noJsContext.close())

  const noJsPage = await noJsContext.newPage()

  await noJsPage.route('**/*', route => {
    const url = new URL(route.request().url())
    const snapshot = fixtures.find(f => f.meta.path === url.pathname)

    if (url.origin === origin && snapshot) {
      return route.fulfill({
        contentType: 'text/html',
        body: snapshot.html,
      })
    }

    if (url.origin === origin && url.pathname.startsWith('/assets/')) {
      return route.fulfill({
        path: new URL('.' + url.pathname, dist).pathname,
      })
    }

    return route.abort()
  })

  for (const fixture of fixtures) {
    await noJsPage.goto(origin + fixture.meta.path)

    const heading = noJsPage.locator('main h1')
    assert.equal(await heading.count(), 1)
    assert.equal(await heading.textContent(), fixture.product.item_name)
    assert.equal(await heading.isVisible(), true)
    assert.equal(
      await noJsPage.locator('[data-static-product-preview]').count(),
      1
    )
    assert.equal(
      await noJsPage.locator('[data-static-product-preview] button').count(),
      0
    )
  }

  await page.route('**/*', async route => {
    const url = new URL(route.request().url())
    const snapshot = fixtures.find(f => f.meta.path === url.pathname)
    if (snapshot) return route.fulfill({ contentType: 'text/html', body: snapshot.html })
    if (url.origin === origin && url.pathname !== '/') {
      return route.fulfill({ path: new URL('.' + url.pathname, dist).pathname })
    }
    const byID = fixtures.find(f => String(f.product.id) === url.pathname.split('/').at(-2))
    const id = url.searchParams.get('publicId')
    let data = []
    if (id) {
      if (catalogGate) await catalogGate

      if (catalogMode === 'offline') {
        return route.fulfill({
          status: 503,
          headers: { 'access-control-allow-origin': '*' },
          json: { message: 'Temporary catalog failure' },
        })
      }

      if (catalogMode !== 'missing') {
        data = fixtures.filter(
          f => f.product.public_id === id
        ).map(f => f.product)
      }
    }
    if (byID && url.pathname.endsWith('/variants')) data = byID.variants
    if (byID && url.pathname.endsWith('/related')) data = [fixtures[(fixtures.indexOf(byID) + 1) % fixtures.length].product]
    return route.fulfill({ headers: { 'access-control-allow-origin': '*' }, json: { data } })
  })
  catalogGate = new Promise(resolve => {
    releaseCatalog = resolve
  })

  try {
    await page.goto(origin + fixtures[0].meta.path)

    await page.locator('.state-message h1').waitFor()

    assert.equal(
      await page.locator('main h1').count(),
      1
    )

    assert.equal(
      await page.locator('.state-message h1').textContent(),
      fixtures[0].product.item_name
    )

    assert.equal(
      await page.locator('[data-static-product-preview]').count(),
      0
    )
  } finally {
    releaseCatalog()
    catalogGate = null
  }

  // Complete a cycle so each product is also opened through a real SPA link.
  for (const [i, fixture] of [...fixtures, fixtures[0]].entries()) {
    if (i) await page.locator(`.similar-products a[href="${fixture.meta.path}"]`).first().click()
    for (let pass = 0; pass < 2; pass++) {
      if (pass) await page.reload()
      await page.locator('.similar-products a').first().waitFor()
      await page.waitForFunction(title => document.title === title, fixture.meta.title)
      assert.deepEqual(await readHead(page), fixture.head)

      const heading = page.locator('main h1')
      assert.equal(await heading.count(), 1)
      assert.equal(await heading.textContent(), fixture.product.item_name)
      assert.equal(await heading.isVisible(), true)

      assert.equal(
        await page.locator('[data-static-product-preview]').count(),
        0
      )
    }
  }
  catalogMode = 'offline'
  await page.goto(origin + fixtures[0].meta.path)

  await page.locator('.product-title-row h1').waitFor()

  assert.equal(await page.locator('main h1').count(), 1)
  assert.equal(
    await page.locator('.product-title-row h1').textContent(),
    fixtures[0].product.item_name
  )

  assert.doesNotMatch(
    await page.locator('meta[name=robots]').getAttribute('content'),
    /noindex/
  )

  catalogMode = 'missing'
  await page.reload()

  await page.getByText(
    'This product could not be found or is no longer available.'
  ).waitFor()

  assert.equal(await page.locator('main h1').count(), 0)

  assert.equal(
    await page.locator('[data-static-product-preview]').count(),
    0
  )

  assert.match(
    await page.locator('meta[name=robots]').getAttribute('content'),
    /noindex/
  )

  catalogMode = 'available'

  await page.goto(origin + fixtures[0].meta.path + '?ref=metadata')
  await page.locator('.similar-products a').first().waitFor()
  assert.deepEqual(await readHead(page), fixtures[0].head)
  assert.match(await page.locator('meta[name=robots]').getAttribute('content'), /noindex/)
  await page.getByRole('link', { name: 'Home', exact: true }).first().click()
  await page.waitForURL(origin + '/')
  assert.equal(await page.locator('meta[property="og:type"]').getAttribute('content'), 'website')
  assert.equal(await page.locator('#southwest-jsonld-product').count(), 0)
  assert.notEqual(await page.title(), fixtures[0].head.title)
})
