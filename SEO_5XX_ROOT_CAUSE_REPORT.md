# South West historical crawl server errors — Phase 0

25 November 2026 · Issue S1 · Repository revision `d884353`

## Executive summary

**Historical root cause undetermined.** Search Console reported a rounded 4% of approximately 1,650 crawl requests as HTTP 5XX. That implies roughly 66 requests. The exact count, affected URLs, status subtypes and failure times are unknown. The API host's recent availability warning makes its logs a sensible first place to look, but all three hosts remain in scope.

The smallest actionable handoff is **one dated GSC 5XX example and its matching virtual-host access entry**, including the final status and any upstream status. Those two records can identify which serving layer to investigate first. Preserve rotated logs for all three hosts while obtaining the reporting dates. A single explained request would establish the cause for that request only.

## Error request inventory and affected hosts

| Evidence in the supplied snapshot | Host | Request path | Failure time | HTTP status | What it establishes |
|---|---|---|---|---|---|
| Domain-level response breakdown | Host unassigned | Unavailable | Reporting interval unavailable | 5XX class only | Aggregate server-error activity. The 25 November capture date is the observation date. |
| 881 requests, no host problem reported | southwest.lk | Unavailable | Unavailable | Per-host breakdown unavailable | Storefront traffic present. Individual server errors remain possible. |
| 701 requests, host problems during the preceding week | api.southwest.lk | Unavailable | No event timestamps | Per-host breakdown unavailable | Lead for investigation. The warning component and its overlap with the 5XX requests are unknown. |
| 65 requests, no host problem reported | www.southwest.lk | Unavailable | Unavailable | Per-host breakdown unavailable | Alias traffic present. Individual server errors remain possible. |

**Individual failed requests available for correlation: 0. Confirmed affected endpoints: 0 identified.** The table contains aggregate observations only. The earlier audit recorded a successful API catalog GET, a 404 on API robots.txt, and 200/301 responses from the storefront. These are separate spot checks. A current GET cannot recover the historical response or its producer. Evidence is in `SEO_CRAWL_AUDIT_REPORT.md:23–35,38–57,74–78`.

## Supporting log evidence and collection limits

The supplied brief and existing audit contain no GSC 5XX example rows. The project search included hidden and ignored files outside dependency and Git internals, common log/rotation names, server and process output, and export/archive filenames. No relevant production HTTP access, error, upstream, application, DB or deployment event logs were located. The storefront README's Search Console reference is setup guidance (`Frontend/Customer/README.md:13`). Historical snippets below are **not available**; source references and diagnostic strings in this report describe the checked-out code only.

No incident-era release mapping, authenticated GSC session or hosting telemetry was supplied. Database backups and private environment values were unnecessary. No fresh production probes, fault injection or application startup were used. In particular, starting this backend would run theme synchronization before listen.

## Timestamp correlation and missing evidence

| Obtain from | Minimum fields or records | Correlation purpose |
|---|---|---|
| Search Console property owner | Actual report start/end, displayed time zone and precision, 5XX example URLs with crawl dates/times and any status detail, plus the dated API host-status component | Anchor the incidents. Keep unknown subtypes unknown until corroborated. Include examples from different dates/hosts where available. |
| Hosting operator | Redacted LiteSpeed/vhost access and error records for apex, www and API. Include rotated records, timestamp with offset, host, method, sanitized path, final status, duration, request ID, upstream status and connect/response timings if recorded. Include proxy/CDN records if one was in the serving path. | Identify where the request arrived and which hop issued the response. Establish whether logs cover the full interval. |
| Backend/process operator | Application stderr/stdout, process-manager starts/exits, readiness, instance/release identifiers, restarts, host resource limits and termination events | Separate a controller exception from a process that never accepted the request. |
| DB/storage operator and deployer | Matching DB connection/error events, pool waits or slow-query fingerprints, filesystem errors and capacity, deployment start/end, active revision and restart history | Identify the failing dependency or release phase for a specific request. No raw customer SQL or private media contents needed. |

Normalize source timestamps to UTC while preserving original offsets and precision. Match by host, path, method and time, then follow a shared request ID where available. Allow for measured clock skew and request duration. For repeated URLs or minute/day precision, retain all plausible matches until other fields disambiguate. Verify crawler identity using operator-side evidence before labeling access-log-only rows as Googlebot. Retain only a verification flag in the report. Keep tokens, customer identifiers, cookies and raw query values out of exports; use consistent redacted identifiers when needed for joins.

For each match record the GSC example, edge status, upstream status, app completion/exception, dependency event and deployed revision. A proxy timeout can precede an eventual application success. A missing app entry is inconclusive unless logger coverage and retention are known. Classify matched requests by cause and give unmatched requests a separate count. If historical logs have expired, document the precise gap and use future monitoring to attribute recurrences.

## Confirmed root causes

**None established for S1.** There is no historical request-level evidence linking the reported class to LiteSpeed, Express, MySQL, storage, a deployment or an upstream. Neither the 417 ms aggregate mean nor a source-level failure branch identifies the producer of a particular response.

## Suspected causes and endpoint traces

The following are conditional traces for triage. Their ordering follows the serving path. Available evidence does not support ranking them by likelihood.

| Candidate layer and request scope | Relevant code or configuration | Evidence that would distinguish the cause |
|---|---|---|
| LiteSpeed, vhost or upstream connectivity; any host | The prior audit observed LiteSpeed. Customer files and rewrites are deployed under the storefront root (`.cpanel.yml:4–10`, `Frontend/Customer/public/.htaccess:1–15`). Express assumes one proxy (`Backend/src/app.js:96–99`). Live proxy topology and timeouts are unknown. | Match a final 5XX to the vhost error, upstream response, connection refusal/reset or upstream timeout. An apex static HTML error can originate at hosting without any API call. Inspect the actual hop that returned HTTP; a crawler DNS failure alone supplies no HTTP status. |
| Backend process unavailable; API paths across routes | `startServer` authenticates to MySQL, awaits theme synchronization and starts the configured worker before listen. The catch labels failures inside this block “Unable to connect to MySQL.” Theme sync includes DB find/create and updates (`Backend/src/app.js:259–283`, `Backend/src/services/websiteThemeRegistryService.js:7–61`). | Look for refused upstream connections paired with process exit/start, a missing listener or failed readiness. Use the underlying exception and startup stage. The generic catch label on its own cannot distinguish authentication from theme sync or synchronous worker startup failure. |
| Express exception or database query failure; public catalog API | `/api/store/products` → product router → cache middleware → `getStoreProducts`. Listing performs image eligibility, campaign lookup and catalog queries. Paginated listing executes SQL; variants fetch price and stock per variant. Product catches explicitly send 500 (`Backend/src/app.js:233–235`, `Backend/src/routes/storeProductRoutes.js:16–25`, `Backend/src/controllers/storeProductController.js:57–77,188–198,361–430,695–699,1023–1054,1117,1221–1227`, `Backend/src/utils/storeProductListingQuery.js:414–417`). `/api/store/categories` → `getStoreCategories` → active-category query and image metadata → catch/500 (`Backend/src/routes/storeCategoryRoutes.js:5–7`, `Backend/src/controllers/storeCategoryController.js:5–29,62–72`). | Match edge and app status to an exception class, stack and release. A DB error code plus same-time pool/DB evidence supports a DB cause. A JavaScript stack referencing transformation code supports a different cause. Product and category endpoints are examples of candidates; none appears in a historical failure row. |
| Request timeout or saturation; API catalog and variants | Catalog-wide image eligibility reads and per-variant DB fan-out can increase service time (`Backend/src/utils/productStockHistory.js:119–132`, product controller lines above). Browser Axios deadline is 15 s (`Frontend/Customer/src/services/api.js:4–10`). | Compare upstream connect and response times with the actual proxy deadline, app finish/abort time, pool waits and SQL duration. A client abort does not establish an HTTP 504. |
| Media storage or filesystem; API uploads or catalog enrichment | `/uploads` goes through global middleware and then Express static serving (`Backend/src/app.js:113–143,216–227`). The catalog validator opens, stats and reads images. It catches file errors and returns false (`Backend/src/utils/fileStorage.js:157–180`). | For a failed media URL, obtain static-handler/vhost status and filesystem error or capacity evidence. An unreadable image during eligibility checking can simply exclude an item. That code path alone does not establish a 500. |
| Deployment interruption; storefront or API | cPanel tasks build and copy frontend output (`.cpanel.yml:4–10`). Those tasks do not establish a backend restart. Prior audit HTML or sitemap modification times establish file age only. | Match deployment or process transition to the failing instance/revision, request and serving error. Check requests immediately before and after, and on unaffected hosts. Timing overlap alone is insufficient. |
| CORS middleware; API requests carrying Origin | Global CORS allows absent Origin and configured origins. An unapproved Origin is passed as an Error before the request logger and routes (`Backend/src/app.js:102–143`). An unclassified middleware error can reach Express error handling as a 500. | Match actual Origin, incident-era allowlist decision, middleware error and edge status. An absent Origin rules out this rejection branch. A browser-side CORS message by itself cannot establish a server 5XX. |

## Recommended fixes and implementation risks

| Condition | Targeted action after attribution and approval | Main implementation risk |
|---|---|---|
| Proxy connection or process-readiness failure | Correct the specific upstream binding, restart policy or startup dependency shown in logs. Monitor readiness before shifting traffic. | Restart loops or serving traffic before DB/schema readiness. |
| Controller or DB fault | Fix the exact exception or query. For measured contention, narrow/batch the implicated lookup and verify pool capacity against DB limits. | Changed catalog eligibility or prices; a larger pool can shift contention onto MySQL. |
| Deadline exceeded | Reduce time spent in the measured slow stage, then align app and proxy deadlines with observed service times. | Extending deadlines can retain workers and connections during saturation. |
| Confirmed storage or release failure | Restore the affected mount, capacity or narrowly required access. For release gaps, stage complete artifacts and switch after readiness checks. | Broad permission changes or cleanup can expose or remove media. |
| Confirmed CORS rejection reported as 500 | Correct intended storefront origin handling. Give intentional denials an explicit policy and test their HTTP status. | A permissive wildcard or incorrect credential handling can broaden cross-origin access. |

The immediate corrective work is improving attribution. No cause-specific production change is justified by the aggregate alone.

## Logging and monitoring improvements

1. Add a request identifier at ingress and propagate it through the application. Record start and finish/close, timestamp, vhost, method, route template, status, elapsed time, instance and release. At the proxy retain upstream connect/response timing and status. Keep query values, authorization headers and customer data out of logs.
2. Place lifecycle instrumentation before CORS and parsing. Today's logger records only method and raw URL on entry after both middleware stages (`Backend/src/app.js:113–143`). Controller errors have uneven detail and lack a shared request ID. Use sanitized structured exception events with operation, error class and DB error code. Separate startup stages and record readiness transitions.
3. Track host/route request counts and 5XX counts by subtype with denominators, plus duration percentiles, restart events, DB pool acquisition waits and storage errors. Sequelize query logging is disabled (`Backend/src/config/database.js:4–12`). Use timing and query fingerprints where justified. Avoid globally logging raw SQL.
4. Tag releases and monitor a lightweight static storefront GET separately from an anonymous, bounded catalog GET. Alert on sustained errors and absolute counts appropriate to low traffic. Preserve access/error logs long enough to cover the GSC reporting and investigation delay. Confirm hosting-side telemetry availability with the operator.

## Regression and verification plan

- After a matched trace is available, replay its sanitized request shape in staging against the incident revision and proposed fix using fixture data. Confirm the expected status, content and serving layer. Pair it with a healthy control and preserve expected 4XX behavior.
- Exercise the specific failure boundary with a controlled staging dependency or test double. For example, simulate a DB error, unavailable upstream or timeout only if that branch matches the evidence. Confirm edge and origin events share an ID and that an aborted request is distinguishable from a completed 5XX. Test startup-stage labels if process availability is implicated.
- For a catalog or media fix, check anonymous product list, variants and an existing product image plus a missing item. For a CORS fix, compare intended storefront Origin, absent Origin and denied Origin. For a deployment fix, verify readiness and sample static and catalog requests across the release transition.
- After an approved release, compare the attributed host/path/status signature and rate over comparable traffic windows, annotate deployments and check subsequent GSC examples. Record residual and unmatched errors. A passing spot check or one quiet low-volume interval cannot establish resolution of the historical 4%.

## Investigation record

Initial Git status contained only the pre-existing untracked `SEO_CRAWL_AUDIT_REPORT.md`. This phase produced one new report. No fixes were implemented.
