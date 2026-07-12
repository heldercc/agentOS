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
//     senseis/<id>.yaml (+ senseis/history/<id>/v<N>.yaml, write-once)
//     senseis/telemetry/<id>.victories.jsonl    (append-only: picked options)
//     base/senseis/<id>.yaml                    (the reference photo, write-once)
//     candidates/<id>.yaml
//     retired/<id>.yaml
//     index/  (derived, regenerable)
//
// The Sensei reform (parecer 2026-07-12 noite, pontos A/B/C/F2): the expert
// entity is the SENSEI — every seed belongs to exactly ONE Sensei, nothing
// applies transversally; when the Pilot picks an option a Sensei voiced, the
// victory returns to that Sensei (append-only) and its graduation (faixa)
// derives from use — like a fighter that wins and evolves. Reference Senseis
// keep a write-once photo under base/ so the sanity of the evolved brain can
// always be measured against the balanced original.
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

import { PKG_ROOT, projectDir, workspaceRoot } from "./paths.js";
import { abs, readJson, readText, sha256 } from "./stores.js";

/**
 * The library root. PRODUCT_HI_DIR overrides it (read per call, not at
 * module load) so smoke tests run against an isolated, disposable library --
 * scripted seeds must never enter the owner's real one.
 */
export function hiDir(): string {
  const env = process.env["PRODUCT_HI_DIR"];
  // Relative values resolve under product/ (same contract as
  // PRODUCT_WORKSPACE_DIR — RULE A, ADR-0023); absolute values win as-is.
  return env ? resolve(PKG_ROOT, env) : resolve(PKG_ROOT, "human-intelligence");
}
function seedsRoot(): string {
  return resolve(hiDir(), "seeds");
}
function senseisRoot(): string {
  return resolve(hiDir(), "senseis");
}
/** Pre-reform location — read only by the migration. */
function legacyMentorsRoot(): string {
  return resolve(hiDir(), "mentors");
}
function baseRoot(): string {
  return resolve(hiDir(), "base");
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
  /**
   * The Sensei this seed belongs to (parecer 2026-07-12 noite, ponto A):
   * exactly one — a seed never applies transversally. Candidates may still
   * be ownerless; admission assigns the owner.
   */
  sensei?: string;
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
 * A Sensei is NOT another intelligence and NOT an AI agent: it is the named,
 * governed expert of ONE craft -- the entity that owns GuruSeeds, whose voice
 * the temporary model roles carry, and the ONLY thing that evolves with use:
 * picked options return as victories, victories earn graduation (faixas).
 * The product shows which Sensei suggested what (ADR-0020 sec. 6; parecer
 * 2026-07-12 noite, pontos B/C). Formerly named "Mentor".
 */
export interface Sensei {
  id: string;
  title: string;
  /** One line of voice, e.g. "realizador -- contencao antes do impacto". */
  persona: string;
  /** The craft: domains this Sensei serves. Matching agent tags convene it. */
  domains: string[];
  version: number;
  owner: string;
  createdAt: string;
  seeds: { id: string; version: number }[];
  selection_notes: string[];
  /** sha256 of the composition's content. */
  content_hash?: string;
}

/** One picked option, returned to the Sensei that voiced it (append-only). */
export interface SenseiVictory {
  ts: string;
  project: string;
  dsId: string;
  optionId: string;
  /** The decision the option answered, for a legible trail. */
  decision: string;
}

/** The dojo ladder — derived from telemetry, never stored. */
export const GRADUATIONS = [
  { min: 20, faixa: "faixa preta" },
  { min: 10, faixa: "faixa castanha" },
  { min: 6, faixa: "faixa azul" },
  { min: 3, faixa: "faixa verde" },
  { min: 1, faixa: "faixa amarela" },
  { min: 0, faixa: "faixa branca" },
] as const;

export function senseiGraduation(victories: number): string {
  return (GRADUATIONS.find((g) => victories >= g.min) ?? GRADUATIONS[5]).faixa;
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

export function listSenseis(): Sensei[] {
  if (!existsSync(senseisRoot())) return [];
  return readdirSync(senseisRoot())
    .filter((f) => f.endsWith(".yaml"))
    .map((f) => readYaml<Sensei>(resolve(senseisRoot(), f)));
}

export function getSensei(senseiId: string): Sensei | null {
  return listSenseis().find((s) => s.id === senseiId) ?? null;
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
  /** The Sensei this seed is proposed for — admission may still reassign. */
  sensei?: string;
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
    ...(args.sensei?.trim() ? { sensei: args.sensei.trim() } : {}),
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

/**
 * The Pilot's hand: candidate -> admitted (moves into the seeds tree).
 * The reform (ponto A): every admitted seed belongs to exactly ONE Sensei —
 * `senseiId` assigns or confirms the owner, and the ownership is mirrored
 * into the Sensei's composition (a new pin bumps the Sensei's version).
 */
export function admitSeed(seedId: string, editedRule?: string, senseiId?: string): GuruSeed {
  const seed = getCandidate(seedId);
  if (!seed) throw new Error(`unknown candidate seed ${seedId}`);
  const owner = senseiId?.trim() || seed.sensei;
  if (!owner) {
    throw new Error(
      `a seed belongs to exactly one Sensei — choose one before admitting ${seedId}`,
    );
  }
  const sensei = getSensei(owner);
  if (!sensei) throw new Error(`unknown Sensei ${owner} — create it before admitting`);
  seed.sensei = owner;
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
  // Ownership mirrored in the composition — visible, versioned, never silent.
  if (!sensei.seeds.some((p) => p.id === seed.id)) {
    saveSensei({
      id: sensei.id,
      title: sensei.title,
      persona: sensei.persona,
      domains: sensei.domains,
      seedIds: [...sensei.seeds.map((p) => p.id), seed.id],
      selectionNotes: sensei.selection_notes,
    });
  }
  return getSeed(seedId) as GuruSeed;
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
// Senseis -- authored and governed by the user; saving a change bumps the
// version, never silently, and every version stays recoverable from
// senseis/history/. Victories are telemetry: append-only, beside the content.

function senseiContent(m: Sensei): Record<string, unknown> {
  const content: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(m)) {
    if (k !== "content_hash") content[k] = v;
  }
  return content;
}

/** Write the current record and its immutable version snapshot (write-once). */
function writeSenseiRecord(sensei: Sensei): void {
  const content = senseiContent(sensei);
  const record = { ...content, content_hash: sha256(YAML.stringify(content)) };
  writeYaml(resolve(senseisRoot(), `${sensei.id}.yaml`), record);
  const vPath = resolve(senseisRoot(), "history", sensei.id, `v${sensei.version}.yaml`);
  if (!existsSync(vPath)) {
    mkdirSync(resolve(senseisRoot(), "history", sensei.id), { recursive: true });
    writeFileSync(vPath, YAML.stringify(record), { encoding: "utf8", flag: "wx" });
  }
}

/** A historical composition, recoverable exactly as written. */
export function getSenseiVersion(senseiId: string, version: number): Sensei | null {
  const p = resolve(senseisRoot(), "history", senseiId, `v${version}.yaml`);
  return existsSync(p) ? readYaml<Sensei>(p) : null;
}

export function saveSensei(args: {
  id?: string;
  title: string;
  persona: string;
  domains: string[];
  seedIds: string[];
  selectionNotes: string[];
  owner?: string;
}): Sensei {
  const id = args.id ?? slugifyId(args.title);
  const existing = listSenseis().find((m) => m.id === id) ?? null;
  const seeds = args.seedIds
    .map((sid) => getSeed(sid))
    .filter((s): s is GuruSeed => s !== null)
    .map((s) => ({ id: s.id, version: s.version }));
  const sensei: Sensei = {
    id,
    title: args.title.trim(),
    persona: args.persona.trim(),
    domains: args.domains.map((d) => d.trim().toLowerCase()).filter((d) => d !== ""),
    version: existing ? existing.version + 1 : 1,
    owner: args.owner ?? existing?.owner ?? "helder",
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    seeds,
    selection_notes: args.selectionNotes.filter((n) => n.trim() !== ""),
  };
  writeSenseiRecord(sensei);
  return sensei;
}

// ---------------------------------------------------------------------------
// Victories (ponto C) -- "como um Pokémon que ganha a fight, evolui": when
// the Pilot picks an option a Sensei voiced, the win returns to THAT Sensei
// only. Append-only telemetry beside the content; graduation derives from it.

function victoriesPath(senseiId: string): string {
  return resolve(senseisRoot(), "telemetry", `${senseiId}.victories.jsonl`);
}

export function recordSenseiVictory(senseiId: string, victory: SenseiVictory): void {
  if (getSensei(senseiId) === null) return; // an unknown voice earns nothing
  mkdirSync(resolve(senseisRoot(), "telemetry"), { recursive: true });
  appendFileSync(victoriesPath(senseiId), JSON.stringify(victory) + "\n", "utf8");
}

export function senseiVictories(senseiId: string): SenseiVictory[] {
  return readJsonl<SenseiVictory>(victoriesPath(senseiId));
}

// ---------------------------------------------------------------------------
// The reference photo (ponto F2) -- a write-once snapshot of a balanced
// Sensei as shipped. The active record evolves with the Pilot; the photo
// never does, so the sanity of the developed brain stays measurable.

export function snapshotSenseiBase(senseiId: string): boolean {
  const sensei = getSensei(senseiId);
  if (!sensei) throw new Error(`unknown Sensei ${senseiId}`);
  const p = resolve(baseRoot(), "senseis", `${senseiId}.yaml`);
  if (existsSync(p)) return false;
  mkdirSync(resolve(baseRoot(), "senseis"), { recursive: true });
  writeFileSync(p, YAML.stringify(sensei), { encoding: "utf8", flag: "wx" });
  return true;
}

export function baseSensei(senseiId: string): Sensei | null {
  const p = resolve(baseRoot(), "senseis", `${senseiId}.yaml`);
  return existsSync(p) ? readYaml<Sensei>(p) : null;
}

/** Active-vs-photo, per Sensei — the sanity check the Pilot asked for. */
export interface SenseiSanity {
  senseiId: string;
  hasBase: boolean;
  baseVersion?: number;
  currentVersion: number;
  seedsAdded: string[];
  seedsRemoved: string[];
  victories: number;
  graduation: string;
}

export function senseiSanity(sensei: Sensei): SenseiSanity {
  const base = baseSensei(sensei.id);
  const wins = senseiVictories(sensei.id).length;
  const baseIds = new Set((base?.seeds ?? []).map((s) => s.id));
  const currentIds = new Set(sensei.seeds.map((s) => s.id));
  return {
    senseiId: sensei.id,
    hasBase: base !== null,
    ...(base ? { baseVersion: base.version } : {}),
    currentVersion: sensei.version,
    seedsAdded: [...currentIds].filter((id) => !baseIds.has(id)),
    seedsRemoved: [...baseIds].filter((id) => !currentIds.has(id)),
    victories: wins,
    graduation: senseiGraduation(wins),
  };
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
  for (const m of listSenseis()) {
    const vPath = resolve(senseisRoot(), "history", m.id, `v${m.version}.yaml`);
    if (m.content_hash === undefined || !existsSync(vPath)) {
      writeSenseiRecord(m);
      corrected += 1;
    }
  }
  return corrected;
}

// ---------------------------------------------------------------------------
// The Sensei reform migration (parecer 2026-07-12 noite): one-time,
// mechanical, idempotent. mentors/ becomes senseis/ (history preserved);
// each migrated Sensei derives its craft domains from the seeds it pins;
// each admitted seed gains its owner Sensei from the composition that pinned
// it. Content changes bump versions — never edited in place.

export function ensureSenseiLibrary(): number {
  let corrected = 0;
  // 1. Move the pre-reform tree, files and history alike.
  if (existsSync(legacyMentorsRoot()) && !existsSync(senseisRoot())) {
    renameSync(legacyMentorsRoot(), senseisRoot());
    corrected += 1;
  }
  // 2. A migrated record without domains derives them from its pinned seeds.
  for (const raw of listSenseis()) {
    if (Array.isArray(raw.domains)) continue;
    const pinned = raw.seeds
      .map((p) => getSeed(p.id))
      .filter((s): s is GuruSeed => s !== null);
    const domains = [...new Set(pinned.flatMap((s) => s.scope.domains))];
    saveSensei({
      id: raw.id,
      title: raw.title,
      persona: raw.persona,
      domains,
      seedIds: raw.seeds.map((p) => p.id),
      selectionNotes: raw.selection_notes,
      owner: raw.owner,
    });
    corrected += 1;
  }
  // 3. Every admitted seed belongs to exactly one Sensei — assign from the
  //    composition that pins it (revision: version bumps, history stays).
  for (const seed of listSeeds()) {
    if (seed.status !== "admitted" || seed.sensei) continue;
    const owner = listSenseis().find((m) => m.seeds.some((p) => p.id === seed.id));
    if (!owner) continue; // an orphan stays visible — the Pilot assigns it in the UI
    ensureSeedSidecars(seedDir(seed));
    const current = getSeed(seed.id);
    if (!current) continue;
    current.sensei = owner.id;
    current.version += 1;
    writeSeedRecord(current);
    corrected += 1;
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
  const shared = abs(workspaceRoot(), "_shared", "expertise.json");
  if (existsSync(shared)) stores.push({ path: shared, project: null });
  if (existsSync(workspaceRoot())) {
    for (const name of readdirSync(workspaceRoot())) {
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
