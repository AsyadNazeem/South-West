# Ramadan storefront artwork

For the header, footer and WhatsApp artwork, the built-in image generator produced eight independent transparent PNGs. Those elements use ten WebPs, including a separate brass star cropped from the festoon and a composition of the original South West wordmark with the generated crescent.

| Artwork | Source dimensions | Source bytes | WebP dimensions | WebP bytes |
|---|---:|---:|---:|---:|
| [ramadan-logo.webp](../../Frontend/Customer/public/themes/ramadan/ramadan-logo.webp) | 2171 × 724 | 356,175 | 594 × 131 | 21,412 |
| [ramadan-header.webp](../../Frontend/Customer/public/themes/ramadan/decorations/ramadan-header.webp) | 2149 × 732 | 791,229 | 880 × 265 | 65,374 |
| [ramadan-lantern-01.webp](../../Frontend/Customer/public/themes/ramadan/decorations/ramadan-lantern-01.webp) | 1024 × 1536 | 1,831,903 | 73 × 240 | 8,406 |
| [ramadan-lantern-02.webp](../../Frontend/Customer/public/themes/ramadan/decorations/ramadan-lantern-02.webp) | 1312 × 1199 | 1,120,620 | 140 × 240 | 17,412 |
| [ramadan-lantern-03.webp](../../Frontend/Customer/public/themes/ramadan/decorations/ramadan-lantern-03.webp) | 1024 × 1536 | 1,742,821 | 88 × 240 | 9,558 |
| [ramadan-crescent.webp](../../Frontend/Customer/public/themes/ramadan/decorations/ramadan-crescent.webp) | 1312 × 1199 | 1,036,275 | 229 × 240 | 16,502 |
| [ramadan-footer-left.webp](../../Frontend/Customer/public/themes/ramadan/decorations/ramadan-footer-left.webp) | 1536 × 1024 | 1,930,173 | 400 × 324 | 33,918 |
| [ramadan-footer-right.webp](../../Frontend/Customer/public/themes/ramadan/decorations/ramadan-footer-right.webp) | 1536 × 1024 | 2,209,073 | 400 × 285 | 35,442 |
| [ramadan-whatsapp.webp](../../Frontend/Customer/public/themes/ramadan/decorations/ramadan-whatsapp.webp) | 1254 × 1254 | 1,685,665 | 175 × 192 | 13,366 |
| [ramadan-star.webp](../../Frontend/Customer/public/themes/ramadan/decorations/ramadan-star.webp) | 99 × 103 crop from header PNG | shared source | 67 × 72 | 5,050 |

The logo row gives the original brand PNG size. Its crescent uses the same source as the separate crescent row. The ten WebPs total 226,440 bytes.

## Generation prompts

Each subject prompt followed this shared direction.

> Premium photorealistic studio product cutout, genuine alpha transparent background, no floor, no backdrop, no shadow plane, no text, no Arabic lettering. Brushed antique gold, crisp delicate edges, tasteful warm light, elegant Ramadan collection.

- **header** — Wide shallow festoon: one delicate fine brass double swag chain, ends at equal height, three tiny pendant warm illuminated filigree lanterns with small star charms. Horizontal composition.
- **lantern-01** — One hanging tall narrow six-sided antique gold fanous with amber glass, fine short chain above.
- **lantern-02** — One hanging round pierced-brass globe lantern, warm candle glow through intricate octagonal lattice, short fine chain.
- **lantern-03** — One hanging small pear-shaped tapered brass lantern, emerald glass with warm light and short fine chain.
- **crescent** — One upright sculptural slim hammered golden crescent opening right with two tiny gold stars nestled inside, polished jewelry finish.
- **footer-left** — Low horizontal still life, tall glowing faceted brass lantern on LEFT, a low brass dish of dates and tiny resting metallic star on right. All objects share a baseline.
- **footer-right** — Low horizontal still life, tall glowing round latticed lantern on RIGHT, short standing gold crescent sculpture and little dates on left. All objects share a baseline.
- **whatsapp** — App icon front view. Recognizable green circular WhatsApp button with exact clean white telephone receiver inside standard white chat bubble centered. A tiny metallic gold crescent hugs upper left rim and two tiny gold stars sit on upper edge. Fully visible icon.

## Shopping sections

The greeting uses HTML text over a generated emerald silk still life. The product and category photographs come from the catalog. Section headings and ambient particles reuse the crescent and star listed above.

| Asset | Source dimensions | Source bytes | Delivered dimensions | Delivered bytes |
|---|---:|---:|---:|---:|
| [Greeting](../../Frontend/Customer/public/themes/ramadan/decorations/ramadan-greeting.webp) | 2172 × 724 | 1,902,357 | 1200 × 400 | 48,208 |
| [Corner inlay](../../Frontend/Customer/public/themes/ramadan/decorations/ramadan-corner.webp) | 1278 × 1230 | 2,195,358 | 180 × 162 | 17,130 |
| [Divider](../../Frontend/Customer/public/themes/ramadan/decorations/ramadan-divider.webp) | 2172 × 724 | 205,392 | 320 × 41 | 3,736 |
| [Seamless eight-point star tile](../../Frontend/Customer/public/themes/ramadan/decorations/ramadan-background.svg) | Vector original | 420 | 88 × 88 repeat | 420 |

The three PNGs totaled 4,303,107 bytes. Pillow trimmed the transparent ornaments and exported the three WebPs at 69,074 bytes combined. The vector tile brings the new artwork total to 69,494 bytes.

### Generation prompts

- **Greeting** — Ultra-wide horizontal luxury Ramadan still life banner, panoramic 4:1 composition. Edge-to-edge dark sumptuous emerald silk folds and deep green studio backdrop. Elegant faceted brass lanterns with warm candlelight and a hammered golden crescent arranged on the far RIGHT third. Keep left two thirds tranquil dark green subtly textured negative space for text to be added in code. Opulent editorial photography, restrained amber illumination, no text, letters, calligraphy, logos or borders.
- **Corner** — Isolated compact top RIGHT art-deco Islamic geometric corner inlay, perpendicular luxury gilded brass thin lines with interlocking eight-point star geometry, precise fine engraved metal on transparent background. Triangular right angle with vertex at top right. Delicate open lattice, no plaque, no background, no typography. Ornament for ivory ecommerce card corner.
- **Divider** — Isolated delicate horizontal gold decorative divider on transparent background. Symmetrical fine straight tapering brass rays extending left and right from small central intricate eight-pointed geometric star inlay, premium thin precision metalwork, very wide shallow composition. No background, shadow plane or lettering.
