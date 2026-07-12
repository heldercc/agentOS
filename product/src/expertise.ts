// Human expertise is the durable asset (docs/FOUNDATION-CORRECTION.md,
// ADR-0019). Models are interchangeable engines; agents are temporary
// vessels; what accumulates is governed human judgement. This module is the
// asset's store and its governance transitions — the Kernel schedules
// expertise into work orders (kernel.ts) but NEVER admits it: candidate →
// admitted | discarded is the user's hand alone, and every transition is a
// pilot-actor evidence event.

import { existsSync } from "node:fs";

import { projectDir, WORKSPACE_DIR } from "./paths.js";
import { abs, readJson, writeJson } from "./stores.js";

export type ExpertiseStatus = "candidate" | "admitted" | "discarded";
export type ExpertiseReach = "project" | "reusable";

export interface ExpertiseApplication {
  projectId: string;
  workOrderId: string;
  ts: string;
}

/** One piece of governed human judgement. */
export interface Expertise {
  id: string;
  title: string;
  /** The judgement itself — what should be known/done, in the owner's words. */
  body: string;
  /** Scope: overlaps agent tags to apply; empty = applies project-wide. */
  tags: string[];
  status: ExpertiseStatus;
  reach: ExpertiseReach;
  /** Where this came from: the user's hand, a distilled seed, an import… */
  provenance: { origin: "user" | "distilled" | "imported"; note: string };
  createdAt: string;
  decidedAt?: string;
  /** Automatic trail: every work order whose context this entered. */
  appliedIn: ExpertiseApplication[];
}

export interface ExpertiseFile {
  expertise: Expertise[];
}

/** The cross-project store lives beside the projects, never inside one. */
export const SHARED_ID = "_shared";

function storePath(scopeId: string): string {
  return scopeId === SHARED_ID
    ? abs(WORKSPACE_DIR, SHARED_ID, "expertise.json")
    : abs(projectDir(scopeId), "expertise.json");
}

export function readExpertise(scopeId: string): Expertise[] {
  const p = storePath(scopeId);
  return existsSync(p) ? readJson<ExpertiseFile>(p).expertise : [];
}

function writeExpertise(scopeId: string, expertise: Expertise[]): void {
  writeJson(storePath(scopeId), { expertise });
}

/** Everything visible from one project: its own store + the reusable store. */
export function expertiseFor(projectId: string): Expertise[] {
  return [...readExpertise(projectId), ...readExpertise(SHARED_ID)];
}

/**
 * Admitted judgement applicable to one temporary agent: scope tags overlap
 * the agent's tags, or the expertise is untagged (project-wide).
 */
export function applicableExpertise(projectId: string, agentTags: string[]): Expertise[] {
  return expertiseFor(projectId).filter(
    (e) =>
      e.status === "admitted" &&
      (e.tags.length === 0 || e.tags.some((t) => agentTags.includes(t))),
  );
}

export function addExpertise(args: {
  scopeId: string;
  title: string;
  body: string;
  tags: string[];
  provenanceNote: string;
}): Expertise {
  const all = readExpertise(args.scopeId);
  const maxId = all.reduce((n, e) => {
    const m = /^x-(\d+)$/.exec(e.id);
    return m ? Math.max(n, Number(m[1])) : n;
  }, 0);
  const record: Expertise = {
    id: `x-${maxId + 1}`,
    title: args.title.trim(),
    body: args.body.trim(),
    tags: args.tags.map((t) => t.trim().toLowerCase()).filter((t) => t !== ""),
    status: "candidate",
    reach: args.scopeId === SHARED_ID ? "reusable" : "project",
    provenance: { origin: "user", note: args.provenanceNote },
    createdAt: new Date().toISOString(),
    appliedIn: [],
  };
  all.push(record);
  writeExpertise(args.scopeId, all);
  return record;
}

export function decideExpertise(
  scopeId: string,
  expertiseId: string,
  decision: "admit" | "discard",
): Expertise {
  const all = readExpertise(scopeId);
  const e = all.find((x) => x.id === expertiseId);
  if (!e) throw new Error(`unknown expertise ${expertiseId} in ${scopeId}`);
  if (e.status !== "candidate" && decision === "admit") {
    throw new Error(`expertise ${expertiseId} is not a candidate`);
  }
  e.status = decision === "admit" ? "admitted" : "discarded";
  e.decidedAt = new Date().toISOString();
  writeExpertise(scopeId, all);
  return e;
}

/** The automatic application trail — called by the Kernel when a manifest seals. */
export function recordApplication(
  ownerScopeId: string,
  expertiseId: string,
  application: ExpertiseApplication,
): void {
  const all = readExpertise(ownerScopeId);
  const e = all.find((x) => x.id === expertiseId);
  if (!e) return; // the trail must never break a work order
  e.appliedIn.push(application);
  writeExpertise(ownerScopeId, all);
}

/** Which store a visible expertise record belongs to (for API round-trips). */
export function ownerScopeOf(projectId: string, expertiseId: string): string | null {
  if (readExpertise(projectId).some((e) => e.id === expertiseId)) return projectId;
  if (readExpertise(SHARED_ID).some((e) => e.id === expertiseId)) return SHARED_ID;
  return null;
}
