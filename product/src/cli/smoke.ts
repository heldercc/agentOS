// Smoke test: the full 13-step Product Loop (docs/PRODUCT-LOOP.md) exercised
// end-to-end on the fake runtime, at zero cost. Scripted evidence only —
// the smoke project id starts with "smoke-" so its meters never feed the
// Effort Probe and its events never read as the user's.

import { existsSync, mkdirSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { relative } from "node:path";

import { appendEvent, readEvents } from "../evidence.js";
import { collectMeterSamples, probeEffort } from "../effort.js";
import {
  addCandidateSeedGoverned,
  advanceIteration,
  answerQuestion,
  answerQuestions,
  appendOperationActual,
  concludeProject,
  decideCandidate,
  decideSeedGoverned,
  declareContextSufficient,
  getProject,
  initProject,
  listArtifacts,
  openQuestions,
  planStepsBack,
  readApproved,
  readProjectMap,
  readOperationActuals,
  readQuestions,
  readRoster,
  readSurfaces,
  readWorkOrders,
  readCandidate,
  recordSeedEvidenceGoverned,
  refineOption,
  reopenDeferredQuestions,
  reopenProject,
  revokeApproval,
  setAsideOpenSurface,
  withdrawCandidate,
  reviseSeedGoverned,
  runCandidate,
  runConsult,
  runDecisionSurface,
  runExecute,
  runProjectSlicer,
  approveCandidateProjectMap,
  moveProjectSlice,
  nextProjectSlice,
  saveSenseiGoverned,
  selectOption,
  setEffortProfile,
  stageOf,
  stepBackTo,
  storyOf,
  topOpenQuestion,
  routeQuestionToDecision,
  type ArtifactProvenance,
  type OnMeter,
  type OnPhase,
} from "../kernel.js";
import {
  getCandidate,
  getSensei,
  getSenseiVersion,
  getSeed,
  getSeedVersion,
  seedYamlPath,
  saveSensei,
  senseiGraduation,
  senseiOwnershipSanity,
  senseiSanity,
  senseiVictories,
  snapshotSenseiBase,
} from "../hi.js";
import { resolveSeeds } from "../resolver.js";
import { computeStaleness } from "../build.js";
import { buildActual } from "../effort.js";
import { LIVE_WORKSPACE_DIR, PKG_ROOT, projectDir, workspaceRoot } from "../paths.js";
import {
  abs,
  containedPath,
  readJson,
  readJsonl,
  readText,
  sha256,
  writeArtifactOnce,
  writeJson,
} from "../stores.js";
import { bodyTooLarge, hostAllowed, originAllowed } from "../http-guards.js";
import {
  FakeRuntime,
  OpCancelledError,
  type GenerateArgs,
  type Runtime,
} from "../runtime.js";
import { classifyPollOutcome, shouldApplyPoll } from "../poll-logic.js";
import type { ContextManifest, EvidenceEvent, ModelResult, OperationActual } from "../types.js";
import { validateProject } from "../validate.js";
import { applyMigrations, inspectMigrationState, type Migration } from "../migrations.js";
import { recoverTransitions, withTransition } from "../transitions.js";
import { assertModuleRegistry, MODULES } from "../module-registry.js";

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

  // RULE A (ADR-0023): the smoke redirects the ENTIRE data tree — workspace
  // AND Human Intelligence library — before touching anything. Scripted work
  // never enters the Pilot's live workspace, metrics, expertise or evidence
  // BY CONSTRUCTION, not by name-based filtering. Both roots are disposable.
  process.env["PRODUCT_WORKSPACE_DIR"] = "workspace-smoke";
  const smokeWs = workspaceRoot();
  if (existsSync(smokeWs)) rmSync(smokeWs, { recursive: true, force: true });
  const smokeHi = abs(smokeWs, "..", "smoke-hi");
  if (existsSync(smokeHi)) rmSync(smokeHi, { recursive: true, force: true });
  process.env["PRODUCT_HI_DIR"] = smokeHi;
  check(
    "RULE A. smoke workspace is isolated from the Pilot's live one",
    workspaceRoot() !== LIVE_WORKSPACE_DIR && projectDir("smoke-loop").startsWith(smokeWs),
  );
  const sourcePaths: string[] = [];
  const walkTs = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = abs(dir, entry.name);
      if (entry.isDirectory()) walkTs(path);
      else if (entry.name.endsWith(".ts")) sourcePaths.push(relative(PKG_ROOT, path).replace(/\\/g, "/"));
    }
  };
  walkTs(abs(PKG_ROOT, "src"));
  let registryComplete = true;
  try { assertModuleRegistry(sourcePaths); } catch { registryComplete = false; }
  check("MODULE 1. every durable TypeScript module is registered", registryComplete);
  check("MODULE 2. every registration declares boundary, contract, tests and doctrine", MODULES.every((item) => item.authorityBoundary.length > 0 && item.contractVersion.length > 0 && item.tests.length > 0 && item.doctrine.length > 0));

  // PHASE 2.1 — canonical records survive every deterministic crash window;
  // append-only logs tolerate only a torn FINAL line (ADR-0023 RULE D).
  const safetyDir = abs(smokeWs, "_store-safety");
  mkdirSync(safetyDir, { recursive: true });
  const x = abs(safetyDir, "x.json");
  writeJson(x, { version: 1 });
  writeJson(x, { version: 2 });
  check("STORE 1. two writes preserve v1 in .prev", readJson<{ version: number }>(x + ".prev").version === 1);
  writeFileSync(x + ".tmp", "not-json", "utf8");
  check("STORE 2. stale garbage .tmp never shadows the good main", readJson<{ version: number }>(x).version === 2);
  writeJson(x, { version: 3 });
  check("STORE 2b. the next atomic write replaces and removes stale .tmp", !existsSync(x + ".tmp"));

  const y = abs(safetyDir, "y.json");
  writeJson(y, { recovered: true });
  renameSync(y, y + ".prev");
  check("STORE 3. missing main recovers its valid .prev", readJson<{ recovered: boolean }>(y).recovered);

  const z = abs(safetyDir, "z.json");
  writeJson(z, { version: 1 });
  writeJson(z, { version: 2 });
  writeFileSync(z, "{broken", "utf8");
  let corruptNamedPrevious = false;
  try {
    readJson(z);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    corruptNamedPrevious = message.includes(z) && message.includes(z + ".prev");
  }
  check("STORE 4. corrupt main with valid .prev throws and names both", corruptNamedPrevious);

  const log = abs(safetyDir, "events.jsonl");
  writeFileSync(log, '{"n":1}\n{"n":2}\n{"n":', "utf8");
  const whole = readJsonl<{ n: number }>(log);
  check("STORE 5. a torn JSONL tail is skipped without losing whole records", whole.length === 2 && whole[1]?.n === 2);
  writeFileSync(log, '{"n":1}\nBROKEN\n{"n":2}\n', "utf8");
  let middleCorruptionThrows = false;
  try { readJsonl(log); } catch { middleCorruptionThrows = true; }
  check("STORE 5b. JSONL corruption in the middle still throws", middleCorruptionThrows);

  // PHASE 2.2 pure perimeter gates — no server and no live data involved.
  check("HTTP 1. loopback Host is accepted", hostAllowed("localhost:4900", 4900));
  check("HTTP 2. foreign Host is rejected", !hostAllowed("evil.example", 4900));
  check("HTTP 3. same Origin is accepted", originAllowed("http://127.0.0.1:4900", 4900));
  check("HTTP 4. foreign Origin is rejected", !originAllowed("https://evil.example", 4900));
  check("HTTP 5. body limit trips only above 1 MB", !bodyTooLarge(1024 * 1024) && bodyTooLarge(1024 * 1024 + 1));
  check("HTTP 6. contained paths stay in root", containedPath(safetyDir, "child", "x.json") !== null);
  check("HTTP 7. traversal and absolute paths escape no root", containedPath(safetyDir, "..", "escape") === null && containedPath(safetyDir, "C:\\escape") === null);
  let validationNamesField = false;
  try {
    validateProject({ id: "bad", name: "Bad", description: "Bad", createdAt: "now", iteration: "one" }, "bad-project.json");
  } catch (e) {
    validationNamesField = e instanceof Error && e.message.includes("bad-project.json.iteration");
  }
  check("VALIDATE 1. wrong-typed records fail with record and field", validationNamesField);

  const migrationRoot = abs(smokeWs, "_migration-safety");
  const failingMigration: Migration = {
    id: "smoke-1-to-2",
    fromSchema: 1,
    toSchema: 2,
    dryRun: () => [],
    apply: () => { throw new Error("simulated migration crash"); },
    validate: () => undefined,
  };
  const failedMigration = applyMigrations(migrationRoot, 2, [failingMigration]);
  check("MIGRATE 1. a failed migration forces read-only safe mode", failedMigration.safeMode && failedMigration.reason?.includes("smoke-1-to-2") === true);
  const aheadRoot = abs(smokeWs, "_migration-ahead");
  writeJson(abs(aheadRoot, "_meta", "schema.json"), { version: 99 });
  check("MIGRATE 2. data ahead of code forces safe mode", inspectMigrationState(aheadRoot, 1).safeMode);

  const transitionRoot = abs(smokeWs, "_transition-safety");
  const oldFile = abs(transitionRoot, "old.json");
  const newFile = abs(transitionRoot, "new.json");
  writeJson(oldFile, { state: "old" });
  try {
    withTransition(transitionRoot, "smoke-crash", [oldFile, newFile], () => {
      writeJson(oldFile, { state: "new" });
      writeJson(newFile, { state: "new" });
      throw new Error("simulated transition crash");
    });
  } catch {
    // expected: withTransition restores the complete before-image
  }
  recoverTransitions(transitionRoot);
  check(
    "TRANSITION 1. crash recovery yields the complete old state, never half",
    readJson<{ state: string }>(oldFile).state === "old" && !existsSync(newFile),
  );

  // Real meters, if any exist, must be exactly as many after the smoke:
  // scripted work never feeds the Effort Probe. With RULE A isolation the
  // live workspace is untouchable from here; the count guards the invariant
  // inside the isolated root too.
  const samplesBefore = collectMeterSamples(workspaceRoot()).length;

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

  // Ponto D — the per-phase effort profile is the Pilot's standing strategy:
  // internal movement (the automatic re-consult) must run at HIS "questions"
  // level, not at the automation clamp.
  setEffortProfile(
    project.id,
    { questions: "balanced", options: "low", execution: "minimal" },
    true,
  );
  check(
    "D1. the effort profile persists on the project",
    getProject(project.id).effortProfile?.questions === "balanced",
  );

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
  check(
    "D2. the automatic re-consult ran at the profile's questions level",
    readWorkOrders(project.id, 1)
      .filter((w) => w.kind === "reconsult")
      .every((w) => w.effortLevel === "balanced") &&
      readWorkOrders(project.id, 1).some((w) => w.kind === "reconsult"),
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
    workspaceDir: workspaceRoot(),
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

  // ADR-0020 + the Sensei reform — the Human Intelligence slice: the Sensei
  // of ONE craft exists first; the user's judgement enters as a candidate
  // GuruSeed, is admitted TO that Sensei (ownership, ponto A), and from then
  // on the Resolver schedules it only through the Sensei whose craft overlaps
  // the agent's tags — never transversally.
  const sensei = saveSenseiGoverned(
    project.id,
    {
      title: "Smoke Sensei",
      persona: "brevity above all",
      domains: ["intent", "craft"],
      seedIds: [],
      selectionNotes: ["prefer project-local seeds when relevant"],
    },
    true,
  );
  check("20a0. the sensei starts at v1, faixa branca", sensei.version === 1 && senseiGraduation(0) === "faixa branca");
  check("F2a. the reference photo is taken once", snapshotSenseiBase(sensei.id) === true);
  check("F2b. the photo is write-once", snapshotSenseiBase(sensei.id) === false);
  const seed = addCandidateSeedGoverned(
    project.id,
    {
      title: "Prefer the shortest honest option",
      rule: "When two options are equal, the shorter one wins.",
      why: "brevity is a durable preference of this owner",
      domains: ["craft"],
      projectLocal: false,
      provenanceNote: "smoke: the owner's own hand",
      sensei: sensei.id,
    },
    true,
  );
  check("20a. seed enters as candidate", seed.status === "candidate");
  check(
    "20b. candidate seeds are never resolved",
    resolveSeeds({ projectId: project.id, agentTags: ["intent", "craft"] }).every(
      (r) => r.seed.id !== seed.id,
    ),
  );
  decideSeedGoverned(project.id, seed.id, "admit", undefined, true, sensei.id);
  check(
    "20c. admission assigns canonical ownership and the Sensei index derives it",
    getSeed(seed.id)?.sensei === sensei.id &&
      getSensei(sensei.id)?.seeds.some((p) => p.id === seed.id) === true &&
      getSensei(sensei.id)?.version === 1,
  );
  let divergenceRejected = false;
  try {
    saveSensei({
      id: sensei.id,
      title: sensei.title,
      persona: sensei.persona,
      domains: sensei.domains,
      seedIds: [],
      selectionNotes: sensei.selection_notes,
    });
  } catch {
    divergenceRejected = true;
  }
  check("20c2. public API rejects a divergent Sensei.seeds edit", divergenceRejected);
  check("20c3. canonical ownership sanity is healthy", senseiOwnershipSanity().healthy);
  check(
    "A1. no owner overlap, no entry — transversality is dead",
    resolveSeeds({ projectId: project.id, agentTags: [] }).length === 0 &&
      resolveSeeds({ projectId: project.id, agentTags: ["unrelated-tag"] }).length === 0 &&
      resolveSeeds({ projectId: project.id, agentTags: ["intent"] }).some(
        (r) => r.seed.id === seed.id && r.senseiId === sensei.id,
      ),
  );
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
    "20g. the sensei's voice is attributed on its option, seeds included",
    ds.options.some(
      (o) => o.senseiId === sensei.id && o.seeds.some((s) => s.senseiId === sensei.id),
    ),
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
  // Ponto C — the pick IS the fight won: the victory returns to the ONE
  // Sensei whose voice was chosen, append-only, and the graduation follows.
  const wins = senseiVictories(sensei.id);
  check(
    "C1. the victory landed on the picked sensei only",
    wins.length === 1 && wins[0]?.dsId === ds.id && wins[0]?.optionId === firstOption,
  );
  check(
    "C2. graduation derives from victories (faixa amarela at 1)",
    senseiGraduation(wins.length) === "faixa amarela",
  );
  check(
    "C3. the victory is evidence",
    readEvents(project.id).some((e) => e.action === "sensei_victory"),
  );
  check(
    "F2c. sanity vs the photo shows what the sensei learned",
    (() => {
      const s = getSensei(sensei.id);
      if (!s) return false;
      const sa = senseiSanity(s);
      return sa.hasBase && sa.baseVersion === 1 && sa.seedsAdded.includes(seed.id);
    })(),
  );
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
  const sensei3 = saveSenseiGoverned(
    project.id,
    {
      id: sensei.id,
      title: "Smoke Sensei",
      persona: "brevity above all, honesty above brevity",
      domains: ["intent", "craft"],
      seedIds: [seed.id],
      selectionNotes: [],
    },
    true,
  );
  check(
    "22g. sensei revision bumps and v1 stays recoverable from history/",
    sensei3.version === 2 &&
      getSenseiVersion(sensei.id, 1)?.persona === "brevity above all" &&
      getSenseiVersion(sensei.id, 2)?.seeds.some((s) => s.id === seed.id && s.version === 2) === true,
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
      flat.some((i) => i.action === "sensei_saved"),
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
    collectMeterSamples(workspaceRoot()).length === samplesBefore,
    `before=${samplesBefore} after=${collectMeterSamples(workspaceRoot()).length}`,
  );
  check("smoke project id carries the smoke- prefix", project.id.startsWith("smoke-"));

  // PHASE 1.1 (ADR-0022) — product-aware staleness, acceptance gates 1 and 2:
  // a docs-only commit must NOT mark the product stale; a product-source
  // commit MUST. Tested pure — no git fixtures, no live repo dependence.
  const docsOnly = computeStaleness({
    buildSha: "aaa1111", buildProductSha: "ppp1111",
    repoHead: "bbb2222", productHead: "ppp1111", dirtyProductFiles: 0,
  });
  check("gate 1. docs-only commit does not mark the product stale", !docsOnly.stale);
  check("gate 1b. docs-only movement is disclosed as such", docsOnly.repoMovedDocsOnly);
  const productMoved = computeStaleness({
    buildSha: "aaa1111", buildProductSha: "ppp1111",
    repoHead: "ccc3333", productHead: "ppp2222", dirtyProductFiles: 0,
  });
  check("gate 2. product-source commit marks the product stale", productMoved.stale);
  check("gate 2b. product movement is never softened to docs-only", !productMoved.repoMovedDocsOnly);
  const inPlace = computeStaleness({
    buildSha: "aaa1111", buildProductSha: "ppp1111",
    repoHead: "aaa1111", productHead: "ppp1111", dirtyProductFiles: 2,
  });
  check("gate 2c. dirty product files are disclosed without a stale claim",
    !inPlace.stale && inPlace.dirtyProduct);

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

  // Governed back-and-forth (ADR-0022 decision 14): reopening deferred
  // questions is pure navigation — Compreender returns, at ZERO token cost.
  const wosBeforeReopen = readWorkOrders(p2.id, 1).length;
  const reopenedN = reopenDeferredQuestions(p2.id, true);
  check("14a. reopening returns every deferred question", reopenedN === deferredN && openQuestions(p2.id).length === deferredN);
  check("14b. the stage returns to interview", stageOf(p2.id) === "interview");
  check(
    "14c. navigation costs zero tokens — no new work orders",
    readWorkOrders(p2.id, 1).length === wosBeforeReopen,
  );
  check(
    "14d. the reopening is governed evidence, actor pilot",
    readEvents(p2.id).some((e) => e.action === "questions_reopened" && e.actor === "pilot"),
  );
  // Defer again so the sufficiency flow below continues exactly as before.
  declareContextSufficient(p2.id, "enough again for the smoke", true);
  check("14e. sufficiency can be declared again after reopening", stageOf(p2.id) === "candidate");

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

  // Ponto J — the table size is the Pilot's explicit choice (2-4), decoupled
  // from the effort level; each extra option is one extra call, nothing more.
  const ds3 = await runDecisionSurface({
    projectId: p2.id,
    level: "minimal",
    runtime,
    scripted: true,
    optionsCount: 3,
  });
  check(
    "J1. three options at minimal effort when the Pilot asks for three",
    ds3.options.length === 3,
    `got ${ds3.options.length}`,
  );
  selectOption(p2.id, ds3.id, ds3.options[0]?.id ?? "option-a", 1, true);

  // Governed back-and-forth across the WHOLE journey (ADR-0022 decision 14):
  // from Decidir, Aprovar and Criar the Pilot steps back at zero token cost;
  // nothing is deleted, stageOf re-derives, evidence carries every act.
  if (existsSync(projectDir("smoke-backforth"))) {
    rmSync(projectDir("smoke-backforth"), { recursive: true, force: true });
  }
  const pBack = initProject("Smoke Backforth", "Prove governed back-and-forth in every stage.", true);
  await runConsult({ projectId: pBack.id, level: "minimal", runtime, scripted: true });
  declareContextSufficient(pBack.id, "enough for the backforth proof", true);
  await runCandidate({ projectId: pBack.id, level: "minimal", runtime, scripted: true });
  check("14f. a proposal is on the table (Aprovar)", stageOf(pBack.id) === "approve");
  const wosBeforeWithdraw = readWorkOrders(pBack.id, 1).length;
  withdrawCandidate(pBack.id, true);
  check(
    "14g. withdrawing steps back and keeps the proposal on file",
    stageOf(pBack.id) === "candidate" && readCandidate(pBack.id)?.status === "withdrawn",
  );
  check("14h. stepping back from Aprovar costs zero work orders", readWorkOrders(pBack.id, 1).length === wosBeforeWithdraw);
  const dsBack = await runDecisionSurface({ projectId: pBack.id, level: "minimal", runtime, scripted: true, optionsCount: 2 });
  check("14i. an open Decision Surface puts the project in Decidir", stageOf(pBack.id) === "decide");
  setAsideOpenSurface(pBack.id, true);
  check(
    "14j. setting the decision aside steps back with the options on record",
    stageOf(pBack.id) === "candidate" && readSurfaces(pBack.id).some((d) => d.id === dsBack.id && d.status === "dismissed"),
  );
  await runCandidate({ projectId: pBack.id, level: "minimal", runtime, scripted: true });
  decideCandidate(pBack.id, "approve", undefined, true);
  check("14k. approved — Criar is next", stageOf(pBack.id) === "execute");
  const wosBeforeRevoke = readWorkOrders(pBack.id, 1).length;
  revokeApproval(pBack.id, true);
  check(
    "14l. revoking the approval returns to Aprovar with no approved state in force",
    stageOf(pBack.id) === "approve" && readApproved(pBack.id) === null,
  );
  check("14m. the revoked snapshot is preserved in history", readdirSync(abs(projectDir(pBack.id), "state", "history")).some((n) => n.includes("revoked")));
  check("14n. stepping back from Criar costs zero work orders", readWorkOrders(pBack.id, 1).length === wosBeforeRevoke);
  decideCandidate(pBack.id, "approve", undefined, true);
  check("14o. re-approval works after revocation", stageOf(pBack.id) === "execute" && readApproved(pBack.id)?.iteration === 1);
  check(
    "14p. every back-and-forth act is governed evidence, actor pilot",
    ["candidate_withdrawn", "decision_dismissed", "approval_revoked"].every((a) =>
      readEvents(pBack.id).some((e) => e.action === a && e.actor === "pilot"),
    ),
  );

  // The journey bar's compositor: one click walks the WHOLE chain of governed
  // acts — planned first (pure), executed only when the full path is clear,
  // each act leaving its own evidence. Never a fifth mechanism (ADR-0022 §4).
  const wosBeforeChain = readWorkOrders(pBack.id, 1).length;
  const chain = stepBackTo(pBack.id, "interview", true);
  check(
    "14q. stepBackTo(interview) from Criar walks revoke → withdraw → reopen in one call",
    stageOf(pBack.id) === "interview" && chain.length === 3 && openQuestions(pBack.id).length > 0,
  );
  const chainActs = readEvents(pBack.id).map((e) => e.action);
  check(
    "14r. the chain lands its evidence in walking order",
    chainActs.lastIndexOf("approval_revoked") < chainActs.lastIndexOf("candidate_withdrawn") &&
      chainActs.lastIndexOf("candidate_withdrawn") < chainActs.lastIndexOf("questions_reopened"),
  );
  check("14s. the whole chain costs zero work orders", readWorkOrders(pBack.id, 1).length === wosBeforeChain);
  let chainGuard = 0;
  while (topOpenQuestion(pBack.id) !== null && chainGuard < 10) {
    chainGuard += 1;
    const cq = topOpenQuestion(pBack.id);
    if (!cq) break;
    await answerQuestion({
      projectId: pBack.id,
      questionId: cq.id,
      answer: "Answered so nothing stays deferred for the blocked-plan proof.",
      runtime,
      scripted: true,
    });
  }
  check(
    "14t. with nothing deferred the plan is blocked BEFORE the first act",
    (() => {
      if (stageOf(pBack.id) !== "candidate") return false;
      const planned = planStepsBack(pBack.id, "interview");
      if (planned.ok) return false;
      try {
        stepBackTo(pBack.id, "interview", true);
        return false;
      } catch {
        return stageOf(pBack.id) === "candidate";
      }
    })(),
  );
  check(
    "14u. walking forward through the bar is refused",
    (() => {
      try {
        stepBackTo(pBack.id, "approve", true);
        return false;
      } catch {
        return true;
      }
    })(),
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

  // ---------------------------------------------------------------------------
  // LIVE EXECUTION OBSERVABILITY (parecer 2026-07-12, GPT parecer): the
  // deliberately-slow fake runtime is what the shell's live operation card
  // and "Parar esta operação" are verified against in the browser (ponto H).
  // These checks exercise the building blocks at zero cost.
  check(
    "24a. OpCancelledError carries the right name",
    new OpCancelledError("job-x").name === "OpCancelledError",
  );
  check(
    "24b. OpCancelledError's message names the job",
    new OpCancelledError("job-y").message.includes("job-y"),
  );

  process.env["PRODUCT_FAKE_DELAY_MS"] = "400";
  const delayedRuntime = new FakeRuntime();
  const genArgs = {
    system: "smoke system",
    prompt: "agent-id: smoke",
    model: "haiku",
    maxTokens: 10,
    timeoutMs: 5000,
    kind: "consult" as const,
  };

  const alreadyAborted = new AbortController();
  alreadyAborted.abort();
  let sawAlreadyAbortedError = false;
  try {
    await delayedRuntime.generate({ ...genArgs, jobId: "job-already-aborted", signal: alreadyAborted.signal });
  } catch (e) {
    sawAlreadyAbortedError = e instanceof OpCancelledError;
  }
  check(
    "24c. an already-aborted signal rejects immediately with OpCancelledError",
    sawAlreadyAbortedError,
  );

  const midAbort = new AbortController();
  setTimeout(() => midAbort.abort(), 100);
  let sawMidAbortError = false;
  try {
    await delayedRuntime.generate({ ...genArgs, jobId: "job-mid-abort", signal: midAbort.signal });
  } catch (e) {
    sawMidAbortError = e instanceof OpCancelledError;
  }
  check("24d. a signal aborted mid-wait rejects with OpCancelledError", sawMidAbortError);

  let activityCount = 0;
  const delayedResult = await delayedRuntime.generate({
    ...genArgs,
    jobId: "job-heartbeat",
    onActivity: () => {
      activityCount += 1;
    },
  });
  check("24e. onActivity fires at least once during a delayed successful call", activityCount > 0);
  check(
    "24f. the delayed call still returns the deterministic fake answer",
    delayedResult.text.length > 0,
  );

  delete process.env["PRODUCT_FAKE_DELAY_MS"];
  const fastStart = Date.now();
  await delayedRuntime.generate({ ...genArgs, jobId: "job-after-reset" });
  check(
    "24g. resetting PRODUCT_FAKE_DELAY_MS restores the zero-cost default",
    Date.now() - fastStart < 200,
  );

  // "operation_cancelled" round-trips through the append-only evidence log —
  // what the Pilot's "Parar esta operação" writes (actor pilot, ponto E).
  appendEvent({
    ts: new Date().toISOString(),
    projectId: project.id,
    iteration: project.iteration,
    actor: "pilot",
    action: "operation_cancelled",
    note: "consult",
    scripted: true,
  } satisfies EvidenceEvent);
  check(
    "24h. operation_cancelled round-trips through readEvents, actor pilot",
    readEvents(project.id).some(
      (e) => e.action === "operation_cancelled" && e.actor === "pilot" && e.scripted,
    ),
  );

  // ---------------------------------------------------------------------------
  // Poll hardening (ADR-0022 PHASE 1 item 6) — poll-logic.ts is the pure,
  // importable twin of the inline client poll logic hand-mirrored in
  // shell.ts's PAGE template; exercised directly here, deterministically.
  check("P1. shouldApplyPoll accepts a strictly newer response", shouldApplyPoll(3, 4) === true);
  check("P2. shouldApplyPoll rejects a duplicate (equal) response", shouldApplyPoll(4, 4) === false);
  check(
    "P3. shouldApplyPoll rejects an older response arriving after a newer one",
    shouldApplyPoll(5, 4) === false,
  );
  check(
    "P4. classifyPollOutcome: a rejected fetch is a connection failure",
    classifyPollOutcome({ fetchRejected: true, httpStatus: null, parseFailed: false }) ===
      "connection-failure",
  );
  check(
    "P5. classifyPollOutcome: a non-200 status is a data error",
    classifyPollOutcome({ fetchRejected: false, httpStatus: 500, parseFailed: false }) ===
      "data-error",
  );
  check(
    "P6. classifyPollOutcome: a JSON parse failure is a data error",
    classifyPollOutcome({ fetchRejected: false, httpStatus: 200, parseFailed: true }) ===
      "data-error",
  );
  check(
    "P7. classifyPollOutcome: a 200 with a parseable body is ok",
    classifyPollOutcome({ fetchRejected: false, httpStatus: 200, parseFailed: false }) === "ok",
  );

  // ---------------------------------------------------------------------------
  // Operation visibility + persisted actuals (ADR-0022 PHASE 1 items 3/5):
  // the Kernel's onPhase/onMeter callbacks must fire only honest, ordered
  // phases per Work Order, meters must accumulate, and an OperationActual
  // must round-trip through operations.jsonl.
  if (existsSync(projectDir("smoke-observability"))) {
    rmSync(projectDir("smoke-observability"), { recursive: true, force: true });
  }
  const p3 = initProject("Smoke Observability", "Prove honest phase reporting.", true);
  const phaseLog: { phase: string; workOrderId: string; agentId: string }[] = [];
  let meterCalls = 0;
  let tokensSeen = 0;
  const onPhase: OnPhase = (phase, workOrderId, agentId) => {
    phaseLog.push({ phase, workOrderId, agentId });
  };
  const onMeter: OnMeter = (meter) => {
    meterCalls += 1;
    tokensSeen += meter.inputTokens + meter.outputTokens;
  };
  await runConsult({
    projectId: p3.id,
    level: "balanced",
    runtime,
    scripted: true,
    onPhase,
    onMeter,
  });
  const byWo = new Map<string, string[]>();
  for (const e of phaseLog) {
    const list = byWo.get(e.workOrderId) ?? [];
    list.push(e.phase);
    byWo.set(e.workOrderId, list);
  }
  check(
    "OB1. every work order reports response-received, then validating-parsing, then persisting",
    byWo.size > 0 &&
      [...byWo.values()].every((phases) => {
        const rr = phases.indexOf("response-received");
        const vp = phases.indexOf("validating-parsing");
        const pe = phases.indexOf("persisting");
        return rr !== -1 && vp !== -1 && pe !== -1 && rr < vp && vp < pe;
      }),
    JSON.stringify([...byWo.entries()]),
  );
  check(
    "OB2. onMeter fires once per work order and tokens accumulate",
    meterCalls === byWo.size && tokensSeen > 0,
    `meterCalls=${meterCalls} woCount=${byWo.size} tokens=${tokensSeen}`,
  );
  const opStart = new Date(Date.now() - 5000).toISOString();
  const opActual: OperationActual = {
    operationId: "op-smoke-test",
    projectId: p3.id,
    iteration: p3.iteration,
    op: "consult",
    effortLevel: "balanced",
    startedAt: opStart,
    endedAt: new Date().toISOString(),
    outcome: "completed",
    wallMs: 5000,
    queueMs: 10,
    firstFeedbackMs: 120,
    phases: [
      { phase: "queued", at: opStart },
      { phase: "persisting", at: new Date().toISOString() },
    ],
    workOrdersPlanned: byWo.size,
    workOrdersDone: byWo.size,
    tokensInput: 100,
    tokensOutput: 50,
    tokensEstimated: true,
    heartbeatGapMaxMs: 200,
    timeoutMs: 60000,
    models: ["fake:sonnet"],
  };
  appendOperationActual(opActual);
  const readBack = readOperationActuals(p3.id);
  check(
    "OB3. an OperationActual round-trips through operations.jsonl with outcome completed",
    readBack.length === 1 &&
      readBack[0]?.operationId === "op-smoke-test" &&
      readBack[0]?.outcome === "completed" &&
      readBack[0]?.tokensInput === 100,
  );

  // PHASE 2.7 — a cancelled 3-WO execution resumes from the interrupted WO;
  // completed WO1 and its immutable Artifact are reused, never called/written twice.
  const resumeProject = initProject("Smoke Resume", "Prove partial Work Order reuse", true);
  writeJson(abs(projectDir(resumeProject.id), "roster.json"), {
    agents: ["one", "two", "three"].map((id) => ({ id, title: id, mandate: `produce ${id}`, tags: [] })),
    workOrderId: "fixture-roster",
  });
  writeJson(abs(projectDir(resumeProject.id), "state", "approved.json"), {
    iteration: 1,
    approvedAt: new Date().toISOString(),
    state: {
      objective: "resume safely",
      phase: "execution",
      approvedDecisions: [],
      activeArtifacts: [],
      unresolvedQuestions: [],
      constraints: [],
      nextAction: "execute",
    },
  });
  class CancelSecondRuntime implements Runtime {
    readonly name = "cancel-second";
    calls = 0;
    readonly fake = new FakeRuntime();
    async generate(args: GenerateArgs): Promise<ModelResult> {
      this.calls += 1;
      if (this.calls === 2) throw new OpCancelledError(args.jobId);
      return this.fake.generate(args);
    }
  }
  class CountingRuntime implements Runtime {
    readonly name = "counting";
    calls = 0;
    readonly fake = new FakeRuntime();
    async generate(args: GenerateArgs): Promise<ModelResult> {
      this.calls += 1;
      return this.fake.generate(args);
    }
  }
  const cancelSecond = new CancelSecondRuntime();
  let executionInterrupted = false;
  try {
    await runExecute({ projectId: resumeProject.id, level: "high", runtime: cancelSecond });
  } catch (e) {
    executionInterrupted = e instanceof OpCancelledError;
  }
  const afterCancel = readWorkOrders(resumeProject.id, 1);
  check("RESUME 1. first pass preserves done WO1 and marks WO2 interrupted", executionInterrupted && afterCancel.some((wo) => wo.agentId === "one" && wo.status === "done") && afterCancel.some((wo) => wo.agentId === "two" && wo.status === "interrupted"));
  const retryRuntime = new CountingRuntime();
  const resumed = await runExecute({ projectId: resumeProject.id, level: "high", runtime: retryRuntime });
  check("RESUME 2. retry skips completed WO1 and calls only WO2+WO3", retryRuntime.calls === 2);
  check("RESUME 3. all three immutable Artifacts exist after resume", resumed.artifacts.length === 3 && listArtifacts(resumeProject.id).length === 3);

  // PHASE 4 — AI proposes once; the Pilot approves; every graph movement
  // after that is deterministic, versioned, CAS-protected and token-free.
  const mapProject = initProject("Smoke Project Map", "Divide this objective into governed slices", true);
  writeJson(abs(projectDir(mapProject.id), "state", "approved.json"), {
    iteration: 1,
    approvedAt: new Date().toISOString(),
    state: {
      objective: "prove the Project Engine",
      phase: "mapped",
      approvedDecisions: [],
      activeArtifacts: [],
      unresolvedQuestions: [],
      constraints: [],
      nextAction: "map the work",
    },
  });
  const slicerRuntime = new CountingRuntime();
  const proposedMap = await runProjectSlicer({ projectId: mapProject.id, level: "low", runtime: slicerRuntime, scripted: true });
  check("MAP 1. Slicer is exactly one authorized model call", slicerRuntime.calls === 1 && proposedMap.candidate.slices.length === 3);
  check("MAP 2. Candidate Map cannot schedule work", proposedMap.candidate.slices.every((slice) => slice.status === "proposed"));
  const approvedMap = approveCandidateProjectMap(mapProject.id, null, true);
  check("MAP 3. Pilot approval creates immutable v1 and State reference", approvedMap.version === 1 && readApproved(mapProject.id)?.state.projectMap?.version === 1);
  check("MAP 4. deterministic traversal chooses the first unblocked Slice", nextProjectSlice(mapProject.id)?.id === "understand");
  let staleMapRejected = false;
  try { approveCandidateProjectMap(mapProject.id, null, true); } catch (e) { staleMapRejected = e instanceof Error && e.message.includes("conflict"); }
  check("MAP 5. stale-tab approval cannot overwrite newer authority", staleMapRejected);
  const mapV2 = moveProjectSlice({ projectId: mapProject.id, sliceId: "understand", to: "active", expectedMapVersion: 1, scripted: true });
  const mapV3 = moveProjectSlice({ projectId: mapProject.id, sliceId: "understand", to: "done", expectedMapVersion: mapV2.version, scripted: true });
  check("MAP 6. completing an upstream Slice unlocks the next with zero model calls", mapV3.version === 3 && nextProjectSlice(mapProject.id)?.id === "decide" && slicerRuntime.calls === 1);
  const mapV4 = moveProjectSlice({ projectId: mapProject.id, sliceId: "decide", to: "active", expectedMapVersion: mapV3.version, scripted: true });
  const mapV5 = moveProjectSlice({ projectId: mapProject.id, sliceId: "decide", to: "done", expectedMapVersion: mapV4.version, scripted: true });
  const mapV6 = moveProjectSlice({ projectId: mapProject.id, sliceId: "understand", to: "active", expectedMapVersion: mapV5.version, reason: "new governing information", scripted: true });
  check("MAP 7. backtracking marks all downstream work affected", mapV6.slices.filter((slice) => ["decide", "create"].includes(slice.id)).every((slice) => slice.status === "affected"));
  check("MAP 8. approved Map history is write-once and current is validated", readProjectMap(mapProject.id)?.version === 6 && existsSync(abs(projectDir(mapProject.id), "state", "maps", "v1.json")));
  const sliceDecision1 = await runDecisionSurface({ projectId: mapProject.id, level: "minimal", runtime, scripted: true, optionsCount: 2 });
  const firstChoice = sliceDecision1.options[0];
  if (!firstChoice) throw new Error("fake Decision Surface has no option");
  selectOption(mapProject.id, sliceDecision1.id, firstChoice.id, firstChoice.version, true);
  const sliceDecision2 = await runDecisionSurface({ projectId: mapProject.id, level: "minimal", runtime, scripted: true, optionsCount: 2 });
  check("MAP 9. one Slice can prepare multiple sequential material decisions", sliceDecision1.decision === "scope and constraints" && sliceDecision2.decision === "acceptance boundary");

  const batchProject = initProject("Smoke Question Batch", "Batch questions and route uncertainty", true);
  writeJson(abs(projectDir(batchProject.id), "roster.json"), {
    agents: [
      { id: "alpha", title: "Alpha", mandate: "alpha", tags: [] },
      { id: "beta", title: "Beta", mandate: "beta", tags: [] },
    ],
    workOrderId: "fixture-roster",
  });
  writeJson(abs(projectDir(batchProject.id), "questions.json"), {
    questions: [
      { id: "q-1", text: "First material fact?", askedBy: ["alpha", "beta"], iteration: 1, status: "open" },
      { id: "q-2", text: "Second material fact?", askedBy: ["alpha"], iteration: 1, status: "open" },
      { id: "q-3", text: "Third material fact?", askedBy: ["beta"], iteration: 1, status: "open" },
    ],
  });
  const batchResult = await answerQuestions({
    projectId: batchProject.id,
    answers: [
      { questionId: "q-1", answer: "one" },
      { questionId: "q-2", answer: "two" },
      { questionId: "q-3", answer: "three" },
    ],
    runtime,
    scripted: true,
  });
  check("QUESTIONS 1. three answers submit as one coherent batch", readQuestions(batchProject.id).every((question) => question.status === "answered"));
  check("QUESTIONS 2. each affected agent is reconsulted once, not once per question", batchResult.reconsulted.length === 2 && readWorkOrders(batchProject.id, 1).filter((wo) => wo.kind === "reconsult").length === 2);
  writeJson(abs(projectDir(batchProject.id), "questions.json"), {
    questions: [{ id: "q-4", text: "Which direction should we choose?", askedBy: ["alpha"], iteration: 1, status: "open" }],
  });
  routeQuestionToDecision(batchProject.id, "q-4", true);
  const routedSurface = await runDecisionSurface({ projectId: batchProject.id, level: "minimal", runtime, scripted: true, optionsCount: 3 });
  check("QUESTIONS 3. a deferred-to-Decide question becomes the Decision Surface", routedSurface.sourceQuestionId === "q-4" && routedSurface.decision === "Which direction should we choose?");

  console.log(`\n${passed}/${passed + failed} checks passed`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error("smoke crashed:", e);
  process.exit(1);
});
