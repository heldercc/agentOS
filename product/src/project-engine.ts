// Project Engine mechanics (ADR-0024): pure validation, comparison and graph
// movement. No runtime, no context assembly, no persistence, no audit log and
// no authority live here — those remain Kernel responsibilities.

import type { ProjectMap, ProjectSlice, ProjectSliceStatus } from "./types.js";

export interface ProjectMapChange {
  kind: "slice-added" | "slice-removed" | "purpose-changed" | "dependencies-changed" | "artifacts-changed" | "decisions-changed";
  sliceId: string;
  material: true;
}

function unique(values: readonly string[]): string[] { return [...new Set(values)]; }
function sameSet(a: readonly string[], b: readonly string[]): boolean {
  const aa = [...new Set(a)].sort();
  const bb = [...new Set(b)].sort();
  return aa.length === bb.length && aa.every((value, index) => value === bb[index]);
}

export function validateProjectMap(map: ProjectMap): ProjectMap {
  if (!map.projectId) throw new Error("ProjectMap.projectId is required");
  if (!Number.isInteger(map.version) || map.version < 1) throw new Error("ProjectMap.version must be >= 1");
  if (map.schemaVersion !== 1) throw new Error(`unsupported ProjectMap.schemaVersion ${map.schemaVersion}`);
  const ids = new Set<string>();
  for (const slice of map.slices) {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(slice.id)) throw new Error(`invalid ProjectSlice.id ${slice.id}`);
    if (ids.has(slice.id)) throw new Error(`duplicate ProjectSlice.id ${slice.id}`);
    if (!slice.title.trim() || !slice.purpose.trim()) throw new Error(`ProjectSlice ${slice.id} needs title and purpose`);
    ids.add(slice.id);
  }
  for (const slice of map.slices) {
    if (slice.parentId !== null && !ids.has(slice.parentId)) throw new Error(`ProjectSlice ${slice.id} has unknown parent ${slice.parentId}`);
    if (slice.parentId === slice.id) throw new Error(`ProjectSlice ${slice.id} cannot parent itself`);
    for (const dependency of slice.dependsOn) {
      if (!ids.has(dependency)) throw new Error(`ProjectSlice ${slice.id} depends on unknown ${dependency}`);
      if (dependency === slice.id) throw new Error(`ProjectSlice ${slice.id} cannot depend on itself`);
    }
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const byId = new Map(map.slices.map((slice) => [slice.id, slice]));
  const visit = (id: string): void => {
    if (visiting.has(id)) throw new Error(`ProjectMap dependency cycle at ${id}`);
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dependency of byId.get(id)?.dependsOn ?? []) visit(dependency);
    visiting.delete(id);
    visited.add(id);
  };
  for (const id of ids) visit(id);
  return map;
}

export function candidateProjectMapFromText(args: {
  text: string;
  projectId: string;
  projectIteration: number;
  priorMapVersion: number | null;
  workOrderId: string;
}): ProjectMap {
  const matches = [...args.text.matchAll(/```json\s*([\s\S]*?)```/gi)];
  const payload = matches.at(-1)?.[1] ?? args.text;
  let parsed: unknown;
  try { parsed = JSON.parse(payload.trim()); } catch (e) {
    throw new Error(`Slicer returned no parseable Project Map: ${e instanceof Error ? e.message : String(e)}`);
  }
  if (parsed === null || typeof parsed !== "object" || !Array.isArray((parsed as { slices?: unknown }).slices)) {
    throw new Error("Slicer output must contain a slices array");
  }
  const rawSlices = (parsed as { slices: unknown[] }).slices;
  const slices: ProjectSlice[] = rawSlices.map((value, index) => {
    if (value === null || typeof value !== "object") throw new Error(`slices[${index}] must be an object`);
    const raw = value as Record<string, unknown>;
    const strings = (key: string): string[] => Array.isArray(raw[key]) ? (raw[key] as unknown[]).filter((item): item is string => typeof item === "string") : [];
    return {
      id: String(raw["id"] ?? ""),
      title: String(raw["title"] ?? ""),
      purpose: String(raw["purpose"] ?? ""),
      parentId: typeof raw["parentId"] === "string" ? raw["parentId"] : null,
      dependsOn: unique(strings("dependsOn")),
      expectedArtifacts: unique(strings("expectedArtifacts")),
      materialDecisions: unique(strings("materialDecisions")),
      status: "proposed",
    };
  });
  return validateProjectMap({
    projectId: args.projectId,
    version: (args.priorMapVersion ?? 0) + 1,
    schemaVersion: 1,
    status: "candidate",
    createdAt: new Date().toISOString(),
    basedOn: { projectIteration: args.projectIteration, priorMapVersion: args.priorMapVersion },
    slices,
    proposalWorkOrderId: args.workOrderId,
  });
}

export function compareProjectMaps(previous: ProjectMap | null, candidate: ProjectMap): ProjectMapChange[] {
  if (previous === null) return candidate.slices.map((slice) => ({ kind: "slice-added", sliceId: slice.id, material: true }));
  const before = new Map(previous.slices.map((slice) => [slice.id, slice]));
  const after = new Map(candidate.slices.map((slice) => [slice.id, slice]));
  const changes: ProjectMapChange[] = [];
  for (const id of before.keys()) if (!after.has(id)) changes.push({ kind: "slice-removed", sliceId: id, material: true });
  for (const [id, slice] of after) {
    const old = before.get(id);
    if (!old) { changes.push({ kind: "slice-added", sliceId: id, material: true }); continue; }
    if (old.purpose !== slice.purpose) changes.push({ kind: "purpose-changed", sliceId: id, material: true });
    if (!sameSet(old.dependsOn, slice.dependsOn)) changes.push({ kind: "dependencies-changed", sliceId: id, material: true });
    if (!sameSet(old.expectedArtifacts, slice.expectedArtifacts)) changes.push({ kind: "artifacts-changed", sliceId: id, material: true });
    if (!sameSet(old.materialDecisions, slice.materialDecisions)) changes.push({ kind: "decisions-changed", sliceId: id, material: true });
  }
  return changes;
}

export function normalizeProjectMap(map: ProjectMap): ProjectMap {
  const done = new Set(map.slices.filter((slice) => slice.status === "done").map((slice) => slice.id));
  return {
    ...map,
    slices: map.slices.map((slice) => {
      if (["done", "active", "affected", "abandoned"].includes(slice.status)) return slice;
      const blocked = slice.dependsOn.some((dependency) => !done.has(dependency));
      return { ...slice, status: blocked ? "blocked" : "ready" };
    }),
  };
}

export function nextUnblockedSlice(map: ProjectMap): ProjectSlice | null {
  const normalized = normalizeProjectMap(validateProjectMap(map));
  return normalized.slices.find((slice) => slice.status === "active")
    ?? normalized.slices.find((slice) => slice.status === "ready")
    ?? null;
}

function downstreamIds(map: ProjectMap, sourceId: string): Set<string> {
  const affected = new Set<string>();
  const queue = [sourceId];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;
    for (const slice of map.slices.filter((item) => item.dependsOn.includes(current))) {
      if (!affected.has(slice.id)) { affected.add(slice.id); queue.push(slice.id); }
    }
  }
  return affected;
}

export function transitionProjectSlice(args: {
  map: ProjectMap;
  sliceId: string;
  to: Extract<ProjectSliceStatus, "ready" | "active" | "done" | "abandoned">;
  reason?: string;
}): ProjectMap {
  const map = validateProjectMap(args.map);
  if (map.status !== "approved") throw new Error("candidate Project Maps cannot schedule work");
  const target = map.slices.find((slice) => slice.id === args.sliceId);
  if (!target) throw new Error(`unknown ProjectSlice ${args.sliceId}`);
  const normalized = normalizeProjectMap(map);
  const current = normalized.slices.find((slice) => slice.id === args.sliceId) as ProjectSlice;
  if (args.to === "active" && current.dependsOn.some((id) => normalized.slices.find((slice) => slice.id === id)?.status !== "done")) {
    throw new Error(`ProjectSlice ${args.sliceId} is blocked by unfinished dependencies`);
  }
  const reopeningDone = target.status === "done" && args.to !== "done";
  const downstream = reopeningDone ? downstreamIds(map, target.id) : new Set<string>();
  const slices = normalized.slices.map((slice) => {
    if (slice.id === target.id) return { ...slice, status: args.to, ...(args.reason ? { statusReason: args.reason } : {}) };
    if (downstream.has(slice.id) && slice.status !== "abandoned") {
      return { ...slice, status: "affected" as const, statusReason: `upstream ${target.id} reopened` };
    }
    return slice;
  });
  return validateProjectMap(normalizeProjectMap({
    ...map,
    version: map.version + 1,
    createdAt: new Date().toISOString(),
    slices,
    basedOn: { projectIteration: map.basedOn.projectIteration, priorMapVersion: map.version },
  }));
}
