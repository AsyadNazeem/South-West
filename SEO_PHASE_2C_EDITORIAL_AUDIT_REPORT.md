# South West · Phase 2C.1 and 2C.2 editorial audit

**Proposal for approval · 25 November 2026.** Reviewed all 143 public products in the verified Phase 2B capture. The proposals change 113 SEO titles and 142 descriptions. All 143 proposed titles and descriptions are distinct. Seven rows should be held until the owner identifies the product or confirms the signal path. The remaining review can proceed in batches; a catalog field under investigation does not have to appear in the snippet.

## Catalog, method and evidence boundaries

Reused the 25 November catalog captured at **14:28:19 UTC (19:58:19 Sri Lanka)**, with variant capture complete at 14:31:21 UTC. No new storefront or public API requests. Joined the 143 UUIDs to the complete 160-variant capture and verified each active variant’s parent. Ran today’s shared productMetadata over every record and compared the complete returned objects with Phase 2B. All 143 matched, including canonical path, title, description and primary image. Prior Phase 2B browser testing found zero build/browser differences. No new render or production test was needed for a text proposal.

The same capture has 142 in stock, one active out of stock, 14 brands and 143 distinct slashless canonical URLs. Reviewed generated heads, the separate product bodies, variant attributes and image labels. Compared selected model claims with manufacturer sources; the CSV identifies catalog-derived evidence on ordinary rows. No visit to a warehouse, inspection of physical labels or independent certification was performed. The catalog reuse gives direct comparability; inventory changes since that observation are outside this sample.

The working tree already contained unstaged Customer implementation and tests, the disabled cPanel overlay, undeployed backend social previews, untracked SEO and deployment files, Admin tooling and caches. The Git index was empty of staged changes. The previously reviewed Phase 1 closure, on-page audit, 2A baseline and 2B report distinguish deployed behavior, search evidence and local code. The current build and browser still consume the same shared generator.

## Editorial results and branding decision

| Measure | Phase 2B | Proposed |
|---|---:|---:|
| Products / unique canonicals | 143 / 143 | 143 / 143 |
| Titles over 60 characters | 62 | 23 |
| Longest title | 128 | 72 |
| Descriptions over 160 characters | 0 | 0 |
| Descriptions from 120 through 160 characters | 99 | 74 |
| Duplicate titles / descriptions | 0 / 0 | 0 / 0 |
| Generic name-only descriptions | 0 | 0 |

Counted Unicode characters, including spaces and suffixes. Thirty titles and one description are retained. The PK8899 tripod already has a readable opening sentence; adding a feature or extra location phrase would provide little value. Shorter descriptions are deliberate where only one or two specifications help a buyer.

**Suffix experiment.** With identical Phase 2B product wording, changing only “| South West Sri Lanka” to “| South West” saves ten characters and reduces titles over 60 from 62 to 40. The proposals also edit product wording and use the shorter suffix on 67 records, the full suffix on 75 and no suffix on the SouthWest-branded monitor arm. The full suffix preserves a local cue on compact names and on Acer, the one model with a disclosed local price query. On long cable and charger names, preserve the part number, connector direction, power or length before the store location. Twenty-three titles still exceed the guideline. For instance, the X517’s 25 W charger and included 60 W cable must remain distinguishable.

**Catalog-wide title findings.** SCW1050 repeats “Power Socket”; MG22 repeats dryer terminology and adds a stack of specifications; shorten each around the model and product type. Expand generic “Adapter” on travel plugs and “DP” where connector direction matters. Standardize “Pro”, “USB-C”, “NVMe”, cable lengths and brand casing in metadata. Correct “Pnael” and “Vacume” there while keeping catalog names and URLs intact. Use the model before long accessory strings, distinguish SSD capacity and use separate DDR choices. Keep unknown manufacturer module numbers out of memory titles. Thirty-eight products lack a populated variant Model attribute, but readable model identifiers can still exist in names or bodies.

**Description findings.** A literal feature list can bury the answer to a buying question. For the Lightning cable, length and connector fit do more work than repeated “Cable Type” and “Available Lengths” labels. An adapter needs an explicit source and display. For SSDs the 128GB and 256GB versions share the same qualified speed; capacity legitimately distinguishes the copy. The short and long suffix scenarios and description lengths are editorial comparisons, with no ranking forecast.

## Sri Lankan search evidence

The operator’s 2–23 November GSC baseline contained 18 clicks and 87 impressions; Sri Lanka accounted for 18 clicks and 78 impressions. Only six queries were disclosed. “acer aspire go 15 price in sri lanka” recorded one impression, zero clicks and position 48. Other candidate product pages had small impression samples. This supports testing whether the Acer listing answers a local price-and-configuration question. Its proposal invites readers to check the price and does not quote a volatile amount. Model + Sri Lanka, buying a named product, connector compatibility, model specifications and price intent are hypotheses for the remaining rows. No search volume, ranking difficulty or forecast can be inferred. After a separately approved release and recrawl, compare dated Sri Lankan page/query results and flag promotions or stock changes.

## Priority specification checks

**Yesido YP88.** The captured title and two image labels say AA. Its AAA/440 mAh body closely matches the YP98 AAA entry and its variant capacity is an unqualified 2146. A Yesido-branded wholesale listing supports AA but gives 580 mAh; its status as a factory specification was not established. No exact sheet was located on the manufacturer index. A copied or incorrect body is likely. The physical cell size and correct capacity remain open. Require photographs showing model, dimensions or AA/AAA marking and capacity units. [Yesido manufacturer index](https://www.iyesido.com/map-products.htm) [Yesido-branded wholesale page (secondary)](https://yesidoriginal.com/products/aa-rechargeable-battery-yp88)

**ONTEN OTN-5138S.** The manufacturer identifies OTN-5138S as a VGA-source to HDMI-display converter. Catalog name and variant model agree; the body’s final character is “3” and the variant declares USB. The body identifier is likely a typo. An auxiliary power lead, if present, must be distinguished from signal input. Confirm the physical label before publication. [ONTEN OTN-5138S](https://www.onten.com.cn/enp-535.html)

**Kingston 16GB desktop RAM.** The following are the three active captured options. The product body identifies desktop DIMM. Variant strings are reseller labels, and none supplies a Kingston manufacturer part number. DDR4 and DDR5 require different slots. Check the motherboard memory generation, supported transfer rate and CPU compatibility. [Kingston memory compatibility](https://www.kingston.com/en/blog/pc-performance/ddr-memory-generation-differences)

| Catalog variant | Generation | Speed field as stored | Capacity | What remains open |
|---|---|---:|---|---|
| 16 26 DT KN | DDR4 | 2666 | 16GB | Missing from detailed body specs. Verify units, DIMM label and part number. |
| 16 32 DT KN | DDR4 | 3200 | 16GB | Body says 3200 MT/s. Verify part and timing for the supplied module. |
| 16 56 DT KN | DDR5 | 5600 | 16GB | Body says 5600 MT/s. Verify part and timing for the supplied module. |

**ONTEN OTN-5202.** The exact manufacturer page documents USB 3.0 to female HDMI, a 20 cm lead and a “2K” designation. The catalog identifies the input as Type-A. Exact maximum pixels, refresh rate and driver/OS requirements remain unverified. The manufacturer driver index references other model numbers. Omit those performance and compatibility claims until the correct revision-specific manual is available. [ONTEN OTN-5202](https://www.onten.com.cn/enp-467.html) [ONTEN driver index](https://www.onten.com.cn/endown.html)

**Acer AG15-42P-R917.** US part NX.JJHAA.003 specifies Ryzen 7 7730U, 512GB NVMe SSD, 15.6-inch 1920 × 1080 TN display at 60 Hz and Windows 11 Home. The memory section specifies DDR4 and a 32GB maximum. Portuguese part NX.J7WEB.05R lists 8GB installed under the same R917 model; the captured South West record and variant say 16GB DDR4. A regional difference or reseller upgrade is possible. Obtain the local NX part number, installed RAM and OS before claiming the exact sold configuration. The proposal uses the shared CPU, screen size and capacity. [Acer US](https://www.acer.com/us-en/laptops/aspire/aspire-go-amd/pdp/NX.JJHAA.003) [Acer Portugal](https://www.acer.com/pt-pt/laptops/aspire/aspire-go-amd/pdp/NX.J7WEB.05R)

**Soundcore R50i NC.** The support guide maps R50i NC / P30i to A3959, also present in the catalog body. The official P30i page supports 10 mm drivers, Bluetooth 5.4, adaptive ANC rated up to 42 dB and a case that doubles as a phone stand. The phone stand differentiates the proposal without quoting battery life. [Soundcore A3959 guide](https://service.soundcore.com/product-description/a085g00000GjIPnAAN) [Soundcore P30i specifications](https://www.soundcore.com/products/soundcore-p30i)

**Soundcore R60i NC.** The support record maps P31i / R60i NC to D1202 and lists SBC, AAC and LDAC with Bluetooth 6.1. The product page identifies 11 mm titanium-coated drivers and adaptive ANC up to 52 dB. State LDAC compatibility conditionally. Decibel figures are manufacturer maxima, not a promised result in every environment. [Soundcore D1202 support](https://service.soundcore.com/product-description/a08e2000002muutAAA) [Soundcore P31i specifications](https://www.soundcore.com/products/d1202-p31i-wirless-earbuds-with-anc)

## Product bodies, images and correction priorities

- All 143 catalog bodies are populated and distinct by the Phase 2A normalization. Five have fewer than 30 whitespace-delimited words including bullet tokens: Lexar NS100 128GB and 256GB, and R8 1801, 1802 and 1812. Lexar’s interface and capacity-specific read speeds are already useful; the keyboard listings need meaningful layout, connector or footprint differences where the supplier can substantiate them. [Lexar specifications](https://americas.lexar.com/product/ssd-ns100/)
- Some distinct bodies repeat almost the same content. The YP88 and YP98 bodies share the AAA specification block. CA209 repeats an entire block within one product, and its 140 W name/body disagrees with the 240 variant value. MG67 should describe settings and attachments without promising therapy. Name, body and variant may each need a separate correction.
- Nine UGREEN listings say 18 months in body copy and one year in the structured warranty field. The policy owner must identify which terms apply. Neither duration appears in the proposals. The 512GB Exodia listing also needs a physical SKU check: the official DTX sheet lists up to 256GB. [Kingston DTX datasheet](https://www.kingston.com/datasheets/dtx_en.pdf)
- Three of 340 image records have empty alt text: Yesido ST03 image 2, HP 15-fd2050wm image 1 and Lexar NS100 256GB image 2 (capture order). Across 134 products at least two images reuse the same nonempty label; 190 labels contain “buy”, “price” or “best”, and 103 exceed 125 characters. These are review flags, not accessibility pass/fail thresholds. The VC18 gallery repeats retail copy across views. Inspect each actual image, describe a visible connector, control or angle when meaningful, and remove sales phrases. Current Vue uses the product name for the main image and name-plus-index for thumbnails; catalog alt edits alone will not change those bindings.
- The correction register has 35 named owner tasks, including the three missing image labels. Manufacturer evidence supports four specification corrections; 19 additional product/issue pairs remain unresolved. Broader model-family uncertainty, unverified commercial claims and image-quality screening are reported separately. The CSV statuses are 107 ready for review, 28 needing owner verification, seven blocked by conflicting data and one requiring no change. All proposed publication still requires explicit approval.

## Detailed pilot and two conflict entries

Counts in parentheses include the full store suffix. “Ready for review” means ready to present to the owner for editorial approval. A blocked row contains a conservative draft for comparison; it must not be published as an interim fix.

### LDNIO Lightning USB Cable 1M / 2M

Public UUID `ee0d3371-187f-41a5-a640-c5444bcbe6c2` · [Existing canonical](https://southwest.lk/product/ldnio-lightning-usb-cable-1m-2m-ee0d3371-187f-41a5-a640-c5444bcbe6c2)

- **Current title (56)** — LDNIO Lightning USB Cable 1M / 2M | South West Sri Lanka
- **Proposed title (53)** — LDNIO USB to Lightning Cable, 1 m or 2 m | South West
- **Phase 2B description (152)** — LDNIO Lightning USB Cable 1M / 2M. Cable Type: USB to Lightning. Available Lengths: 1 Metre / 2 Metres. Designed for compatible Apple Lightning devices.
- **Proposed description (139)** — Charge or sync a Lightning-equipped Apple device from a USB port. Choose the 1 m LDNIO cable for a desk or the 2 m version for extra reach.

**Evidence.** Catalog and variants — USB to Lightning, 1 m LS901 and 2 m LS902; charging and sync. **Excluded.** MFi certification, charging wattage and compatibility with USB-C-only phones.

**Search intent.** USB to Lightning cable length and Apple device fit. **Editorial rationale.** Lead with charging and syncing, then explain the length choice. **Approval.** Ready for review. Routine editorial sign-off only.

### Acer Aspire Go 15 AG15-42P-R917

Public UUID `c1dd22ae-f5a3-4da6-a5a8-bab11015c4ec` · [Existing canonical](https://southwest.lk/product/acer-aspire-go-15-ag15-42p-r917-c1dd22ae-f5a3-4da6-a5a8-bab11015c4ec)

- **Current title (54)** — Acer Aspire Go 15 AG15-42P-R917 | South West Sri Lanka
- **Proposed title (61)** — Acer Aspire Go 15 AG15-42P-R917 Laptop | South West Sri Lanka
- **Phase 2B description (160)** — Acer Aspire Go 15 AG15-42P-R917. Processor: AMD Ryzen™ 7 7730U Processor. RAM: 16GB DDR4. Storage: 512GB PCIe NVMe SSD. Display Size: 15.6-inch. Colour: Silver.
- **Proposed description (135)** — Check the Acer Aspire Go 15 AG15-42P-R917 price in Sri Lanka and compare its Ryzen 7 7730U processor, 15.6-inch display and 512 GB SSD.

**Evidence.** Catalog and Acer R917 sheet — Ryzen 7 7730U, 15.6-inch display and 512GB SSD. **Excluded.** Installed RAM, local OS and panel configuration until regional part/stock match. [Acer US](https://www.acer.com/us-en/laptops/aspire/aspire-go-amd/pdp/NX.JJHAA.003) [Acer Portugal](https://www.acer.com/pt-pt/laptops/aspire/aspire-go-amd/pdp/NX.J7WEB.05R)

**Search intent.** Acer Aspire Go 15 price in Sri Lanka (one disclosed impression). **Editorial rationale.** Answer the disclosed local query using the configuration fields that agree. **Approval.** Owner verification required. Read NX part number, inspect installed RAM and OS, then match display panel and storage to the sold unit.

### OTN-5202 USB to HDMI Converter

Public UUID `b49b3ea8-ce13-4331-a176-2d608af7df9e` · [Existing canonical](https://southwest.lk/product/otn-5202-usb-to-hdmi-converter-b49b3ea8-ce13-4331-a176-2d608af7df9e)

- **Current title (59)** — ONTEN OTN-5202 USB to HDMI Converter | South West Sri Lanka
- **Proposed title (51)** — ONTEN OTN-5202 USB 3.0 to HDMI Adapter | South West
- **Phase 2B description (127)** — ONTEN OTN-5202 USB to HDMI Converter. Input Interface: USB 3.0 Type-A. Output Interface: HDMI Female. Cable Length: 0.2 Metres.
- **Proposed description (128)** — Connect a computer’s USB 3.0 Type-A port to an HDMI display with the ONTEN OTN-5202. The 20 cm adapter has a female HDMI output.

**Evidence.** ONTEN — USB 3.0 to HDMI female, 0.2 m; catalog specifies Type-A input. **Excluded.** Exact pixels, Hz, driverless operation and OS support. [ONTEN OTN-5202](https://www.onten.com.cn/enp-467.html) [ONTEN driver index](https://www.onten.com.cn/endown.html)

**Search intent.** OTN-5202 USB 3.0 to HDMI adapter compatibility. **Editorial rationale.** Describe the direction and the physical port without promising a display mode. **Approval.** Owner verification required. Obtain model-specific manual or test sheet. Do not reuse the 5201/5201B driver entry.

### R8 1610 Wired Mouse

Public UUID `2bb3b909-39ca-4682-8422-b05ff64faa41` · [Existing canonical](https://southwest.lk/product/r8-1610-wired-mouse-2-2bb3b909-39ca-4682-8422-b05ff64faa41)

- **Current title (42)** — R8 1610 Wired Mouse | South West Sri Lanka
- **Proposed title (46)** — R8 1610 Wired USB Mouse | South West Sri Lanka
- **Phase 2B description (80)** — R8 1610 Wired Mouse. Interface: USB. Designed for desktop computers and laptops.
- **Proposed description (113)** — Connect the R8 1610 directly to a desktop or laptop with a USB port. Its wired connection keeps the setup simple.

**Evidence.** Catalog and variant — R8 1610 wired USB mouse for desktop/laptop. **Excluded.** DPI, sensor part and button count.

**Search intent.** R8 1610 wired USB mouse for laptop or desktop. **Editorial rationale.** Explain how to connect the mouse in one sentence. **Approval.** Ready for review. Routine editorial sign-off only.

### Yesido MG67 Massage Gun for Muscle Therapy Relief

Public UUID `6a545a8b-e6f2-418a-ad67-de44a5387737` · [Existing canonical](https://southwest.lk/product/yesido-mg67-massage-gun-for-muscle-therapy-relief-6a545a8b-e6f2-418a-ad67-de44a5387737)

- **Current title (72)** — Yesido MG67 Massage Gun for Muscle Therapy Relief | South West Sri Lanka
- **Proposed title (59)** — Yesido MG67 Rechargeable Massage Gun | South West Sri Lanka
- **Phase 2B description (158)** — Yesido MG67 Massage Gun for Muscle Therapy Relief. Battery Capacity: 1200mAh. Maximum Power: 35W. Speed Adjustment: 6-level adjustment. Material: ABS plastic.
- **Proposed description (140)** — Adjust the Yesido MG67 through six speed settings and choose from six interchangeable massage heads. The rechargeable unit charges by USB-C.

**Evidence.** Catalog — six adjustment levels, six heads, USB-C charging. **Excluded.** Therapeutic effects, recovery guarantees and exact runtime.

**Search intent.** Yesido MG67 speed settings and massage heads. **Editorial rationale.** Replace the therapeutic promise with controls the buyer can compare. **Approval.** Owner verification required. Review health wording with the owner. Describe the controls and heads without a therapeutic outcome.

### Anker Soundcore R50i NC True Wireless Bluetooth Earbuds

Public UUID `221db4b0-72f6-434c-97b6-fc7f85362ef2` · [Existing canonical](https://southwest.lk/product/anker-soundcore-r50i-nc-true-wireless-bluetooth-earbuds-221db4b0-72f6-434c-97b6-fc7f85362ef2)

- **Current title (78)** — Anker Soundcore R50i NC True Wireless Bluetooth Earbuds | South West Sri Lanka
- **Proposed title (53)** — Anker Soundcore R50i NC Wireless Earbuds | South West
- **Phase 2B description (148)** — Anker Soundcore R50i NC True Wireless Bluetooth Earbuds. 10mm dynamic drivers with Soundcore BassUp technology. Bluetooth 5.4 wireless connectivity.
- **Proposed description (124)** — The R50i NC pairs 10 mm drivers with adaptive noise cancellation of up to 42 dB. Its charging case doubles as a phone stand.

**Evidence.** Soundcore A3959 / P30i — 10 mm drivers, up to 42 dB ANC, phone-stand case. **Excluded.** Guaranteed attenuation or runtime for individual users. [Soundcore A3959 guide](https://service.soundcore.com/product-description/a085g00000GjIPnAAN) [Soundcore P30i specifications](https://www.soundcore.com/products/soundcore-p30i)

**Search intent.** Anker R50i NC noise cancellation and case features. **Editorial rationale.** Differentiate this model through ANC and the stand case. **Approval.** Ready for review. Routine editorial sign-off only.

### Anker Soundcore R60i NC True Wireless Earbuds

Public UUID `dd0b232d-6117-45fd-b759-e34fac440c46` · [Existing canonical](https://southwest.lk/product/anker-soundcore-r60i-nc-true-wireless-earbuds-dd0b232d-6117-45fd-b759-e34fac440c46)

- **Current title (68)** — Anker Soundcore R60i NC True Wireless Earbuds | South West Sri Lanka
- **Proposed title (53)** — Anker Soundcore R60i NC Wireless Earbuds | South West
- **Phase 2B description (153)** — Anker Soundcore R60i NC True Wireless Earbuds. 11mm titanium-coated dynamic drivers for detailed audio reproduction. Bluetooth 6.1 wireless connectivity.
- **Proposed description (111)** — Choose the R60i NC for its 11 mm titanium-coated drivers, Bluetooth 6.1 and LDAC support on compatible devices.

**Evidence.** Soundcore D1202 / P31i — 11 mm titanium-coated drivers, Bluetooth 6.1 and LDAC. **Excluded.** Unconditional LDAC on every phone or a guaranteed ANC result. [Soundcore D1202 support](https://service.soundcore.com/product-description/a08e2000002muutAAA) [Soundcore P31i specifications](https://www.soundcore.com/products/d1202-p31i-wirless-earbuds-with-anc)

**Search intent.** Soundcore R60i NC LDAC and Bluetooth specifications. **Editorial rationale.** Differentiate this model through its drivers and codec support. **Approval.** Ready for review. Routine editorial sign-off only.

### 128GB NS100 2.5" SATA SSD

Public UUID `e63a62fc-4811-4131-b71e-6e62ec11b9b5` · [Existing canonical](https://southwest.lk/product/128gb-ns100-2-5-sata-ssd-e63a62fc-4811-4131-b71e-6e62ec11b9b5)

- **Current title (54)** — Lexar 128GB NS100 2.5" SATA SSD | South West Sri Lanka
- **Proposed title (58)** — Lexar NS100 128GB 2.5-inch SATA SSD | South West Sri Lanka
- **Phase 2B description (111)** — Lexar 128GB NS100 2.5" SATA SSD. Form Factor: 2.5 Inch. Interface: SATA III (6Gb/s). Read Speed: Up to 520MB/s.
- **Proposed description (149)** — The 128GB Lexar NS100 fits a 2.5-inch SATA drive bay and supports read speeds up to 520 MB/s. Check your computer’s drive interface before upgrading.

**Evidence.** Lexar and catalog — NS100 128GB, 2.5-inch SATA III, up to 520 MB/s reads. **Excluded.** Write speed, sustained throughput, bundled accessories and warranty. [Lexar specifications](https://americas.lexar.com/product/ssd-ns100/)

**Search intent.** Lexar NS100 128GB SATA upgrade and fit. **Editorial rationale.** Put the smaller capacity and drive-bay fit ahead of the read-speed ceiling. **Approval.** Ready for review. Routine editorial sign-off only.

### 256GB NS100 2.5" SATA SSD

Public UUID `42220123-c847-472a-965b-99463a7656ef` · [Existing canonical](https://southwest.lk/product/256gb-ns100-2-5-sata-ssd-42220123-c847-472a-965b-99463a7656ef)

- **Current title (54)** — Lexar 256GB NS100 2.5" SATA SSD | South West Sri Lanka
- **Proposed title (58)** — Lexar NS100 256GB 2.5-inch SATA SSD | South West Sri Lanka
- **Phase 2B description (111)** — Lexar 256GB NS100 2.5" SATA SSD. Form Factor: 2.5 Inch. Interface: SATA III (6Gb/s). Read Speed: Up to 520MB/s.
- **Proposed description (149)** — The 256GB Lexar NS100 fits a 2.5-inch SATA drive bay and supports read speeds up to 520 MB/s. Check your computer’s drive interface before upgrading.

**Evidence.** Lexar and catalog — NS100 256GB, 2.5-inch SATA III, up to 520 MB/s reads. **Excluded.** Write speed, sustained throughput, bundled accessories and warranty. [Lexar specifications](https://americas.lexar.com/product/ssd-ns100/)

**Search intent.** Lexar NS100 256GB SATA upgrade and fit. **Editorial rationale.** Identify the 256GB sibling while keeping its shared read-speed limit. **Approval.** Owner verification required. Inspect actual image, then describe the visible feature or view. Omit a decorative duplicate from the accessibility tree only if appropriate.

### 16GB DDR4/DDR5 DESKTOP RAM

Public UUID `06030b7a-f51e-4328-87ce-a368c20949c8` · [Existing canonical](https://southwest.lk/product/16gb-ddr4-ddr5-desktop-ram-06030b7a-f51e-4328-87ce-a368c20949c8)

- **Current title (58)** — Kingston 16GB DDR4/DDR5 DESKTOP RAM | South West Sri Lanka
- **Proposed title (52)** — Kingston 16GB Desktop RAM, DDR4 or DDR5 | South West
- **Phase 2B description (109)** — Kingston 16GB DDR4/DDR5 DESKTOP RAM. Module Type: Desktop DIMM. Designed for compatible desktop motherboards.
- **Proposed description (134)** — Choose a 16GB Kingston desktop DIMM for your motherboard’s memory slot. DDR4 and DDR5 are separate options and cannot be interchanged.

**Evidence.** Catalog — 16GB desktop DIMM and distinct DDR4/DDR5 options; Kingston confirms incompatible keying. **Excluded.** Universal fit, timings, exact transfer units and manufacturer part numbers. [Kingston memory compatibility](https://www.kingston.com/en/blog/pc-performance/ddr-memory-generation-differences)

**Search intent.** Kingston 16GB desktop RAM motherboard generation. **Editorial rationale.** Make generation compatibility explicit before the customer selects an option. **Approval.** Owner verification required. Read all three DIMM labels including units and part numbers. Map them to the public options and board memory support list.

### Yesido YSW14 Bluetooth Speaker

Public UUID `45591a3e-6165-48d5-a6f9-fad60463ebf3` · [Existing canonical](https://southwest.lk/product/yesido-ysw14-bluetooth-speaker-45591a3e-6165-48d5-a6f9-fad60463ebf3)

- **Current title (53)** — Yesido YSW14 Bluetooth Speaker | South West Sri Lanka
- **Proposed title (53)** — Yesido YSW14 Bluetooth Speaker | South West Sri Lanka
- **Phase 2B description (146)** — Yesido YSW14 Bluetooth Speaker. Connectivity: Bluetooth 5.1 for fast transmission (plus TF card playback mode). Battery: 1200mAh built-in battery.
- **Proposed description (122)** — Play music over Bluetooth or from a TF card with the Yesido YSW14. This portable speaker has a built-in 1,200 mAh battery.

**Evidence.** Yesido and catalog — YSW14 Bluetooth speaker and 1200 mAh battery; catalog lists TF card playback. **Excluded.** Bluetooth version, runtime and a current stock promise. [Yesido YSW14](https://www.iyesido.com/pid18436531/YSW14-Custom-Wholesale-Portable-Mini-Wireless-Speaker-Stereo-bt-Mini-Speakers-With-Rope.htm)

**Search intent.** Yesido YSW14 Bluetooth and TF playback. **Editorial rationale.** Retain playback options while avoiding the disputed radio version. **Approval.** Owner verification required. Read the hardware revision and manual. Retain Bluetooth without a version until resolved.

### Yesido YP88 AA Rechargeable Battery

Public UUID `d405e8e5-e417-4b5a-b6ca-578f17b36256` · [Existing canonical](https://southwest.lk/product/yesido-yp88-aa-rechargeable-battery-d405e8e5-e417-4b5a-b6ca-578f17b36256)

- **Current title (58)** — Yesido YP88 AA Rechargeable Battery | South West Sri Lanka
- **Proposed title (57)** — Yesido YP88 Rechargeable Batteries | South West Sri Lanka
- **Phase 2B description (142)** — Yesido YP88 AA Rechargeable Battery. Rated Voltage: 1.5V. Capacity: 440mAh (666mWh). Charging Interface: Built-in Type-C port on each battery.
- **Proposed description (124)** — Check the YP88 pack label for the cell size and capacity your device needs before choosing this Yesido rechargeable battery.

**Evidence.** Catalog agreement limited to Yesido YP88 rechargeable product identity. Size and capacity disputed. **Excluded.** Cell size, capacity, cycle life, unit conversion and pack count. [Yesido manufacturer index](https://www.iyesido.com/map-products.htm) [Yesido-branded wholesale page (secondary)](https://yesidoriginal.com/products/aa-rechargeable-battery-yp88)

**Search intent.** Yesido YP88 battery size identification. **Editorial rationale.** Remove the disputed size and capacity from the held draft. **Approval.** Blocked by conflicting data. Photograph both pack faces and cell marking; identify model, size, voltage and capacity with units. Replace copied body only after matching inventory.

### OTN-5138S VGA to HDMI Converter

Public UUID `5b35b104-19e9-4846-a61c-1c2af68f5442` · [Existing canonical](https://southwest.lk/product/otn-5138s-vga-to-hdmi-converter-5b35b104-19e9-4846-a61c-1c2af68f5442)

- **Current title (60)** — ONTEN OTN-5138S VGA to HDMI Converter | South West Sri Lanka
- **Proposed title (60)** — ONTEN OTN-5138S VGA to HDMI Converter | South West Sri Lanka
- **Phase 2B description (89)** — ONTEN OTN-5138S VGA to HDMI Converter. Applications: HDMI Monitors, HDTVs and Projectors.
- **Proposed description (140)** — Use the ONTEN OTN-5138S to connect a VGA source to an HDMI monitor or projector. Check that the connection direction matches your equipment.

**Evidence.** ONTEN lists OTN-5138S for VGA source to HDMI display. Physical unit pending. **Excluded.** Audio, power requirements, resolution and proof of physical identity. [ONTEN OTN-5138S](https://www.onten.com.cn/enp-535.html)

**Search intent.** ONTEN VGA source to HDMI display conversion. **Editorial rationale.** Make the signal direction explicit; resolve model identity before publication. **Approval.** Blocked by conflicting data. Match package to OTN-5138S; correct body model and distinguish signal ports from any auxiliary power port. The last-character typo is probable; stock identity needs inspection.

## Implementation recommendation and readiness

1. Approve or annotate the CSV by product. Resolve blocked identities against stock before touching any catalog field. Give the owner the correction register separately from title and snippet decisions.
2. Keep one pure generator in Frontend/Customer/src/utils/productSeo.js; scripts/generate-sitemap.mjs and src/pages/ProductDetails.vue already call it. A small shared suffix-choice rule, approved case/spelling conventions and preference for a factual opening sentence can address repeatable patterns. Exact model strings, variant-specific limits and natural prose belong with verified product content. The existing generator currently favors labeled facts ahead of prose; review that selection order against the pilot.
3. The public response and inspected backend source exposed no supported dedicated SEO title or description override. A curated title may differ intentionally from an immutable catalog name. Prototype maintainable, general display transformations first; bespoke copy that cannot be expressed that way needs a separately approved content mechanism. Do not ship the CSV as a UUID lookup table. Preserve names, visible H1, paths, canonical identity, stock logic and schema.
4. For Phase 2C.3, test the approved subset in an isolated build. Compare initial head, hydration, SPA navigation and refresh; recheck names/UUIDs, sitemap and canonicals, escaping, sibling duplicates, measured lengths and the effect of stale snapshots. Exclude held claims from both build and runtime. Use the previously documented gallery test exception; no UI change is part of this proposal.
5. Editorial review is complete. Phase 2C.3 is ready for **approval of a bounded subset**, with catalog evidence gates on the held rows. No release decision, ranking gain or commercial outcome follows from these measurements.

## Validation

Checked 143 CSV data rows against 143 unique public UUIDs, original names and exact generated canonical URLs. Recomputed the four length columns and checked title and description uniqueness, row reasons, verification status and source presence. Compared tracked working-tree changes and pre-existing untracked files before and after authoring. The three review artifacts are the only repository additions for this stage. Git whitespace validation passed. No application test was rerun because application source and configuration stayed unchanged.
