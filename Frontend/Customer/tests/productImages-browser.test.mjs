import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const dist = fileURLToPath(new URL('../dist/', import.meta.url))
const origin = 'https://store.test'

test('product cards reuse primary gallery variants and preserve original-only slides', {
  skip: !process.env.CHROME_BIN || !process.env.PLAYWRIGHT_MODULE,
  timeout: 30000,
}, async t => {
  const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE)
  const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN })
  t.after(() => browser.close())

  for (const [width, deviceScaleFactor, expectedWidth] of [[390, 1, 320], [1440, 2, 640]]) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor })
    const downloads = []
    const original = origin + '/photos/front-1200.svg'
    const back = origin + '/photos/back-1200.svg'
    const product = {
      id: 1, item_name: 'Gallery fixture', image: original,
      images: [
        { url: original, is_primary: true, responsive_images: [320, 640].map(width => ({
          width, url: origin + '/photos/front-' + width + '.svg',
        })) },
        { url: back },
      ],
    }
    await page.route('**/*', async route => {
      const url = new URL(route.request().url())
      if (url.pathname.startsWith('/photos/')) {
        downloads.push(url.pathname)
        const size = Number(url.pathname.match(/-(\d+)\.svg$/)[1])
        return route.fulfill({ contentType: 'image/svg+xml', body: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"/>` })
      }
      if (url.origin === origin) {
        return route.fulfill({ path: path.join(dist, url.pathname === '/' ? 'index.html' : url.pathname) })
      }
      return route.fulfill({
        headers: { 'access-control-allow-origin': '*' },
        json: { data: url.pathname.endsWith('/store/products') ? [product] : [], pagination: { hasMore: false } },
      })
    })

    await page.goto(origin)
    const card = page.locator('#products .product-card').first()
    const image = card.locator('.image-link img')
    await image.scrollIntoViewIfNeeded()
    await image.evaluate(img => img.decode())
    assert.deepEqual(downloads, ['/photos/front-' + expectedWidth + '.svg'])
    const secondImage = card.getByRole('button', { name: 'Show image 2 of 2' })
    const bounds = await secondImage.boundingBox()
    assert.ok(bounds.width >= 24 && bounds.height >= 24)
    await secondImage.click()
    await image.evaluate(img => img.decode())
    assert.equal(await image.evaluate(img => img.currentSrc), back)
    await page.close()
  }
})
