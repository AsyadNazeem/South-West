# Eid artwork

The built-in image generator produced thirteen original PNGs. The logo combines the existing South West lettering with the Eid crescent. The small card star comes from the same jewellery rendering. Pillow trimmed the alpha bounds before resampling the cutouts.

| Artwork | Source pixels | Source bytes | WebP pixels | WebP bytes |
|---|---:|---:|---:|---:|
| [crescent](../../Frontend/Customer/public/themes/eid/decorations/eid-crescent.webp) | 1312 × 1199 | 917,408 | 223 × 240 | 20,796 |
| [header](../../Frontend/Customer/public/themes/eid/decorations/eid-header.webp) | 2172 × 724 | 1,380,391 | 840 × 269 | 93,872 |
| [star](../../Frontend/Customer/public/themes/eid/decorations/eid-star.webp) | 1312 × 1199 | 1,044,545 | 181 × 240 | 16,152 |
| [hanging-ornament](../../Frontend/Customer/public/themes/eid/decorations/eid-hanging-ornament.webp) | 1024 × 1536 | 1,948,225 | 121 × 240 | 10,526 |
| [lantern](../../Frontend/Customer/public/themes/eid/decorations/eid-lantern.webp) | 1024 × 1536 | 1,999,613 | 94 × 240 | 9,614 |
| [gifts](../../Frontend/Customer/public/themes/eid/decorations/eid-gifts.webp) | 1774 × 887 | 2,854,763 | 220 × 108 | 13,920 |
| [garland](../../Frontend/Customer/public/themes/eid/decorations/eid-garland.webp) | 2172 × 724 | 554,848 | 400 × 112 | 12,172 |
| [section-divider](../../Frontend/Customer/public/themes/eid/decorations/eid-section-divider.webp) | 2172 × 724 | 348,682 | 300 × 33 | 4,238 |
| [card-corner](../../Frontend/Customer/public/themes/eid/decorations/eid-card-corner.webp) | 1278 × 1230 | 539,655 | 128 × 124 | 4,990 |
| [whatsapp](../../Frontend/Customer/public/themes/eid/decorations/eid-whatsapp.webp) | 1254 × 1254 | 1,476,772 | 205 × 220 | 13,250 |
| [footer-right](../../Frontend/Customer/public/themes/eid/decorations/eid-footer-right.webp) | 1536 × 1024 | 2,040,188 | 480 × 319 | 49,070 |
| [footer-left](../../Frontend/Customer/public/themes/eid/decorations/eid-footer-left.webp) | 1774 × 887 | 1,503,799 | 480 × 241 | 34,146 |
| [greeting](../../Frontend/Customer/public/themes/eid/decorations/eid-greeting.webp) | 1672 × 941 | 1,920,718 | 1100 × 619 | 71,942 |
| [logo](../../Frontend/Customer/public/themes/eid/eid-logo.webp) | 2171 × 724 | 356,175 | 593 × 128 | 20,658 |
| [card-star](../../Frontend/Customer/public/themes/eid/decorations/eid-card-star.webp) | 1312 × 1199 | 917,408 | 76 × 80 | 4,034 |

The [repeating background](../../Frontend/Customer/public/themes/eid/decorations/eid-background.svg) is a 435-byte SVG. The 15 WebPs and the SVG total 379,815 bytes.

## Art direction

The header combines blue jewels, warm lanterns and champagne-gold chains. The greeting places its royal blue and gold still life opposite the HTML text. Independent left and right footer cutouts frame the page. The WhatsApp artwork keeps the white phone legible inside a green circle with a small sapphire and crescent.

## Implementation files

- [Backend/src/config/websiteThemes.js](../../Backend/src/config/websiteThemes.js)
- [Frontend/Customer/src/App.vue](../../Frontend/Customer/src/App.vue)
- [Frontend/Customer/src/style.css](../../Frontend/Customer/src/style.css)
- [Frontend/Customer/src/assets/styles/eid.css](../../Frontend/Customer/src/assets/styles/eid.css)
- [Frontend/Customer/src/components/SeasonalDecorations.vue](../../Frontend/Customer/src/components/SeasonalDecorations.vue)
- [Frontend/Customer/src/components/FloatingWhatsApp.vue](../../Frontend/Customer/src/components/FloatingWhatsApp.vue)
- [Frontend/Customer/src/layouts/AppHeader.vue](../../Frontend/Customer/src/layouts/AppHeader.vue)
- [Frontend/Customer/src/layouts/AppFooter.vue](../../Frontend/Customer/src/layouts/AppFooter.vue)
- [Frontend/Customer/src/pages/Home.vue](../../Frontend/Customer/src/pages/Home.vue)
