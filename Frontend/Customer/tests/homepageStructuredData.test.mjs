import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  insertHomepageOrganizationSchema,
  removeHomepageOrganizationSchema,
  writeHomepageOrganizationSchema,
} from '../scripts/homepageStructuredData.mjs'

import { organizationSchema } from '../src/utils/structuredData.js'

const template = `<!doctype html>
<html>
<head>
<title>South West</title>
<link rel="canonical" href="https://southwest.lk/"/>
</head>
<body><div id="app"></div></body>
</html>`

function readOrganization(html) {
  const matches = [...html.matchAll(
    /<script id="southwest-jsonld-organization" type="application\/ld\+json">([\s\S]*?)<\/script>/g
  )]

  assert.equal(matches.length, 1)

  return JSON.parse(matches[0][1])
}

test('static homepage uses the shared Organization schema', () => {
  const html = insertHomepageOrganizationSchema(template)

  assert.deepEqual(
    readOrganization(html),
    organizationSchema()
  )
})

test('homepage insertion is idempotent', () => {
  const first = insertHomepageOrganizationSchema(template)
  const second = insertHomepageOrganizationSchema(first)

  assert.equal(second, first)
  readOrganization(second)
})

test('homepage schema is removed from reused product templates', () => {
  const html = insertHomepageOrganizationSchema(template)

  assert.equal(
    removeHomepageOrganizationSchema(html),
    template
  )
})

test('existing Product and Breadcrumb scripts remain unchanged', () => {
  const otherSchemas =
    '<script id="southwest-jsonld-product" type="application/ld+json">{"@type":"Product"}</script>' +
    '<script id="southwest-jsonld-breadcrumb" type="application/ld+json">{"@type":"BreadcrumbList"}</script>'

  const original = template.replace(
    '</head>', otherSchemas + '</head>'
  )

  const updated = insertHomepageOrganizationSchema(original)

  assert.equal(
    removeHomepageOrganizationSchema(updated),
    original
  )
})

test('invalid HTML fails rather than silently skipping insertion', () => {
  assert.throws(
    () => insertHomepageOrganizationSchema('<html></html>'),
    /closing head tag/
  )
})

test('post-build writer changes only the requested homepage file', async () => {
  const directory = await mkdtemp(
    join(tmpdir(), 'sw-homepage-schema-')
  )

  try {
    const index = join(directory, 'index.html')
    const shell = join(directory, 'app-shell.html')
    const product = join(directory, 'product.html')
    const returns = join(directory, 'returns.html')

    for (const path of [index, shell, product, returns]) {
      await writeFile(path, template)
    }

    await writeHomepageOrganizationSchema(index)

    assert.deepEqual(
      readOrganization(await readFile(index, 'utf8')),
      organizationSchema()
    )

    for (const path of [shell, product, returns]) {
      assert.equal(await readFile(path, 'utf8'), template)
    }

    const first = await readFile(index, 'utf8')

    await writeHomepageOrganizationSchema(index)

    assert.equal(await readFile(index, 'utf8'), first)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
