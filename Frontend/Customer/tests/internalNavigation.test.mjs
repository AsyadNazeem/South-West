import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

function read(path) {
  return readFileSync(
    new URL(path, import.meta.url),
    'utf8'
  )
}

const details = read('../src/pages/ProductDetails.vue')
const generator = read('../scripts/generate-sitemap.mjs')
const header = read('../src/layouts/AppHeader.vue')
const card = read('../src/components/products/ProductCard.vue')

test('runtime product breadcrumb contains crawlable Home and Shop links', () => {
  const breadcrumb = details.match(
    /<nav class="breadcrumbs" aria-label="Breadcrumb">([\s\S]*?)<\/nav>/
  )

  assert.ok(breadcrumb)
  assert.ok(breadcrumb[1].includes(
    '<RouterLink to="/">Home</RouterLink>'
  ))
  assert.ok(breadcrumb[1].includes(
    '<RouterLink to="/shop">Shop</RouterLink>'
  ))
  assert.ok(breadcrumb[1].includes(
    '<span aria-current="page">{{ productName }}</span>'
  ))
})

test('static product breadcrumb matches runtime navigation', () => {
  const breadcrumb = generator.match(
    /<nav class="breadcrumbs" aria-label="Breadcrumb">([\s\S]*?)<\/nav>/
  )

  assert.ok(breadcrumb)
  assert.ok(breadcrumb[1].includes(
    '<a href="/">Home</a>'
  ))
  assert.ok(breadcrumb[1].includes(
    '<a href="/shop">Shop</a>'
  ))
  assert.ok(breadcrumb[1].includes(
    '<span aria-current="page">${escapeHtml(name)}</span>'
  ))
})

test('breadcrumb separators are hidden from assistive technology', () => {
  for (const source of [details, generator]) {
    const breadcrumb = source.match(
      /<nav class="breadcrumbs" aria-label="Breadcrumb">([\s\S]*?)<\/nav>/
    )

    assert.ok(breadcrumb)

    assert.equal(
      (breadcrumb[1].match(
        /<span aria-hidden="true">\/<\/span>/g
      ) || []).length,
      2
    )
  }
})

test('product error navigation points to the shop', () => {
  assert.ok(details.includes(
    '<RouterLink to="/shop">Back to shop</RouterLink>'
  ))

  assert.ok(!details.includes(
    '<RouterLink to="/">Back to shop</RouterLink>'
  ))
})

test('header Shop link points to the shop listing', () => {
  assert.ok(header.includes(
    '<RouterLink to="/shop" class="shop-link">Shop</RouterLink>'
  ))
})

test('product cards use the shared product URL helper', () => {
  assert.ok(card.includes(
    "import { productPathFor } from '@/utils/productSeo.js'"
  ))

  assert.ok(card.includes(
    "const link = computed(() => productPathFor(props.product) || '/')"
  ))
})

test('product image and name links share the same destination', () => {
  assert.match(
    card,
    /<RouterLink\s+:to="link"\s+class="image-link"/
  )

  assert.match(
    card,
    /<RouterLink\s+:to="link"\s+class="card-link"/
  )
})

test('runtime breadcrumb schema retains the existing hierarchy', () => {
  assert.match(
    details,
    /breadcrumbSchema\(\[\s*\{ name: 'Home', path: '\/' \},\s*\{ name: 'Shop', path: '\/shop' \},\s*\{ name: seoName, path: productPath \}/
  )
})
