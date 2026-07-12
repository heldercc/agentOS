// Data schemas for the AgentOS product shell — the 13-step Product Loop
// (docs/PRODUCT-LOOP.md). The engine stays free of project-domain vocabulary
// (ADR-0008): everything the Pilot's projects are ABOUT lives in workspace/,
// never here.
//
// ElementRef / ContextElement / ContextManifest / MeterRecord / ModelUsage /
// ModelResult are COPIED from experiments/beta-governance/src/types.ts
// (ADR-0012/0015 rig) — rigs are disposable science and stay uncoupled; a copy
// with provenance beats an import.

import type { EffortLevel } from "./effort.js";

/** A reference to a versioned data element (provenance by reference, never copy). */
export interface ElementRef {
  id: string;
  version: string;
  path: string;
  sha256: string;
}

/** One enumerated element of assembled context, with why it was included. */
export interface ContextElement {
  ref: ElementRef;
  kind:
    | "project"
    | "roster"
    | "agent-role"
    | "answer"
    | "approved-state"
    | "prior-response"
    | "pilot-note"
    | "artifact"
    | "expertise";
  chars: number;
  selectionReason: string;
}

/**
 * The audit log of exactly what was placed into a Work Order's context.
 * Invariant: nothing enters context that is not enumerated here (ADR-0012).
 */
export interface ContextManifest {
  workOrderId: string;
  elements: ContextElement[];
  assembledSha256: string;
}

/** Real token accounting from the runtime call (estimated on fake/mailbox/cli ports). */
export interface MeterRecord {
  workOrderId: string;
  model: string;
  requestId: string | null;
  inputTokens: number;
  outputTokens: number;
  cacheCreationInputTokens: number;
  cacheReadInputTokens: number;
  timestamp: string;
  durationMs: number;
  estimated: boolean;
}

/** A runtime call's result, normalized across the fake, cli and mailbox ports. */
export interface ModelUsage {
  inputTokens: number;
  outputTokens: number;
  cacheCreationInputTokens: number;
  cacheReadInputTokens: number;
  requestId: string | null;
  /** True when tokens are a chars/4 estimate, not API-metered. */
  estimated?: boolean;
}

export interface ModelResult {
  text: string;
  usage: ModelUsage;
}

// ---------------------------------------------------------------------------
// The product loop's own schemas.

/**
 * The Pilot's standing effort strategy for one project (parecer 2026-07-12
 * noite, ponto D): a level per phase — "um modelo melhor a planear e um pior
 * a executar, ou vice-versa". Explicitly user-set, so it may sit above the
 * automation authority line; the per-launch selector still overrides it.
 */
export interface EffortProfile {
  /** Interview movement: consults, automatic re-consults, refinements. */
  questions: EffortLevel;
  /** Deliberation: Decision Surfaces, candidate synthesis. */
  options: EffortLevel;
  /** Creation: governed execution. */
  execution: EffortLevel;
}

/** One project the Pilot governs — created from a name and a free-text intent. */
export interface Project {
  id: string;
  name: string;
  /** The Pilot's free-text description — the founding intent, verbatim. */
  description: string;
  createdAt: string;
  /** Current iteration of the loop, 1-based. */
  iteration: number;
  /** Per-phase effort strategy; absent = pre-reform project (treated as all "low"). */
  effortProfile?: EffortProfile;
  /** Lifecycle: absent = active (pre-lifecycle records stay valid).
   *  Concluding is a governed act — archive, never delete; reopening
   *  leaves evidence. */
  status?: "active" | "concluded";
  concludedAt?: string;
  /** The Pilot's closing note — what this project ended as. */
  concludedNote?: string;
}

/** One bounded specialist convened by the Kernel for this project. */
export interface AgentRole {
  id: string;
  title: string;
  /** The bounded responsibility — what this agent may reason about. */
  mandate: string;
  tags: string[];
}

export interface RosterFile {
  agents: AgentRole[];
  /** Work order that produced the roster (provenance). */
  workOrderId: string;
}

export type WorkOrderKind =
  | "roster"
  | "consult"
  | "reconsult"
  | "synthesize"
  | "execute"
  | "option"
  | "refine"
  | "recommend";

export interface WorkOrderRecord {
  id: string;
  projectId: string;
  iteration: number;
  kind: WorkOrderKind;
  /** Null for kernel-level orders (roster, synthesize). */
  agentId: string | null;
  model: string;
  effortLevel: string;
  createdAt: string;
  status: "done" | "error";
  error?: string;
}

/**
 * One aggregated Question Need (Operating Model §4): the internal demand for
 * context is plural; the visible interview is singular. The Kernel dedupes by
 * normalized text and ranks by demand.
 */
export interface QuestionNeed {
  id: string;
  text: string;
  /** Agents whose consultation raised this need. */
  askedBy: string[];
  /** Iteration in which the need first appeared. */
  iteration: number;
  /** "deferred" = the user declared context sufficient with this still open
   *  (ADR-0020 §3) — kept on file, never silently dropped. */
  status: "open" | "answered" | "deferred";
  answer?: string;
  answeredAt?: string;
}

export interface QuestionsFile {
  questions: QuestionNeed[];
}

/** The smallest sufficient account of the project now (Operating Model §6). */
export interface ProjectStateDoc {
  objective: string;
  phase: string;
  approvedDecisions: string[];
  activeArtifacts: string[];
  unresolvedQuestions: string[];
  constraints: string[];
  nextAction: string;
}

/** A candidate Project State awaiting the Pilot's approval (steps 9–10). */
export interface CandidateState {
  iteration: number;
  builtAt: string;
  workOrderId: string;
  state: ProjectStateDoc;
  status: "candidate" | "approved" | "rejected";
  decidedAt?: string;
  /** The Pilot's note on rejection — direction for the rebuild. */
  rejectionNote?: string;
}

export interface ApprovedState {
  iteration: number;
  approvedAt: string;
  state: ProjectStateDoc;
}

/** One GuruSeed reference on an option — who shaped it and why. */
export interface OptionSeedRef {
  id: string;
  version: number;
  reason: string;
  senseiId?: string;
  senseiTitle?: string;
  /** Pre-reform records used the old name; kept readable, never written anew. */
  mentorId?: string;
  mentorTitle?: string;
}

/** One genuinely distinct alternative on a Decision Surface, versioned. */
export interface OptionRecord {
  id: string;
  version: number;
  /** The Sensei whose voice produced this option — the one credited if picked. */
  senseiId?: string;
  senseiTitle?: string;
  title: string;
  direction: string;
  description: string;
  benefits: string;
  tradeoffs: string;
  assumptions: string[];
  seeds: OptionSeedRef[];
  workOrderId: string;
  /** Refinements derive versions; the original is never overwritten. */
  parent?: { id: string; version: number };
  refinement?: string;
  status: "candidate" | "selected" | "rejected";
}

/**
 * The Kernel's governed presentation of one consequential choice
 * (GOVERNANCE-INTERACTION-MODEL, ADR-0020 §5). Only the Kernel addresses
 * the Pilot through a Decision Surface.
 */
export interface DecisionSurface {
  id: string;
  projectId: string;
  iteration: number;
  decision: string;
  why: string;
  options: OptionRecord[];
  recommendation: { optionId: string; reason: string } | null;
  status: "open" | "decided";
  selected?: { optionId: string; version: number };
  createdAt: string;
  decidedAt?: string;
}

/**
 * One governance or movement event, appended to the project's evidence log
 * (JSONL, append-only). Every Pilot click and every Kernel movement is an
 * event; nothing else is a signal. `scripted` marks smoke-test events.
 */
export interface EvidenceEvent {
  ts: string;
  projectId: string;
  iteration: number;
  /** Who moved: the Pilot (authority) or the Kernel (movement). */
  actor: "pilot" | "kernel";
  action:
    | "project_init"
    | "project_concluded"
    | "project_reopened"
    | "roster_ready"
    | "consulted"
    | "question_answered"
    | "context_sufficient"
    | "reconsulted"
    | "candidate_built"
    | "state_approved"
    | "state_rejected"
    | "execution_started"
    | "artifact_returned"
    | "iteration_advanced"
    | "pilot_note"
    | "expertise_added"
    | "expertise_admitted"
    | "expertise_discarded"
    | "seed_candidate_added"
    | "seed_admitted"
    | "seed_rejected"
    | "seed_candidate_extracted"
    | "seed_evidence"
    | "seed_revised"
    /** Pre-reform name, kept readable in old evidence logs; new events use sensei_saved. */
    | "mentor_saved"
    | "sensei_saved"
    | "sensei_victory"
    | "effort_profile_set"
    | "decision_opened"
    | "option_refined"
    | "option_selected";
  workOrderId?: string;
  agentId?: string;
  questionId?: string;
  expertiseId?: string;
  seedId?: string;
  dsId?: string;
  optionId?: string;
  note?: string;
  effortLevel?: string;
  scripted: boolean;
}
