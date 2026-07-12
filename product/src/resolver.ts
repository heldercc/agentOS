// The Seed Resolver (Foundation Architecture; ADR-0020 §2), post-reform
// (parecer 2026-07-12 noite, ponto A): a GuruSeed applies to ONE expert —
// its Sensei — never transversally. For every Work Order, the Resolver
// convenes the Senseis whose craft overlaps the agent's tags and schedules
// ONLY their seeds, saying WHY and WHO carries each. The Kernel never copies
// the library; it schedules the necessary judgement.

import { listSeeds, listSenseis, type GuruSeed, type Sensei } from "./hi.js";

export interface ResolvedSeed {
  seed: GuruSeed;
  /** Why the Resolver selected it — recorded verbatim in the manifest. */
  reason: string;
  /** The Sensei that owns this seed — the voice that carries it. */
  senseiId: string;
  senseiTitle: string;
}

/**
 * Selection rules, v1 (deliberately legible — no embeddings, no magic):
 * a seed applies when it is admitted, owned by a Sensei, its project scope
 * includes this project (or is empty = reusable), and its Sensei's craft
 * domains overlap the agent's tags. No owner or no overlap = no entry —
 * universal judgement died with the reform.
 */
export function resolveSeeds(args: {
  projectId: string;
  agentTags: string[];
}): ResolvedSeed[] {
  const senseis = new Map(listSenseis().map((m) => [m.id, m]));
  const out: ResolvedSeed[] = [];
  for (const seed of listSeeds()) {
    if (seed.status !== "admitted" || !seed.sensei) continue;
    const sensei = senseis.get(seed.sensei);
    if (!sensei) continue;
    const projectOk =
      seed.scope.projects.length === 0 || seed.scope.projects.includes(args.projectId);
    if (!projectOk) continue;
    const overlap = (sensei.domains ?? []).filter((d) => args.agentTags.includes(d));
    if (overlap.length === 0) continue;
    out.push({
      seed,
      reason:
        `o Sensei "${sensei.title}" serve este papel — domínio [${overlap.join(", ")}]` +
        (seed.scope.projects.length > 0 ? ", seed local a este projeto" : ""),
      senseiId: sensei.id,
      senseiTitle: sensei.title,
    });
  }
  return out;
}

/**
 * The Senseis with at least one admitted seed applicable to this project —
 * the voices the Decision Surface convenes, each attributed on the option
 * it shapes.
 */
export function applicableSenseis(projectId: string): Sensei[] {
  const owners = new Set(
    listSeeds()
      .filter(
        (s) =>
          s.status === "admitted" &&
          s.sensei !== undefined &&
          (s.scope.projects.length === 0 || s.scope.projects.includes(projectId)),
      )
      .map((s) => s.sensei as string),
  );
  return listSenseis().filter((m) => owners.has(m.id));
}

/** The seeds one Sensei owns and may bring to this project, with reasons. */
export function senseiSeeds(projectId: string, sensei: Sensei): ResolvedSeed[] {
  const out: ResolvedSeed[] = [];
  for (const seed of listSeeds()) {
    if (seed.status !== "admitted" || seed.sensei !== sensei.id) continue;
    if (seed.scope.projects.length > 0 && !seed.scope.projects.includes(projectId)) continue;
    out.push({
      seed,
      reason: `pertence ao Sensei "${sensei.title}" (composição v${sensei.version})`,
      senseiId: sensei.id,
      senseiTitle: sensei.title,
    });
  }
  return out;
}
