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
//     seeds/<domain>/<slug>/seed.yaml (+ evidence.jsonl)
//     mentors/<id>.yaml
//     candidates/<id>.yaml
//     retired/<id>.yaml
//     index/  (derived, regenerable)

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
import { abs, readJson, readText } from "./stores.js";

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
  evidence: {
    supporting: string[];
    contradicting: string[];
  };
  applicability: {
    use_when: string[];
    avoid_when: string[];
  };
  /** Automatic trail: every work order whose context this seed entered. */
  applied_in: SeedApplication[];
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
// Readers -- the library is small by design; full scans stay honest and cheap.

export function listSeeds(): GuruSeed[] {
  const out: GuruSeed[] = [];
  if (!existsSync(seedsRoot())) return out;
  for (const domain of readdirSync(seedsRoot())) {
    const dDir = resolve(seedsRoot(), domain);
    for (const slug of readdirSync(dDir)) {
      const p = resolve(dDir, slug, "seed.yaml");
      if (existsSync(p)) out.push(readYaml<GuruSeed>(p));
    }
  }
  return out;
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
  writeYaml(resolve(seedDir(seed), "seed.yaml"), seed);
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

/** The automatic application trail -- must never break a work order. */
export function recordSeedApplication(seedId: string, app: SeedApplication): void {
  const seed = getSeed(seedId);
  if (!seed) return;
  seed.applied_in.push(app);
  writeYaml(resolve(seedDir(seed), "seed.yaml"), seed);
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
 * The user's judgement returning to the asset (ADR-0020, Consequences):
 * a legible line on the seed record itself plus a full entry in the seed's
 * append-only evidence.jsonl. Only the user grades a seed -- the Kernel
 * never marks its own homework.
 */
export function recordSeedEvidence(
  seedId: string,
  args: { kind: "supporting" | "contradicting"; note: string; project?: string; workOrder?: string },
): GuruSeed {
  const seed = getSeed(seedId);
  if (!seed) throw new Error(`unknown admitted seed ${seedId}`);
  const entry: SeedEvidenceEntry = {
    ts: new Date().toISOString(),
    kind: args.kind,
    note: args.note,
    ...(args.project ? { project: args.project } : {}),
    ...(args.workOrder ? { workOrder: args.workOrder } : {}),
  };
  seed.evidence[args.kind].push(
    `${entry.ts.slice(0, 10)} ${args.note}${args.project ? ` (${args.project})` : ""}`,
  );
  writeYaml(resolve(seedDir(seed), "seed.yaml"), seed);
  appendFileSync(resolve(seedDir(seed), "evidence.jsonl"), JSON.stringify(entry) + "\n", "utf8");
  return seed;
}

// ---------------------------------------------------------------------------
// Mentors -- authored and evolved by the user (the "director" the Pilot
// builds); saving a change bumps the version, never silently.

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
  writeYaml(resolve(mentorsRoot(), `${id}.yaml`), mentor);
  return mentor;
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
        admitted.applied_in = r.appliedIn.map((a) => ({
          project: a.projectId,
          workOrder: a.workOrderId,
          ts: a.ts,
        }));
        writeYaml(seedYamlPath(admitted), admitted);
      }
      migrated += 1;
    }
    renameSync(store.path, `${store.path}.migrated`);
  }
  return migrated;
}
