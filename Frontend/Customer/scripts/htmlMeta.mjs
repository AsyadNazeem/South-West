export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function updateMeta(html, attribute, key, content) {
  const escapedKey = escapeRegex(key)
  const pattern = new RegExp(
    `<meta\\s+[^>]*${attribute}\\s*=\\s*["']${escapedKey}["'][^>]*>`,
    'i'
  )

  const tag = `<meta ${attribute}="${escapeHtml(key)}" content="${escapeHtml(content)}"/>`

  if (pattern.test(html)) {
    return html.replace(pattern, () => tag)
  }

  return html.replace('</head>', () => `    ${tag}\n</head>`)
}

export function updateCanonical(html, canonicalUrl) {
  const pattern = /<link\s+[^>]*rel=["']canonical["'][^>]*>/i
  const tag = `<link rel="canonical" href="${escapeHtml(canonicalUrl)}"/>`

  return pattern.test(html)
    ? html.replace(pattern, () => tag)
    : html.replace('</head>', () => `    ${tag}\n</head>`)
}
