// The Seed Resolver (Foundation Architecture; ADR-0020 §2): for every Work
// Order, select the applicable GuruSeeds — admitted only, scoped by domain
// and project — and say WHY each was selected and WHICH Mentor carries it.
// The Kernel never copies the library; it schedules the necessary judgement.

import { listMentors, listSeeds, type GuruSeed, type Mentor } from "./hi.js";

export interface ResolvedSeed {
  seed: GuruSeed;
  /** Why the Resolver selected it — recorded verbatim in the manifest. */
  reason: string;
  /** The Mentor whose composition carries this seed, if any. */
  mentorId?: string;
  mentorTitle?: string;
}

/**
 * Selection rules, v0 (deliberately legible — no embeddings, no magic):
 * a seed applies when it is admitted, its project scope includes this
 * project (or is empty = reusable), and its domains overlap the agent's
 * tags (or are empty = universal judgement). Mentor attribution: the first
 * mentor whose composition pins the seed.
 */
export function resolveSeeds(args: {
  projectId: string;
  agentTags: string[];
}): ResolvedSeed[] {
  const mentors = listMentors();
  const byMentor = new Map<string, Mentor>();
  for (const m of mentors) {
    for (const s of m.seeds) {
      if (!byMentor.has(s.id)) byMentor.set(s.id, m);
    }
  }
  const out: ResolvedSeed[] = [];
  for (const seed of listSeeds()) {
    if (seed.status !== "admitted") continue;
    const projectOk =
      seed.scope.projects.length === 0 || seed.scope.projects.includes(args.projectId);
    if (!projectOk) continue;
    const overlap = seed.scope.domains.filter((d) => args.agentTags.includes(d));
    const domainOk = seed.scope.domains.length === 0 || overlap.length > 0;
    if (!domainOk) continue;

    const mentor = byMentor.get(seed.id);
    const why =
      seed.scope.domains.length === 0
        ? "universal admitted judgement" +
          (seed.scope.projects.length > 0 ? ", local to this project" : "")
        : `domain overlap [${overlap.join(", ")}] with the agent's tags`;
    out.push({
      seed,
      reason: mentor ? `${why}; carried by Mentor "${mentor.title}"` : why,
      ...(mentor ? { mentorId: mentor.id, mentorTitle: mentor.title } : {}),
    });
  }
  return out;
}

/**
 * The mentors whose seeds are applicable to this project — the voices the
 * Decision Surface convenes, each attributed on the option it shapes.
 */
export function applicableMentors(projectId: string): Mentor[] {
  const seedIds = new Set(
    resolveSeeds({ projectId, agentTags: [] })
      .map((r) => r.seed.id)
      .concat(
        listSeeds()
          .filter(
            (s) =>
              s.status === "admitted" &&
              (s.scope.projects.length === 0 || s.scope.projects.includes(projectId)),
          )
          .map((s) => s.id),
      ),
  );
  return listMentors().filter((m) => m.seeds.some((s) => seedIds.has(s.id)));
}

/** The seeds a specific mentor contributes to one project, with reasons. */
export function mentorSeeds(projectId: string, mentor: Mentor): ResolvedSeed[] {
  const admitted = new Map(listSeeds().map((s) => [s.id, s]));
  const out: ResolvedSeed[] = [];
  for (const pin of mentor.seeds) {
    const seed = admitted.get(pin.id);
    if (!seed || seed.status !== "admitted") continue;
    if (seed.scope.projects.length > 0 && !seed.scope.projects.includes(projectId)) continue;
    out.push({
      seed,
      reason: `pinned by Mentor "${mentor.title}" (composition v${mentor.version})`,
      mentorId: mentor.id,
      mentorTitle: mentor.title,
    });
  }
  return out;
}
