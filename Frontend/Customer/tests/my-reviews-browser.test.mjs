import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const dist = fileURLToPath(new URL('../dist/', import.meta.url))
const origin = 'https://account.test'

test('My Reviews loads both linked photos and omits the gallery for a text-only review', {
  skip: !process.env.CHROME_BIN || !process.env.PLAYWRIGHT_MODULE,
}, async t => {
  const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE)
  const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN })
  t.after(() => browser.close())
  const page = await browser.newPage()
  await page.addInitScript(() => sessionStorage.setItem('customerToken', 'fixture'))
  const images = ['first', 'second'].map((name, id) => ({ id, url: '/uploads/reviews/images/' + name + '.png' }))
  let apiOrigin
  await page.route('**/*', async route => {
    const request = route.request()
    const url = new URL(request.url())
    const headers = {
      'access-control-allow-origin': origin,
      'access-control-allow-methods': 'GET, OPTIONS',
      'access-control-allow-headers': 'authorization, content-type',
    }
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers })
    if (request.resourceType() === 'document') return route.fulfill({ path: path.join(dist, 'index.html') })
    if (url.pathname.endsWith('/customer-auth/me')) {
      return route.fulfill({ headers, json: { customer: { id: 5, first_name: 'Sam' } } })
    }
    if (url.pathname.endsWith('/customer-reviews/my')) {
      apiOrigin = url.origin
      return route.fulfill({ headers, json: { data: [
        { id: 12, rating: 4, review_title: 'With photos', images },
        { id: 13, rating: 3, review_title: 'Without photos', images: [] },
      ] } })
    }
    if (url.origin === apiOrigin && images.some(image => image.url === url.pathname)) {
      return route.fulfill({ path: path.join(dist, 'Favicon.png'), contentType: 'image/png' })
    }
    if (url.origin === origin && url.pathname.startsWith('/assets/')) {
      return route.fulfill({ path: path.join(dist, url.pathname) })
    }
    return route.fulfill({ headers, json: { data: [] } })
  })
  await page.goto(origin + '/account/reviews')
  const cards = page.locator('.reviews-page article')
  await cards.filter({ hasText: 'Without photos' }).waitFor()
  assert.equal(await cards.nth(1).locator('img').count(), 0)
  const photos = cards.first().locator('.photo img')
  assert.equal(await photos.count(), 2)
  for (const [index, photo] of (await photos.all()).entries()) {
    await photo.scrollIntoViewIfNeeded()
    const href = await photo.evaluate(async image => {
      await image.decode()
      return image.naturalWidth && image.currentSrc === image.closest('a').href && image.currentSrc
    })
    assert.equal(href, apiOrigin + images[index].url)
  }
})
