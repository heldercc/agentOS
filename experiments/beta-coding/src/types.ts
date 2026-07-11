// Data schemas for the Beta Coding experiment (ADR-0012).
//
// This file — and everything under src/ — is the engine. It must contain zero
// domain vocabulary (ADR-0008): the words describing the experiment's subject
// live entirely in data/, never here. `npm run check:domain` enforces this.

/** Which context-assembly strategy produced a piece of work. */
export type PathName = "full-reload" | "scheduled";

/** The kind of thing a context element is. */
export type ElementKind = "mentor" | "doc" | "seed" | "state" | "task";

/**
 * A reference to a versioned data element. Provenance is always by reference,
 * never by copy (Architectural Invariant: "provenance by reference"). `version`
 * is the file's short git hash when committed, else a content sha256 fallback.
 */
export interface ElementRef {
  id: string;
  version: string;
  path: string;
  sha256: string;
}

/** One unit of work asked of the Mentor. Tags drive the scheduled resolver (slice 4). */
export interface Task {
  id: string;
  title: string;
  instruction: string;
  tags: string[];
}

/** A GuruSeed — the owner's judgment. Metadata here; body in the referenced .md file. */
export interface Seed {
  id: string;
  version: string;
  title: string;
  tags: string[];
  path: string;
}

/** A Project State slice — one project's knowledge. Same shape as a Seed by design. */
export interface StateSlice {
  id: string;
  version: string;
  title: string;
  tags: string[];
  path: string;
}

/** The authorization to execute one task down one path. Written before execution. */
export interface WorkOrder {
  id: string;
  runId: string;
  taskId: string;
  path: PathName;
  model: string;
  maxTokens: number;
  createdAt: string;
  status: "created" | "executed" | "failed";
}

/** One enumerated element of assembled context, with why it was included. */
export interface ContextElement {
  ref: ElementRef;
  kind: ElementKind;
  chars: number;
  selectionReason: string;
}

/**
 * The audit log of exactly what was placed into a Mentor's context.
 * Invariant: nothing enters context that is not enumerated here.
 * `assembledSha256` hashes the final prompt string, proving the manifest is complete.
 */
export interface ContextManifest {
  workOrderId: string;
  path: PathName;
  elements: ContextElement[];
  assembledSha256: string;
  measuredInputTokens?: number;
}

/**
 * Real token accounting from the model call. Cache fields must be zero: any
 * prompt caching would corrupt the input-token comparison the experiment rests on.
 */
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
  /** True when inputTokens/outputTokens are estimates, not API-metered (fake/manual). */
  estimated: boolean;
}

/**
 * Provenance for an immutable artifact. The body (artifact.md) is write-once;
 * the store refuses to overwrite it. Everything here is by reference.
 */
export interface ArtifactProvenance {
  artifactId: string;
  workOrderId: string;
  taskId: string;
  path: PathName;
  contextManifest: string;
  producedBy: { model: string; requestId: string | null };
  sha256: string;
  createdAt: string;
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

/** The two on-disk index files. */
export interface SeedIndex {
  seeds: Seed[];
}
export interface StateIndex {
  slices: StateSlice[];
}
export interface TaskFile {
  tasks: Task[];
}
