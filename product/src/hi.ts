// The Human Intelligence Library (docs/HUMAN-INTELLIGENCE-LIBRARY.md,
// ADR-0020): the durable asset, materialized on disk as a real library --
// never hidden in prompts, session memory or "magic personalization".
// Disk = canonical intelligence. UI = inspection and governance.
// Kernel = selection and scheduling. Model = temporary application.
// Pilot = authority.
//
// Layout (spec, v0 -- tools/ and workflows/ are registered categories,
// engine support arrives when a slice demands them):
//   human-intelligence/
//     seeds/<domain>/<slug>/seed.yaml           (current version + content_hash)
//     seeds/<domain>/<slug>/versions/v<N>.yaml  (immutable history, write-once)
//     seeds/<domain>/<slug>/evidence.jsonl      (append-only telemetry)
//     seeds/<domain>/<slug>/applications.jsonl  (append-only telemetry)
//     mentors/<id>.yaml (+ mentors/history/<id>/v<N>.yaml, write-once)
//     candidates/<id>.yaml
//     retired/<id>.yaml
//     index/  (derived, regenerable)
//
// Immutability contract (parecer 2026-07-12): the versioned CONTENT of a Seed
// or Mentor is write-once per version -- revision bumps the version, history
// stays recoverable forever. Telemetry (applications, evidence) is append-only
// BESIDE the content, never inside it, so a version's hash never drifts.

import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { resolve } from "node:path";
import YAML from "yaml";

import { PKG_ROOT, projectDir, WORKSPACE_DIR } from "./paths.js";
import { abs, readJson, readText, sha256 } from "./stores.js";

/**
 * The library root. PRODUCT_HI_DIR overrides it (read per call, not at
 * module load) so smoke tests run against an isolated, disposable library --
 * scripted seeds must never enter the owner's real one.
 */
export function hiDir(): string {
  return process.env["PRODUCT_HI_DIR"] ?? resolve(PKG_ROOT, "human-intelligence");
}
function seedsRoot(): string {
  return resolve(hiDir(), "seeds");
}
function mentorsRoot(): string {
  return resolve(hiDir(), "mentors");
}
function candidatesRoot(): string {
  return resolve(hiDir(), "candidates");
}
function retiredRoot(): string {
  return resolve(hiDir(), "retired");
}

// ---------------------------------------------------------------------------
// Schemas -- the Pilot's records (HUMAN-INTELLIGENCE-LIBRARY.md), typed.

export interface SeedApplication {
  project: string;
  workOrder: string;
  ts: string;
}

/** The minimal unit of human intelligence. */
export interface GuruSeed {
  id: string;
  title: string;
  kind: "judgement" | "heuristic" | "method" | "example";
  status: "candidate" | "admitted" | "retired";
  scope: {
    /** Domains double as matching tags for the Resolver. Empty = universal. */
    domains: string[];
    /** Projects this seed is local to. Empty = reusable everywhere. */
    projects: string[];
  };
  owner: string;
  version: number;
  /** The judgement itself, in the owner's words. */
  rule: string;
  why: string;
  provenance: {
    origin: "taught" | "distilled" | "imported";
    source_project?: string;
    admitted_by?: string;
    admitted_at?: string;
    note?: string;
  };
  /** Telemetry — hydrated from evidence.jsonl, never stored in seed.yaml. */
  evidence: {
    supporting: string[];
    contradicting: string[];
  };
  applicability: {
    use_when: string[];
    avoid_when: string[];
  };
  /** Telemetry — hydrated from applications.jsonl, never stored in seed.yaml. */
  applied_in: SeedApplication[];
  /** sha256 of the versioned content (everything except telemetry). */
  content_hash?: string;
}

/**
 * A Mentor is NOT another intelligence and NOT an AI agent: it is a governed,
 * user-authored composition of GuruSeeds with a name and a voice -- the thing
 * the temporary model roles carry. The product shows which Mentor shaped
 * which option (ADR-0020 sec. 6).
 */
export interface Mentor {
  id: string;
  title: string;
  /** One line of voice, e.g. "realizador -- contencao antes do impacto". */
  persona: string;
  version: number;
  owner: string;
  createdAt: string;
  seeds: { id: string; version: number }[];
  selection_notes: string[];
  /** sha256 of the composition's content. */
  content_hash?: string;
}

// ---------------------------------------------------------------------------
// IO.

function readYaml<T>(path: string): T {
  return YAML.parse(readText(path)) as T;
}

function writeYaml(path: string, value: unknown): void {
  mkdirSync(resolve(path, ".."), { recursive: true });
  writeFileSync(path, YAML.stringify(value), "utf8");
}

function seedDir(seed: GuruSeed): string {
  const domain = seed.scope.domains[0] ?? "general";
  return resolve(seedsRoot(), domain, seed.id);
}

/** Canonical path of one admitted seed's record (provenance by reference). */
export function seedYamlPath(seed: GuruSeed): string {
  return resolve(seedDir(seed), "seed.yaml");
}

export function slugifyId(text: string): string {
  return (
    text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "seed"
  );
}

// ---------------------------------------------------------------------------
// Immutable provenance (parecer 2026-07-12). The versioned content of a Seed
// or Mentor is write-once per version; telemetry is append-only sidecars.

const SEED_TELEMETRY_KEYS: readonly string[] = ["evidence", "applied_in", "content_hash"];

/** The versioned content of a seed: everything except telemetry and hash. */
function seedContent(seed: GuruSeed): Record<string, unknown> {
  const content: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(seed)) {
    if (!SEED_TELEMETRY_KEYS.includes(k)) content[k] = v;
  }
  return content;
}

/** The hash a provenance sidecar records for the seed version it applied. */
export function seedContentHash(seed: GuruSeed): string {
  return sha256(YAML.stringify(seedContent(seed)));
}

/** Write the current record and its immutable version snapshot (write-once). */
function writeSeedRecord(seed: GuruSeed): void {
  const content = seedContent(seed);
  const record = { ...content, content_hash: sha256(YAML.stringify(content)) };
  writeYaml(seedYamlPath(seed), record);
  const vPath = resolve(seedDir(seed), "versions", `v${seed.version}.yaml`);
  if (!existsSync(vPath)) {
    mkdirSync(resolve(seedDir(seed), "versions"), { recursive: true });
    // flag wx: a version, once written, can never be overwritten.
    writeFileSync(vPath, YAML.stringify(record), { encoding: "utf8", flag: "wx" });
  }
}

function readJsonl<T>(path: string): T[] {
  if (!existsSync(path)) return [];
  return readText(path)
    .split(/\r?\n/)
    .filter((l) => l.trim() !== "")
    .map((l) => JSON.parse(l) as T);
}

/** Attach the append-only telemetry sidecars to the versioned content. */
function hydrateSeed(raw: GuruSeed, dir: string): GuruSeed {
  const seed: GuruSeed = {
    ...raw,
    evidence: raw.evidence ?? { supporting: [], contradicting: [] },
    applied_in: raw.applied_in ?? [],
  };
  const apps = readJsonl<SeedApplication>(resolve(dir, "applications.jsonl"));
  if (apps.length > 0) seed.applied_in = apps;
  const entries = readJsonl<SeedEvidenceEntry>(resolve(dir, "evidence.jsonl"));
  if (entries.length > 0) {
    seed.evidence = { supporting: [], contradicting: [] };
    for (const e of entries) {
      seed.evidence[e.kind].push(
        `${e.ts.slice(0, 10)} ${e.note}${e.project ? ` (${e.project})` : ""}`,
      );
    }
  }
  return seed;
}

/**
 * One-time, mechanical, idempotent: a seed written before this correction
 * carries telemetry inline -- move it to the sidecars, stamp the content
 * hash, and snapshot the current version so history starts now. Returns
 * true when the record needed correcting.
 */
function ensureSeedSidecars(dir: string): boolean {
  const p = resolve(dir, "seed.yaml");
  const raw = readYaml<GuruSeed>(p);
  const inlineApps = raw.applied_in ?? [];
  const inlineEvidence =
    (raw.evidence?.supporting.length ?? 0) + (raw.evidence?.contradicting.length ?? 0);
  const legacy =
    raw.content_hash === undefined || inlineApps.length > 0 || inlineEvidence > 0;
  if (!legacy) return false;
  const appsPath = resolve(dir, "applications.jsonl");
  if (inlineApps.length > 0 && !existsSync(appsPath)) {
    for (const a of inlineApps) appendFileSync(appsPath, JSON.stringify(a) + "\n", "utf8");
  }
  // Inline evidence lines without a jsonl (hand-edited records): preserve them
  // as entries -- the line IS the note, nothing is lost.
  const evPath = resolve(dir, "evidence.jsonl");
  if (inlineEvidence > 0 && !existsSync(evPath) && raw.evidence) {
    for (const kind of ["supporting", "contradicting"] as const) {
      for (const line of raw.evidence[kind]) {
        const entry: SeedEvidenceEntry = { ts: new Date().toISOString(), kind, note: line };
        appendFileSync(evPath, JSON.stringify(entry) + "\n", "utf8");
      }
    }
  }
  writeSeedRecord(raw);
  return true;
}

// ---------------------------------------------------------------------------
// Readers -- the library is small by design; full scans stay honest and cheap.

export function listSeeds(): GuruSeed[] {
  const out: GuruSeed[] = [];
  if (!existsSync(seedsRoot())) return out;
  for (const domain of readdirSync(seedsRoot())) {
    const dDir = resolve(seedsRoot(), domain);
    for (const slug of readdirSync(dDir)) {
      const p = resolve(dDir, slug, "seed.yaml");
      if (existsSync(p)) out.push(hydrateSeed(readYaml<GuruSeed>(p), resolve(dDir, slug)));
    }
  }
  return out;
}

/** A historical version, recoverable exactly as written (telemetry attached). */
export function getSeedVersion(seedId: string, version: number): GuruSeed | null {
  const current = getSeed(seedId);
  if (!current) return null;
  const p = resolve(seedDir(current), "versions", `v${version}.yaml`);
  if (!existsSync(p)) return null;
  return hydrateSeed(readYaml<GuruSeed>(p), seedDir(current));
}

export function listCandidates(): GuruSeed[] {
  if (!existsSync(candidatesRoot())) return [];
  return readdirSync(candidatesRoot())
    .filter((f) => f.endsWith(".yaml"))
    .map((f) => readYaml<GuruSeed>(resolve(candidatesRoot(), f)));
}

export function listMentors(): Mentor[] {
  if (!existsSync(mentorsRoot())) return [];
  return readdirSync(mentorsRoot())
    .filter((f) => f.endsWith(".yaml"))
    .map((f) => readYaml<Mentor>(resolve(mentorsRoot(), f)));
}

export function getSeed(seedId: string): GuruSeed | null {
  return listSeeds().find((s) => s.id === seedId) ?? null;
}

export function getCandidate(seedId: string): GuruSeed | null {
  return listCandidates().find((s) => s.id === seedId) ?? null;
}

// ---------------------------------------------------------------------------
// Writing -- candidates enter freely; admitted seeds only through the Pilot.

function uniqueSeedId(base: string): string {
  const taken = new Set([
    ...listSeeds().map((s) => s.id),
    ...listCandidates().map((s) => s.id),
  ]);
  let id = base;
  let n = 2;
  while (taken.has(id)) {
    id = `${base}-${n}`;
    n += 1;
  }
  return id;
}

export function addCandidateSeed(args: {
  title: string;
  rule: string;
  why: string;
  domains: string[];
  projects: string[];
  origin: "taught" | "distilled" | "imported";
  provenanceNote: string;
  sourceProject?: string;
  owner?: string;
}): GuruSeed {
  const seed: GuruSeed = {
    id: uniqueSeedId(slugifyId(args.title)),
    title: args.title.trim(),
    kind: "judgement",
    status: "candidate",
    scope: {
      domains: args.domains.map((d) => d.trim().toLowerCase()).filter((d) => d !== ""),
      projects: args.projects.filter((p) => p.trim() !== ""),
    },
    owner: args.owner ?? "helder",
    version: 1,
    rule: args.rule.trim(),
    why: args.why.trim(),
    provenance: {
      origin: args.origin,
      note: args.provenanceNote,
      ...(args.sourceProject ? { source_project: args.sourceProject } : {}),
    },
    evidence: { supporting: [], contradicting: [] },
    applicability: { use_when: [], avoid_when: [] },
    applied_in: [],
  };
  writeYaml(resolve(candidatesRoot(), `${seed.id}.yaml`), seed);
  return seed;
}

/** The Pilot's hand: candidate -> admitted (moves into the seeds tree). */
export function admitSeed(seedId: string, editedRule?: string): GuruSeed {
  const seed = getCandidate(seedId);
  if (!seed) throw new Error(`unknown candidate seed ${seedId}`);
  if (editedRule && editedRule.trim() !== "") seed.rule = editedRule.trim();
  seed.status = "admitted";
  seed.provenance.admitted_by = seed.owner;
  seed.provenance.admitted_at = new Date().toISOString();
  writeSeedRecord(seed);
  mkdirSync(retiredRoot(), { recursive: true });
  renameSync(
    resolve(candidatesRoot(), `${seedId}.yaml`),
    resolve(retiredRoot(), `${seedId}.candidate-admitted.yaml`),
  );
  return seed;
}

/** The Pilot's hand: candidate -> retired (rejected, kept for the record). */
export function rejectSeed(seedId: string): void {
  const p = resolve(candidatesRoot(), `${seedId}.yaml`);
  if (!existsSync(p)) throw new Error(`unknown candidate seed ${seedId}`);
  mkdirSync(retiredRoot(), { recursive: true });
  renameSync(p, resolve(retiredRoot(), `${seedId}.rejected.yaml`));
}

/**
 * The automatic application trail -- must never break a work order. Appended
 * to the seed's applications.jsonl sidecar: telemetry never touches the
 * versioned content.
 */
export function recordSeedApplication(seedId: string, app: SeedApplication): void {
  const seed = getSeed(seedId);
  if (!seed) return;
  ensureSeedSidecars(seedDir(seed));
  appendFileSync(
    resolve(seedDir(seed), "applications.jsonl"),
    JSON.stringify(app) + "\n",
    "utf8",
  );
}

/**
 * The Pilot's hand: revise an admitted seed's content. The version bumps and
 * every previous version stays recoverable -- content is never edited in
 * place (parecer 2026-07-12).
 */
export function reviseSeed(
  seedId: string,
  changes: { title?: string; rule?: string; why?: string },
): GuruSeed {
  const seed = getSeed(seedId);
  if (!seed) throw new Error(`unknown admitted seed ${seedId}`);
  // A pre-correction record snapshots its current version before it bumps.
  ensureSeedSidecars(seedDir(seed));
  if (changes.title && changes.title.trim() !== "") seed.title = changes.title.trim();
  if (changes.rule && changes.rule.trim() !== "") seed.rule = changes.rule.trim();
  if (changes.why && changes.why.trim() !== "") seed.why = changes.why.trim();
  seed.version += 1;
  writeSeedRecord(seed);
  return getSeed(seedId) as GuruSeed;
}

/** One line of the seed's append-only evidence file. */
export interface SeedEvidenceEntry {
  ts: string;
  kind: "supporting" | "contradicting";
  note: string;
  project?: string;
  workOrder?: string;
}

/**
 * The user's judgement returning to the asset (ADR-0020, Consequences): one
 * entry in the seed's append-only evidence.jsonl, hydrated onto the record at
 * read time -- the versioned content is never rewritten by telemetry. Only
 * the user grades a seed; the Kernel never marks its own homework.
 */
export function recordSeedEvidence(
  seedId: string,
  args: { kind: "supporting" | "contradicting"; note: string; project?: string; workOrder?: string },
): GuruSeed {
  const seed = getSeed(seedId);
  if (!seed) throw new Error(`unknown admitted seed ${seedId}`);
  ensureSeedSidecars(seedDir(seed));
  const entry: SeedEvidenceEntry = {
    ts: new Date().toISOString(),
    kind: args.kind,
    note: args.note,
    ...(args.project ? { project: args.project } : {}),
    ...(args.workOrder ? { workOrder: args.workOrder } : {}),
  };
  appendFileSync(resolve(seedDir(seed), "evidence.jsonl"), JSON.stringify(entry) + "\n", "utf8");
  return getSeed(seedId) as GuruSeed;
}

// ---------------------------------------------------------------------------
// Mentors -- authored and evolved by the user (the "director" the Pilot
// builds); saving a change bumps the version, never silently, and every
// version stays recoverable from mentors/history/.

function mentorContent(m: Mentor): Record<string, unknown> {
  const content: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(m)) {
    if (k !== "content_hash") content[k] = v;
  }
  return content;
}

/** Write the current record and its immutable version snapshot (write-once). */
function writeMentorRecord(mentor: Mentor): void {
  const content = mentorContent(mentor);
  const record = { ...content, content_hash: sha256(YAML.stringify(content)) };
  writeYaml(resolve(mentorsRoot(), `${mentor.id}.yaml`), record);
  const vPath = resolve(mentorsRoot(), "history", mentor.id, `v${mentor.version}.yaml`);
  if (!existsSync(vPath)) {
    mkdirSync(resolve(mentorsRoot(), "history", mentor.id), { recursive: true });
    writeFileSync(vPath, YAML.stringify(record), { encoding: "utf8", flag: "wx" });
  }
}

/** A historical composition, recoverable exactly as written. */
export function getMentorVersion(mentorId: string, version: number): Mentor | null {
  const p = resolve(mentorsRoot(), "history", mentorId, `v${version}.yaml`);
  return existsSync(p) ? readYaml<Mentor>(p) : null;
}

export function saveMentor(args: {
  id?: string;
  title: string;
  persona: string;
  seedIds: string[];
  selectionNotes: string[];
  owner?: string;
}): Mentor {
  const id = args.id ?? slugifyId(args.title);
  const existing = listMentors().find((m) => m.id === id) ?? null;
  // A pre-correction record snapshots its current version before it bumps.
  if (existing && existing.content_hash === undefined) writeMentorRecord(existing);
  const seeds = args.seedIds
    .map((sid) => getSeed(sid))
    .filter((s): s is GuruSeed => s !== null)
    .map((s) => ({ id: s.id, version: s.version }));
  const mentor: Mentor = {
    id,
    title: args.title.trim(),
    persona: args.persona.trim(),
    version: existing ? existing.version + 1 : 1,
    owner: args.owner ?? existing?.owner ?? "helder",
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    seeds,
    selection_notes: args.selectionNotes.filter((n) => n.trim() !== ""),
  };
  writeMentorRecord(mentor);
  return mentor;
}

/**
 * One-time, mechanical, idempotent (parecer 2026-07-12): bring a library
 * written before the immutability correction up to it -- telemetry moves to
 * sidecars, content hashes are stamped, and every current version gets its
 * first immutable snapshot. Returns how many records were corrected.
 */
export function ensureImmutableProvenance(): number {
  let corrected = 0;
  if (existsSync(seedsRoot())) {
    for (const domain of readdirSync(seedsRoot())) {
      const dDir = resolve(seedsRoot(), domain);
      for (const slug of readdirSync(dDir)) {
        if (
          existsSync(resolve(dDir, slug, "seed.yaml")) &&
          ensureSeedSidecars(resolve(dDir, slug))
        ) {
          corrected += 1;
        }
      }
    }
  }
  for (const m of listMentors()) {
    const vPath = resolve(mentorsRoot(), "history", m.id, `v${m.version}.yaml`);
    if (m.content_hash === undefined || !existsSync(vPath)) {
      writeMentorRecord(m);
      corrected += 1;
    }
  }
  return corrected;
}

// ---------------------------------------------------------------------------
// Migration from the ADR-0019 flat store (superseded by ADR-0020 sec. 9):
// mechanical, provenance preserved, the old file kept as .migrated.

interface LegacyExpertise {
  id: string;
  title: string;
  body: string;
  tags: string[];
  status: string;
  reach: string;
  provenance: { origin: string; note: string };
  appliedIn: { projectId: string; workOrderId: string; ts: string }[];
}

export function migrateLegacyExpertise(): number {
  let migrated = 0;
  const stores: { path: string; project: string | null }[] = [];
  const shared = abs(WORKSPACE_DIR, "_shared", "expertise.json");
  if (existsSync(shared)) stores.push({ path: shared, project: null });
  if (existsSync(WORKSPACE_DIR)) {
    for (const name of readdirSync(WORKSPACE_DIR)) {
      const p = abs(projectDir(name), "expertise.json");
      if (name !== "_shared" && existsSync(p)) stores.push({ path: p, project: name });
    }
  }
  for (const store of stores) {
    const records = readJson<{ expertise: LegacyExpertise[] }>(store.path).expertise;
    for (const r of records) {
      if (r.status === "discarded") continue;
      const seed = addCandidateSeed({
        title: r.title,
        rule: r.body,
        why: "migrated from the ADR-0019 flat store",
        domains: r.tags,
        projects: store.project && r.reach === "project" ? [store.project] : [],
        origin: "imported",
        provenanceNote: `ADR-0019 record ${r.id} (${r.provenance.note})`,
        ...(store.project ? { sourceProject: store.project } : {}),
      });
      if (r.status === "admitted") {
        const admitted = admitSeed(seed.id);
        // The legacy application trail lands in the telemetry sidecar --
        // never inside the versioned content.
        const appsPath = resolve(seedDir(admitted), "applications.jsonl");
        for (const a of r.appliedIn) {
          const app: SeedApplication = {
            project: a.projectId,
            workOrder: a.workOrderId,
            ts: a.ts,
          };
          appendFileSync(appsPath, JSON.stringify(app) + "\n", "utf8");
        }
      }
      migrated += 1;
    }
    renameSync(store.path, `${store.path}.migrated`);
  }
  return migrated;
}
