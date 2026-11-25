import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { organizationSchema } from '../src/utils/structuredData.js'

const SCRIPT_ID = 'southwest-jsonld-organization'

export function removeHomepageOrganizationSchema(html) {
  return html.replace(
    /<script\b[^>]*\bid\s*=\s*(["'])southwest-jsonld-organization\1[^>]*>[\s\S]*?<\/script\s*>/gi,
    ''
  )
}

export function insertHomepageOrganizationSchema(html) {
  const cleaned = removeHomepageOrganizationSchema(html)

  if (cleaned.split('</head>').length !== 2) {
    throw new Error('Expected exactly one closing head tag.')
  }

  const json = JSON.stringify(organizationSchema())
    .replaceAll('<', '\\u003c')
    .replaceAll('>', '\\u003e')
    .replaceAll('&', '\\u0026')

  const script =
    `<script id="${SCRIPT_ID}" type="application/ld+json">${json}</script>`

  return cleaned.replace(
    '</head>',
    () => `${script}</head>`
  )
}

export async function writeHomepageOrganizationSchema(
  indexPath = resolve('dist/index.html')
) {
  const html = await readFile(indexPath, 'utf8')
  const updated = insertHomepageOrganizationSchema(html)

  if (updated !== html) {
    await writeFile(indexPath, updated, 'utf8')
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  await writeHomepageOrganizationSchema()
  console.log('Generated static homepage Organization schema.')
}
