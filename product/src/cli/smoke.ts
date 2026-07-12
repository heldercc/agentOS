// Smoke test: the full 13-step Product Loop (docs/PRODUCT-LOOP.md) exercised
// end-to-end on the fake runtime, at zero cost. Scripted evidence only —
// the smoke project id starts with "smoke-" so its meters never feed the
// Effort Probe and its events never read as the user's.

import { existsSync, rmSync } from "node:fs";

import { readEvents } from "../evidence.js";
import { collectMeterSamples, probeEffort } from "../effort.js";
import {
  addExpertiseGoverned,
  advanceIteration,
  answerQuestion,
  decideCandidate,
  decideExpertiseGoverned,
  getProject,
  initProject,
  openQuestions,
  readApproved,
  readQuestions,
  readRoster,
  readWorkOrders,
  runCandidate,
  runConsult,
  runExecute,
  stageOf,
  storyOf,
  topOpenQuestion,
} from "../kernel.js";
import { applicableExpertise, readExpertise } from "../expertise.js";
import { buildActual } from "../effort.js";
import { projectDir, WORKSPACE_DIR } from "../paths.js";
import { abs, readJson, readText, writeArtifactOnce } from "../stores.js";
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

  // Step 13 — the loop repeats.
  const advanced = advanceIteration(project.id, true);
  check("13. iteration advanced", advanced.iteration === 2);
  check("13b. stage returns to consult", stageOf(project.id) === "consult");

  // ADR-0019 — expertise is the durable asset: the user's judgement enters
  // the store as a candidate, is admitted by the user, and from then on the
  // Kernel schedules it into every applicable work order, visibly.
  const x = addExpertiseGoverned(
    project.id,
    {
      reach: "project",
      title: "Prefer the shortest honest option",
      body: "When two options are equal, the shorter one wins.",
      tags: [],
      provenanceNote: "smoke: the owner's own hand",
    },
    true,
  );
  check("19a. expertise enters as candidate", x.status === "candidate");
  check(
    "19b. candidate expertise is never applied",
    applicableExpertise(project.id, []).every((e) => e.id !== x.id),
  );
  decideExpertiseGoverned(project.id, x.id, "admit", true);
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
    "19c. admitted expertise entered the next consult's manifest with a reason",
    it2manifest?.elements.some(
      (el) => el.kind === "expertise" && el.ref.id === x.id && el.selectionReason !== "",
    ) === true,
  );
  check(
    "19d. the application trail recorded the work order",
    readExpertise(project.id).find((e) => e.id === x.id)?.appliedIn.some(
      (a) => a.workOrderId === it2wo?.id,
    ) === true,
  );

  // The story (ADR-0019 §3): the whole project navigable from disk.
  const story = storyOf(project.id);
  const flat = story.iterations.flatMap((i) => i.items);
  check("19e. story opens with the founding intent", story.intent.name === "Smoke Loop");
  check("19f. story spans both iterations", story.iterations.length >= 2);
  check(
    "19g. contributions carry mandate + output (provenance, not reasoning)",
    flat.some((i) => i.action === "consulted" && i.mandate && i.output),
  );
  check(
    "19h. a contribution shows the expertise it received and why",
    flat.some((i) => i.expertise?.some((e) => e.id === x.id && e.reason !== "")),
  );
  check(
    "19i. governance moments are in the story",
    flat.some((i) => i.action === "state_approved") &&
      flat.some((i) => i.action === "expertise_admitted"),
  );
  check(
    "19j. the interview is in the story with question and answer",
    flat.some((i) => i.action === "question_answered" && i.questionText && i.answer),
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

  console.log(`\n${passed}/${passed + failed} checks passed`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error("smoke crashed:", e);
  process.exit(1);
});
