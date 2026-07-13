// Runtime validation at canonical store boundaries (ADR-0023 RULE D).
// TypeScript types disappear at runtime; these small validators make corrupt
// or future-shaped records fail by record + field instead of becoming truth
// through an unchecked `as T` cast. Older optional fields remain optional.

import type { GuruSeed, Sensei } from "./hi.js";
import type {
  ApprovedState,
  CandidateState,
  DecisionSurface,
  EvidenceEvent,
  OperationActual,
  Project,
  ProjectMap,
  QuestionsFile,
  WorkOrderRecord,
} from "./types.js";

export class RecordValidationError extends Error {
  constructor(readonly record: string, readonly field: string, detail: string) {
    super(`${record}.${field}: ${detail}`);
    this.name = "RecordValidationError";
  }
}

type Obj = Record<string, unknown>;
function obj(value: unknown, record: string): Obj {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new RecordValidationError(record, "<root>", "expected object");
  }
  return value as Obj;
}
function str(o: Obj, key: string, record: string, optional = false): void {
  if (optional && o[key] === undefined) return;
  if (typeof o[key] !== "string") throw new RecordValidationError(record, key, "expected string");
}
function num(o: Obj, key: string, record: string): void {
  if (typeof o[key] !== "number" || !Number.isFinite(o[key])) {
    throw new RecordValidationError(record, key, "expected finite number");
  }
}
function numOrNull(o: Obj, key: string, record: string): void {
  if (o[key] === null) return;
  num(o, key, record);
}
function bool(o: Obj, key: string, record: string): void {
  if (typeof o[key] !== "boolean") throw new RecordValidationError(record, key, "expected boolean");
}
function arr(o: Obj, key: string, record: string): unknown[] {
  if (!Array.isArray(o[key])) throw new RecordValidationError(record, key, "expected array");
  return o[key] as unknown[];
}
function oneOf(o: Obj, key: string, record: string, values: readonly string[]): void {
  str(o, key, record);
  if (!values.includes(o[key] as string)) {
    throw new RecordValidationError(record, key, `expected one of ${values.join("|")}`);
  }
}
function stringArray(o: Obj, key: string, record: string): void {
  if (!arr(o, key, record).every((item) => typeof item === "string")) {
    throw new RecordValidationError(record, key, "expected string[]");
  }
}

export function validateProject(value: unknown, record = "Project"): Project {
  const o = obj(value, record);
  for (const key of ["id", "name", "description", "createdAt"]) str(o, key, record);
  num(o, "iteration", record);
  if ((o["iteration"] as number) < 1) throw new RecordValidationError(record, "iteration", "must be >= 1");
  if (o["status"] !== undefined) oneOf(o, "status", record, ["active", "concluded"]);
  str(o, "concludedAt", record, true);
  str(o, "concludedNote", record, true);
  return value as Project;
}

export function validateWorkOrderRecord(value: unknown, record = "WorkOrderRecord"): WorkOrderRecord {
  const o = obj(value, record);
  for (const key of ["id", "projectId", "kind", "model", "effortLevel", "createdAt"]) str(o, key, record);
  num(o, "iteration", record);
  if (o["agentId"] !== null && typeof o["agentId"] !== "string") {
    throw new RecordValidationError(record, "agentId", "expected string|null");
  }
  str(o, "sliceId", record, true);
  oneOf(o, "status", record, ["queued", "running", "done", "interrupted", "timed-out", "error"]);
  str(o, "error", record, true);
  return value as WorkOrderRecord;
}

export function validateQuestionsFile(value: unknown, record = "QuestionsFile"): QuestionsFile {
  const o = obj(value, record);
  for (const [i, item] of arr(o, "questions", record).entries()) {
    const q = obj(item, `${record}.questions[${i}]`);
    for (const key of ["id", "text", "status"]) str(q, key, `${record}.questions[${i}]`);
    stringArray(q, "askedBy", `${record}.questions[${i}]`);
    num(q, "iteration", `${record}.questions[${i}]`);
  }
  return value as QuestionsFile;
}

function validateStateDoc(value: unknown, record: string): void {
  const o = obj(value, record);
  for (const key of ["objective", "phase", "nextAction"]) str(o, key, record);
  for (const key of ["approvedDecisions", "activeArtifacts", "unresolvedQuestions", "constraints"]) {
    stringArray(o, key, record);
  }
}

export function validateCandidateState(value: unknown, record = "CandidateState"): CandidateState {
  const o = obj(value, record);
  num(o, "iteration", record);
  for (const key of ["builtAt", "workOrderId", "status"]) str(o, key, record);
  validateStateDoc(o["state"], `${record}.state`);
  return value as CandidateState;
}

export function validateApprovedState(value: unknown, record = "ApprovedState"): ApprovedState {
  const o = obj(value, record);
  num(o, "iteration", record);
  str(o, "approvedAt", record);
  validateStateDoc(o["state"], `${record}.state`);
  return value as ApprovedState;
}

export function validateDecisionSurface(value: unknown, record = "DecisionSurface"): DecisionSurface {
  const o = obj(value, record);
  for (const key of ["id", "projectId", "decision", "why", "status", "createdAt"]) str(o, key, record);
  num(o, "iteration", record);
  arr(o, "options", record);
  return value as DecisionSurface;
}

export function validateEvidenceEvent(value: unknown, record = "EvidenceEvent"): EvidenceEvent {
  const o = obj(value, record);
  for (const key of ["ts", "projectId", "actor", "action"]) str(o, key, record);
  num(o, "iteration", record);
  bool(o, "scripted", record);
  return value as EvidenceEvent;
}

export function validateGuruSeed(value: unknown, record = "GuruSeed"): GuruSeed {
  const o = obj(value, record);
  for (const key of ["id", "title", "kind", "status", "owner", "rule", "why"]) str(o, key, record);
  num(o, "version", record);
  str(o, "sensei", record, true);
  const scope = obj(o["scope"], `${record}.scope`);
  stringArray(scope, "domains", `${record}.scope`);
  stringArray(scope, "projects", `${record}.scope`);
  obj(o["provenance"], `${record}.provenance`);
  return value as GuruSeed;
}

export function validateSensei(value: unknown, record = "Sensei"): Sensei {
  const o = obj(value, record);
  for (const key of ["id", "title", "persona", "owner", "createdAt"]) str(o, key, record);
  num(o, "version", record);
  stringArray(o, "domains", record);
  arr(o, "seeds", record);
  stringArray(o, "selection_notes", record);
  return value as Sensei;
}

export function validateOperationActual(value: unknown, record = "OperationActual"): OperationActual {
  const o = obj(value, record);
  for (const key of ["operationId", "projectId", "op", "effortLevel", "startedAt", "endedAt", "outcome"]) str(o, key, record);
  for (const key of ["iteration", "wallMs", "workOrdersPlanned", "workOrdersDone", "tokensInput", "tokensOutput", "heartbeatGapMaxMs"]) num(o, key, record);
  numOrNull(o, "queueMs", record);
  numOrNull(o, "firstFeedbackMs", record);
  bool(o, "tokensEstimated", record);
  arr(o, "phases", record);
  stringArray(o, "models", record);
  return value as OperationActual;
}

export function validateProjectMapRecord(value: unknown, record = "ProjectMap"): ProjectMap {
  const o = obj(value, record);
  str(o, "projectId", record);
  num(o, "version", record);
  num(o, "schemaVersion", record);
  oneOf(o, "status", record, ["candidate", "approved"]);
  str(o, "createdAt", record);
  arr(o, "slices", record);
  obj(o["basedOn"], `${record}.basedOn`);
  if (o["proposalWorkOrderId"] !== null && typeof o["proposalWorkOrderId"] !== "string") {
    throw new RecordValidationError(record, "proposalWorkOrderId", "expected string|null");
  }
  return value as ProjectMap;
}
