# Production audit — 29 October 2026

## Verdict and scope

This is a bounded source, integration, browser and deployment review of the
standalone Space Works Inventory repository, with the other products audited
separately. Verified security, lending and accessibility defects were fixed.
Version **0.6.0** is prepared at the user's direction on the audit feature
branch. The complete Linux application suites and packaged clean-stack results
below describe the preceding **0.5.1 functional baseline**. Both layouts, real
queued STARTTLS email before/after recovery, empty-volume encrypted recovery,
private objects, usable restored keys and complete schema replacement passed.
The subsequent 0.6.0 update fixes public-asset ownership in the nonroot backend
and adds an actual private-mode asset image assertion. Final 0.6.0 native image,
installer/recovery, image scans and new-head CI are pending; the older image IDs
and scan evidence are retained as historical proof. No deployment was performed.
This report does not certify the absence of other defects or replace validation
of a real host, public DNS, external providers, load and operational ownership.

The checkout was initially clean. No production database, existing service
container or credential file was used as a test target. No push, merge or release
was performed by this audit agent. Initial Windows checks used disposable
loopback PostgreSQL/Redis; those containers were removed. Final Linux acceptance
uses only `sw-audit-inventory-20261029-*` services in an isolated runner network,
with no host service ports published. The installed Next.js route-handler and
Playwright guides were consulted before framework-related verification.

## Verified defects and changes

| Severity | Finding and evidence | Remediation and regression coverage |
| --- | --- | --- |
| High | `lib/events/network.ts` accepted canonical hexadecimal IPv4-mapped IPv6 loopback/private addresses and expanded IPv6 loopback. WHATWG URL canonicalization itself converts dotted mapped addresses to the previously accepted hexadecimal form. A manager-controlled webhook could therefore reach local/private network endpoints. | Normalize and expand IPv6 before checking its words; delegate mapped IPv4 and 6to4 destinations to IPv4 policy; refuse non-global IPv6 scopes. `tests/unit/webhook-network.test.ts` covers 28 private/public/URL-canonicalization cases. Existing DNS pinning and redirect refusal remain in the delivery layer. |
| High | `issueLoan` locks only its own loan row; simultaneous handovers for distinct loans of one borrower could each read the same active-loan/item allowance and exceed the space limit. Self-checkout checked the same allowance before shared sequence/stock locks. | Add a transaction-scoped, tenant-and-borrower advisory lock before enforced handover eligibility in both desk issue and self-checkout. It avoids inverting membership row locks used after returns/incidents. Real PostgreSQL regressions cover desk/desk, self/self and mixed handovers. |
| Medium | `containerFor` checked whether a container was already out without locking the shared container. Two loans for different borrowers could both claim it. | Lock the tenant-scoped container before checking active loans and reread archive state under that lock. Concurrent shared-container regression proves only one handover succeeds. |
| Medium | Borrowing eligibility considered membership activity but omitted account disablement and the repair-only technician role. Staff/API workflows could issue loans to accounts denied the member UI. | Check current user `disabledAt` and require at least `MEMBER`. Database regression covers both refusals. |
| Medium | Self-checkout obtained StockLevel locks before `takeFree` obtained Item locks. Lending loops also acquired items one at a time in arbitrary line order, creating avoidable deadlock paths. | Acquire the complete Item set in sorted order before lending approve/cancel/issue/return/self-checkout stock loops. Existing availability code continues to own quantity and asset writes. Affected lending integration suites were rerun. |
| Medium | Registry dependency audit reported five direct Nodemailer advisories in installed 10.0.10 (recipient parsing and SMTP authentication regex behavior). | Upgrade exact dependency and lockfile to 10.3.1. Audit again after installation; no incompatible major dependency migration was attempted. |
| High advisory; migration CLI | Prisma's development/migration dependency resolved vulnerable `deepmerge-ts` 7. The isolated Docker migration CLI install did not inherit root dependency overrides. No public request path into this CLI dependency was identified. | Pin `deepmerge-ts` exactly 8.0.2 via root override/lockfile and copy only sanitized overrides into the isolated CLI stage before installation. Prisma generation, migrations, application suites and full dependency audit pass. |
| Medium | A `Field` hydration fallback assigned the visible Radix dropdown's ID to its preceding aria-hidden native select. Duplicate IDs stole the visible control's accessible label; the full transfer receipt browser journey failed at the labelled destination selector. | Ignore aria-hidden controls in the fallback selector. Keep the existing labelled browser assertion unchanged; complete monolith and split transfer receipt journeys now pass. |
| Low; mobile UI | Authenticated 390px visual acceptance showed a wrapped transfer reference colliding with the direction caption because the touch-target link uses negative vertical margins. | Keep the transfer reference on one line; the table still scrolls within its own region. Both production backend/frontend images rebuilt successfully. Eight authenticated desktop/mobile catalogue, lending, transfer and transfer-detail screenshots passed; DOM geometry confirms a single-line reference with no caption overlap, and both existing transfer journeys pass against the final backend image. |
| Low; validation gap | CI provisioned Silo without wiring its endpoint into integration tests, and hosting jobs supplied no demo seed, silently skipping product journeys. Four evidence tests also assumed disk storage paths. | Wire real private Silo into CI, assert stored objects through the configured backend, and run fresh onboarding before seeded full browser journeys in both hosting layouts. Add an LF/CRLF equivalence/content-change regression for the existing normalized frontend source hash. |
| Low; acceptance gap | The initial recovery harness removed its SMTP capture before restore and only checked generic worker health afterward. Its split-to-single switch also kept the API hostname while authentication used the website origin. | Extract a reusable guarded worker/STARTTLS smoke and invoke it both before backup and after restore on the new network. Align the single public hostname with the configured auth/public origins and assert their equality. Both final harness contracts passed in the packaged clean-stack acceptance. |
| High; recovery correctness | Both VPS and alternate database CLI used `pg_restore --clean`, which removes only objects present in the archive. Newer-release tables absent from an older backup survived recovery. A direct producer pipe could also apply a valid truncated prefix after archive generation failed. | Stage the complete SQL privately before applying one transaction that replaces `public`. VPS restore retains archive schema ACL/comments and narrow runtime/default grants; the generic CLI preserves `--no-owner --no-privileges` and refuses other user schemas. Seven helper/source-execution regressions and four actual PostgreSQL 16 generic-CLI scenarios passed. Actual encrypted VPS recovery explicitly creates and then verifies removal of a target-only table. |
| High; failed recovery availability | Cleanup restarted the deployment after a database commit even when object restoration, migrations or readiness failed, potentially serving recovered rows against incomplete files. | Track successful SQL commit. Before commit, rollback failures may restart the previous deployment; after commit, stop all serving processes (including any partially restarted ones), keep the site offline and instruct the operator to repair and retry the full restore. Six actual cleanup-function phase regressions passed in Inventory and independently against Workspace source, including object/migration/readiness failures. |
| Low; lifecycle correctness | Switching from split to single left the inactive profiled frontend container behind, so ordinary teardown did not fully remove the prior layout. | `vps-compose.sh down` selects all profiles. An actual shell-selection regression and final clean-stack teardown passed; no final split frontend or deployment service remains. |
| Low | `SECURITY.md` documented an unreleased 0.1 release line and obsolete owner/admin tenant roles. | Align security policy with 0.5 and the authoritative manager/staff/member/technician model. |
| Medium | Local quickstart configured Redis but started only the Next.js process, leaving the BullMQ outbox and schedules unprocessed. Mailpit existed in Compose but SMTP defaults were blank; local Redis had no durable job volume. | Add a cross-platform `dev:stack` supervisor, wire `local.sh` to web/worker/beat, use separate loopback worker health ports, drain workers with IPC/signals before stopping Docker, and stop siblings when a child fails. Add loopback-only PostgreSQL/direct/Redis/S3/SMTP checks before local migrations. Enable local Redis append-only persistence/noeviction and configure local-only Mailpit capture defaults. Eleven launcher/guard tests, targeted lint/types and ShellCheck passed. |

## Version 0.6.0 follow-up

The backend copied `public/` as root while preserving file modes. A checkout
created under a private umask therefore yielded root-owned 0700 directories
that the serving UID 1001 could not enumerate. Copy public assets with explicit
`nextjs:nodejs` ownership; existing frontend copies already use that owner.
The real CI installer creates only a new owned nested 0700/0600 probe, builds
it into the image and runs Node as the default nonroot user to verify ownership,
mode retention, directory enumeration and file contents. Its existing cleanup
trap removes the probe even when a build fails; existing checkout permissions
are never changed. A source-executed failure regression checks this lifecycle.

The first PR 5 CI run passed application lint/types/units/integration and both
browser layouts, then failed in the installer fixture because sudo-rs ignored
`sudo -E` and dropped `SWI_CONFIG_DIR`. The fixture now passes only `CI`, the
configuration directory and disposable project name through `sudo env`;
credentials remain in private configuration files and unrelated environment
secrets are not forwarded. The root-run native proof remains valid for its
original scope; it did not exercise this nonroot CI handoff.

Focused follow-up verification: **11 tests in two files passed**, focused
ESLint, Bash syntax and ShellCheck passed. Separate disposable Linux execution
of the actual harness confirms 0700/0700/0600 probe modes, cleanup after a
build failure, unchanged existing asset contents/modes, and correct minimal
environment handoff through an environment-clearing fake sudo. The final
container assertion will verify UID 1001 can enumerate/read those packaged
assets; it is not yet claimed as executed for 0.6.0.

The earlier 0.5.1 image/source/restore evidence below remains historical. Final
0.6.0 native images/recovery/scans and new-head CI remain pending before merge.

The independent `deploy/cloudflare-cron/package-lock.json` was also audited
separately. The root audit does not include this auxiliary deployment package.
Its initial audit reported **one high and two moderate** entries through
undici 7.29.1 and its parent tooling. A compatible lockfile update resolves
Wrangler 4.156.0, undici **7.30.1** and workerd 1.20261023.1; the exact workerd
install-script allowlist pin follows that locked version without broadening it.
The nested audit now reports **zero vulnerabilities**. The upstream
[undici advisory](https://github.com/nodejs/undici/security/advisories/GHSA-xjj6-f33q-929c)
identifies 7.30.1 as a fixed release. No application request path into Wrangler
was identified; it is excluded from application builds.

An actual Wrangler `deploy --dry-run` succeeded from a Git-visible-only copy
with an explicit environment allowlist, private temporary HOME/profile/cache,
metrics disabled and no inherited Cloudflare credentials. It bundled 2.10 KiB;
no Worker was deployed. Evidence is under `inventory/v060/cron-audit/`. A separate
quality job now installs this independent lockfile with scripts disabled,
checks high-severity advisories and repeats the bundle dry-run with an empty
profile. This result is separate from the root application's two moderate
ExcelJS/UUID entries, which remain tracked.

Private PostgreSQL HBA/init inputs are now staged from read-only bootstrap
mounts into postgres-owned runtime files before the official entrypoint drops
privileges. A real PostgreSQL 16 probe passed with source modes 0600/0700,
TLS enabled, `swi_app` initialized and nonroot read/execute/mode assertions.
The exact installer now runs this isolated probe without changing existing
checkout permissions. Evidence: `inventory/v060/bootstrap-acceptance/probe.log`.

Encrypted backup packaging precreates its excluded output before GNU tar reads
directory metadata. A deterministic checkpoint regression reproduces the prior
`file changed as we read it` failure and passes with the actual precreation
step. The actual age pipeline also passed checkpoint injection, decryption and
byte comparison (`inventory/v060/backup-encrypted-race-proof.log`). Tar errors
remain fatal. The final 0.6.0 full clean-stack drill remains pending below.

## Coverage and evidence

| Area | Reviewed paths / verification |
| --- | --- |
| Accounts, authentication, authorization | `lib/auth.ts`, `lib/permissions.ts`, `lib/actionContext.ts`, `lib/mfa.ts`, `app/actions/account.ts`, `lib/roles.ts`, `lib/membership.ts`, API key authentication and scopes. Checked disabled-user/session-version revocation, password/magic-link MFA, TOTP replay claims, admin step-up, active tenant membership and last-manager protections. Existing role/page guard/member integration tests passed. Production browser journeys cover password, one-use magic-link and member/staff boundaries; MFA replay/recovery remains covered by unit/database suites, not a new interactive MFA journey. |
| Tenant boundaries and public access | Space context and query scoping, loan ownership not-found behavior, API principal-derived space IDs, transfer side checks, public catalogue and private evidence/image routes. Database suites exercise API workflows, member ownership, catalogue images and evidence visibility. |
| Stock, loans and transfers | Central availability locking and CHECK constraints; receipts, weighted cost, holds/releases, serialized issue/return/loss, consumables, approval/payment gates, renewals, restrictions, transfer mapping/dispatch/receipt/returns and loan limits. Full availability, lending, transfers and regression suites passed on PostgreSQL. |
| Counts, purchasing and finance | Count staleness/four-eyes policy, receipt into stock, purchase payment ledger posting, partial returns/incidents, repair quarantine and payout posting, payment/refund row locks, webhook signatures and deduplication. Full count/purchase/repair/finance/payment integration suites passed. Real payment-provider settlement was not attempted. |
| Files and imports | Tenant-prefixed object keys, authorized response routes, image decode/pixel limits and re-encoding, CSV/XLSX limits and import workflows. All image/import/evidence integration tests passed with real private Silo, including successful photo writes and rollback cleanup. XLSX expansion/resource-exhaustion limits and large-file load behavior need separate stress testing. |
| Integrations and jobs | Hashed API secrets, scoped API wrappers, signed outbound delivery, DNS pinning, webhook retry policy, SQL durable outbox, BullMQ queue definitions/worker/beat, scheduler registrations and production Compose worker health. Added real Redis worker integration: SQL outbox commits without sending, worker invokes a mocked transport and marks SENT, Redis holds only the outbox ID, repeated relay IDs deduplicate. A separate real worker/beat smoke delivered a synthetic email exactly once into local Mailpit and drained both processes through IPC. No external recipient was contacted. |
| Deployment and operations | One-line `install.sh`, `local.sh`, production/local Compose, migrator/worker/beat, TLS/private data network, external proxy/storage overrides, CI, release scripts, backup/recovery configuration and environment preflight. Compared Events reference read-only: its legacy local Compose contains PostgreSQL only, while Inventory already contains requested PostgreSQL/Redis/Silo stack and private bucket initialization. Packaged split/single bootstrap, authenticated STARTTLS worker delivery, encrypted fresh-volume/key/private-object restore and target-only schema cleanup passed. Full VM/systemd/public-DNS provisioning and failed upgrade/rollback remain separate boundaries. |

## Verification results

Final acceptance ran source snapshots excluding credential files in
`spaceworks-acceptance:20261029`: Ubuntu 24.04, Node 22.23.4, Playwright
1.64.1 Chromium, Docker CLI 29.1.3, Compose 2.40.3, Buildx 0.20.1, age and
ShellCheck. Exact toolchain, command harnesses, logs, statuses, browser traces
and source archives are outside the repository in
`../audit-evidence/2026-10-29/inventory/`. The runner was limited to 5.5 GiB,
3 CPUs, with Vitest workers limited to one or two. Dependencies were installed
with `npm ci`; the security override was then applied with a bounded install.
All database URLs, Redis namespaces, object buckets and email recipients were
explicit disposable fixtures. No ambient application configuration was loaded.

| Gate | Exact result |
| --- | --- |
| Prisma validate and migrations | Passed; all six committed migrations applied to empty test databases. |
| Full lint and root typecheck | Final `npm run lint` and `npm run typecheck` passed after all application and installer fixture changes. `final-security-lint.log`, `final-security-types.log`. |
| Full Linux units | Final `npx vitest run --maxWorkers=1`: **62 files / 1,315 tests passed, zero skips**, with the disposable Redis fixture active. Includes launch/signal/remote-service guards, hash portability, operator scripts, file limits and nine source-executed edge-build failure/conditional-caller regressions. |
| Full database integrations | `npx vitest run --config vitest.integration.config.mts --maxWorkers=1`: **33 files / 189 tests passed**, using actual PostgreSQL, Redis and private Silo. Includes handover concurrency and worker delivery. |
| Worker and beat bundles | `npm run build:jobs` passed, including the authoritative crypto helper used by recovery verification. |
| Backend production build | Final Linux `npm run build` passed. Earlier Windows retry also passed after avoiding the concurrent Prisma DLL lock. |
| Frontend contract/types/build | Regenerated stale contracts after source changes; 64 guarded views, 158 actions, 222 transport types and 12 UI types. Frontend typecheck and build passed; dependency traces contain no backend persistence/mail/storage client. |
| Empty-install onboarding | Independent fresh-database production browser run: **1 passed in monolith; 1 passed in split**. |
| Full monolith browsers | `npx playwright test --workers=1`: **23 passed / 2 expected skips** (setup already completed and split-only contract). The initial labelled-transfer failure is preserved separately and fixed without weakening the assertion. |
| Full split browsers | Same full suite against a narrow-environment frontend and separate action keys: **24 passed / 1 expected setup skip**. |
| Real local architecture | Built worker and beat became healthy, delivered a SQL-outbox email exactly once through BullMQ into Mailpit, verified private Silo put/get and anonymous HTTP 403, then drained through supervisor IPC. |
| Deployment syntax | Last complete `npm run deployment:check`: **72 scripts/manifests passed** (Bash syntax, ShellCheck, MJS syntax and YAML parsing). No Helm chart or Python source gate exists in this repository. |
| Packaged installer/recovery | **Passed three times; the final run covers npm-free images, pinned October 26 storage, the patched edge, complete schema replacement/residue removal and the final cleanup guard.** Real `scripts/test-vps-install.sh` builds/loads both images, bootstraps split and single layouts, rejects plaintext PostgreSQL and anonymous storage, checks least-privilege runtime role/readiness, and delivers actual BullMQ SMTP over authenticated STARTTLS. Age-encrypted off-host archive restores onto a new project/configuration and destroyed/recreated database/object volumes. Fixture account/space/object absence is checked first; target-only table disappears, recovered keys decrypt ciphertext, membership/catalogue/object bytes match, private object stays HTTP 403, and queued SMTP passes again after restart. Logs: final `installer.log`/`installer.status`, earlier `before-image-hardening-installer.log` and `installer-first-pass.log`. |
| Generic CLI restore PostgreSQL contract | **4 passed** on own PostgreSQL 16: complete older-schema replacement/data/public CREATE denial; late SQL failure atomically rolls back; generation failure never mutates target and cleans staging; unrelated user schema is refused unchanged. `restore-pg-contract.log`, helper SHA-256 `b68c2f460256a18b2c63187b4dcbb26dc123c9c771db1be4edfb43b6d4d0f214`. |
| Packaged native/runtime dependency proof | Both final images: Node 22, UID 1001 and absent global npm/npx passed. Backend isolated migration CLI `deepmerge-ts` **8.0.2**, native Sharp WebP/SVG fonts and frontend exclusion of backend database/mail/storage/queue clients passed. `final-native-images.json`, `final-backend-native.log`, `final-frontend-native.log`. |
| Selected visual evidence | Eight final authenticated catalogue, lending queue, transfer list and actual transfer-detail screenshots at desktop 1440x1000/mobile 390x844, using the rebuilt backend image: all page overflow zero; transfer reference single-line/caption separation asserted. Existing `transfers.spec.ts`: **2 passed / 0 retries**, including approval, scanned dispatch, photo evidence and receipt. `visual-product-final/`, `visual-product-final.log`; representative screens inspected. Earlier HTTPS-edge login screenshots remain under `visual/`. This is representative visual acceptance, not every possible screen/state. |
| Dependency audits | Both complete and production-only npm audits: **0 critical, 0 high, 2 moderate**; remaining entries are ExcelJS and transitive UUID under the same advisory. |
| Final installer source checks | After pinned storage, edge wiring and the swap-budget change: **24 focused tests in 3 files passed**, deployment/ShellCheck **72 checks passed**, and focused ESLint passed. Seven extracted actual setup branches verify source/published installs, bundled/external edge, existing memory/swap and an existing swapfile without changing the host. |
| Whitespace | Host/Linux source diff checks passed. |

Earlier Windows runs were not all green: the constrained full unit rerun had
1,263 passes and five Bash/POSIX-path/fixture timing failures. The final complete
Linux suite above is the release-platform result. Initial isolated Linux
installer fixtures also passed 5 files / 24 tests. The initial Windows local
SMTP probe exceeded its deadline during host contention; the complete actual
Linux worker/Mailpit/Silo probe now supersedes that incomplete experiment.

The shared Next config now explicitly sets `experimental.cpus: 2`, inherited
by the frontend; installed memory/static-generation documentation and worker
selection code were consulted. Final Alpine images rebuilt successfully using
two workers after the earlier Docker export outage. That incident and the
truncated first font download are preserved in historical logs, superseded by
the complete successful final drill. No mirror/TLS bypass was introduced.

The final host-only recovery cleanup guard leaves serving processes offline
after post-commit object/migration/readiness failures. Focused source-executed
phase tests, ShellCheck, ESLint and the complete unit suite passed; the final
full packaged happy-path drill subsequently passed with this guard present.
No live object-failure injection is claimed. The host restore script is not
copied into the runtime app image.

A subsequent authenticated mobile capture found a transfer-reference overlap;
the final no-wrap fix was linted, its frontend contract regenerated and checked
on Windows/Linux (source hash `7758b3f61555487fdfcd926b6dad12b0ce8fd5950646e673ba92f5efffe8ee63`),
and both actual production images rebuilt with type/static/boundary checks.
Eight final image-based product screenshots and the two existing transfer
journeys then passed. Prior complete domain/browser suites remain the broader
coverage; they were not repeated solely for this single CSS class.

UI-tested image IDs, before the package-manager removal below:

- Backend: `sha256:74d38959b749b019d34ecf32f79661bb057aee50a5b577909a99b17b9fb434b1`.
- Frontend: `sha256:d3988e0fa283b858092bc20f76819d22e7681f788199f527a85ec3d293b97e5d`.

Historical 0.5.1 image-security/installer-tested image IDs:

- Backend: `sha256:80d7634c48051b4df737e0fdb2ccb08c4bba177d96ddf00b319555b6e8133184`.
- Frontend: `sha256:1204d5fd590f23f7cc71125b4da81840ad15cb4d0366e0d6e2a018a3b576dcf4`.

The exact checked-in installer/restore harness finished successfully at
2026-10-29 19:41:35 UTC. Its first final-image attempt encountered a registry
`ECONNRESET` during dependency installation; the unchanged locked build was
retried and completed. The failed attempt remains under
`final-attempt1-network-installer.log`; no registry/TLS bypass was introduced.

## Container vulnerability follow-up

Official Trivy 0.76.1 was verified through its release ZIP checksum and exact
executable member hash. Its vulnerability database v2 was updated on
2026-10-29 at 13:09:46 UTC. Existing local images were scanned for OS and library
vulnerabilities, with offline dependency analysis, telemetry disabled and no
severity or unfixed-package suppression. Complete JSON, image IDs, provenance
and findings are outside the repository in
`../audit-evidence/2026-10-29/image-security/`.

The earlier UI-tested Inventory images contained 10 high, 10 medium and one low finding,
all inside the global npm bundled with the Node base image. No finding was
reported in their detected application, operator or isolated Prisma CLI
packages. The final runtime Dockerfile stages now remove npm/npx; Node and the
isolated CLI remain. Web, worker, beat, migrations and VPS operator entrypoints
invoke Node directly. The separate managed-database CLI remains documented for
a trusted source checkout with PostgreSQL client tools and npm. Both rebuilt
npm-free images passed native and packaged runtime verification; their exact-ID
OS/library scans report **zero findings** at all severities. This does not
supersede the separate moderate UUID source dependency advisory or prove that
all compiled/bundled code is free of vulnerabilities.

The shared cached stack also has findings. Redis reports zero. PostgreSQL's
one critical and 25 high findings all refer to Go stdlib functions in the gosu
privilege-switch helper, rather than PostgreSQL packages; the upstream
[gosu security policy](https://github.com/tianon/gosu/security) explains why
unused network/archive interfaces need reachability assessment. All 26 CVEs
were mapped to official Go advisory metadata and the exact binary's 3,019
compiled function names: affected packages or os.Root methods were absent.
No affected gosu call path was identified. This is an independent ELF function
table assessment, rather than a binary govulncheck or exhaustive call-graph proof.

Refreshing official Caddy retained the same image digest and its one critical
and nine high findings, including an installed Brotli library and Go HTTP/2
dependencies. The initial shared patched Caddy candidate (x/net 0.60.0)
`sha256:a82d89dfe088d6a703584a22e0d9f1f5f1f1a083242df9261a1e2fe1a4530eab`
was independently scanned: **zero critical, one high, three medium and three
unknown**, with no remaining OS finding. The high entry is go-jose/v3 3.0.5,
which has no listed patched version; its configured-path assessment remains
separate from the raw scan. Inventory now builds that pinned-toolchain/locked
dependency edge after either published app pulls or source builds, with failure
propagation and an external-proxy skip. Internal certificate export uses the
same edge image. The final shared source subsequently advances x/net to 0.62.0
and Chi to 5.4.0 with verified Go 1.26.10 module locks to address the remaining
fixable findings. The replacement image
`sha256:0956bb7459167ed6f47cc9fbb29e2d3ddb452f7ba1b7313f175a1ebd74c91293`
was scanned unsuppressed: **zero critical, one high, two medium and one unknown**,
with no OS findings. These are the three unpatched go-jose/v3 advisories and
the unmaintained OpenPGP advisory; the earlier fixable findings are absent.
Inventory's actual Compose export is
`sha256:3235b24a0efa5dccec40cc6a9ac6c612dcf924da7b875d70ed726fed47d0120b`;
its eight filesystem layers are identical to the reviewed reference above,
while image configuration/Compose metadata differs. Its own unsuppressed scan
also reports **zero critical, one high, two medium and one unknown**. Exact-ID
scan evidence is `image-security/shared-caddy-inventory-final/`; filesystem
equivalence is recorded in `inventory/edge-layer-equivalence.json`. The final
Inventory installer and fresh-volume recovery passed with this actual edge.
The final shared assessment identifies the go-jose/v3 vulnerable
symbols in the retained standard ACME-server module, with no such configured
JWK ingress in the shipped reverse-proxy configurations. The older govulncheck
database does not contain that advisory and is not evidence of its absence.

Silo's official October 26 image removes the prior Go,
pcre2 and JOSE high findings: its remaining one high scanner attribution is
the inherited MinIO CSV advisory, while the exact released Silo source already
uses bounded reads and a 1 MiB record limit. Raw findings remain retained;
this is a source-backport assessment. Its 15 medium and six unknown occurrences
remain in the raw report. Unknown entries include x/net HTML advisories
`CVE-2026-78661` and `CVE-2026-97045` per server/client binary, with module fixes
in 0.62.0; the official image contains 0.61.0 and needs upstream image tracking.
`GO-2026-5932` separately identifies unmaintained OpenPGP code. No affected
application path into these optional parsers was established; absence of such
a path is not claimed. The matching October 26 mc utility has
zero critical/high findings, but retains its medium/unknown inventory. Local,
production and CI image references now pin
those coordinated October 26 releases by verified multi-architecture manifest
digest. Compatibility probes
confirmed the mc/mcli aliases and curl are present. The updated stack has not
yet passed this application's repeated recovery drill.

## Remaining limits and owner checks

1. A real fresh supported host with systemd, public DNS, ACME, firewall and
   off-site provider access remains an operator acceptance boundary. Container
   bootstrap/recovery does not prove those external conditions or a complete
   failed-upgrade/rollback drill.
2. Real outbound SMTP provider acceptance/inbox delivery and sandbox payment,
   refund and duplicate-provider-webhook validation need the owner's external
   accounts. Local captures and signed fixture integrations do not prove them.
3. Keep the moderate ExcelJS/UUID advisory tracked. Installed ExcelJS uses
   `uuid.v4()`; the advisory affects v3/v5/v6 methods with caller buffers, so no
   affected ExcelJS call path was identified. This is reachability analysis,
   not a clean audit. [Upstream advisory](https://github.com/advisories/GHSA-w5hq-g745-h8pq).
4. This is not an independent penetration test, exhaustive query authorization
   proof, load test or availability guarantee. XLSX expansion/resource usage,
   large imports, multi-item transfer/count/repair races and concurrent policy
   changes deserve targeted stress testing beyond the complete available suites.

## Coordinator follow-up

Standalone preparation now preserves the installed `@img` packages in full,
including Sharp companion DLLs needed by Windows standalone servers. The same
tracing omission was reproduced and its correction verified in Machines.

The remaining UUID advisory was also checked against ExcelJS's installed source:
its conditional-formatting implementation calls only `uuid.v4()`. The advisory
affects v3/v5/v6 methods with caller-provided buffers, so no affected ExcelJS call
path was identified in this inspection. This is a reachability assessment, not
a clean dependency audit; the two moderate entries remain tracked.
[Upstream advisory](https://github.com/advisories/GHSA-w5hq-g745-h8pq).

The coordinator executed standalone preparation and verified the prepared Sharp
package loads successfully. Final worker/beat bundles were rebuilt after all
local runtime changes. Earlier temporary Inventory services were removed; final
acceptance services are removed or stopped. Audit cleanup removes only owned
Inventory runtime/source volumes and image tags after their final proof, while
retaining the final source archive, raw logs, screenshots and scan evidence.
The shared Buildx container/state and shared images remain available for the
other products. No global image/volume pruning or unowned-service changes were
performed by this agent.
