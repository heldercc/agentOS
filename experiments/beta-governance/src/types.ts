// Data schemas for the Beta 2 governance experiment (ADR-0015).
//
// This file — and everything under src/ — is the engine. It must contain zero
// domain vocabulary (ADR-0008): the words describing the experiment's subject
// live entirely in data/, never here. `npm run check:domain` enforces this.

/** A reference to a versioned data element (provenance by reference, never copy). */
export interface ElementRef {
  id: string;
  version: string;
  path: string;
  sha256: string;
}

/** One governance decision the Pilot works through rounds of proposals. */
export interface Decision {
  id: string;
  title: string;
  instruction: string;
  tags: string[];
}

/**
 * One way of attacking a decision. The hint steers the model; the Pilot never
 * sees which approach produced which proposal while judging (blind mapping,
 * sealed per round). Selection statistics over approaches are the raw material
 * the distiller turns into candidate seeds (O4, miniature).
 */
export interface Approach {
  id: string;
  title: string;
  tags: string[];
  hint: string;
}

/** One enumerated element of assembled context, with why it was included. */
export interface ContextElement {
  ref: ElementRef;
  kind: "decision" | "approach" | "learned-seed" | "feedback";
  chars: number;
  selectionReason: string;
}

/**
 * The audit log of exactly what was placed into a proposal's context.
 * Invariant: nothing enters context that is not enumerated here.
 */
export interface ContextManifest {
  proposalId: string;
  elements: ContextElement[];
  assembledSha256: string;
}

/** Real token accounting from the model call (estimated on fake/manual ports). */
export interface MeterRecord {
  proposalId: string;
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

/**
 * One governance click, appended to the session's evidence log (JSONL).
 * The evidence log is the experiment's raw data (ADR-0015 rigor parameter 1):
 * every Pilot action is an event; nothing else is a signal.
 * `scripted` is true only for smoke-test events — the distiller and metrics
 * treat scripted evidence as radioactive and only read it inside its own
 * sandboxed session.
 */
export interface EvidenceEvent {
  ts: string;
  session: string;
  decisionId: string;
  round: number;
  /** Present on proposal-level actions; absent on tray actions. */
  proposalId?: string;
  /** Resolved server-side from the sealed mapping — the judge never sees it. */
  approachId?: string;
  /** Present on tray actions. */
  candidateId?: string;
  action:
    | "approve"
    | "reject"
    | "select"
    | "admit_seed"
    | "discard_seed"
    | "present"
    | "pilot_note";
  scripted: boolean;
  /** `present` events (ADR-0016 §1–2): display order and what was on the table. */
  order?: string[];
  /** `present` events: content sha256 per displayed option. */
  contentSha?: Record<string, string>;
  /** `present` events: learned-seed versions active in this round's context. */
  activeSeeds?: string[];
  /** Anchor verdicts (ADR-0016 §3): excluded from learning and improvement. */
  anchor?: boolean;
  anchorId?: string;
  /** `pilot_note` events: the owner initiating direction for the next round. */
  note?: string;
}

/** A model call's result, normalized across the real, fake, and manual ports. */
export interface ModelUsage {
  inputTokens: number;
  outputTokens: number;
  cacheCreationInputTokens: number;
  cacheReadInputTokens: number;
  requestId: string | null;
  /** True when tokens are a chars/4 estimate (fake or manual port), not API-metered. */
  estimated?: boolean;
}

export interface ModelResult {
  text: string;
  usage: ModelUsage;
}

/** Sealed blind mapping for one round: display letter → approach. */
export interface RoundMapping {
  session: string;
  decisionId: string;
  round: number;
  letters: Record<string, string>; // "A" → approachId
}

/** Selection statistics for one approach, folded from evidence. */
export interface ApproachStats {
  approachId: string;
  appearances: number;
  approvals: number;
  selections: number;
}

/**
 * A candidate seed the distiller drafted from selection evidence. It sits in
 * the tray until the Pilot admits or discards it — nothing is admitted
 * automatically (O5 holds, ADR-0015 rigor parameter 2).
 */
export interface CandidateSeed {
  id: string;
  approachId: string;
  title: string;
  body: string;
  stats: ApproachStats;
}

/** Per-decision progress, derived from evidence. */
export interface DecisionProgress {
  decisionId: string;
  rounds: number;
  approvals: number;
  closed: boolean;
  /** Round number of the winning selection, if closed. */
  roundsToSelection: number | null;
}

export interface DecisionFile {
  decisions: Decision[];
}
export interface ApproachFile {
  approaches: Approach[];
}
