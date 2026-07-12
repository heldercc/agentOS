// The Kernel of the product shell (Operating Model §2): the governor and
// organiser of work. It receives Pilot intent, convenes bounded agents,
// aggregates their Question Needs, creates Work Orders, records evidence and
// advances the project after governance. It owns authority boundaries; it
// does not own taste and never silently reinterprets the Pilot.
//
// The 13 steps of docs/PRODUCT-LOOP.md map onto the exported operations:
//   1 initProject · 2-3 runConsult (roster + consults through the runtime)
//   4-5 mergeQuestions/aggregation · 6 topOpenQuestion · 7-8 answerQuestion
//   9 runCandidate · 10 decideCandidate · 11 runExecute
//   12 artifacts auto-return inside runExecute · 13 advanceIteration

import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";

import { appendEvent, readEvents } from "./evidence.js";
import {
  clampAutoEffort,
  effortSpec,
  levelIndex,
  type EffortLevel,
} from "./effort.js";
import {
  addCandidateSeed,
  admitSeed,
  listCandidates,
  listSeeds,
  recordSeedApplication,
  recordSeedEvidence,
  rejectSeed,
  saveMentor,
  seedYamlPath,
  type GuruSeed,
  type Mentor,
} from "./hi.js";
import {
  applicableMentors,
  mentorSeeds,
  resolveSeeds,
  type ResolvedSeed,
} from "./resolver.js";
import { buildManifest, ContextBuilder, type AssembledContext } from "./manifest.js";
import {
  artifactsDir,
  projectDir,
  stateDir,
  WORKSPACE_DIR,
  workOrdersDir,
} from "./paths.js";
import { abs, readJson, readText, writeArtifactOnce, writeJson } from "./stores.js";
import type { Runtime } from "./runtime.js";
import type {
  AgentRole,
  ApprovedState,
  CandidateState,
  DecisionSurface,
  EvidenceEvent,
  MeterRecord,
  OptionRecord,
  OptionSeedRef,
  Project,
  ProjectStateDoc,
  QuestionNeed,
  QuestionsFile,
  RosterFile,
  WorkOrderKind,
  WorkOrderRecord,
} from "./types.js";

function nowIso(): string {
  return new Date().toISOString();
}

// ---------------------------------------------------------------------------
// Step 1 — Project Init from name + free-text description.

export function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return base || "project";
}

export function initProject(name: string, description: string, scripted = false): Project {
  let id = slugify(name);
  let n = 2;
  while (existsSync(projectDir(id))) {
    id = `${slugify(name)}-${n}`;
    n += 1;
  }
  const project: Project = {
    id,
    name: name.trim(),
    description: description.trim(),
    createdAt: nowIso(),
    iteration: 1,
  };
  writeJson(abs(projectDir(id), "project.json"), project);
  event(project, "pilot", "project_init", scripted, {});
  return project;
}

export function listProjects(): Project[] {
  if (!existsSync(WORKSPACE_DIR)) return [];
  const out: Project[] = [];
  for (const name of readdirSync(WORKSPACE_DIR).sort()) {
    const p = abs(WORKSPACE_DIR, name, "project.json");
    if (statSync(abs(WORKSPACE_DIR, name)).isDirectory() && existsSync(p)) {
      out.push(readJson<Project>(p));
    }
  }
  return out;
}

export function getProject(projectId: string): Project {
  return readJson<Project>(abs(projectDir(projectId), "project.json"));
}

// ---------------------------------------------------------------------------
// Readers — the shell UI and the smoke test observe the loop through these.

export function readRoster(projectId: string): RosterFile | null {
  const p = abs(projectDir(projectId), "roster.json");
  return existsSync(p) ? readJson<RosterFile>(p) : null;
}

export function readQuestions(projectId: string): QuestionNeed[] {
  const p = abs(projectDir(projectId), "questions.json");
  return existsSync(p) ? readJson<QuestionsFile>(p).questions : [];
}

function writeQuestions(projectId: string, questions: QuestionNeed[]): void {
  writeJson(abs(projectDir(projectId), "questions.json"), { questions });
}

/** Open needs ranked by demand (Operating Model §4), then by age. */
export function openQuestions(projectId: string): QuestionNeed[] {
  return readQuestions(projectId)
    .filter((q) => q.status === "open")
    .sort((a, b) => b.askedBy.length - a.askedBy.length || a.iteration - b.iteration);
}

/** Step 6 — the one governed question on the table. */
export function topOpenQuestion(projectId: string): QuestionNeed | null {
  return openQuestions(projectId)[0] ?? null;
}

export function readCandidate(projectId: string): CandidateState | null {
  const p = abs(stateDir(projectId), "candidate.json");
  return existsSync(p) ? readJson<CandidateState>(p) : null;
}

export function readApproved(projectId: string): ApprovedState | null {
  const p = abs(stateDir(projectId), "approved.json");
  return existsSync(p) ? readJson<ApprovedState>(p) : null;
}

/**
 * The artifact's own declaration of what shaped it (gap audit, critical row;
 * TERMINOLOGY: "every Artifact carries provenance by reference"): a sidecar
 * next to the artifact file, so the artifact text stays byte-faithful to the
 * runtime's output while the human intelligence behind it stays provable.
 */
export interface ArtifactProvenance {
  workOrderId: string;
  agentId: string;
  iteration: number;
  effortLevel: string;
  model: string;
  seeds: {
    id: string;
    version: number;
    title: string;
    reason: string;
    mentorId?: string;
    mentorTitle?: string;
  }[];
}

export interface ArtifactInfo {
  iteration: number;
  agentId: string;
  path: string;
  chars: number;
  workOrderId?: string;
  /** The human intelligence that shaped this artifact (provenance by reference). */
  seeds?: ArtifactProvenance["seeds"];
}

export function listArtifacts(projectId: string): ArtifactInfo[] {
  const root = abs(projectDir(projectId), "artifacts");
  if (!existsSync(root)) return [];
  const out: ArtifactInfo[] = [];
  for (const itName of readdirSync(root).sort()) {
    const m = /^it-(\d+)$/.exec(itName);
    if (!m) continue;
    const itDir = abs(root, itName);
    for (const f of readdirSync(itDir).sort()) {
      if (!f.endsWith(".md")) continue;
      const info: ArtifactInfo = {
        iteration: Number(m[1]),
        agentId: f.replace(/\.md$/, ""),
        path: abs(itDir, f),
        chars: readText(abs(itDir, f)).length,
      };
      const provPath = abs(itDir, f.replace(/\.md$/, ".provenance.json"));
      if (existsSync(provPath)) {
        const prov = readJson<ArtifactProvenance>(provPath);
        info.workOrderId = prov.workOrderId;
        info.seeds = prov.seeds;
      }
      out.push(info);
    }
  }
  return out;
}

export function readWorkOrders(projectId: string, iteration: number): WorkOrderRecord[] {
  const dir = workOrdersDir(projectId, iteration);
  if (!existsSync(dir)) return [];
  const out: WorkOrderRecord[] = [];
  for (const wo of readdirSync(dir).sort()) {
    const p = abs(dir, wo, "workorder.json");
    if (existsSync(p)) out.push(readJson<WorkOrderRecord>(p));
  }
  return out;
}

export type Stage =
  | "consult"
  | "interview"
  | "decide"
  | "candidate"
  | "approve"
  | "execute"
  | "advance";

/** Where the loop stands — drives the shell's single primary action. */
export function stageOf(projectId: string): Stage {
  const project = getProject(projectId);
  const candidate = readCandidate(projectId);
  if (candidate && candidate.iteration === project.iteration) {
    if (candidate.status === "candidate") return "approve";
    if (candidate.status === "approved") {
      const done = listArtifacts(projectId).some((a) => a.iteration === project.iteration);
      return done ? "advance" : "execute";
    }
    // rejected — rebuild with the Pilot's note in context
    return "candidate";
  }
  const consults = readWorkOrders(projectId, project.iteration).filter(
    (w) => (w.kind === "consult" || w.kind === "reconsult") && w.status === "done",
  );
  if (readRoster(projectId) === null || consults.length === 0) return "consult";
  if (openQuestions(projectId).length > 0) return "interview";
  // An open Decision Surface outranks the candidate build: the selection is
  // authoritative direction the next candidate must fold.
  if (openSurface(projectId) !== null) return "decide";
  return "candidate";
}

// ---------------------------------------------------------------------------
// Evidence helper.

function event(
  project: Project,
  actor: EvidenceEvent["actor"],
  action: EvidenceEvent["action"],
  scripted: boolean,
  extra: Partial<EvidenceEvent>,
): void {
  appendEvent({
    ts: nowIso(),
    projectId: project.id,
    iteration: project.iteration,
    actor,
    action,
    scripted,
    ...extra,
  });
}

export function addPilotNote(projectId: string, note: string, scripted = false): void {
  const project = getProject(projectId);
  event(project, "pilot", "pilot_note", scripted, { note });
}

function pilotNotes(projectId: string): string[] {
  return readEvents(projectId)
    .filter((e) => e.action === "pilot_note" && e.note)
    .map((e) => e.note as string);
}

// ---------------------------------------------------------------------------
// Structured-output parsing — fenced JSON, with a bullet-list fallback for
// questions so a chatty worker still lands.

function extractJsonBlocks(text: string): unknown[] {
  const out: unknown[] = [];
  const re = /```json\s*([\s\S]*?)```/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    try {
      out.push(JSON.parse(m[1] ?? ""));
    } catch {
      // a malformed block is simply not a signal
    }
  }
  return out;
}

const MAX_QUESTIONS_PER_AGENT = 3;

export function questionsFrom(text: string): string[] {
  for (const block of extractJsonBlocks(text).reverse()) {
    if (
      typeof block === "object" &&
      block !== null &&
      Array.isArray((block as { questions?: unknown }).questions)
    ) {
      return ((block as { questions: unknown[] }).questions ?? [])
        .filter((q): q is string => typeof q === "string" && q.trim() !== "")
        .slice(0, MAX_QUESTIONS_PER_AGENT);
    }
  }
  // Fallback: a "Perguntas ao Pilot" / "Questions" section with bullets.
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((l) => /perguntas ao pilot|^#+\s*questions/i.test(l));
  if (start < 0) return [];
  const out: string[] = [];
  for (let i = start + 1; i < lines.length && out.length < MAX_QUESTIONS_PER_AGENT; i++) {
    const m = /^\s*(?:\d+[.)]|[-*•])\s*(.+)$/.exec(lines[i] ?? "");
    if (m?.[1]) out.push(m[1].trim());
    else if (out.length > 0 && (lines[i] ?? "").trim() !== "") break;
  }
  return out;
}

function rosterFrom(text: string): AgentRole[] | null {
  for (const block of extractJsonBlocks(text).reverse()) {
    const agents = (block as { agents?: unknown }).agents;
    if (!Array.isArray(agents)) continue;
    const roles: AgentRole[] = [];
    for (const a of agents) {
      const r = a as Partial<AgentRole>;
      if (
        typeof r.id === "string" &&
        typeof r.title === "string" &&
        typeof r.mandate === "string"
      ) {
        roles.push({
          id: slugify(r.id),
          title: r.title,
          mandate: r.mandate,
          tags: Array.isArray(r.tags) ? r.tags.filter((t) => typeof t === "string") : [],
        });
      }
    }
    if (roles.length >= 2) return roles.slice(0, 5);
  }
  return null;
}

function stateFrom(text: string): ProjectStateDoc | null {
  const str = (v: unknown): string => (typeof v === "string" ? v : "");
  const arr = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  for (const block of extractJsonBlocks(text).reverse()) {
    const b = block as Partial<Record<keyof ProjectStateDoc, unknown>>;
    if (typeof b !== "object" || b === null) continue;
    if (typeof b.objective !== "string" || typeof b.nextAction !== "string") continue;
    return {
      objective: b.objective,
      phase: str(b.phase) || "shaping",
      approvedDecisions: arr(b.approvedDecisions),
      activeArtifacts: arr(b.activeArtifacts),
      unresolvedQuestions: arr(b.unresolvedQuestions),
      constraints: arr(b.constraints),
      nextAction: b.nextAction,
    };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Work Orders — one bounded runtime call, fully audited: prompt, manifest,
// meter, response, record. Retries come from the effort spec.

async function runWorkOrder(args: {
  project: Project;
  kind: WorkOrderKind;
  agentId: string | null;
  system: string;
  ctx: AssembledContext;
  level: EffortLevel;
  runtime: Runtime;
}): Promise<{ record: WorkOrderRecord; text: string; meter: MeterRecord; retriesUsed: number }> {
  const spec = effortSpec(args.level);
  const iteration = args.project.iteration;
  const wosDir = workOrdersDir(args.project.id, iteration);
  mkdirSync(wosDir, { recursive: true });
  const seq = readdirSync(wosDir).length + 1;
  const woId = `${String(seq).padStart(2, "0")}-${args.kind}${args.agentId ? `-${args.agentId}` : ""}`;
  const dir = abs(wosDir, woId);
  mkdirSync(dir, { recursive: true });

  writeJson(abs(dir, "manifest.json"), buildManifest(woId, args.ctx));
  writeFileSync(
    abs(dir, "prompt.md"),
    `# system\n\n${args.system}\n\n# context\n\n${args.ctx.text}`,
    "utf8",
  );

  // The application trail (ADR-0020): every GuruSeed that entered this
  // context is recorded on the asset itself, automatically.
  for (const el of args.ctx.elements) {
    if (el.kind !== "expertise") continue;
    recordSeedApplication(el.ref.id, {
      project: args.project.id,
      workOrder: woId,
      ts: nowIso(),
    });
  }

  const base: Omit<WorkOrderRecord, "status"> = {
    id: woId,
    projectId: args.project.id,
    iteration,
    kind: args.kind,
    agentId: args.agentId,
    model: spec.workerModel,
    effortLevel: args.level,
    createdAt: nowIso(),
  };

  let lastError = "";
  for (let attempt = 0; attempt <= spec.retryBudget; attempt++) {
    const t0 = Date.now();
    try {
      const res = await args.runtime.generate({
        system: args.system,
        prompt: args.ctx.text,
        model: spec.workerModel,
        maxTokens: spec.maxTokens,
        timeoutMs: spec.timeoutMs,
        jobId: `${args.project.id}-it${iteration}-${woId}`,
        kind: args.kind,
      });
      const meter: MeterRecord = {
        workOrderId: woId,
        model: `${args.runtime.name}:${spec.workerModel}`,
        requestId: res.usage.requestId,
        inputTokens: res.usage.inputTokens,
        outputTokens: res.usage.outputTokens,
        cacheCreationInputTokens: res.usage.cacheCreationInputTokens,
        cacheReadInputTokens: res.usage.cacheReadInputTokens,
        timestamp: nowIso(),
        durationMs: Date.now() - t0,
        estimated: res.usage.estimated ?? false,
      };
      writeJson(abs(dir, "meter.json"), meter);
      writeFileSync(abs(dir, "response.md"), res.text, "utf8");
      const record: WorkOrderRecord = { ...base, status: "done" };
      writeJson(abs(dir, "workorder.json"), record);
      return { record, text: res.text, meter, retriesUsed: attempt };
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
    }
  }
  const record: WorkOrderRecord = { ...base, status: "error", error: lastError };
  writeJson(abs(dir, "workorder.json"), record);
  throw new Error(`work order ${woId} failed: ${lastError}`);
}

// ---------------------------------------------------------------------------
// Context assembly per work-order kind. Required pieces always enter;
// optional pieces respect the effort level's budget (§7).

function baseContext(project: Project, budget: number): ContextBuilder {
  const b = new ContextBuilder(budget);
  const pPath = abs(projectDir(project.id), "project.json");
  b.add({
    kind: "project",
    id: project.id,
    absPath: pPath,
    content:
      `Name: ${project.name}\nIteration: ${project.iteration}\n\n` +
      `The user's founding intent, verbatim:\n\n${project.description}`,
    reason: "the project is the subject of every work order",
    required: true,
  });
  return b;
}

function addApprovedState(b: ContextBuilder, project: Project, required: boolean): void {
  const approved = readApproved(project.id);
  if (!approved) return;
  b.add({
    kind: "approved-state",
    id: `approved-it${approved.iteration}`,
    absPath: abs(stateDir(project.id), "approved.json"),
    content: JSON.stringify(approved.state, null, 2),
    reason: "the approved Project State is the smallest sufficient account of the project",
    required,
  });
}

function addAnswers(b: ContextBuilder, project: Project, required: boolean): void {
  const answered = readQuestions(project.id).filter((q) => q.status === "answered");
  for (const q of [...answered].reverse()) {
    b.add({
      kind: "answer",
      id: q.id,
      absPath: abs(projectDir(project.id), "questions.json"),
      content: `Q: ${q.text}\nA (from the user): ${q.answer ?? ""}`,
      reason: `the user answered this need (asked by ${q.askedBy.join(", ")})`,
      required,
    });
  }
}

function addPilotNotes(b: ContextBuilder, project: Project): void {
  const notes = pilotNotes(project.id);
  for (const [i, note] of [...notes].reverse().entries()) {
    b.add({
      kind: "pilot-note",
      id: `note-${notes.length - i}`,
      absPath: abs(projectDir(project.id), "evidence.jsonl"),
      content: note,
      reason: "the user's own direction outranks derived context",
      required: false,
    });
  }
}

/**
 * A runtime agent is a composition (FOUNDATION-CORRECTION, ADR-0020 §2):
 * mandate + relevant project context + applicable human intelligence +
 * effort budget. The Seed Resolver selects the admitted GuruSeeds — they
 * enter BEFORE other optional elements, because under a tight budget the
 * owner's judgement outranks derived history. Each entry carries the
 * Resolver's reason (and Mentor attribution) into the manifest.
 */
function addExpertise(
  b: ContextBuilder,
  project: Project,
  agentTags: string[],
): ResolvedSeed[] {
  const resolved = resolveSeeds({ projectId: project.id, agentTags });
  for (const r of resolved) {
    b.add({
      kind: "expertise",
      id: r.seed.id,
      absPath: seedYamlPath(r.seed),
      content:
        `${r.seed.title} (GuruSeed v${r.seed.version}` +
        `${r.mentorTitle ? `, Mentor: ${r.mentorTitle}` : ""})\n\n` +
        `Rule: ${r.seed.rule}\nWhy: ${r.seed.why}`,
      reason: r.reason,
      required: false,
    });
  }
  return resolved;
}

function addRole(b: ContextBuilder, project: Project, agent: AgentRole): void {
  b.add({
    kind: "agent-role",
    id: agent.id,
    absPath: abs(projectDir(project.id), "roster.json"),
    content:
      `agent-id: ${agent.id}\nTitle: ${agent.title}\nMandate: ${agent.mandate}\n` +
      `Tags: ${agent.tags.join(", ")}`,
    reason: "the bounded mandate this work order runs under",
    required: true,
  });
}

// ---------------------------------------------------------------------------
// System prompts — engine-generic (ADR-0008): no project-domain vocabulary.

const LANG_RULE =
  "Respond in the language of the user's founding intent (the project description).";

const CONVENER_SYSTEM =
  "You are the Kernel's convener inside AgentOS, a governed operating layer " +
  "for turning human intent into iterative work. From the project context, " +
  "propose the smallest sufficient team of bounded specialist agents " +
  "(3 to 5) for this specific project. Each agent gets: id (kebab-case), " +
  "title, mandate (one sentence of bounded responsibility — what it may " +
  "reason about, not more), tags (2-4 keywords). Do not invent work; do not " +
  "pre-answer the project. End with exactly one fenced ```json block: " +
  '{"agents": [{"id", "title", "mandate", "tags"}, ...]}. ' +
  LANG_RULE;

function consultSystem(reconsult: boolean): string {
  return (
    "You are one bounded specialist agent inside AgentOS. You never address " +
    "the user directly — the Kernel mediates everything. Stay strictly inside " +
    "your mandate: inspect the context, state briefly what you understand and " +
    "what you would do next within your mandate, and identify what is missing. " +
    (reconsult
      ? "The user has just answered a question you raised — read the answer, " +
        "update your read, and only ask again if something material is STILL missing. "
      : "") +
    "You may ask at most 3 short questions, and only questions whose answers " +
    "materially improve the next decision or execution — do not interview for " +
    "completeness. Do not decide project direction. Do not produce the final " +
    "work yet. End with exactly one fenced ```json block: " +
    '{"questions": ["...", ...]} (an empty array if nothing material is missing). ' +
    LANG_RULE
  );
}

const SYNTHESIZE_SYSTEM =
  "You are the Kernel of AgentOS building a candidate Project State: the " +
  "smallest sufficient account of the project now — NOT a plan, NOT the work " +
  "itself, NOT the full history. Fold the founding intent, the user's answers " +
  "and the agents' reads into it. Do not invent decisions the user never " +
  "made; unresolved things stay unresolved. End with exactly one fenced " +
  "```json block: {\"objective\", \"phase\", \"approvedDecisions\": [], " +
  '"activeArtifacts": [], "unresolvedQuestions": [], "constraints": [], ' +
  '"nextAction"} — nextAction is the single next meaningful action. ' +
  LANG_RULE;

const EXECUTE_SYSTEM =
  "You are one bounded specialist agent inside AgentOS, executing under an " +
  "approved Project State. Produce the concrete artifact your mandate owes " +
  "toward the state's nextAction — the work itself, not a plan for it, not " +
  "questions about it. Respond with ONLY the artifact content in markdown. " +
  LANG_RULE;

// ---------------------------------------------------------------------------
// Question Needs — collect (4), aggregate & dedupe (5), persist answer (7).

function normalizeQuestion(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function mergeQuestions(
  projectId: string,
  agentId: string,
  texts: string[],
  iteration: number,
): void {
  const questions = readQuestions(projectId);
  let maxId = questions.reduce((n, q) => {
    const m = /^q-(\d+)$/.exec(q.id);
    return m ? Math.max(n, Number(m[1])) : n;
  }, 0);
  for (const text of texts) {
    const key = normalizeQuestion(text);
    if (key === "") continue;
    const hit = questions.find((q) => normalizeQuestion(q.text) === key);
    if (hit) {
      // An answered need never reopens; an open one gains a voice.
      if (hit.status === "open" && !hit.askedBy.includes(agentId)) {
        hit.askedBy.push(agentId);
      }
      continue;
    }
    maxId += 1;
    questions.push({
      id: `q-${maxId}`,
      text: text.trim(),
      askedBy: [agentId],
      iteration,
      status: "open",
    });
  }
  writeQuestions(projectId, questions);
}

// ---------------------------------------------------------------------------
// Steps 2–5 — convene the roster (once) and consult every agent through the
// runtime; their Question Needs aggregate into the single visible interview.

export async function runConsult(args: {
  projectId: string;
  level: EffortLevel;
  runtime: Runtime;
  scripted?: boolean;
}): Promise<{ consulted: string[]; newQuestions: number }> {
  const scripted = args.scripted ?? false;
  const project = getProject(args.projectId);
  const spec = effortSpec(args.level);

  let roster = readRoster(project.id);
  if (!roster) {
    const b = baseContext(project, spec.contextBudgetChars);
    addPilotNotes(b, project);
    const ctx = b.build();
    const { record, text } = await runWorkOrder({
      project,
      kind: "roster",
      agentId: null,
      system: CONVENER_SYSTEM,
      ctx,
      level: args.level,
      runtime: args.runtime,
    });
    const agents = rosterFrom(text);
    if (!agents) {
      throw new Error(
        `roster work order ${record.id} returned no parseable {"agents": [...]} block`,
      );
    }
    roster = { agents, workOrderId: record.id };
    writeJson(abs(projectDir(project.id), "roster.json"), roster);
    event(project, "kernel", "roster_ready", scripted, {
      workOrderId: record.id,
      note: agents.map((a) => a.id).join(", "),
    });
  }

  const before = readQuestions(project.id).length;
  const table = roster.agents.slice(0, spec.maxAgents);
  const consulted: string[] = [];
  for (const agent of table) {
    const b = baseContext(project, spec.contextBudgetChars);
    addRole(b, project, agent);
    addApprovedState(b, project, true);
    addExpertise(b, project, agent.tags);
    addAnswers(b, project, false);
    addPilotNotes(b, project);
    const ctx = b.build();
    const { record, text } = await runWorkOrder({
      project,
      kind: "consult",
      agentId: agent.id,
      system: consultSystem(false),
      ctx,
      level: args.level,
      runtime: args.runtime,
    });
    mergeQuestions(project.id, agent.id, questionsFrom(text), project.iteration);
    consulted.push(agent.id);
    event(project, "kernel", "consulted", scripted, {
      workOrderId: record.id,
      agentId: agent.id,
    });
  }
  return { consulted, newQuestions: readQuestions(project.id).length - before };
}

// ---------------------------------------------------------------------------
// Steps 7–8 — persist the user's answer, then automatically re-consult the
// agents that raised the need. Movement, not authority: effort is clamped.

export async function answerQuestion(args: {
  projectId: string;
  questionId: string;
  answer: string;
  runtime: Runtime;
  scripted?: boolean;
}): Promise<{ reconsulted: string[] }> {
  const scripted = args.scripted ?? false;
  const project = getProject(args.projectId);
  const questions = readQuestions(project.id);
  const q = questions.find((x) => x.id === args.questionId);
  if (!q) throw new Error(`unknown question ${args.questionId}`);
  if (q.status === "answered") throw new Error(`question ${q.id} is already answered`);

  q.status = "answered";
  q.answer = args.answer.trim();
  q.answeredAt = nowIso();
  writeQuestions(project.id, questions);
  event(project, "pilot", "question_answered", scripted, { questionId: q.id });

  // Automatic re-consult of the agents whose need this was (§8) — cheap by
  // design: internal movement runs below the authority line.
  const level = clampAutoEffort("low");
  const spec = effortSpec(level);
  const roster = readRoster(project.id);
  const reconsulted: string[] = [];
  for (const agentId of q.askedBy) {
    const agent = roster?.agents.find((a) => a.id === agentId);
    if (!agent) continue;
    const b = baseContext(project, spec.contextBudgetChars);
    addRole(b, project, agent);
    b.add({
      kind: "answer",
      id: q.id,
      absPath: abs(projectDir(project.id), "questions.json"),
      content: `Q (yours): ${q.text}\nA (from the user): ${q.answer}`,
      reason: "the answered need that triggered this re-consultation",
      required: true,
    });
    addApprovedState(b, project, false);
    addExpertise(b, project, agent.tags);
    addAnswers(b, project, false);
    const ctx = b.build();
    const { record, text } = await runWorkOrder({
      project,
      kind: "reconsult",
      agentId: agent.id,
      system: consultSystem(true),
      ctx,
      level,
      runtime: args.runtime,
    });
    mergeQuestions(project.id, agent.id, questionsFrom(text), project.iteration);
    reconsulted.push(agent.id);
    event(project, "kernel", "reconsulted", scripted, {
      workOrderId: record.id,
      agentId: agent.id,
      questionId: q.id,
    });
  }
  return { reconsulted };
}

/**
 * ADR-0020 §3 — the Pilot may declare context sufficient at any time; it is
 * a first-class governance act, not a shortcut. Every open question is
 * DEFERRED — kept on file, never silently dropped — and the loop moves on;
 * the candidate build carries the deferred needs as explicit unresolved
 * matter the user can inspect and overturn.
 */
export function declareContextSufficient(
  projectId: string,
  note?: string,
  scripted = false,
): number {
  const project = getProject(projectId);
  const questions = readQuestions(project.id);
  let deferred = 0;
  for (const q of questions) {
    if (q.status !== "open") continue;
    q.status = "deferred";
    deferred += 1;
  }
  writeQuestions(project.id, questions);
  event(project, "pilot", "context_sufficient", scripted, {
    note:
      (note?.trim() ? `${note.trim()} — ` : "") +
      `${deferred} pergunta(s) adiada(s) pela minha mão`,
  });
  return deferred;
}

// ---------------------------------------------------------------------------
// Step 9 — build the candidate Project State.

export async function runCandidate(args: {
  projectId: string;
  level: EffortLevel;
  runtime: Runtime;
  scripted?: boolean;
}): Promise<CandidateState> {
  const scripted = args.scripted ?? false;
  const project = getProject(args.projectId);
  const spec = effortSpec(args.level);
  const roster = readRoster(project.id);
  if (!roster) throw new Error("no roster yet — consult first");

  const b = baseContext(project, spec.contextBudgetChars);
  b.add({
    kind: "roster",
    id: "roster",
    absPath: abs(projectDir(project.id), "roster.json"),
    content: roster.agents.map((a) => `- ${a.id} (${a.title}): ${a.mandate}`).join("\n"),
    reason: "who deliberated — the candidate folds their reads",
    required: true,
  });
  addApprovedState(b, project, true);
  addExpertise(b, project, []);
  addAnswers(b, project, true);
  // ADR-0020 §3: deferred needs stay visible — the candidate must record
  // them as unresolved, never assume answers the user chose not to give.
  const deferredQs = readQuestions(project.id).filter((q) => q.status === "deferred");
  if (deferredQs.length > 0) {
    b.add({
      kind: "pilot-note",
      id: "context-sufficient",
      absPath: abs(projectDir(project.id), "questions.json"),
      content:
        "The user declared the context sufficient. These questions remain " +
        "deliberately unanswered — list them as unresolved; assume nothing:\n" +
        deferredQs.map((q) => `- ${q.text}`).join("\n"),
      reason: "ADR-0020 §3 — deferred questions stay visible, never silently dropped",
      required: true,
    });
  }
  // Decided Decision Surfaces are authoritative direction (steps 9-10 of the
  // interaction-model slice): the candidate folds every selection, with its
  // refinement lineage visible.
  for (const ds of readSurfaces(project.id).filter((d) => d.status === "decided")) {
    const sel = ds.options.find(
      (o) => o.id === ds.selected?.optionId && o.version === ds.selected?.version,
    );
    if (!sel) continue;
    b.add({
      kind: "pilot-note",
      id: ds.id,
      absPath: abs(projectDir(project.id), "decisions", `${ds.id}.json`),
      content:
        `Governed decision (${ds.id}): ${ds.decision}\n` +
        `The user selected: ${sel.title} — ${sel.direction}\n${sel.description}` +
        (sel.refinement ? `\nWith the user's refinement: ${sel.refinement}` : ""),
      reason: "a decided Decision Surface is authoritative direction",
      required: true,
    });
  }
  const prev = readCandidate(project.id);
  if (prev?.status === "rejected" && prev.rejectionNote) {
    b.add({
      kind: "pilot-note",
      id: "rejection-note",
      absPath: abs(stateDir(project.id), "candidate.json"),
      content: `The user rejected the previous candidate state with this direction:\n${prev.rejectionNote}`,
      reason: "the user's rejection is the strongest signal the rebuild has",
      required: true,
    });
  }
  // The agents' latest reads, newest first, under the optional budget.
  const wos = readWorkOrders(project.id, project.iteration)
    .filter((w) => (w.kind === "consult" || w.kind === "reconsult") && w.status === "done")
    .reverse();
  const seen = new Set<string>();
  for (const w of wos) {
    if (!w.agentId || seen.has(w.agentId)) continue;
    seen.add(w.agentId);
    const respPath = abs(workOrdersDir(project.id, project.iteration), w.id, "response.md");
    if (!existsSync(respPath)) continue;
    b.add({
      kind: "prior-response",
      id: `${w.id}-response`,
      absPath: respPath,
      content: readText(respPath),
      reason: `the latest read from agent ${w.agentId} this iteration`,
      required: false,
    });
  }
  addPilotNotes(b, project);

  const ctx = b.build();
  const { record, text } = await runWorkOrder({
    project,
    kind: "synthesize",
    agentId: null,
    system: SYNTHESIZE_SYSTEM,
    ctx,
    level: args.level,
    runtime: args.runtime,
  });
  const state = stateFrom(text);
  if (!state) {
    throw new Error(`synthesize work order ${record.id} returned no parseable state block`);
  }
  const candidate: CandidateState = {
    iteration: project.iteration,
    builtAt: nowIso(),
    workOrderId: record.id,
    state,
    status: "candidate",
  };
  writeJson(abs(stateDir(project.id), "candidate.json"), candidate);
  event(project, "kernel", "candidate_built", scripted, { workOrderId: record.id });
  return candidate;
}

// ---------------------------------------------------------------------------
// Step 10 — the Pilot approves (or rejects, with direction).

export function decideCandidate(
  projectId: string,
  decision: "approve" | "reject",
  note?: string,
  scripted = false,
): void {
  const project = getProject(projectId);
  const candidate = readCandidate(projectId);
  if (!candidate || candidate.status !== "candidate") {
    throw new Error("no candidate state awaiting a decision");
  }
  candidate.decidedAt = nowIso();
  if (decision === "approve") {
    candidate.status = "approved";
    const approved: ApprovedState = {
      iteration: candidate.iteration,
      approvedAt: candidate.decidedAt,
      state: candidate.state,
    };
    writeJson(abs(stateDir(projectId), "approved.json"), approved);
    writeJson(
      abs(stateDir(projectId), "history", `approved-it${candidate.iteration}.json`),
      approved,
    );
    event(project, "pilot", "state_approved", scripted, {});
  } else {
    candidate.status = "rejected";
    if (note) candidate.rejectionNote = note;
    event(project, "pilot", "state_rejected", scripted, note ? { note } : {});
  }
  writeJson(abs(stateDir(projectId), "candidate.json"), candidate);
}

// ---------------------------------------------------------------------------
// Steps 11–12 — governed execution at the Pilot's chosen effort; artifacts
// return automatically into the project workspace.

export async function runExecute(args: {
  projectId: string;
  level: EffortLevel;
  runtime: Runtime;
  scripted?: boolean;
}): Promise<{ artifacts: string[]; meters: MeterRecord[]; retriesUsed: number }> {
  const scripted = args.scripted ?? false;
  const project = getProject(args.projectId);
  const spec = effortSpec(args.level);
  const approved = readApproved(project.id);
  if (!approved) throw new Error("no approved Project State — approval precedes execution");
  const roster = readRoster(project.id);
  if (!roster) throw new Error("no roster — consult precedes execution");

  event(project, "pilot", "execution_started", scripted, { effortLevel: args.level });

  const table = roster.agents.slice(0, spec.maxAgents);
  const artifacts: string[] = [];
  const meters: MeterRecord[] = [];
  let retriesUsed = 0;
  for (const agent of table) {
    const b = baseContext(project, spec.contextBudgetChars);
    addRole(b, project, agent);
    addApprovedState(b, project, true);
    const applied = addExpertise(b, project, agent.tags);
    addAnswers(b, project, false);
    for (const a of listArtifacts(project.id).reverse()) {
      b.add({
        kind: "artifact",
        id: `it${a.iteration}-${a.agentId}`,
        absPath: a.path,
        content: readText(a.path),
        reason: "a prior returned artifact — execution builds on what exists",
        required: false,
      });
    }
    addPilotNotes(b, project);
    const ctx = b.build();
    const { record, text, meter, retriesUsed: r } = await runWorkOrder({
      project,
      kind: "execute",
      agentId: agent.id,
      system: EXECUTE_SYSTEM,
      ctx,
      level: args.level,
      runtime: args.runtime,
    });
    retriesUsed += r;
    meters.push(meter);
    const artifactPath = abs(artifactsDir(project.id, project.iteration), `${agent.id}.md`);
    writeArtifactOnce(artifactPath, text);
    artifacts.push(artifactPath);
    // Provenance by reference, on the artifact itself (gap audit): which
    // human judgement shaped this output, at which version, and why it was
    // selected — the artifact text stays byte-faithful, the sidecar declares.
    const provenance: ArtifactProvenance = {
      workOrderId: record.id,
      agentId: agent.id,
      iteration: project.iteration,
      effortLevel: record.effortLevel,
      model: record.model,
      seeds: applied.map((r) => ({
        id: r.seed.id,
        version: r.seed.version,
        title: r.seed.title,
        reason: r.reason,
        ...(r.mentorId ? { mentorId: r.mentorId, mentorTitle: r.mentorTitle } : {}),
      })),
    };
    writeJson(
      abs(artifactsDir(project.id, project.iteration), `${agent.id}.provenance.json`),
      provenance,
    );
    event(project, "kernel", "artifact_returned", scripted, {
      workOrderId: record.id,
      agentId: agent.id,
    });
  }
  return { artifacts, meters, retriesUsed };
}

// ---------------------------------------------------------------------------
// Step 13 — advance the iteration; the loop repeats with the approved state
// in every future context.

export function advanceIteration(projectId: string, scripted = false): Project {
  const project = getProject(projectId);
  const advanced: Project = { ...project, iteration: project.iteration + 1 };
  writeJson(abs(projectDir(projectId), "project.json"), advanced);
  event(advanced, "pilot", "iteration_advanced", scripted, {
    note: `it-${project.iteration} -> it-${advanced.iteration}`,
  });
  return advanced;
}

// ---------------------------------------------------------------------------
// Human Intelligence governance (ADR-0020): store transitions live in hi.ts;
// these wrappers add what governance requires — the evidence event, pilot
// actor, always. The Kernel schedules seeds; only the user admits them.

export function addCandidateSeedGoverned(
  projectId: string,
  args: {
    title: string;
    rule: string;
    why: string;
    domains: string[];
    projectLocal: boolean;
    provenanceNote: string;
  },
  scripted = false,
): GuruSeed {
  const project = getProject(projectId);
  const seed = addCandidateSeed({
    title: args.title,
    rule: args.rule,
    why: args.why,
    domains: args.domains,
    projects: args.projectLocal ? [projectId] : [],
    origin: "taught",
    provenanceNote: args.provenanceNote,
    sourceProject: projectId,
  });
  event(project, "pilot", "seed_candidate_added", scripted, {
    seedId: seed.id,
    note: seed.title,
  });
  return seed;
}

export function decideSeedGoverned(
  projectId: string,
  seedId: string,
  decision: "admit" | "reject",
  editedRule?: string,
  scripted = false,
): void {
  const project = getProject(projectId);
  if (decision === "admit") {
    const seed = admitSeed(seedId, editedRule);
    event(project, "pilot", "seed_admitted", scripted, { seedId, note: seed.title });
  } else {
    rejectSeed(seedId);
    event(project, "pilot", "seed_rejected", scripted, { seedId });
  }
}

export function saveMentorGoverned(
  projectId: string,
  args: {
    id?: string;
    title: string;
    persona: string;
    seedIds: string[];
    selectionNotes: string[];
  },
  scripted = false,
): Mentor {
  const project = getProject(projectId);
  const mentor = saveMentor(args);
  event(project, "pilot", "mentor_saved", scripted, {
    note: `${mentor.title} (v${mentor.version}, ${mentor.seeds.length} seeds)`,
  });
  return mentor;
}

/**
 * The user's verdict on a seed in use, returning to the asset (ADR-0020,
 * Consequences: "the Pilot evaluates → evidence returns to the seed").
 * Explicit governance only — nothing is ever inferred from silence.
 */
export function recordSeedEvidenceGoverned(
  projectId: string,
  seedId: string,
  kind: "supporting" | "contradicting",
  note: string,
  scripted = false,
): GuruSeed {
  const project = getProject(projectId);
  const seed = recordSeedEvidence(seedId, { kind, note, project: projectId });
  event(project, "pilot", "seed_evidence", scripted, {
    seedId,
    note: `${kind === "supporting" ? "reforçou" : "contradisse"}: ${note}`,
  });
  return seed;
}

// ---------------------------------------------------------------------------
// The Decision Surface (GOVERNANCE-INTERACTION-MODEL, ADR-0020 §5): the
// Kernel chews the problem — resolves expertise, convenes distinct voices,
// compares consequences — and surfaces one consequential choice with
// genuinely distinct options, a recommendation, and refinement capability.
// Options are versioned; originals are never overwritten; the whole lineage
// is evidence.

const OPTION_LETTERS = ["a", "b", "c", "d"] as const;

const GENERIC_ANGLES: { id: string; hint: string }[] = [
  { id: "economico", hint: "the most economical honest path — smallest effort that truly serves the intent" },
  { id: "arrojado", hint: "the boldest, most distinctive path — what makes this unmistakably itself" },
  { id: "seguro", hint: "the safest, most reversible path — minimal risk, easy to change later" },
  { id: "sensorial", hint: "the most concrete, sensory path — what the audience directly feels" },
];

const OPTION_SYSTEM =
  "You are one temporary specialist voice inside AgentOS, producing ONE " +
  "concrete option for a governed decision. Your angle is given in context " +
  "(the line starting with 'angle:'). Commit to that angle — the user will " +
  "compare genuinely distinct alternatives, so do not hedge toward the " +
  "middle. If Mentor seeds are in context, apply them faithfully and let " +
  "them shape the option. Do not decide for the user; do not mention other " +
  "options. End with exactly one fenced ```json block: {\"title\", " +
  '"direction" (a 3-6 word slug of the underlying direction), ' +
  '"description" (the concrete option, 4-8 sentences), "benefits" (one ' +
  'sentence), "tradeoffs" (one sentence), "assumptions" (array of short ' +
  "strings)}. " +
  LANG_RULE;

const REFINE_SYSTEM =
  "You are refining ONE existing option inside AgentOS per the user's " +
  "short instruction. Change ONLY what the instruction asks; preserve " +
  "everything else — structure, direction, level of detail. The user must " +
  "recognize the option they liked. End with exactly one fenced ```json " +
  'block, same shape as the original: {"title", "direction", "description", ' +
  '"benefits", "tradeoffs", "assumptions"}. ' +
  LANG_RULE;

const RECOMMEND_SYSTEM =
  "You are the Kernel of AgentOS comparing the options on one Decision " +
  "Surface against the project's approved state and founding intent. " +
  "Recommend exactly one, with an honest one-sentence reason grounded in " +
  "the state — never in your own taste. End with exactly one fenced " +
  '```json block: {"optionId", "reason"}. ' +
  LANG_RULE;

function surfacesDir(projectId: string): string {
  return abs(projectDir(projectId), "decisions");
}

export function readSurfaces(projectId: string): DecisionSurface[] {
  const dir = surfacesDir(projectId);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => readJson<DecisionSurface>(abs(dir, f)));
}

export function openSurface(projectId: string): DecisionSurface | null {
  return readSurfaces(projectId).find((d) => d.status === "open") ?? null;
}

function writeSurface(ds: DecisionSurface): void {
  writeJson(abs(surfacesDir(ds.projectId), `${ds.id}.json`), ds);
}

interface OptionParse {
  title: string;
  direction: string;
  description: string;
  benefits: string;
  tradeoffs: string;
  assumptions: string[];
}

function optionFrom(text: string): OptionParse | null {
  const str = (v: unknown): string => (typeof v === "string" ? v : "");
  for (const block of extractJsonBlocks(text).reverse()) {
    const b = block as Partial<Record<keyof OptionParse, unknown>>;
    if (typeof b !== "object" || b === null) continue;
    if (typeof b.title !== "string" || typeof b.description !== "string") continue;
    return {
      title: b.title,
      direction: str(b.direction) || "unnamed-direction",
      description: b.description,
      benefits: str(b.benefits),
      tradeoffs: str(b.tradeoffs),
      assumptions: Array.isArray(b.assumptions)
        ? b.assumptions.filter((a): a is string => typeof a === "string")
        : [],
    };
  }
  return null;
}

function seedRefs(resolved: ResolvedSeed[]): OptionSeedRef[] {
  return resolved.map((r) => ({
    id: r.seed.id,
    version: r.seed.version,
    reason: r.reason,
    ...(r.mentorId ? { mentorId: r.mentorId, mentorTitle: r.mentorTitle } : {}),
  }));
}

/** Steps 1-4 of the interaction-model slice: open one governed option set. */
export async function runDecisionSurface(args: {
  projectId: string;
  level: EffortLevel;
  runtime: Runtime;
  scripted?: boolean;
}): Promise<DecisionSurface> {
  const scripted = args.scripted ?? false;
  const project = getProject(args.projectId);
  if (openSurface(project.id)) {
    throw new Error("a Decision Surface is already open — decide it first");
  }
  const spec = effortSpec(args.level);
  const approved = readApproved(project.id);

  const decision = approved
    ? `Como concretizar a próxima ação: ${approved.state.nextAction}`
    : `A direção fundamental de "${project.name}"`;
  const why = approved
    ? "a próxima ação aprovada admite mais do que um caminho honesto"
    : "a intenção fundadora admite mais do que uma direção honesta";

  // Voices: the user's Mentors first (attributed), generic angles fill the
  // table to at least two genuinely distinct alternatives.
  const mentors = applicableMentors(project.id).slice(0, Math.min(spec.maxAgents, 4));
  const targetCount = Math.max(2, Math.min(spec.maxAgents, 4));
  const angles: { id: string; hint: string; mentorId?: string }[] = mentors.map((m) => ({
    id: m.id,
    hint: `the path this Mentor's judgement points to: ${m.persona}`,
    mentorId: m.id,
  }));
  for (const g of GENERIC_ANGLES) {
    if (angles.length >= targetCount) break;
    angles.push(g);
  }

  const options: OptionRecord[] = [];
  for (const [i, angle] of angles.entries()) {
    const b = baseContext(project, spec.contextBudgetChars);
    addApprovedState(b, project, true);
    b.add({
      kind: "pilot-note",
      id: `angle-${angle.id}`,
      absPath: abs(projectDir(project.id), "project.json"),
      content: `angle: ${angle.id}\nAngle hint: ${angle.hint}`,
      reason: "the distinct angle this option must commit to",
      required: true,
    });
    const mentor = angle.mentorId ? mentors.find((m) => m.id === angle.mentorId) : undefined;
    const resolved = mentor
      ? mentorSeeds(project.id, mentor)
      : resolveSeeds({ projectId: project.id, agentTags: [] });
    for (const r of resolved) {
      b.add({
        kind: "expertise",
        id: r.seed.id,
        absPath: seedYamlPath(r.seed),
        content:
          `${r.seed.title} (GuruSeed v${r.seed.version}` +
          `${r.mentorTitle ? `, Mentor: ${r.mentorTitle}` : ""})\n\n` +
          `Rule: ${r.seed.rule}\nWhy: ${r.seed.why}`,
        reason: r.reason,
        required: mentor !== undefined,
      });
    }
    addAnswers(b, project, false);
    const ctx = b.build();
    const { record, text } = await runWorkOrder({
      project,
      kind: "option",
      agentId: angle.id,
      system: OPTION_SYSTEM,
      ctx,
      level: args.level,
      runtime: args.runtime,
    });
    const parsed = optionFrom(text);
    if (!parsed) continue; // an unparseable voice is not an option — visible in the WO record
    const included = new Set(
      ctx.elements.filter((el) => el.kind === "expertise").map((el) => el.ref.id),
    );
    options.push({
      id: `option-${OPTION_LETTERS[i] ?? String(i + 1)}`,
      version: 1,
      ...parsed,
      seeds: seedRefs(resolved.filter((r) => included.has(r.seed.id))),
      workOrderId: record.id,
      status: "candidate",
    });
  }
  if (options.length < 2) {
    throw new Error(
      `only ${options.length} option(s) parsed — a Decision Surface needs at least two honest alternatives`,
    );
  }

  // The Kernel's recommendation, grounded in the state (skippable at minimal).
  let recommendation: DecisionSurface["recommendation"] = null;
  if (levelIndex(args.level) >= levelIndex("low")) {
    const b = baseContext(project, spec.contextBudgetChars);
    addApprovedState(b, project, true);
    b.add({
      kind: "pilot-note",
      id: "options-on-the-table",
      absPath: abs(projectDir(project.id), "project.json"),
      content: options
        .map((o) => `${o.id}: ${o.title} — ${o.direction}\n${o.description}`)
        .join("\n\n"),
      reason: "the options being compared",
      required: true,
    });
    const ctx = b.build();
    try {
      const { text } = await runWorkOrder({
        project,
        kind: "recommend",
        agentId: null,
        system: RECOMMEND_SYSTEM,
        ctx,
        level: args.level,
        runtime: args.runtime,
      });
      for (const block of extractJsonBlocks(text).reverse()) {
        const r = block as { optionId?: unknown; reason?: unknown };
        if (
          typeof r.optionId === "string" &&
          typeof r.reason === "string" &&
          options.some((o) => o.id === r.optionId)
        ) {
          recommendation = { optionId: r.optionId, reason: r.reason };
          break;
        }
      }
    } catch {
      // no recommendation is honest; a failed one is not
    }
  }

  const ds: DecisionSurface = {
    id: `ds-${readSurfaces(project.id).length + 1}`,
    projectId: project.id,
    iteration: project.iteration,
    decision,
    why,
    options,
    recommendation,
    status: "open",
    createdAt: nowIso(),
  };
  writeSurface(ds);
  event(project, "kernel", "decision_opened", scripted, {
    dsId: ds.id,
    note: `${decision} (${options.length} opções)`,
  });
  return ds;
}

/** Steps 5-7: a versioned refinement — the original is never overwritten. */
export async function refineOption(args: {
  projectId: string;
  dsId: string;
  optionId: string;
  instruction: string;
  runtime: Runtime;
  scripted?: boolean;
}): Promise<{ option: OptionRecord; candidateSeed: GuruSeed }> {
  const scripted = args.scripted ?? false;
  const project = getProject(args.projectId);
  const ds = readSurfaces(project.id).find((d) => d.id === args.dsId);
  if (!ds || ds.status !== "open") throw new Error(`no open surface ${args.dsId}`);
  const base = ds.options
    .filter((o) => o.id === args.optionId)
    .sort((a, b) => b.version - a.version)[0];
  if (!base) throw new Error(`unknown option ${args.optionId} on ${args.dsId}`);

  const spec = effortSpec(clampAutoEffort("low"));
  const b = baseContext(project, spec.contextBudgetChars);
  addApprovedState(b, project, false);
  b.add({
    kind: "prior-response",
    id: `${base.id}-v${base.version}`,
    absPath: abs(surfacesDir(project.id), `${ds.id}.json`),
    content:
      `The option being refined (${base.id} v${base.version}):\n` +
      `Title: ${base.title}\nDirection: ${base.direction}\n${base.description}\n` +
      `Benefits: ${base.benefits}\nTradeoffs: ${base.tradeoffs}`,
    reason: "the original the refinement must preserve",
    required: true,
  });
  b.add({
    kind: "pilot-note",
    id: "refinement",
    absPath: abs(projectDir(project.id), "evidence.jsonl"),
    content: `refinement instruction: ${args.instruction.trim()}`,
    reason: "the user's own direction — the only thing that may change",
    required: true,
  });
  const seedsById = new Map(listSeeds().map((s) => [s.id, s]));
  for (const ref of base.seeds) {
    const seed = seedsById.get(ref.id);
    if (!seed) continue;
    b.add({
      kind: "expertise",
      id: seed.id,
      absPath: seedYamlPath(seed),
      content: `${seed.title} (GuruSeed v${seed.version})\n\nRule: ${seed.rule}\nWhy: ${seed.why}`,
      reason: `carried over from ${base.id} v${base.version}: ${ref.reason}`,
      required: true,
    });
  }
  const ctx = b.build();
  const { record, text } = await runWorkOrder({
    project,
    kind: "refine",
    agentId: base.id,
    system: REFINE_SYSTEM,
    ctx,
    level: clampAutoEffort("low"),
    runtime: args.runtime,
  });
  const parsed = optionFrom(text);
  if (!parsed) throw new Error(`refine work order ${record.id} returned no parseable option`);

  const refined: OptionRecord = {
    id: base.id,
    version: base.version + 1,
    ...parsed,
    seeds: base.seeds,
    workOrderId: record.id,
    parent: { id: base.id, version: base.version },
    refinement: args.instruction.trim(),
    status: "candidate",
  };
  ds.options.push(refined);
  writeSurface(ds);
  event(project, "pilot", "option_refined", scripted, {
    dsId: ds.id,
    optionId: base.id,
    workOrderId: record.id,
    note: args.instruction.trim(),
  });

  // Step 11: a refinement may teach — candidate only, the Pilot governs it.
  const candidateSeed = addCandidateSeed({
    title: `Preferência: ${args.instruction.trim().slice(0, 60)}`,
    rule: args.instruction.trim(),
    why:
      `O utilizador refinou ${base.id} em ${ds.id} com esta direção — ` +
      `possivelmente um julgamento reutilizável, possivelmente pontual.`,
    domains: [],
    projects: [project.id],
    origin: "taught",
    provenanceNote: `extracted from refinement ${ds.id}:${base.id} v${base.version}→v${refined.version}`,
    sourceProject: project.id,
  });
  event(project, "kernel", "seed_candidate_extracted", scripted, {
    seedId: candidateSeed.id,
    dsId: ds.id,
    optionId: base.id,
    note: candidateSeed.title,
  });
  return { option: refined, candidateSeed };
}

/** Steps 8-10: the Pilot's choice closes the surface; lineage is evidence. */
export function selectOption(
  projectId: string,
  dsId: string,
  optionId: string,
  version: number,
  scripted = false,
): DecisionSurface {
  const project = getProject(projectId);
  const ds = readSurfaces(projectId).find((d) => d.id === dsId);
  if (!ds || ds.status !== "open") throw new Error(`no open surface ${dsId}`);
  const chosen = ds.options.find((o) => o.id === optionId && o.version === version);
  if (!chosen) throw new Error(`unknown option ${optionId} v${version} on ${dsId}`);
  chosen.status = "selected";
  for (const o of ds.options) {
    if (o !== chosen && o.status === "candidate") o.status = "rejected";
  }
  ds.selected = { optionId, version };
  ds.status = "decided";
  ds.decidedAt = nowIso();
  writeSurface(ds);
  event(project, "pilot", "option_selected", scripted, {
    dsId,
    optionId,
    note: `${chosen.title} (v${version}${chosen.refinement ? ", refinada" : ""})`,
  });
  return ds;
}

// ---------------------------------------------------------------------------
// The story of the project (FOUNDATION-CORRECTION, ADR-0019 §3): assembled
// entirely from disk — evidence, work orders, manifests, questions, states,
// artifacts. Operational provenance, never private model reasoning: the only
// things stored (and therefore the only things shown) are inputs, outputs,
// and what entered context with which reason.

const OUTPUT_EXCERPT_CHARS = 1600;

export interface StoryItem {
  ts: string;
  iteration: number;
  action: EvidenceEvent["action"];
  actor: "pilot" | "kernel";
  agentId?: string;
  agentTitle?: string;
  mandate?: string;
  workOrderId?: string;
  workKind?: WorkOrderKind;
  effortLevel?: string;
  model?: string;
  workStatus?: string;
  /** Expertise this work order received, with the Kernel's selection reason. */
  expertise?: { id: string; title: string; reason: string }[];
  /** Operational output excerpt (response or artifact), never reasoning. */
  output?: string;
  outputChars?: number;
  questionText?: string;
  answer?: string;
  askedBy?: string[];
  expertiseId?: string;
  note?: string;
}

export interface StoryIteration {
  iteration: number;
  items: StoryItem[];
}

export interface Story {
  intent: { name: string; description: string; createdAt: string };
  iterations: StoryIteration[];
}

function woDetail(
  projectId: string,
  iteration: number,
  workOrderId: string,
  expertiseTitles: Map<string, string>,
): Partial<StoryItem> {
  const dir = abs(workOrdersDir(projectId, iteration), workOrderId);
  if (!existsSync(abs(dir, "workorder.json"))) return {};
  const record = readJson<WorkOrderRecord>(abs(dir, "workorder.json"));
  const out: Partial<StoryItem> = {
    workKind: record.kind,
    effortLevel: record.effortLevel,
    model: record.model,
    workStatus: record.status,
  };
  const manifestPath = abs(dir, "manifest.json");
  if (existsSync(manifestPath)) {
    const manifest = readJson<import("./types.js").ContextManifest>(manifestPath);
    const applied = manifest.elements
      .filter((el) => el.kind === "expertise")
      .map((el) => ({
        id: el.ref.id,
        title: expertiseTitles.get(el.ref.id) ?? el.ref.id,
        reason: el.selectionReason,
      }));
    if (applied.length > 0) out.expertise = applied;
  }
  const respPath = abs(dir, "response.md");
  if (existsSync(respPath)) {
    const text = readText(respPath);
    out.output = text.slice(0, OUTPUT_EXCERPT_CHARS);
    out.outputChars = text.length;
  }
  return out;
}

export function storyOf(projectId: string): Story {
  const project = getProject(projectId);
  const roster = readRoster(projectId);
  const questions = readQuestions(projectId);
  const titles = new Map<string, string>();
  for (const s of [...listSeeds(), ...listCandidates()]) titles.set(s.id, s.title);

  const iterations = new Map<number, StoryItem[]>();
  for (const e of readEvents(projectId)) {
    const item: StoryItem = {
      ts: e.ts,
      iteration: e.iteration,
      action: e.action,
      actor: e.actor,
    };
    if (e.agentId) {
      item.agentId = e.agentId;
      const role = roster?.agents.find((a) => a.id === e.agentId);
      if (role) {
        item.agentTitle = role.title;
        item.mandate = role.mandate;
      }
    }
    if (e.workOrderId) {
      item.workOrderId = e.workOrderId;
      Object.assign(item, woDetail(projectId, e.iteration, e.workOrderId, titles));
    }
    if (e.questionId) {
      const q = questions.find((x) => x.id === e.questionId);
      if (q) {
        item.questionText = q.text;
        if (q.answer !== undefined) item.answer = q.answer;
        item.askedBy = q.askedBy;
      }
    }
    if (e.expertiseId) item.expertiseId = e.expertiseId;
    if (e.note) item.note = e.note;

    const bucket = iterations.get(e.iteration) ?? [];
    bucket.push(item);
    iterations.set(e.iteration, bucket);
  }

  return {
    intent: {
      name: project.name,
      description: project.description,
      createdAt: project.createdAt,
    },
    iterations: [...iterations.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([iteration, items]) => ({ iteration, items })),
  };
}
