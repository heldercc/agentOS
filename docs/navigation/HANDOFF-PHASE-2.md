# HANDOFF — PHASE 2 do Programa CEO (para o próximo executor)

> Navigation instrument (ADR-0001: Copilot-agnostic). Written by the worker
> Claude at the end of Session 015 (2026-07-12, late night), when tokens ran
> low. The next executor — GPT, a fresh Claude, anyone — continues from here.
> Plain technical language; every claim checkable against origin/main.

## 0A. Codex continuation after the handoff (implemented and verified)

The Pilot explicitly authorized Codex to continue implementation and later
explicitly authorized this complete continuation to be committed and pushed.
The resulting save contains:

- PHASE 2 safety: atomic/recoverable JSON and YAML current records; torn-tail
  JSONL; loopback binding; 1 MB/body/content-type/Host/Origin gates; path
  containment; safe 500s; runtime validators; schema v2 migration registry +
  visible read-only safe mode; recoverable multi-file journal applied to seed
  admission, state approval/rejection, Artifact return and migrations;
  `seed.sensei` as sole canonical ownership with derived Sensei index,
  versioned reassignment and sanity report; queued/running/interrupted/
  timed-out Work Orders; proven resume of a three-WO execution without
  rerunning WO1 or colliding with its immutable Artifact. Windows cancellation
  now uses `taskkill /T /F` on the exact PowerShell child tree.
- PHASE 3: Architecture Module Registry (`module-registry.ts`) mechanically
  covers every TypeScript module and separates contract/schema/build/doctrine
  identities; minimal Windows GitHub Actions runs npm ci + typecheck + smoke,
  FakeRuntime only.
- PHASE 4: ADR-0024 + Project Engine MVP. The Slicer is one authorized Kernel
  Work Order; Candidate Project Maps cannot schedule; Pilot approval is
  compare-and-swap against current Map version; approved versions are
  immutable and referenced from Project State; cycle/reference validation,
  deterministic next-unblocked traversal, blocking, completion, backtracking
  and downstream `affected` propagation use zero model calls. Each later Work
  Order records and receives its active `sliceId`. Child-project creation is
  deliberately deferred behind its own future material gate.
- PHASE 5 first slice: up to three coherent questions per submission; one
  aggregated reconsult per affected agent; “Levar para Decidir — quero opções”
  turns that exact question into a Decision Surface; a Slice prepares multiple
  sequential material decisions. Project Map is visible/actionable in Agora.

Verification at this save point: `npm run typecheck` clean; smoke **149/149**,
isolated and zero paid calls. Isolated live proof on `127.0.0.1:54901`:
empty verify workspace, schema v2, registry v1; traversal 400; foreign Host
403; foreign Origin 403; unsupported Content-Type 415; body >1 MB 413; page
contains Project Map, batched questions and route-to-Decide controls. The
temporary server stopped; :4900 and Claude's older :4901/:4902 processes were
not touched.

Honest remaining limits before calling the whole CEO programme complete:
resumability is intentionally proven only for execution WOs until operation
group identity exists (semantic calls are never guessed/reused); the real
Claude-on-Windows orphan-process proof was not run to preserve subscription
fuel; general two-tab CAS outside Project Maps remains owed; Phase 5 still
owes full governed stage navigation/edit/name+effective-intent work; Phase 6
Review/Mode Edit/Sensei evolution and Phase 7 verticals remain.

## 0. Where the repository stands (verified state)

- HEAD at handoff: `5a6c56a` (plus possibly one final save commit after it).
- Session 015 executed and pushed, slice by slice:
  - PHASE 0: ADR-0021 (SENSEI canonical, CLOSED), ADR-0022 (the CEO
    programme + EXPLICIT budget-enforcement deferral + the Pilot's addendum:
    Project Engine = Kernel mechanism, never a second orchestrator),
    ADR-0023 (standing rules A–E). Sensei propagated to all active Book I
    docs.
  - PHASE 1 complete: 1.1 product-aware staleness (`product/src/build.ts`,
    pure, smoke-tested; docs-only commits never mark the product stale);
    1.2 RULE A isolation by construction (`PRODUCT_WORKSPACE_DIR`, per-call
    `workspaceRoot()` in `paths.ts`; smoke → `workspace-smoke/`, :4901
    verify → `workspace-verify/` + `hi-verify/`; the three scripted
    projects relocated to `workspace-scripted/`, classified, not deleted);
    1.3 Kernel cancel boundary (`recordOperationCancelled` in kernel.ts;
    `OpCancelledError` passes intact; WO status `"interrupted"`; no
    substring sniffing) + full operation visibility (Busy: operationId,
    agentId/humanRole, honest phases queued→launching→awaiting-model→
    response-received→validating-parsing→persisting, live tokens
    exact/estimated) + per-operation actuals appended to each project's
    `operations.jsonl` (`OperationActual` in types.ts, appended by
    kernel.ts); 1.4 poll hardening (monotonic seq, one in flight,
    data-error vs connection banners; `product/src/poll-logic.ts` is the
    pure twin of the inline client logic); 1.5 diary S015 + compass; the
    S014 claim "executed in full" corrected.
  - PHASE 7D immediate: the 20 unsourced Guild candidates quarantined
    (`product/src/cli/quarantine-unsourced.ts`, idempotent, run live);
    preload labels corrected.
- Tests: `npm run typecheck` clean (tsc strict); `npm run smoke` 112/112,
  fully isolated (RULE A), zero paid calls (FakeRuntime).
- The live :4900 still runs pre-programme code and correctly self-reports
  stale (product moved). Restarting it is the operator's explicit act —
  ask the Pilot, or restart if he says the session is yours to manage.
- INCIDENT (resolved in the save commit that carries this file): the
  1.3b/1.4 subagent also refactored `stores.ts`, `evidence.ts` and `hi.ts`
  (a torn-tail-tolerant `readJsonl` centralized in stores.ts) but its
  report omitted those files, so commit `b079000` shipped kernel.ts
  importing `readJsonl` WITHOUT the stores.ts that defines it —
  origin/main was briefly unbuildable even though local typecheck+smoke
  were green (they saw the working tree). Lesson for fan-out: verify with
  `git status` that the commit stages EVERY dirty product file, or run
  typecheck from a clean checkout; a subagent's file list is a claim, not
  evidence. The torn-tail work itself is good and PARTIALLY discharges
  slice 2.1's JSONL half — verify and finish per §2.1.

## 1. Standing law you must not break (read the ADRs, this is the digest)

- ADR-0023 RULES A–E: test isolation by construction; no module without a
  contract; four separate version identities; canonical data safety (a
  failed migration/partial transition NEVER lets the App act healthy); no
  domain vocabulary in Kernel/Project Engine.
- Budget enforcement is DEFERRED (ADR-0022 §2). Measure and disclose only.
  Never claim budgets are enforced.
- Every slice: state the invariant + CEO decision served; typecheck +
  smoke green (count grows); browser/API-verify visible behavior on :4901
  (`agentos-shell-verify-4901` launch config — fake runtime, 6s delay,
  isolated roots); commit with the ADR-0020 §8 five answers; PUSH
  IMMEDIATELY (Sync Doctrine); report the SHA; update diary honestly at
  session end. Never modify permanent expertise during tests (smoke is
  already isolated — keep it that way).
- PT-PT user-facing strings; English code comments; PowerShell 5.1 quirks:
  use `curl.exe` (not Invoke-WebRequest) against localhost, POST JSON via
  `--data "@file"`, write commit messages to a temp file (no BOM) and
  `git commit -F`.

## 2. PHASE 2 — the plan (execute in this order)

Rationale for the order: pure-local first (stores), then the security
perimeter (shell), then ownership/validation (data model), then the
registry/journal machinery, then resumable WOs (depends on validation +
atomic writes). Each numbered slice is one commit+push.

### 2.1 Atomic canonical writes (RULE D; acceptance gate 4)

In `product/src/stores.ts` (small file, read it fully):

- `writeJson` becomes atomic and recoverable, Windows-appropriate:
  serialize → write `path + ".tmp"` (same dir/volume) → VALIDATE the temp
  (read back + JSON.parse; invalid ⇒ delete temp and throw — never replace
  good data with a bad write) → if `path` exists, rename to `path + ".prev"`
  (delete stale .prev first) → rename tmp → path (same-volume rename is the
  NTFS-safe replace) → on failure after the .prev rename, attempt restore
  .prev → path before rethrowing. Document the crash windows: a crash
  leaves (old path) OR (.prev + .tmp) OR (.prev + new path) — never a torn
  main file.
- `readJson` recovery: `path` missing but `.prev` present ⇒ restore and
  read it (one honest console.warn). `path` unparsable with a clean `.prev`
  ⇒ THROW naming both files ("corrupt record, recoverable previous version
  exists") — silent swapping is lying; safe mode arrives in 2.5.
- Torn-tail tolerance for append-only JSONL (evidence.jsonl,
  operations.jsonl, victories, applications): a final unparsable line is
  skipped with console.warn; an unparsable line in the MIDDLE still throws
  (corruption ≠ torn tail). Centralize as `readJsonl` in stores.ts and use
  it from evidence.ts / hi.ts / kernel.ts readers (grep `split(/\r?\n/)`).
  NOTE: the uncommitted hi.ts edit at handoff suggests this was started.
- Smoke (crash simulation, deterministic, isolated workspace):
  (i) two writes ⇒ .prev holds v1; (ii) garbage `x.json.tmp` beside good
  `x.json` ⇒ read returns good, next write cleans up; (iii) only
  `y.json.prev` present ⇒ read recovers it; (iv) corrupt main + valid
  .prev ⇒ read THROWS naming .prev; (v) torn tail on a copied evidence
  log ⇒ whole-line events returned, tail skipped.

### 2.2 Local security (CEO item 7; gate 9)

In `product/src/cli/shell.ts` (routes ~line 626–1000; `body()` helper;
`server.listen` at the end):

- Bind loopback explicitly: `server.listen(PORT, "127.0.0.1", ...)`.
- Body limit 1 MB in `body()` ⇒ 413.
- POST content-type whitelist (what `body()` actually parses — JSON and/or
  form-urlencoded) ⇒ 415 otherwise. Do not break the UI (it posts JSON).
- Host/Origin validation on POSTs: Host must be 127.0.0.1[:port] or
  localhost[:port] ⇒ 403; if Origin present it must be the same-origin
  http variant ⇒ 403. (Gate 9: cross-origin invalid mutation rejected.)
- Path containment: every request param that reaches the filesystem
  (artifact/story routes — grep `q("` uses feeding paths) goes through ONE
  helper `containedPath(root, ...parts): string | null` (null on `..`,
  absolute paths, drive letters) added to stores.ts.
- Safe 500s: the route dispatcher's catch must not leak stack traces.
- Extract pure decisions into `product/src/http-guards.ts` (hostAllowed,
  originAllowed, bodyTooLarge) because shell.ts starts listening on import
  and cannot be smoke-imported; smoke tests the module + containedPath.
- Doc line in shell.ts header + product/README.md: :4900 is loopback-only,
  never expose directly; remote arrives only via the future authenticated
  mobile design (PHASE 7B).
- Live verify with curl.exe on :4901: traversal attempt 400, foreign Host
  403, >1MB 413, foreign Origin 403.

### 2.3 Canonical Seed–Sensei ownership (CEO decision 6; gate 6)

In `product/src/hi.ts`: today `seed.sensei` (on the seed) and
`sensei.seeds[]` (on the Sensei composition) can drift. Decide per the CEO
order: **seed.sensei is canonical** (one seed, one Sensei — the Pilot's
rule); `sensei.seeds` becomes a DERIVED index — either computed on read or
rebuilt atomically whenever ownership changes (pick one, document it).
Provide: versioned reassignment (an ownership change bumps the seed
version, ADR-style never-silent), an invariant checker
(`senseiSanity`-style: every seed's sensei exists; no seed appears under
two Senseis; report conflicts, do not auto-fix), a mechanical migration
for existing records (idempotent, dry-run first on a copy), and conflict
reporting surfaced in the UI's Inteligência Humana / sanity area. Smoke:
divergence cannot be constructed via the public API (attempting it either
fixes the derived side atomically or throws).

### 2.4 Versioned runtime validation (CEO decision 4 start; gates 5/19 prep)

New `product/src/validate.ts`: hand-rolled validators (no new deps),
`validateProject(x): Project` etc., throwing typed errors naming record +
field, for at least: Project, WorkOrderRecord, QuestionsFile,
CandidateState/ApprovedState, DecisionSurface, EvidenceEvent, GuruSeed,
Sensei, OperationActual. Each validator tolerates OLDER schema shapes that
are still readable (absent optional fields) — reading old records must not
break (gate 19). Wire into the canonical read paths (kernel.ts readers,
hi.ts readYaml sites) replacing bare `JSON.parse(...) as T` /
`YAML.parse(...) as T` casts. `DATA_SCHEMA_VERSION` (types.ts, currently 1)
is the declared version. Smoke: a record with a wrong-typed field fails
validation with a message naming the field; every existing smoke record
passes.

### 2.5 Migration registry + safe mode (CEO decision 4; RULE D; gate 5)

New `product/src/migrations.ts`: registry of {id, fromSchema, toSchema,
dryRun(root), apply(root)}, an applied-ledger JSONL at the workspace root
(`_meta/migrations.jsonl`), backup/checkpoint before apply (copy the
touched files with a suffix), idempotency (applying twice = no-op),
post-validation via validate.ts. On startup (shell.ts boot), if the ledger
says the data is AHEAD of the code's DATA_SCHEMA_VERSION or a migration
failed mid-way (ledger entry without completion), enter READ-ONLY SAFE
MODE: GET routes serve, every mutating route returns 503 with an honest
PT-PT message; the home shows a visible safe-mode card. NEVER catch a
migration error and serve partially migrated data as healthy. Smoke:
a fake migration that throws mid-apply leaves the ledger open ⇒ a
simulated boot decision function returns safe-mode (extract the decision
pure so smoke can test it).

### 2.6 Multi-file journal transitions (CEO PHASE 2 item 2)

New small journal in stores.ts or its own module: `withTransition(name,
files[], fn)` — writes a journal entry (intent + file list + backups),
runs the writes, marks complete, and a recovery pass at boot rolls
FORWARD a completed-but-unmarked transition or rolls BACK an incomplete
one (complete old state or complete new state, never half). Apply to the
transitions the CEO names: seed admission (candidate → seeds/ + sensei
index), sensei changes, approvals, execution return (artifact + provenance
+ evidence + state), migrations (2.5 uses it). Smoke: simulate a crash
between the two writes of a seed admission (call the internals), run
recovery, assert both-or-neither.

### 2.7 Resumable Work Orders (CEO decision 2; gates 7/8)

kernel.ts + shell.ts + runtime.ts: WO statuses queued|running|done|
interrupted|timed-out|error are already in types.ts — start WRITING
queued/running (runWorkOrder writes the record as running before the
runtime call; timed-out when the timeout fires). Resume: an operation
re-launched after interruption REUSES completed WOs (the acceptance
test: a 3-WO operation where WO1 completed and WO2 was cancelled ⇒ retry
does not re-call the model for WO1, resumes WO2, continues WO3; no
immutable-artifact collision — execute reuses the artifact version
counter correctly; provenance stays complete). This needs: WO records
addressable by deterministic id per (iteration, kind, agent) — they
already are (`01-roster` etc. — verify), plus an op-level "resume"
entry point in the shell (the relaunch button already exists; make it
resume-aware). Windows process proof (gate 8): with PRODUCT_RUNTIME=cli,
cancel mid-call and assert no orphan `claude` process remains — the cli
runtime kills only its own child (S014 built this; RE-VERIFY it after
your changes with Get-CimInstance Win32_Process filtering on the child
pid, and write down the evidence).

### Exit criteria for the whole phase

Gates 4,5,6,7,8,9,10*,19 demonstrably pass (*10 — two-tabs stale/conflict
detection — may land with the Project Engine if state versioning is
needed; if deferred, SAY SO in the diary). Then PHASE 3 (module registry +
minimal CI) begins; its GitHub Actions workflow runs npm ci + typecheck +
smoke only — no paid calls (ADR-0022 §1 "minimal CI now").

## 3. Fan-out method that worked this session (recommended)

The worker designs and writes a CLOSED spec per slice (file anchors, exact
behaviors, smoke checks, hard rules: no commits, no paid models, no live
workspace); a subordinate model implements; the worker independently
verifies (typecheck, smoke, live proof on :4901) and commits. One slice at
a time — parallel subagents collide on smoke.ts. The 1.3b/1.4 subagent
caught its own dishonest phase placement because the spec demanded a smoke
check for phase ORDER — put invariants in checks, not in prose.
