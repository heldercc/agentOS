// Smoke test: the full 13-step Product Loop (docs/PRODUCT-LOOP.md) exercised
// end-to-end on the fake runtime, at zero cost. Scripted evidence only —
// the smoke project id starts with "smoke-" so its meters never feed the
// Effort Probe and its events never read as the user's.

import { existsSync, rmSync } from "node:fs";

import { readEvents } from "../evidence.js";
import { collectMeterSamples, probeEffort } from "../effort.js";
import {
  addCandidateSeedGoverned,
  advanceIteration,
  answerQuestion,
  concludeProject,
  decideCandidate,
  decideSeedGoverned,
  declareContextSufficient,
  getProject,
  initProject,
  listArtifacts,
  openQuestions,
  readApproved,
  readQuestions,
  readRoster,
  readSurfaces,
  readWorkOrders,
  recordSeedEvidenceGoverned,
  refineOption,
  reopenProject,
  reviseSeedGoverned,
  runCandidate,
  runConsult,
  runDecisionSurface,
  runExecute,
  saveMentorGoverned,
  selectOption,
  stageOf,
  storyOf,
  topOpenQuestion,
  type ArtifactProvenance,
} from "../kernel.js";
import { getCandidate, getMentorVersion, getSeed, getSeedVersion, seedYamlPath } from "../hi.js";
import { resolveSeeds } from "../resolver.js";
import { buildActual } from "../effort.js";
import { projectDir, WORKSPACE_DIR } from "../paths.js";
import { abs, readJson, readText, sha256, writeArtifactOnce } from "../stores.js";
import { FakeRuntime } from "../runtime.js";
import type { ContextManifest } from "../types.js";

let passed = 0;
let failed = 0;
function check(name: string, ok: boolean, detail = ""): void {
  if (ok) {
    passed += 1;
    console.log(`  ok  ${name}`);
  } else {
    failed += 1;
    console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

const runtime = new FakeRuntime();

async function main(): Promise<void> {
  console.log("product shell smoke — the 13-step loop on the fake runtime\n");

  // The smoke runs against an ISOLATED Human Intelligence library — scripted
  // seeds must never enter the owner's real one (hi.ts reads this per call).
  const smokeHi = abs(WORKSPACE_DIR, "..", "smoke-hi");
  if (existsSync(smokeHi)) rmSync(smokeHi, { recursive: true, force: true });
  process.env["PRODUCT_HI_DIR"] = smokeHi;

  // Real meters, if any exist, must be exactly as many after the smoke:
  // scripted work never feeds the Effort Probe.
  const samplesBefore = collectMeterSamples(WORKSPACE_DIR).length;

  // A clean slate: the smoke project is disposable by definition.
  const preexisting = "smoke-loop";
  if (existsSync(projectDir(preexisting))) {
    rmSync(projectDir(preexisting), { recursive: true, force: true });
  }

  // Step 1 — Project Init from name + free-text description.
  const project = initProject(
    "Smoke Loop",
    "A deterministic exercise of the whole loop. (id will differ)",
    true,
  );
  // initProject slugifies the name; rename check to the actual id contract.
  check("1. project init creates project.json", getProject(project.id).name === "Smoke Loop");
  check("1b. iteration starts at 1", project.iteration === 1);
  check("1c. stage is consult", stageOf(project.id) === "consult");

  // Steps 2–5 — roster + consults + Question Needs aggregation.
  const consult = await runConsult({
    projectId: project.id,
    level: "minimal",
    runtime,
    scripted: true,
  });
  const roster = readRoster(project.id);
  check("2. roster produced by a work order", roster !== null && roster.workOrderId !== "");
  check("3. roster has bounded agents", (roster?.agents.length ?? 0) >= 2);
  check(
    "3b. consults ran for the effort-capped table",
    consult.consulted.length === 1, // minimal caps the table at 1 agent
    `consulted=${consult.consulted.join(",")}`,
  );

  // Widen the table: consult again at balanced so every agent speaks.
  // (Movement is idempotent-ish: more consults, more evidence, same store.)
  await runConsult({ projectId: project.id, level: "balanced", runtime, scripted: true });
  const questions = readQuestions(project.id);
  check("4. question needs collected", questions.length > 0);
  const common = questions.find((q) => q.askedBy.length > 1);
  check(
    "5. kernel deduplicated the shared need across agents",
    common !== undefined,
    JSON.stringify(questions.map((q) => ({ t: q.text.slice(0, 30), by: q.askedBy })), null, 0),
  );
  check("5b. stage is interview", stageOf(project.id) === "interview");

  // Step 6 — one governed question at a time, ranked by demand.
  const top = topOpenQuestion(project.id);
  check("6. top question is the most-demanded", top !== null && top.askedBy.length > 1);

  // Steps 7–8 — answer persists; relevant agents re-consult automatically.
  const { reconsulted } = await answerQuestion({
    projectId: project.id,
    questionId: top?.id ?? "",
    answer: "The outcome that matters is a working governed loop.",
    runtime,
    scripted: true,
  });
  check(
    "7. answer persisted",
    readQuestions(project.id).find((q) => q.id === top?.id)?.status === "answered",
  );
  check(
    "8. every asking agent was re-consulted",
    reconsulted.length === (top?.askedBy.length ?? -1),
    `reconsulted=${reconsulted.join(",")}`,
  );

  // Drain the remaining open questions (agent-specific ones).
  let guard = 0;
  while (topOpenQuestion(project.id) !== null && guard < 10) {
    guard += 1;
    const q = topOpenQuestion(project.id);
    if (!q) break;
    await answerQuestion({
      projectId: project.id,
      questionId: q.id,
      answer: "Nothing is out of bounds for the smoke.",
      runtime,
      scripted: true,
    });
  }
  check("8b. interview drains to zero open questions", openQuestions(project.id).length === 0);
  check("8c. stage is candidate", stageOf(project.id) === "candidate");

  // Step 9 — candidate Project State.
  const candidate = await runCandidate({
    projectId: project.id,
    level: "minimal",
    runtime,
    scripted: true,
  });
  check("9. candidate built with objective + nextAction", candidate.state.objective !== "" && candidate.state.nextAction !== "");
  check("9b. stage is approve", stageOf(project.id) === "approve");

  // Step 10 — the Pilot approves. (Reject path first, to prove direction flows.)
  decideCandidate(project.id, "reject", "Sharpen the objective.", true);
  check("10. rejection reopens the candidate stage", stageOf(project.id) === "candidate");
  const rebuilt = await runCandidate({
    projectId: project.id,
    level: "minimal",
    runtime,
    scripted: true,
  });
  check("10b. rebuild ran after rejection", rebuilt.status === "candidate");
  decideCandidate(project.id, "approve", undefined, true);
  check("10c. approval lands the state", readApproved(project.id)?.iteration === 1);
  check("10d. stage is execute", stageOf(project.id) === "execute");

  // Step 11–12 — governed execution; artifacts auto-return to the workspace.
  const probeBefore = probeEffort({
    workspaceDir: WORKSPACE_DIR,
    level: "minimal",
    plannedCalls: 1,
    priorIterations: 0,
  });
  check("11. probe estimates before execution", probeBefore.expectedTokens > 0);
  const exec = await runExecute({
    projectId: project.id,
    level: "minimal",
    runtime,
    scripted: true,
  });
  check("12. artifacts returned automatically", exec.artifacts.length === 1);
  check(
    "12b. artifact content is on disk",
    exec.artifacts.every((p) => readText(p).length > 0),
  );
  const actual = buildActual({
    estimate: probeBefore,
    level: "minimal",
    meters: exec.meters,
    retriesUsed: exec.retriesUsed,
    outcome: "ok",
  });
  check("12c. effort actual reports estimate-vs-real", Number.isFinite(actual.tokensDeltaPct));
  check(
    "12d. artifacts are immutable once produced",
    (() => {
      try {
        writeArtifactOnce(exec.artifacts[0] ?? "", "overwrite attempt");
        return false;
      } catch {
        return true;
      }
    })(),
  );
  check("12e. stage is advance", stageOf(project.id) === "advance");
  check(
    "12f. the artifact carries a provenance sidecar (even with an empty library)",
    readJson<ArtifactProvenance>(
      (exec.artifacts[0] ?? "").replace(/\.md$/, ".provenance.json"),
    ).workOrderId !== "",
  );

  // Step 13 — the loop repeats.
  const advanced = advanceIteration(project.id, true);
  check("13. iteration advanced", advanced.iteration === 2);
  check("13b. stage returns to consult", stageOf(project.id) === "consult");

  // ADR-0020 — the Human Intelligence slice: the user's judgement enters as
  // a candidate GuruSeed, is admitted by the user, composes into a Mentor,
  // and from then on the Seed Resolver schedules it into every applicable
  // work order — visibly, with the trail on the asset itself.
  const seed = addCandidateSeedGoverned(
    project.id,
    {
      title: "Prefer the shortest honest option",
      rule: "When two options are equal, the shorter one wins.",
      why: "brevity is a durable preference of this owner",
      domains: [],
      projectLocal: false,
      provenanceNote: "smoke: the owner's own hand",
    },
    true,
  );
  check("20a. seed enters as candidate", seed.status === "candidate");
  check(
    "20b. candidate seeds are never resolved",
    resolveSeeds({ projectId: project.id, agentTags: [] }).every(
      (r) => r.seed.id !== seed.id,
    ),
  );
  decideSeedGoverned(project.id, seed.id, "admit", undefined, true);
  const mentor = saveMentorGoverned(
    project.id,
    {
      title: "Smoke Mentor",
      persona: "brevity above all",
      seedIds: [seed.id],
      selectionNotes: ["prefer project-local seeds when relevant"],
    },
    true,
  );
  check("20c. mentor composed from the admitted seed", mentor.seeds.length === 1);
  await runConsult({ projectId: project.id, level: "minimal", runtime, scripted: true });
  const it2wo = readWorkOrders(project.id, 2).find((w) => w.kind === "consult");
  const it2manifest = it2wo
    ? readJson<ContextManifest>(
        abs(
          projectDir(project.id),
          "iterations",
          "it-002",
          "workorders",
          it2wo.id,
          "manifest.json",
        ),
      )
    : null;
  check(
    "20d. the Resolver put the seed in the consult manifest with a reason",
    it2manifest?.elements.some(
      (el) => el.kind === "expertise" && el.ref.id === seed.id && el.selectionReason !== "",
    ) === true,
  );
  check(
    "20e. the application trail lives on the seed itself",
    getSeed(seed.id)?.applied_in.some((a) => a.workOrder === it2wo?.id) === true,
  );

  // The Decision Surface slice (GOVERNANCE-INTERACTION-MODEL): options,
  // refinement with lineage, selection folding into the candidate state.
  const ds = await runDecisionSurface({
    projectId: project.id,
    level: "minimal",
    runtime,
    scripted: true,
  });
  check(
    "20f. at least two genuinely distinct options",
    ds.options.length >= 2 &&
      new Set(ds.options.map((o) => o.direction)).size === ds.options.length,
  );
  check(
    "20g. the mentor's voice is attributed on its option",
    ds.options.some((o) => o.seeds.some((s) => s.mentorId === mentor.id)),
  );
  check("20h. stage is decide while the surface is open", stageOf(project.id) === "decide");
  const firstOption = ds.options[0]?.id ?? "option-a";
  const { option: refined, candidateSeed } = await refineOption({
    projectId: project.id,
    dsId: ds.id,
    optionId: firstOption,
    instruction: "menos dramático, mais físico",
    runtime,
    scripted: true,
  });
  check(
    "20i. refinement created v2 and preserved the original",
    refined.version === 2 &&
      refined.parent?.version === 1 &&
      readSurfaces(project.id)[0]?.options.filter((o) => o.id === firstOption).length === 2,
  );
  check(
    "20j. the refinement extracted a candidate seed for governance",
    getCandidate(candidateSeed.id) !== null,
  );
  const decided = selectOption(project.id, ds.id, firstOption, 2, true);
  check(
    "20k. the Pilot's selection closes the surface on the refined version",
    decided.status === "decided" && decided.selected?.version === 2,
  );
  check("20l. stage moves to candidate", stageOf(project.id) === "candidate");
  await runCandidate({ projectId: project.id, level: "minimal", runtime, scripted: true });
  const synthWo = readWorkOrders(project.id, 2)
    .filter((w) => w.kind === "synthesize")
    .pop();
  const synthManifest = synthWo
    ? readJson<ContextManifest>(
        abs(
          projectDir(project.id),
          "iterations",
          "it-002",
          "workorders",
          synthWo.id,
          "manifest.json",
        ),
      )
    : null;
  check(
    "20m. the decided surface is authoritative context for the candidate",
    synthManifest?.elements.some((el) => el.ref.id === ds.id) === true,
  );

  // The artifact declares its provenance (gap audit, critical row): approve
  // the it-2 candidate, execute, and the sidecar must name the seed, its
  // version, and the Resolver's reason — artifact → expertise, by reference.
  decideCandidate(project.id, "approve", undefined, true);
  const exec2 = await runExecute({
    projectId: project.id,
    level: "minimal",
    runtime,
    scripted: true,
  });
  const prov = readJson<ArtifactProvenance>(
    (exec2.artifacts[0] ?? "").replace(/\.md$/, ".provenance.json"),
  );
  check(
    "20t. the artifact declares the seeds that shaped it",
    prov.seeds.some((s) => s.id === seed.id && s.version >= 1 && s.reason !== ""),
  );
  check(
    "20u. artifact provenance is visible through listArtifacts",
    listArtifacts(project.id).some(
      (a) => a.iteration === 2 && a.seeds?.some((s) => s.id === seed.id) === true,
    ),
  );

  // The evidence returns to the seed (ADR-0020, Consequences) — only by the
  // user's hand, on the asset itself and in its append-only file.
  const graded = recordSeedEvidenceGoverned(
    project.id,
    seed.id,
    "supporting",
    "the smoke artifact honored brevity",
    true,
  );
  check(
    "20v. the user's evidence lands on the seed record",
    graded.evidence.supporting.length === 1 && graded.evidence.contradicting.length === 0,
  );
  check(
    "20w. the seed's evidence.jsonl is append-only on disk",
    readText(seedYamlPath(graded).replace(/seed\.yaml$/, "evidence.jsonl"))
      .trim()
      .split("\n").length === 1,
  );

  // Immutable provenance (parecer 2026-07-12): versioned content is
  // write-once per version; telemetry lives beside it, never inside it;
  // artifact, manifest and seed all carry verifiable hashes.
  check(
    "22a. seed.yaml carries no telemetry — sidecars only",
    (() => {
      const y = readText(seedYamlPath(graded));
      return !y.includes("applied_in:") && !y.includes("evidence:") && y.includes("content_hash:");
    })(),
  );
  check(
    "22b. the admitted v1 is recoverable from versions/",
    getSeedVersion(seed.id, 1)?.rule === "When two options are equal, the shorter one wins.",
  );
  const revised = reviseSeedGoverned(
    project.id,
    seed.id,
    { rule: "When two options are equal, the shorter honest one wins." },
    true,
  );
  check(
    "22c. revision bumps to v2 and v1 stays untouched",
    revised.version === 2 &&
      getSeedVersion(seed.id, 2)?.rule === revised.rule &&
      getSeedVersion(seed.id, 1)?.rule !== revised.rule,
  );
  check(
    "22d. content hashes are real and version-specific",
    (() => {
      const v1 = getSeedVersion(seed.id, 1);
      const v2 = getSeedVersion(seed.id, 2);
      return (
        (v1?.content_hash ?? "").length === 64 &&
        (v2?.content_hash ?? "").length === 64 &&
        v1?.content_hash !== v2?.content_hash
      );
    })(),
  );
  check(
    "22e. a written version is immutable on disk",
    (() => {
      try {
        writeArtifactOnce(abs(seedYamlPath(graded), "..", "versions", "v1.yaml"), "overwrite");
        return false;
      } catch {
        return true;
      }
    })(),
  );
  check(
    "22f. artifact provenance carries verifiable hashes (artifact, manifest, seed)",
    (() => {
      const artifactText = readText(exec2.artifacts[0] ?? "");
      const manifestText = readText(
        abs(
          projectDir(project.id),
          "iterations",
          "it-002",
          "workorders",
          prov.workOrderId,
          "manifest.json",
        ),
      );
      return (
        prov.artifactSha256 === sha256(artifactText) &&
        prov.manifestSha256 === sha256(manifestText) &&
        prov.seeds.every((s) => (s.contentHash ?? "").length === 64)
      );
    })(),
  );
  const mentor2 = saveMentorGoverned(
    project.id,
    {
      title: "Smoke Mentor",
      persona: "brevity above all, honesty above brevity",
      seedIds: [seed.id],
      selectionNotes: [],
    },
    true,
  );
  check(
    "22g. mentor revision bumps and v1 stays recoverable from history/",
    mentor2.version === 2 &&
      getMentorVersion(mentor.id, 1)?.persona === "brevity above all" &&
      getMentorVersion(mentor.id, 2)?.seeds.some((s) => s.id === seed.id && s.version === 2) === true,
  );

  // The story: the whole project, including the new lineage, from disk.
  const story = storyOf(project.id);
  const flat = story.iterations.flatMap((i) => i.items);
  check("20n. story opens with the founding intent", story.intent.name === "Smoke Loop");
  check(
    "20o. contributions carry mandate + output (provenance, not reasoning)",
    flat.some((i) => i.action === "consulted" && i.mandate && i.output),
  );
  check(
    "20p. a contribution shows the seed it received and why",
    flat.some((i) => i.expertise?.some((e) => e.id === seed.id && e.reason !== "")),
  );
  check(
    "20q. the full decision lineage is in the story",
    ["decision_opened", "option_refined", "seed_candidate_extracted", "option_selected"].every(
      (a) => flat.some((i) => i.action === a),
    ),
  );
  check(
    "20r. governance moments are in the story",
    flat.some((i) => i.action === "state_approved") &&
      flat.some((i) => i.action === "seed_admitted") &&
      flat.some((i) => i.action === "mentor_saved"),
  );
  check(
    "20s. the interview is in the story with question and answer",
    flat.some((i) => i.action === "question_answered" && i.questionText && i.answer),
  );
  check(
    "20x. the evidence moment is in the story",
    flat.some((i) => i.action === "seed_evidence" && i.actor === "pilot"),
  );
  check(
    "22h. the revision moment is in the story as the user's",
    flat.some((i) => i.action === "seed_revised" && i.actor === "pilot"),
  );

  // Cross-cutting invariants.
  const wos = readWorkOrders(project.id, 1);
  check("manifests exist for every work order", wos.length > 0 && wos.every((w) => {
    const m = abs(projectDir(project.id), "iterations", "it-001", "workorders", w.id, "manifest.json");
    return existsSync(m) && readJson<ContextManifest>(m).elements.length > 0;
  }));
  const events = readEvents(project.id);
  const order = ["project_init", "roster_ready", "consulted", "question_answered", "reconsulted", "candidate_built", "state_rejected", "state_approved", "execution_started", "artifact_returned", "iteration_advanced"];
  check(
    "evidence log contains the whole loop",
    order.every((a) => events.some((e) => e.action === a)),
    order.filter((a) => !events.some((e) => e.action === a)).join(","),
  );
  check("all smoke evidence is scripted", events.every((e) => e.scripted));
  check(
    "smoke meters never feed the probe",
    collectMeterSamples(WORKSPACE_DIR).length === samplesBefore,
    `before=${samplesBefore} after=${collectMeterSamples(WORKSPACE_DIR).length}`,
  );
  check("smoke project id carries the smoke- prefix", project.id.startsWith("smoke-"));

  // ADR-0020 §3 — "enough; build with what you have" is a first-class
  // governance act: open questions defer (kept, never dropped), the loop
  // moves on, and the candidate carries the deferral visibly.
  if (existsSync(projectDir("smoke-enough"))) {
    rmSync(projectDir("smoke-enough"), { recursive: true, force: true });
  }
  const p2 = initProject("Smoke Enough", "Prove the governed sufficiency exit.", true);
  await runConsult({ projectId: p2.id, level: "minimal", runtime, scripted: true });
  check("21a. the interview opens with questions on the table", openQuestions(p2.id).length > 0);
  const deferredN = declareContextSufficient(p2.id, "enough for the smoke", true);
  check(
    "21b. declaring sufficiency defers every open question",
    deferredN > 0 && openQuestions(p2.id).length === 0,
  );
  check("21c. the stage moves on without an answer", stageOf(p2.id) === "candidate");
  check(
    "21d. deferred questions are kept, never dropped",
    readQuestions(p2.id).some((q) => q.status === "deferred"),
  );
  await runCandidate({ projectId: p2.id, level: "minimal", runtime, scripted: true });
  const synthEnough = readWorkOrders(p2.id, 1)
    .filter((w) => w.kind === "synthesize")
    .pop();
  const synthEnoughManifest = synthEnough
    ? readJson<ContextManifest>(
        abs(
          projectDir(p2.id),
          "iterations",
          "it-001",
          "workorders",
          synthEnough.id,
          "manifest.json",
        ),
      )
    : null;
  check(
    "21e. the candidate context carries the deferral visibly",
    synthEnoughManifest?.elements.some((el) => el.ref.id === "context-sufficient") === true,
  );
  check(
    "21f. the sufficiency act is in the story as the user's",
    storyOf(p2.id)
      .iterations.flatMap((i) => i.items)
      .some((i) => i.action === "context_sufficient" && i.actor === "pilot"),
  );

  // Project lifecycle (parecer 2026-07-12): concluding is a governed act —
  // freeze and archive, never delete; reopening leaves evidence.
  const closed = concludeProject(p2.id, "provou a saída de suficiência", true);
  check(
    "23a. concluding freezes the project with the Pilot's note",
    closed.status === "concluded" &&
      closed.concludedNote === "provou a saída de suficiência" &&
      typeof closed.concludedAt === "string",
  );
  check(
    "23b. nothing is deleted — story, questions and state survive the archive",
    storyOf(p2.id).iterations.length > 0 && readQuestions(p2.id).length > 0,
  );
  check(
    "23c. the conclusion is evidence, actor pilot",
    readEvents(p2.id).some((e) => e.action === "project_concluded" && e.actor === "pilot"),
  );
  check("23d. concluding twice is idempotent", concludeProject(p2.id, undefined, true).concludedAt === closed.concludedAt);
  const reopened = reopenProject(p2.id, true);
  check(
    "23e. reopening restores the active state and leaves evidence",
    (reopened.status ?? "active") === "active" &&
      reopened.concludedAt === undefined &&
      readEvents(p2.id).some((e) => e.action === "project_reopened" && e.actor === "pilot"),
  );

  console.log(`\n${passed}/${passed + failed} checks passed`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error("smoke crashed:", e);
  process.exit(1);
});
