import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const dist = fileURLToPath(new URL('../dist/', import.meta.url))
const origin = 'https://store.test'

test('late promotion data keeps the benefits strip in place at mobile and desktop widths', {
  skip: !process.env.CHROME_BIN || !process.env.PLAYWRIGHT_MODULE,
  timeout: 30000,
}, async t => {
  const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE)
  const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN })
  t.after(() => browser.close())

  for (const width of [375, 650, 651, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' })
    const banners = Promise.withResolvers()
    await page.route('**/*', async route => {
      const url = new URL(route.request().url())
      if (url.origin === origin) {
        const file = url.pathname === '/' ? 'index.html' : url.pathname
        return route.fulfill({ path: path.join(dist, file) })
      }

      let data = []
      if (url.pathname.endsWith('/store/homepage-banners')) data = await banners.promise
      return route.fulfill({
        headers: { 'access-control-allow-origin': '*' },
        json: { data, pagination: { hasMore: false } },
      })
    })

    await page.goto(origin, { waitUntil: 'domcontentloaded' })
    await page.locator('.banner-placeholder').waitFor()
    const benefits = page.getByRole('list', { name: 'Why shop with us' })
    const before = await benefits.boundingBox()
    banners.resolve([1, 2].map(id => ({ id, title: 'Promotion ' + id, image_url: origin + '/SWLogo.webp' })))
    await page.locator('.banner-image').waitFor()
    const after = await benefits.boundingBox()
    assert.ok(Math.abs(before.y - after.y) < 1, `${width}px moved benefits from ${before.y} to ${after.y}`)
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))

    const secondBanner = page.getByRole('button', { name: 'Show banner 2' })
    const bounds = await secondBanner.boundingBox()
    assert.ok(bounds.width >= 24 && bounds.height >= 24)
    await secondBanner.focus()
    await page.keyboard.press('Enter')
    await page.getByRole('heading', { name: 'Promotion 2' }).waitFor()
    await page.close()
  }
})
