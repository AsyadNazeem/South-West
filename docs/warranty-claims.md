# Warranty claims

Customers use `/account/warranty-claims`. Staff use `/admin/sales/warranty-claims`. The existing bearer-session middleware protects both APIs. The role editor grants the warranty permissions. Changing warranty grants also requires `warranty_claims.manage` alongside the existing role-management permissions.

## Purchase and workflow decisions

An eligible purchase is a paid online order owned by the customer and outside cancelled or returned status. An invoice must link to that order. A legacy invoice with a null customer ID inherits ownership from its order. A different non-null invoice owner disqualifies the invoice. The API resolves the order line, product and purchaser on the server. It takes the purchaser name from billing, then shipping, then the account.

Eligibility uses the current product warranty duration from the order date, including calendar-month end handling. The catalog has no historical warranty snapshot on the order item. The claim records the terms used for its decision. Missing or zero duration defaults to staff review. One open claim per order item and a customer-scoped submission key prevent accidental duplicates.

New claims start as Submitted. A reviewer moves them to Under Review. Reviewers may request evidence, approve, or reject. A requested round can only advance when the customer responds. Approved claims may enter Processing or Resolved. Resolved and Rejected claims may be closed. Customer history omits internal notes, assignment events, and download audits.

## Deployment preparation

1. Back up the database and review pending migrations in the release checkout. The first two warranty migrations dated 20261121 create the claim tables and grant the seven catalog permissions to Admin and Super Admin roles. Run the existing Sequelize migration process during the approved release. Rolling back the schema drops claim data.
2. Use the backend lockfile with Node 26. Build the Customer and Admin apps using their own lockfiles and include the sibling Frontend/shared source directory in the build checkout. The customer build reads the public catalog for its sitemap. The cPanel frontend recipe expects a checkout at /home/southwes/southwest-repo and the Node 26 environment. Confirm both paths in cPanel before release.
3. Provision persistent private evidence storage outside both release trees and document roots. The Passenger account must own the directory with mode 0700. Back up the private files together with their database records. Use a private temp directory with sufficient quota. Include files left by abrupt process termination in host housekeeping. Reconcile orphaned processed files with evidence records before removing them.
4. Verify the effective HTTPS proxy request size and timeout in staging. With defaults, the maximum admitted body is 60 MiB plus 64 KiB multipart overhead. Uploads require Content-Length. The application permits two concurrent uploads, one transcode and two ZIP streams **per Node process**. Multiply by the Passenger process count when evaluating LVE memory, CPU, disk and process budgets. Rate windows are also per process. Persisted quotas are 100 MiB and 80 files per claim, and 512 MiB per customer.
5. Apply `20261121120000-warranty-mail-recipients.js` after the original claim migrations. It preserves existing queue rows as customer jobs and adds uniqueness per history event and recipient. Coordinate the API and worker upgrade so an older worker cannot consume recipient-specific jobs. Configure the existing verified support and admin mail senders, CUSTOMER_APP_URL and ADMIN_APP_URL. The worker configuration is described below.
6. Verify a synthetic claim and evidence response through a staging Passenger application using test accounts and an email sink. Check mobile upload, file permissions, ZIP audit, Email delivery, proxy/body limits and CloudLinux resource faults. Enable production video only after the staging check and capacity review.

## cPanel release checklist

- [ ] Record the running commit, Node version, current document roots, cron configuration and migration status. Take fresh, restorable backups of `southwes_prod`, private evidence, public uploads, both deployed sites (including dotfiles), backend code and protected environment configuration. Verify the backup can be restored to an isolated location.
- [ ] Fetch the approved commit into a clean release checkout. Confirm its SHA and synchronize Backend into the Passenger application at `/home/southwes/southwest-backend`. Preserve its environment and persistent data. Keep the previous release available. The root cPanel recipe builds and copies the frontends only.
- [ ] Activate the backend Node 26 environment. In Backend, run `npm ci --include=dev` for the release migration CLI. In each frontend, run `npm ci --include=dev`. Keep Frontend/shared alongside both apps.
- [ ] Configure a persistent absolute WARRANTY_STORAGE outside public_html and the release checkout, owned by the Passenger user with directory mode 0700. Verify private file permissions and writable temp space. Set CUSTOMER_APP_URL=https://southwest.lk, ADMIN_APP_URL=https://admin.southwest.lk and CORS_ORIGINS for both HTTPS origins. Configure EMAIL_PROVIDER, the support and admin sender identities (EMAIL_FROM_SUPPORT and EMAIL_FROM_ADMIN), and their verified provider credentials in the backend environment. Pick the queue worker mode described below.
- [ ] Pause API writes, stop the old Passenger process and suspend warranty cron before migration. From Backend, confirm the production environment selects southwes_prod. Review `npx --no-install sequelize-cli db:migrate:status --env production` and reconcile any earlier pending migrations. Run `npx --no-install sequelize-cli db:migrate --env production`. Verify the claim-table, permission and mail-recipient migrations applied in that order, and check status again.
- [ ] Build Customer with `VITE_API_URL=https://api.southwest.lk/api npm run build` using the real public catalog. Verify the product count, sitemap and seven information pages. Build Admin with `VITE_API_URL=https://api.southwest.lk/api npm run build -- --base=/` and check index.html references /assets/. Publish the contents of Customer/dist to /home/southwes/public_html and Admin/dist to /home/southwes/public_html/admin, including their .htaccess files. Preserve the nested Admin site and hosting-managed files when switching Customer releases.
- [ ] Restart the upgraded backend using cPanel’s Node.js application manager. Restore the selected mail worker and resume traffic. With designated test accounts, verify frontend assets, deep-link refreshes, order details, a product canonical and sitemap, and a saved address. Exercise purchase lookup, claim submission with a photo, staff notification, authorized evidence download, status change, evidence request and customer response. Check the audit trail, private file modes, queue outcomes and actual receipt in designated inboxes. Complete the staging video and capacity checks above before enabling production video.
- [ ] If release checks fail, pause writes and stop the new API and queue worker. Restore the previous frontend builds together and select the previous backend and environment. Keep the old worker stopped while recipient-specific jobs exist. Preserve post-release claims, evidence and queue state before recovery. If schema or data restoration is necessary, reconcile intervening orders and writes with the operator, then restore the matched database and file backups during maintenance. Restart the compatible application and worker and repeat smoke checks before reopening traffic.

## Warranty mail operations

The local investigation found three pending customer jobs with zero attempts. The previous API required an independently scheduled worker. The updated API drains the queue at startup and once per minute while running. Development can use the existing Mailpit provider. For Passenger installations where the process may sleep, set `WARRANTY_MAIL_WORKER=cron` and schedule the following command every minute using cPanel Cron Jobs and the same application environment:

```sh
cd /home/southwes/southwest-backend && /home/southwes/nodevenv/southwest-backend/26/bin/node scripts/warranty-mail.js
```

The worker leases jobs transactionally. It retries temporary failures with backoff and records terminal failures after six attempts. A revoked reviewer is suppressed immediately. Customer jobs require the current account's verified email. New-claim admin jobs require an active account with both warranty view and review permissions at submission and delivery. Staff need the existing notifications.view permission to use the bell. SMTP acceptance is recorded as sent. A process crash between SMTP acceptance and acknowledgement can cause redelivery with the same Message-ID.

For a read-only inspection, run `node scripts/warranty-mail.js --inspect` from Backend with the application's environment. This lists up to 100 outstanding jobs with state, attempt count, next attempt or lease time and the last error code. Pending jobs with zero attempts point to worker scheduling or connectivity to the queue. Increasing attempts indicate processing failures. Check the logged job ID and error code, the verified customer address and the support/admin SMTP sender credentials. Staging tests should use Mailpit or a mocked transport. Starting the upgraded worker against a real queue processes its existing pending jobs.

## Configuration

| Setting | Meaning |
| --- | --- |
| WARRANTY_STORAGE | Absolute private evidence directory, required in production |
| WARRANTY_UNKNOWN_POLICY | Default review. Set to deny to reject purchases with missing terms |
| WARRANTY_VIDEO_ENABLED | Set to true to accept video after host verification. Otherwise photos remain available |
| WARRANTY_VIDEO_INPUT_MB / WARRANTY_VIDEO_OUTPUT_MB | Defaults 30 / 5 MiB. Supported configuration ranges 1–64 / 1–16 |
| WARRANTY_FFMPEG / WARRANTY_FFPROBE | Executable paths, resolved from PATH by default. Prefer verified absolute paths under Passenger |
| WARRANTY_MEDIA_LAUNCHER | Linux default prlimit. Select bash for this cPanel host. Both enforce 1.5 GiB address space, 25 CPU seconds, 128 descriptors and a bounded file size per child. Node enforces a 30-second wall timeout per tool invocation |
| WARRANTY_PRLIMIT | Executable override for the prlimit launcher |
| WARRANTY_WORKER_URL / WARRANTY_WORKER_TOKEN | Optional private HTTPS conversion endpoint and shared secret of at least 32 characters |
| WARRANTY_WORKER_PORT | Loopback worker port, default 8097 |
| TMPDIR / CUSTOMER_APP_URL / CORS_ORIGINS | Existing temporary directory, customer-facing origin and allowed API origins |

A separate trusted worker can run Backend/scripts/warranty-video-worker.js under an isolated OS account with its own quotas and a maintained encoder. Set its local binary paths, limits, token and enabled flag. Leave WARRANTY_WORKER_URL unset on the worker. Terminate TLS on a private ingress allowing the backend to POST to /convert, disable body logging, limit body size and permit one conversion at a time. Configure that HTTPS address and matching token on the application. The application streams the input and bounds the response, checks the WebM signature and requires the trusted worker's original-duration measurement. Failed processing rejects the submission.

## Hosting verification recorded on 21 November 2026

In cPanel Terminal, Node 26.13.1 loaded Sharp 0.35.5 with libvips 8.18.7 and produced a 58-byte WebP. FFmpeg and FFprobe 9.0.2 ran. prlimit was unavailable. Bash successfully applied child limits. A one-second VP9/Opus test encoded both streams. The Node-launched ten-second motion fixture encoded in 0.787 seconds to 730,453 bytes. FFprobe decoded 240 VP9 frames at 640×360. These timings apply to the synthetic inputs and terminal context.

The confirmed cPanel executable paths and launcher for staging are:

```dotenv
WARRANTY_MEDIA_LAUNCHER=bash
WARRANTY_FFMPEG=/home/southwes/bin/ffmpeg
WARRANTY_FFPROBE=/home/southwes/bin/ffprobe
```

Set these in the staging application's environment. Enable video there for the synthetic Passenger upload check. Leave production video disabled until that check and the account capacity review pass.

The shared filesystem reported 3.2 TB free. The quota utility was unavailable. Check cPanel Statistics and Resource Usage for account disk space and LVE limits. The terminal probes did not exercise Passenger uploads, reverse-proxy limits or worst-case concurrent load. Backend/scripts/warranty-preflight.js can exercise the actual adapter and private storage in staging with the provided synthetic MP4. It writes temporary files and removes them.

## Implementation and verification inventory

- Backend/src/warranty contains schema, eligibility, workflow, ownership, private media, remote conversion and ZIP services. Five Warranty models in Backend/src/models register these tables.
- Backend/src/routes/warrantyClaimRoutes.js and Backend/src/app.js expose the two authenticated APIs. Backend/src/config/permissions.js and Backend/src/controllers/rolePermissionController.js integrate grants. Backend/src/services/emailService.js reuses the branded mail template. Backend/package.json and its lockfile declare the multipart and ZIP libraries.
- Backend/scripts contains the mail worker, optional video worker and hosting preflight. The root gitignore excludes local private storage.
- Frontend/Customer/src/pages/account/WarrantyClaims.vue and components/account/ClaimUpload.vue implement submission, evidence response and history. Frontend/Admin/src/pages/sales/WarrantyClaims.vue provides listing and staff actions. Both routers and sidebar components expose the feature. Frontend/shared/ClaimDetail.vue renders the gallery and activity.
- Backend/src/tests/warrantyClaims.integration.test.js uses a disposable schema on a supplied local WARRANTY_TEST_SOCKET. It uses actual session authentication, mock mail delivery and synthetic purchases. Backend/src/tests/warrantyMedia.test.js exercises malformed, interrupted and oversized uploads, WebP and WebM conversion, cleanup and launcher arguments. Backend/src/tests/emailService.test.js verifies notification escaping and privacy. The one-second synthetic MP4 is in Backend/src/tests/fixtures/warranty.
- Frontend/shared/tests/warranty-browser.mjs runs headless Chrome against the Vue components and fixture APIs when CHROME_BIN points to Chrome. Both frontend production builds and existing test suites also run independently.
