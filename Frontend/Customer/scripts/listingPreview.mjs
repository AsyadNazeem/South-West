import { listingContent } from '../src/router/listingContent.js'
import { escapeHtml } from './htmlMeta.mjs'

export function insertListingPreview(html, path) {
  const content = listingContent[path]

  if (!Object.hasOwn(listingContent, path)) {
    throw new Error(`Unknown listing route: ${path}`)
  }

  const marker = '<div id="app"></div>'

  if (html.split(marker).length !== 2) {
    throw new Error('Expected exactly one empty application container.')
  }

  const directory = path === '/categories' || path === '/brands'
  const prefix = directory ? 'directory' : 'store'

  const extraLink = path === '/offers'
    ? '<a href="/shop" class="store-text-link">View all products</a>'
    : ''

  const preview = `<main class="${prefix}-page" data-static-listing-preview>
    <div class="${prefix}-container">
      <nav class="${prefix}-breadcrumb" aria-label="Breadcrumb">
        <a href="/">Home</a>
        <span>/</span>
        <span>${escapeHtml(content.breadcrumb)}</span>
      </nav>
      <header class="${prefix}-heading">
        <div>
          <p class="${prefix}-eyebrow">${escapeHtml(content.eyebrow)}</p>
          <h1>${escapeHtml(content.heading)}</h1>
          <p>${escapeHtml(content.description)}</p>
        </div>
        ${extraLink}
      </header>
      <p>JavaScript is required to browse the live catalog.</p>
    </div>
  </main>`

  return html.replace(marker, () => `<div id="app">${preview}</div>`)
}
