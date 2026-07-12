// The AgentOS shell — the product's face (docs/PRODUCT-LOOP.md, Operating
// Model §12): "I state what I want. The system digests it. A team works
// underneath. I see only the questions and choices that matter. I decide."
//
// One HTTP server, no dependencies, localhost:4900. The user sees one primary
// action per loop stage; everything below the authority line moves by itself.

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { existsSync, readdirSync } from "node:fs";

import { readEvents } from "../evidence.js";
import {
  AUTO_MAX_LEVEL,
  EFFORT_LEVELS,
  effortSpec,
  probeEffort,
  buildActual,
  type EffortLevel,
} from "../effort.js";
import {
  addCandidateSeedGoverned,
  advanceIteration,
  answerQuestion,
  concludeProject,
  decideCandidate,
  decideSeedGoverned,
  DEFAULT_EFFORT_PROFILE,
  getProject,
  initProject,
  listArtifacts,
  listProjects,
  openQuestions,
  openSurface,
  addPilotNote,
  readCandidate,
  readApproved,
  readQuestions,
  readRoster,
  readSurfaces,
  readWorkOrders,
  refineOption,
  reopenProject,
  declareContextSufficient,
  recordSeedEvidenceGoverned,
  runCandidate,
  runConsult,
  runDecisionSurface,
  runExecute,
  saveSenseiGoverned,
  selectOption,
  setEffortProfile,
  stageOf,
  storyOf,
  topOpenQuestion,
} from "../kernel.js";
import {
  ensureImmutableProvenance,
  ensureSenseiLibrary,
  listCandidates,
  listSenseis,
  listSeeds,
  migrateLegacyExpertise,
  senseiSanity,
  senseiVictories,
} from "../hi.js";
import { iterationDir, MAILBOX_DIR, projectDir, workOrdersDir, WORKSPACE_DIR } from "../paths.js";
import { resolveRuntime } from "../runtime.js";
import { abs, readJson, readText, writeJson } from "../stores.js";
import type { EffortProfile, MeterRecord } from "../types.js";

/** PRODUCT_PORT lets a verification instance run beside the live :4900 shell. */
const PORT = Number(process.env["PRODUCT_PORT"] ?? 4900);
const RUNTIME_NAME = process.env["PRODUCT_RUNTIME"] ?? "cli";
const runtime = resolveRuntime(RUNTIME_NAME, { mailboxDir: MAILBOX_DIR });

// One-time, mechanical, provenance-preserving (ADR-0020 §9).
try {
  const n = migrateLegacyExpertise();
  if (n > 0) console.log(`migrated ${n} ADR-0019 expertise record(s) into the HI library`);
} catch (e) {
  console.error("legacy expertise migration failed:", e);
}

// One-time, mechanical, idempotent (parecer 2026-07-12): telemetry moves to
// sidecars, content hashes are stamped, current versions get their first
// immutable snapshot.
try {
  const c = ensureImmutableProvenance();
  if (c > 0) console.log(`immutable provenance: corrected ${c} HI record(s)`);
} catch (e) {
  console.error("immutable provenance correction failed:", e);
}

// The Sensei reform migration (parecer 2026-07-12 noite): mentors/ becomes
// senseis/, crafts derive from pinned seeds, admitted seeds gain their owner.
try {
  const c = ensureSenseiLibrary();
  if (c > 0) console.log(`sensei reform: migrated/corrected ${c} HI record(s)`);
} catch (e) {
  console.error("sensei reform migration failed:", e);
}

// ---------------------------------------------------------------------------
// One in-flight operation per project — honest for a Beta: the loop is
// sequential by design; parallel governance is nobody's ask yet.

interface Busy {
  op: string;
  startedAt: string;
}
const busy = new Map<string, Busy>();
const lastError = new Map<string, string>();

function startOp(projectId: string, op: string, work: () => Promise<void>): boolean {
  if (busy.has(projectId)) return false;
  busy.set(projectId, { op, startedAt: new Date().toISOString() });
  lastError.delete(projectId);
  void work()
    .catch((e) => {
      lastError.set(projectId, e instanceof Error ? e.message : String(e));
    })
    .finally(() => {
      busy.delete(projectId);
    });
  return true;
}

// ---------------------------------------------------------------------------
// Planned calls per operation — feeds the probe so the estimate is honest.

function plannedCalls(
  projectId: string,
  op: string,
  level: EffortLevel,
  optionsCount?: number,
): number {
  const spec = effortSpec(level);
  const roster = readRoster(projectId);
  if (op === "consult") {
    const agents = roster ? Math.min(roster.agents.length, spec.maxAgents) : spec.maxAgents;
    return roster ? agents : agents + 1; // +1 for the roster bootstrap
  }
  if (op === "candidate") return 1;
  if (op === "execute") {
    return roster ? Math.min(roster.agents.length, spec.maxAgents) : spec.maxAgents;
  }
  if (op === "decision") {
    const options = optionsCount
      ? Math.max(2, Math.min(4, optionsCount))
      : Math.max(2, Math.min(spec.maxAgents, 4));
    return options + (level === "minimal" ? 0 : 1); // +1 for the recommendation
  }
  return 1;
}

// ---------------------------------------------------------------------------
// Ponto I — tokens and time must be EVIDENT: the real meters of the current
// iteration, summed from disk on every poll, so the Pilot watches the spend
// grow while the system thinks.

function iterationMeters(projectId: string, iteration: number): {
  workOrders: number;
  tokens: number;
  durationMs: number;
  estimated: boolean;
} {
  const dir = workOrdersDir(projectId, iteration);
  let workOrders = 0;
  let tokens = 0;
  let durationMs = 0;
  let estimated = false;
  if (existsSync(dir)) {
    for (const wo of readdirSync(dir)) {
      const p = abs(dir, wo, "meter.json");
      if (!existsSync(p)) continue;
      const m = readJson<MeterRecord>(p);
      workOrders += 1;
      tokens += m.inputTokens + m.outputTokens;
      durationMs += m.durationMs;
      if (m.estimated) estimated = true;
    }
  }
  return { workOrders, tokens, durationMs, estimated };
}

// ---------------------------------------------------------------------------
// The view model the page polls.

function stateView(projectId: string): unknown {
  const project = getProject(projectId);
  const stage = stageOf(projectId);
  const roster = readRoster(projectId);
  const questions = readQuestions(projectId);
  const top = topOpenQuestion(projectId);
  const artifacts = listArtifacts(projectId).map((a) => ({
    iteration: a.iteration,
    agentId: a.agentId,
    chars: a.chars,
    seeds: a.seeds ?? null,
    content: a.iteration === project.iteration ? readText(a.path).slice(0, 6000) : null,
  }));
  const events = readEvents(projectId).slice(-25).reverse();
  return {
    project,
    stage,
    runtime: RUNTIME_NAME,
    autoMaxLevel: AUTO_MAX_LEVEL,
    effortProfile: project.effortProfile ?? DEFAULT_EFFORT_PROFILE,
    /** Ponto I: the iteration's real spend, visible and growing. */
    meters: iterationMeters(projectId, project.iteration),
    levels: EFFORT_LEVELS.map((l) => {
      const s = effortSpec(l);
      return {
        level: l,
        workerModel: s.workerModel,
        maxAgents: s.maxAgents,
        expectedQuality: s.expectedQuality,
        intendedFor: s.intendedFor,
      };
    }),
    roster: roster?.agents ?? null,
    interview: {
      open: openQuestions(projectId).length,
      top,
      answered: questions
        .filter((q) => q.status === "answered")
        .map((q) => ({ id: q.id, text: q.text, answer: q.answer, askedBy: q.askedBy })),
    },
    candidate: readCandidate(projectId),
    approved: readApproved(projectId),
    surface: openSurface(projectId),
    decidedSurfaces: readSurfaces(projectId).filter((d) => d.status === "decided").length,
    artifacts,
    workOrders: readWorkOrders(projectId, project.iteration),
    events,
    /** Seeds awaiting the Pilot's judgement — reviewed before concluding. */
    pendingCandidates: listCandidates().length,
    busy: busy.get(projectId) ?? null,
    lastError: lastError.get(projectId) ?? null,
  };
}

/** Concluded projects are frozen: governance ops require reopening first. */
function guardActive(projectId: string, res: ServerResponse): boolean {
  const p = getProject(projectId);
  if ((p.status ?? "active") === "concluded") {
    json(res, 409, { error: "projeto concluído — reabre-o para continuar a trabalhar" });
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Plumbing.

function json(res: ServerResponse, code: number, value: unknown): void {
  res.writeHead(code, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(value));
}

async function body(req: IncomingMessage): Promise<Record<string, string>> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const text = Buffer.concat(chunks).toString("utf8");
  return text ? (JSON.parse(text) as Record<string, string>) : {};
}

function asLevel(v: string | undefined): EffortLevel {
  return EFFORT_LEVELS.includes(v as EffortLevel) ? (v as EffortLevel) : "low";
}

/** The per-phase effort profile from a request body (ponto D). */
function profileFrom(b: Record<string, string>): EffortProfile {
  return {
    questions: asLevel(b["effortQuestions"]),
    options: asLevel(b["effortOptions"]),
    execution: asLevel(b["effortExecution"]),
  };
}

// ---------------------------------------------------------------------------
// Routes.

const server = createServer((req, res) => {
  void route(req, res).catch((e) => {
    json(res, 500, { error: e instanceof Error ? e.message : String(e) });
  });
});

async function route(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
  const q = (name: string): string => url.searchParams.get(name) ?? "";

  if (req.method === "GET" && url.pathname === "/") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(PAGE);
    return;
  }
  if (req.method === "GET" && url.pathname === "/api/projects") {
    // Enriched for the home page: human state, last activity, next action.
    const projects = listProjects().map((p) => {
      const events = readEvents(p.id);
      const last = events[events.length - 1];
      return {
        ...p,
        status: p.status ?? "active",
        stage: stageOf(p.id),
        lastActivityAt: last ? last.ts : p.createdAt,
      };
    });
    json(res, 200, { projects, runtime: RUNTIME_NAME });
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/project/conclude") {
    const b = await body(req);
    const project = concludeProject(b["project"] ?? "", b["note"]);
    json(res, 200, { status: project.status });
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/project/reopen") {
    const b = await body(req);
    const project = reopenProject(b["project"] ?? "");
    json(res, 200, { status: project.status });
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/project") {
    const b = await body(req);
    if (!b["name"]?.trim() || !b["description"]?.trim()) {
      json(res, 400, { error: "nome e descrição são obrigatórios" });
      return;
    }
    const project = initProject(b["name"], b["description"], false, profileFrom(b));
    json(res, 200, { id: project.id });
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/project/effort") {
    const b = await body(req);
    if (!guardActive(b["project"] ?? "", res)) return;
    const project = setEffortProfile(b["project"] ?? "", profileFrom(b));
    json(res, 200, { effortProfile: project.effortProfile });
    return;
  }
  if (req.method === "GET" && url.pathname === "/api/state") {
    if (!existsSync(projectDir(q("project")))) {
      json(res, 404, { error: "projeto desconhecido" });
      return;
    }
    json(res, 200, stateView(q("project")));
    return;
  }
  if (req.method === "GET" && url.pathname === "/api/probe") {
    const level = asLevel(q("level"));
    const project = getProject(q("project"));
    const optionsCount = q("options") ? Number(q("options")) : undefined;
    json(res, 200, {
      probe: probeEffort({
        workspaceDir: WORKSPACE_DIR,
        level,
        plannedCalls: plannedCalls(project.id, q("op") || "execute", level, optionsCount),
        priorIterations: project.iteration - 1,
      }),
      spec: effortSpec(level),
    });
    return;
  }
  if (req.method === "GET" && url.pathname === "/api/story") {
    json(res, 200, storyOf(q("project")));
    return;
  }
  if (req.method === "GET" && url.pathname === "/api/hi") {
    // Senseis carry their telemetry-derived rank (ponto C) and their
    // active-vs-photo sanity (ponto F2) — the library is inspectable, whole.
    const senseis = listSenseis()
      .map((m) => {
        const sanity = senseiSanity(m);
        return {
          ...m,
          victories: senseiVictories(m.id),
          graduation: sanity.graduation,
          sanity,
        };
      })
      .sort((a, b) => b.victories.length - a.victories.length);
    json(res, 200, {
      seeds: listSeeds(),
      candidates: listCandidates(),
      senseis,
    });
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/hi/seed") {
    const b = await body(req);
    if (!b["title"]?.trim() || !b["rule"]?.trim()) {
      json(res, 400, { error: "título e regra são obrigatórios" });
      return;
    }
    const seed = addCandidateSeedGoverned(b["project"] ?? "", {
      title: b["title"],
      rule: b["rule"],
      why: b["why"]?.trim() || "registada à mão na Biblioteca",
      domains: (b["domains"] ?? "").split(",").map((t) => t.trim()).filter((t) => t !== ""),
      projectLocal: b["reach"] === "project",
      provenanceNote: "registada à mão na Biblioteca de Inteligência Humana",
      ...(b["sensei"]?.trim() ? { sensei: b["sensei"].trim() } : {}),
    });
    json(res, 200, { id: seed.id });
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/hi/seed/decide") {
    const b = await body(req);
    decideSeedGoverned(
      b["project"] ?? "",
      b["seedId"] ?? "",
      b["decision"] === "admit" ? "admit" : "reject",
      b["editedRule"]?.trim() || undefined,
      false,
      b["senseiId"]?.trim() || undefined,
    );
    json(res, 200, { ok: true });
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/interview/enough") {
    const b = await body(req);
    if (!guardActive(b["project"] ?? "", res)) return;
    const n = declareContextSufficient(b["project"] ?? "", b["note"]?.trim() || undefined);
    json(res, 200, { deferred: n });
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/hi/seed/evidence") {
    const b = await body(req);
    if (!b["note"]?.trim()) {
      json(res, 400, { error: "a evidência precisa da tua nota — é ela que volta ao ativo" });
      return;
    }
    recordSeedEvidenceGoverned(
      b["project"] ?? "",
      b["seedId"] ?? "",
      b["kind"] === "contradicting" ? "contradicting" : "supporting",
      b["note"].trim(),
    );
    json(res, 200, { ok: true });
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/hi/sensei") {
    const b = await body(req);
    if (!b["title"]?.trim()) {
      json(res, 400, { error: "o Sensei precisa de um nome" });
      return;
    }
    const sensei = saveSenseiGoverned(b["project"] ?? "", {
      ...(b["id"]?.trim() ? { id: b["id"].trim() } : {}),
      title: b["title"],
      persona: b["persona"] ?? "",
      domains: (b["domains"] ?? "").split(",").map((d) => d.trim()).filter((d) => d !== ""),
      seedIds: (b["seedIds"] ?? "").split(",").map((s) => s.trim()).filter((s) => s !== ""),
      selectionNotes: (b["notes"] ?? "").split("\n").map((n) => n.trim()).filter((n) => n !== ""),
    });
    json(res, 200, { id: sensei.id, version: sensei.version });
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/option/refine") {
    const b = await body(req);
    const projectId = b["project"] ?? "";
    if (!guardActive(projectId, res)) return;
    if (!b["instruction"]?.trim()) {
      json(res, 400, { error: "o refinamento precisa da tua instrução" });
      return;
    }
    const ok = startOp(projectId, "refine", async () => {
      await refineOption({
        projectId,
        dsId: b["dsId"] ?? "",
        optionId: b["optionId"] ?? "",
        instruction: b["instruction"] ?? "",
        runtime,
      });
    });
    if (!ok) {
      json(res, 409, { error: "já existe uma operação em curso neste projeto" });
      return;
    }
    json(res, 200, { started: "refine" });
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/option/select") {
    const b = await body(req);
    selectOption(
      b["project"] ?? "",
      b["dsId"] ?? "",
      b["optionId"] ?? "",
      Number(b["version"] ?? 1),
    );
    json(res, 200, { ok: true });
    return;
  }
  if (req.method === "GET" && url.pathname === "/api/artifact") {
    const project = getProject(q("project"));
    const a = listArtifacts(project.id).find(
      (x) => x.iteration === Number(q("iteration")) && x.agentId === q("agent"),
    );
    if (!a) {
      json(res, 404, { error: "artefacto desconhecido" });
      return;
    }
    json(res, 200, { content: readText(a.path) });
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/op") {
    const b = await body(req);
    const projectId = b["project"] ?? "";
    if (!guardActive(projectId, res)) return;
    const op = b["op"] ?? "";
    const level = asLevel(b["level"]);
    const project = getProject(projectId);
    const optionsCount = b["options"] ? Number(b["options"]) : undefined;
    const work = async (): Promise<void> => {
      if (op === "consult") {
        await runConsult({ projectId, level, runtime });
      } else if (op === "candidate") {
        await runCandidate({ projectId, level, runtime });
      } else if (op === "decision") {
        await runDecisionSurface({
          projectId,
          level,
          runtime,
          ...(optionsCount ? { optionsCount } : {}),
        });
      } else if (op === "execute") {
        const estimate = probeEffort({
          workspaceDir: WORKSPACE_DIR,
          level,
          plannedCalls: plannedCalls(projectId, "execute", level),
          priorIterations: project.iteration - 1,
        });
        const r = await runExecute({ projectId, level, runtime });
        writeJson(
          abs(iterationDir(projectId, project.iteration), "effort-actual.json"),
          buildActual({
            estimate,
            level,
            meters: r.meters,
            retriesUsed: r.retriesUsed,
            outcome: "ok",
          }),
        );
      } else {
        throw new Error(`operação desconhecida: ${op}`);
      }
    };
    if (!startOp(projectId, op, work)) {
      json(res, 409, { error: "já existe uma operação em curso neste projeto" });
      return;
    }
    json(res, 200, { started: op });
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/answer") {
    const b = await body(req);
    const projectId = b["project"] ?? "";
    if (!guardActive(projectId, res)) return;
    if (!b["answer"]?.trim()) {
      json(res, 400, { error: "a resposta não pode ser vazia" });
      return;
    }
    const ok = startOp(projectId, "answer", async () => {
      await answerQuestion({
        projectId,
        questionId: b["questionId"] ?? "",
        answer: b["answer"] ?? "",
        runtime,
      });
    });
    if (!ok) {
      json(res, 409, { error: "já existe uma operação em curso neste projeto" });
      return;
    }
    json(res, 200, { started: "answer" });
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/decide") {
    const b = await body(req);
    if (!guardActive(b["project"] ?? "", res)) return;
    decideCandidate(
      b["project"] ?? "",
      b["decision"] === "approve" ? "approve" : "reject",
      b["note"]?.trim() || undefined,
    );
    json(res, 200, { ok: true });
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/advance") {
    const b = await body(req);
    if (!guardActive(b["project"] ?? "", res)) return;
    // "Melhorar" é uma nova passagem pelo ciclo com a tua direção à frente —
    // nunca uma etapa isolada: a nota entra no contexto de todo o trabalho
    // seguinte, as decisões anteriores ficam preservadas.
    if (b["direction"]?.trim()) addPilotNote(b["project"] ?? "", b["direction"].trim());
    advanceIteration(b["project"] ?? "");
    json(res, 200, { ok: true });
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/note") {
    const b = await body(req);
    if (!guardActive(b["project"] ?? "", res)) return;
    if (b["note"]?.trim()) addPilotNote(b["project"] ?? "", b["note"].trim());
    json(res, 200, { ok: true });
    return;
  }
  json(res, 404, { error: "not found" });
}

// ---------------------------------------------------------------------------
// The page — one file, no build step, Portuguese like its user.

const PAGE = /* html */ `<!doctype html>
<html lang="pt">
<head>
<meta charset="utf-8">
<title>AgentOS</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  :root { --bg:#0e1116; --card:#161b23; --line:#242c38; --tx:#d7dee8; --dim:#8b96a5;
          --acc:#4da3ff; --ok:#3fb96b; --warn:#e0a63f; --bad:#e05c5c; }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--bg); color:var(--tx);
         font:15px/1.55 "Segoe UI", system-ui, sans-serif; }
  .wrap { max-width:980px; margin:0 auto; padding:24px 16px 80px; }
  h1 { font-size:20px; margin:0 0 4px; } h1 a { color:var(--tx); text-decoration:none; }
  h2 { font-size:15px; margin:0 0 10px; color:var(--tx); }
  .sub { color:var(--dim); font-size:13px; margin-bottom:20px; }
  .card { background:var(--card); border:1px solid var(--line); border-radius:10px;
          padding:16px; margin-bottom:14px; }
  .badge { display:inline-block; padding:1px 9px; border-radius:20px; font-size:12px;
           border:1px solid var(--line); color:var(--dim); margin-left:8px; }
  .badge.acc { color:var(--acc); border-color:var(--acc); }
  button { background:var(--acc); color:#08111e; border:0; border-radius:8px;
           padding:9px 18px; font-size:14px; font-weight:600; cursor:pointer; }
  button.ghost { background:transparent; color:var(--dim); border:1px solid var(--line); }
  button.danger { background:transparent; color:var(--bad); border:1px solid var(--bad); }
  button:disabled { opacity:.45; cursor:default; }
  input, textarea, select { width:100%; background:#0b0f14; border:1px solid var(--line);
           color:var(--tx); border-radius:8px; padding:9px 11px; font:inherit; }
  textarea { min-height:76px; resize:vertical; }
  label { display:block; font-size:12px; color:var(--dim); margin:10px 0 4px; }
  .row { display:flex; gap:10px; align-items:center; flex-wrap:wrap; }
  .grow { flex:1; }
  .agent { display:inline-block; background:#0b0f14; border:1px solid var(--line);
           border-radius:8px; padding:8px 12px; margin:4px 6px 4px 0; max-width:100%; }
  .agent b { color:var(--acc); font-size:13px; }
  .agent div { font-size:12px; color:var(--dim); }
  .q { font-size:17px; margin:6px 0 12px; }
  .kv { font-size:13px; color:var(--dim); }
  .kv b { color:var(--tx); }
  pre { background:#0b0f14; border:1px solid var(--line); border-radius:8px;
        padding:12px; overflow-x:auto; font-size:12.5px; white-space:pre-wrap; }
  details { margin-top:8px; } summary { cursor:pointer; color:var(--dim); font-size:13px; }
  .ev { font-size:12px; color:var(--dim); padding:3px 0; border-bottom:1px dashed var(--line); }
  .ev b { color:var(--tx); font-weight:600; }
  .err { color:var(--bad); font-size:13px; white-space:pre-wrap; }
  .spin { color:var(--warn); font-size:13px; }
  .probe { font-size:12.5px; color:var(--dim); background:#0b0f14; border:1px dashed var(--line);
           border-radius:8px; padding:8px 12px; margin-top:8px; }
  .probe b { color:var(--warn); }
  input[type=range] { padding:0; accent-color:var(--acc); }
  .stateDoc dt { color:var(--dim); font-size:12px; margin-top:8px; }
  .stateDoc dd { margin:2px 0 0; }
  .proj { display:block; padding:12px 16px; background:var(--card); border:1px solid var(--line);
          border-radius:10px; margin-bottom:10px; color:var(--tx); text-decoration:none; }
  .proj:hover { border-color:var(--acc); }
  .proj small { color:var(--dim); }
  .tabs { display:flex; gap:6px; margin:0 0 16px; }
  .tab { padding:6px 16px; border-radius:20px; border:1px solid var(--line); color:var(--dim);
         background:transparent; font-size:13px; font-weight:600; cursor:pointer; }
  .tab.on { color:var(--acc); border-color:var(--acc); background:rgba(77,163,255,.08); }
  .tl { border-left:2px solid var(--line); margin-left:8px; padding-left:18px; }
  .tli { position:relative; margin-bottom:14px; }
  .tli::before { content:""; position:absolute; left:-24px; top:6px; width:9px; height:9px;
                 border-radius:50%; background:var(--line); }
  .tli.pilot::before { background:var(--acc); }
  .tli .when { font-size:11px; color:var(--dim); }
  .tli .lbl { font-weight:600; }
  .tli .who { font-size:11px; padding:0 7px; border-radius:10px; border:1px solid var(--line);
              color:var(--dim); margin-left:6px; }
  .tli.pilot .who { color:var(--acc); border-color:var(--acc); }
  .xchip { display:inline-block; font-size:11.5px; color:var(--warn); border:1px dashed var(--warn);
           border-radius:10px; padding:0 8px; margin:2px 4px 2px 0; }
  .itdiv { margin:20px 0 12px; color:var(--acc); font-weight:700; font-size:13px; }
  .xp { background:#0b0f14; border:1px solid var(--line); border-radius:8px; padding:10px 12px;
        margin-bottom:8px; }
  .xp .st { font-size:11px; padding:0 8px; border-radius:10px; border:1px solid var(--line);
            margin-left:6px; }
  .xp .st.admitted { color:var(--ok); border-color:var(--ok); }
  .xp .st.candidate { color:var(--warn); border-color:var(--warn); }
  .xp .st.discarded { color:var(--dim); }

  /* A jornada persistente — cor com função: azul = ação atual, âmbar =
     decisão humana pendente, verde = feito/aprovado, cinza = passado/técnico. */
  .journey { display:flex; flex-wrap:wrap; gap:4px; align-items:center; margin:14px 0 4px; }
  .jstep { font-size:12px; padding:3px 10px; border-radius:20px; border:1px solid var(--line);
           color:var(--dim); }
  .jstep.done { color:var(--ok); border-color:rgba(63,185,107,.55); }
  .jstep.now { color:#08111e; background:var(--acc); border-color:var(--acc); font-weight:700; }
  .jstep.now.need { background:var(--warn); border-color:var(--warn); }
  .jsep { color:var(--line); font-size:12px; }
  .jline { font-size:12.5px; color:var(--dim); margin:0 0 16px; }
  .jline b { color:var(--tx); }
  .card.primary { border-left:4px solid var(--acc); }
  .card.primary.need { border-left-color:var(--warn); }
  .card.primary.wait { border-left-color:var(--dim); }
  .card.primary.closed { border-left-color:var(--ok); }
  .kicker { font-size:11px; letter-spacing:.12em; font-weight:700; color:var(--acc);
            margin-bottom:6px; }
  .primary.need .kicker { color:var(--warn); }
  .primary.wait .kicker { color:var(--dim); }
  .primary.closed .kicker { color:var(--ok); }
  button.approve { background:var(--ok); }
  .badge.ok { color:var(--ok); border-color:var(--ok); }
  .badge.warn { color:var(--warn); border-color:var(--warn); }
  .proj .next { font-size:12.5px; color:var(--warn); margin-top:2px; }
  .proj .next.act { color:var(--acc); }
  .proj.closed { opacity:.75; }
  .wo { font-size:12px; color:var(--dim); padding:3px 0; border-bottom:1px dashed var(--line); }
  .wo b { color:var(--tx); }
</style>
</head>
<body>
<div class="wrap" id="app">A carregar…</div>
<script>
"use strict";
var $ = function (id) { return document.getElementById(id); };
var app = $("app");
var projectId = new URLSearchParams(location.search).get("p");
var state = null;
var levelChosen = null;
var lastJson = "";
var view = "agora";

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
  });
}
function post(path, data) {
  return fetch(path, { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify(data) }).then(function (r) {
      return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || r.status); return j; });
    });
}

// ---------------- a jornada (linguagem humana, persistente) ----------------
// A jornada orienta; o Kernel continua a decidir que passos são necessários.
// Os estados internos (consult, candidate, execute…) vivem em Auditoria.
var STEPS = ["Intenção", "Compreender", "Decidir", "Aprovar", "Criar",
  "Avaliar e aprender", "Continuar ou concluir"];
// kind: "need" = decisão humana pendente (âmbar) · "act" = lançar o sistema (azul)
var STAGE_MAP = {
  consult:   { step: 1, kind: "act",  now: "o sistema vai compreender a tua intenção",
               next: "Pôr a equipa a compreender" },
  interview: { step: 1, kind: "need", now: "há perguntas para ti",
               next: "Responder — ou declarar que chega" },
  candidate: { step: 2, kind: "act",  now: "hora de decidir o rumo",
               next: "Pedir opções ou condensar o estado" },
  decide:    { step: 2, kind: "need", now: "há opções à tua espera",
               next: "Escolher ou refinar uma opção" },
  approve:   { step: 3, kind: "need", now: "um estado espera a tua aprovação",
               next: "Aprovar ou rejeitar com direção" },
  execute:   { step: 4, kind: "act",  now: "pronto para criar",
               next: "Mandar criar" },
  advance:   { step: 5, kind: "need", now: "resultado entregue — avalia e decide o futuro",
               next: "Avaliar, melhorar, continuar ou concluir" }
};
function isConcluded(p) { return (p.status || "active") === "concluded"; }
function stageInfo(stage, project) {
  if (project && isConcluded(project)) {
    return { step: 6, kind: "done", now: "projeto concluído e arquivado",
             next: "Reabrir, se quiseres continuar" };
  }
  return STAGE_MAP[stage] || STAGE_MAP.consult;
}
function journeyBar(s) {
  var info = stageInfo(s.stage, s.project);
  var h = '<div class="journey">';
  STEPS.forEach(function (label, i) {
    var cls;
    if (info.kind === "done") cls = i <= info.step ? "done" : "todo";
    else cls = i < info.step ? "done" : i === info.step ? (info.kind === "need" ? "now need" : "now") : "todo";
    h += '<span class="jstep ' + cls + '">' + label + "</span>";
    if (i < STEPS.length - 1) h += '<span class="jsep">›</span>';
  });
  h += "</div>";
  var nxt = info.step < STEPS.length - 1 ? STEPS[info.step + 1] : null;
  h += '<div class="jline">Estás em <b>' + STEPS[info.step] + "</b> — " + esc(info.now) +
    (nxt ? ' · depois vem <b>' + nxt + "</b>" : "") + "</div>";
  return h;
}
function relTime(ts) {
  var min = Math.round((Date.now() - new Date(ts).getTime()) / 60000);
  if (min < 1) return "agora mesmo";
  if (min < 60) return "há " + min + " min";
  var h = Math.round(min / 60);
  if (h < 24) return "há " + h + " h";
  return "há " + Math.round(h / 24) + " dia(s)";
}

// ---------------- home ----------------
function renderHome() {
  fetch("/api/projects").then(function (r) { return r.json(); }).then(function (data) {
    var h = '<h1>AgentOS</h1><div class="sub">Declara a intenção. O sistema digere. ' +
      'Tu governas. <span class="badge">runtime: ' + esc(data.runtime) + '</span></div>';
    function homeLevelSelect(id) {
      var h2 = '<select id="' + id + '">';
      ["minimal", "low", "balanced", "high", "maximum"].forEach(function (l) {
        h2 += '<option value="' + l + '"' + (l === "low" ? " selected" : "") + ">" + l + "</option>";
      });
      return h2 + "</select>";
    }
    h += '<div class="card"><h2>Novo projeto</h2>' +
      '<label>Nome</label><input id="pname" placeholder="O nome do projeto">' +
      '<label>O que queres? (texto livre — a intenção fundadora)</label>' +
      '<textarea id="pdesc" placeholder="Descreve o que queres que exista no fim…"></textarea>' +
      '<details style="margin-top:8px"><summary class="kv">Perfil de esforço por fase (opcional — por defeito tudo "low"; podes mudar a qualquer momento)</summary>' +
      '<div class="row" style="margin-top:6px">' +
      '<div class="grow"><label>Perguntas</label>' + homeLevelSelect("nefq") + "</div>" +
      '<div class="grow"><label>Opções</label>' + homeLevelSelect("nefo") + "</div>" +
      '<div class="grow"><label>Execução</label>' + homeLevelSelect("nefe") + "</div></div></details>" +
      '<div style="margin-top:12px"><button onclick="createProject()">Criar projeto</button></div>' +
      '<div class="err" id="cerr"></div></div>';
    if (data.projects.length) {
      h += "<h2 style='margin:18px 0 10px'>Projetos</h2>";
      var projs = data.projects.slice().sort(function (a, b) {
        var ca = isConcluded(a) ? 1 : 0, cb = isConcluded(b) ? 1 : 0;
        if (ca !== cb) return ca - cb;
        return (b.lastActivityAt || "").localeCompare(a.lastActivityAt || "");
      });
      projs.forEach(function (p) {
        var info = stageInfo(p.stage, p);
        var closed = isConcluded(p);
        h += '<a class="proj' + (closed ? " closed" : "") + '" href="/?p=' + esc(p.id) + '">' +
          "<b>" + esc(p.name) + "</b> " +
          (closed ? '<span class="badge ok">concluído</span>'
                  : '<span class="badge">' + STEPS[info.step] + "</span>") +
          '<small> · passagem ' + p.iteration + " · última atividade " +
          relTime(p.lastActivityAt || p.createdAt) + "</small>" +
          '<div class="next' + (info.kind === "act" ? " act" : "") + '">' +
          (closed ? "arquivado — podes reabrir" : "próxima ação: " + esc(info.next)) +
          "</div></a>";
      });
    }
    app.innerHTML = h;
  });
}
function createProject() {
  post("/api/project", { name: $("pname").value, description: $("pdesc").value,
    effortQuestions: $("nefq") ? $("nefq").value : "low",
    effortOptions: $("nefo") ? $("nefo").value : "low",
    effortExecution: $("nefe") ? $("nefe").value : "low" })
    .then(function (r) { location.search = "?p=" + r.id; })
    .catch(function (e) { $("cerr").textContent = e.message; });
}

// ---------------- project ----------------
function load() {
  fetch("/api/state?project=" + encodeURIComponent(projectId))
    .then(function (r) { return r.json(); })
    .then(function (s) {
      // Re-render only on real change — a quiet poll must not eat a click.
      var j = JSON.stringify(s);
      if (j === lastJson) return;
      lastJson = j;
      state = s;
      // In the story/library views a state change refreshes content in
      // place — no "a carregar…" flash, no eaten interactions.
      if (view === "agora") render();
      else if (view === "historia") loadStory();
      else loadHi();
    })
    .catch(function () { /* poll again */ });
}

// Ponto D — cada operação pertence a uma fase; o perfil do projeto dá o
// default, o slider continua a poder fazer override pontual.
function phaseOf(op) {
  if (op === "execute") return "execution";
  if (op === "decision" || op === "candidate") return "options";
  return "questions";
}
function levelFor(op) {
  return levelChosen || (state.effortProfile && state.effortProfile[phaseOf(op)]) || "low";
}
function levelSelector(op) {
  var lv = levelFor(op);
  var idx = state.levels.map(function (l) { return l.level; }).indexOf(lv);
  var spec = state.levels[idx];
  return '<label>Esforço — o teu perfil define a fase; o slider faz override pontual</label>' +
    '<div class="row"><input type="range" min="0" max="4" step="1" value="' + idx + '" class="grow" ' +
    'oninput="setLevel(this.value, \\'' + op + '\\')">' +
    '<span class="badge acc">' + esc(lv) + " · " + esc(spec.workerModel) + "</span>" +
    (levelChosen ? "" : '<span class="badge">perfil: ' + esc(phaseLabel(phaseOf(op))) + "</span>") +
    "</div>" +
    '<div class="probe" id="probe">a estimar…</div>';
}
function phaseLabel(ph) {
  return ph === "questions" ? "perguntas" : ph === "options" ? "opções" : "execução";
}
function setLevel(idx, op) {
  levelChosen = state.levels[Number(idx)].level;
  render();
  loadProbe(op);
}
function loadProbe(op) {
  if (!$("probe")) return;
  var extra = "";
  if (op === "decision" && $("optcount")) extra = "&options=" + $("optcount").value;
  fetch("/api/probe?project=" + encodeURIComponent(projectId) + "&level=" +
    levelFor(op) + "&op=" + op + extra)
    .then(function (r) { return r.json(); })
    .then(function (d) {
      var p = d.probe;
      $("probe").innerHTML = "Probe: <b>" + p.calls + "</b> chamadas · ~<b>" +
        p.expectedTokens.toLocaleString() + "</b> tokens · ~<b>" +
        Math.round(p.expectedDurationMs / 1000) + "s</b> · pressão <b>" + esc(p.pressure) +
        "</b> · confiança " + esc(p.confidence) + " (" + p.basedOnRuns + " runs)" +
        "<br>Recomendação: <b>" + esc(p.recommendation) + "</b> — " + esc(p.recommendationReason) +
        "<br>" + esc(p.expectedQuality);
    });
}

// Ponto I — tempo e tokens visíveis enquanto o sistema pensa.
function elapsedSince(iso) {
  var s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  var m = Math.floor(s / 60);
  return m > 0 ? m + "m" + String(s % 60).padStart(2, "0") + "s" : s + "s";
}
function metersLine(s) {
  if (!s.meters || !s.meters.workOrders) return "";
  return '<div class="kv" style="margin-top:6px">Esta passagem: <b>' +
    s.meters.tokens.toLocaleString() + "</b> tokens" +
    (s.meters.estimated ? " (estimados)" : "") + " em <b>" + s.meters.workOrders +
    "</b> work orders · <b>" + Math.round(s.meters.durationMs / 1000) + "s</b> de modelo</div>";
}
setInterval(function () {
  var el = $("elapsed");
  if (el && state && state.busy) el.textContent = elapsedSince(state.busy.startedAt);
}, 1000);

// O cartão dominante: UMA área que diz o que precisa do utilizador agora.
// Azul = ação para lançar; âmbar = decisão humana pendente; verde = concluído.
var BUSY_HUMAN = {
  consult: "a equipa está a compreender a tua intenção e a preparar perguntas",
  answer: "a tua resposta está a ser levada aos agentes que perguntaram",
  candidate: "o sistema está a condensar o estado do projeto",
  decision: "o sistema está a preparar opções genuinamente diferentes",
  refine: "a tua instrução está a refinar a opção",
  execute: "o sistema está a criar — o resultado regressa sozinho"
};
var concluding = false;

function primary(kind, title, inner) {
  var cls = kind === "need" ? " need" : kind === "wait" ? " wait" : kind === "closed" ? " closed" : "";
  var kick = kind === "wait" ? "O SISTEMA ESTÁ A TRABALHAR" :
    kind === "closed" ? "PROJETO CONCLUÍDO" : "O QUE PRECISA DE TI AGORA";
  return '<div class="card primary' + cls + '"><div class="kicker">' + kick + "</div>" +
    "<h2>" + title + "</h2>" + inner + "</div>";
}

function concludeBlock(s) {
  var h = '<div class="kv" style="margin-top:10px">Concluir é um ato governado: o resultado fica ' +
    "confirmado, o projeto congela e é <b>arquivado — nada se apaga</b>, toda a proveniência fica. " +
    "Podes reabrir mais tarde, com evidência.</div>";
  if (s.pendingCandidates > 0) {
    h += '<div class="kv" style="margin-top:6px;color:var(--warn)">🌱 ' + s.pendingCandidates +
      " aprendizagem(ns) candidata(s) esperam o teu julgamento — resolve-as na Inteligência Humana " +
      "antes de arquivar, para o projeto fechar limpo.</div>";
  }
  h += '<label>O que este projeto terminou a ser (opcional — fica no registo)</label>' +
    '<textarea id="cnote"></textarea>' +
    '<div class="row" style="margin-top:10px">' +
    '<button class="approve" onclick="doConclude()">Concluir e arquivar</button>' +
    '<button class="ghost" onclick="cancelConclude()">Cancelar</button></div>';
  return h;
}

function primaryCard() {
  var s = state, h = "";
  if (isConcluded(s.project)) {
    return primary("closed", esc(s.project.name) + " está arquivado",
      '<div class="kv">Concluído ' + (s.project.concludedAt ? relTime(s.project.concludedAt) : "") +
      (s.project.concludedNote ? ' · "' + esc(s.project.concludedNote) + '"' : "") +
      " · Tudo fica: história, artefactos, proveniência.</div>" +
      '<div style="margin-top:12px"><button class="ghost" onclick="reopen()">Reabrir projeto</button></div>');
  }
  if (s.busy) {
    // Ponto I: pensar custa e isso deve ser EVIDENTE — cronómetro a andar e
    // os tokens reais da passagem a crescer a cada work order concluída.
    return primary("wait", "Não precisas de fazer nada",
      '<div class="spin">⏳ ' + esc(BUSY_HUMAN[s.busy.op] || s.busy.op) +
      ' — há <b id="elapsed">' + elapsedSince(s.busy.startedAt) + "</b></div>" +
      metersLine(s) +
      '<div class="kv" style="margin-top:6px">O sistema move por baixo; tu decides quando ele voltar.</div>');
  }
  if (s.stage === "consult") {
    h = primary("act", s.roster ? "Voltar a pôr a equipa a compreender" : "Pôr a equipa a compreender a tua intenção",
      '<div class="kv">' + (s.roster ? "A equipa reconsulta com tudo o que já decidiste." :
        "O sistema monta uma equipa delimitada a partir da tua intenção e traz-te só as perguntas que importam.") +
      "</div>" + levelSelector("consult") +
      '<div style="margin-top:12px"><button onclick="op(\\'consult\\')">Começar — recolher as perguntas da equipa</button></div>');
  } else if (s.stage === "interview" && s.interview.top) {
    var t = s.interview.top;
    h = primary("need", "Uma pergunta de cada vez",
      '<div class="q">' + esc(t.text) + "</div>" +
      '<div class="kv">' + s.interview.open + " em aberto (as restantes esperam a vez)</div>" +
      '<label>A tua resposta</label><textarea id="answer"></textarea>' +
      '<div class="row" style="margin-top:10px"><button onclick="answer(\\'' + esc(t.id) + '\\')">Responder</button>' +
      '<button class="ghost" onclick="enough()">Chega — constrói com o que tens</button></div>' +
      '<div class="kv" style="margin-top:6px">Ao responder, quem perguntou volta a pensar sozinho. ' +
      "Declarar suficiência é teu por direito: o que ficar em aberto fica adiado e visível, nunca inventado.</div>");
  } else if (s.stage === "decide" && s.surface) {
    h = decisionSurfaceCard(s.surface);
  } else if (s.stage === "candidate") {
    var rej = s.candidate && s.candidate.status === "rejected" && s.candidate.iteration === s.project.iteration;
    h = primary("act", "Decidir o rumo",
      '<div class="kv">' +
      (rej ? "Rejeitaste a proposta anterior — o sistema reconstrói com a tua nota." :
        "Sem perguntas em aberto. Pede opções concretas para escolheres, ou condensa já o estado do projeto.") +
      "</div>" + levelSelector("candidate") +
      '<label>Quantas opções na mesa? (cada opção extra custa 1 chamada — o probe mostra)</label>' +
      '<select id="optcount" style="width:auto" onchange="loadProbe(\\'decision\\')">' +
      '<option value="2">2 opções</option><option value="3" selected>3 opções</option>' +
      '<option value="4">4 opções</option></select>' +
      '<div class="row" style="margin-top:12px">' +
      '<button onclick="op(\\'decision\\')">Quero opções para escolher</button>' +
      '<button class="ghost" onclick="op(\\'candidate\\')">Condensar já o estado</button></div>');
  } else if (s.stage === "approve" && s.candidate) {
    h = primary("need", "Aprovas este estado do projeto?",
      stateDoc(s.candidate.state) +
      '<label>Nota (obrigatória se rejeitares — é a tua direção)</label><textarea id="dnote"></textarea>' +
      '<div class="row" style="margin-top:10px"><button class="approve" onclick="decide(\\'approve\\')">Aprovar</button>' +
      '<button class="danger" onclick="decide(\\'reject\\')">Rejeitar com nota</button></div>');
  } else if (s.stage === "execute") {
    h = primary("act", "Mandar criar",
      '<div class="kv">Estado aprovado. O sistema vai criar: <b>' +
      esc(s.approved ? s.approved.state.nextAction : "") + "</b></div>" + levelSelector("execute") +
      '<div style="margin-top:12px"><button onclick="op(\\'execute\\')">Criar</button></div>' +
      '<div class="kv" style="margin-top:6px">O resultado regressa sozinho a este ecrã.</div>');
  } else if (s.stage === "advance") {
    var inner = '<div class="kv">O resultado está em baixo, em <b>Resultados</b>. Lê-o. ' +
      "Se uma GuruSeed ajudou ou atrapalhou, devolve o teu veredicto na <b>Inteligência Humana</b> — " +
      "é assim que o sistema aprende contigo.</div>";
    if (s.pendingCandidates > 0) {
      inner += '<div class="kv" style="margin-top:6px;color:var(--warn)">🌱 ' + s.pendingCandidates +
        " aprendizagem(ns) candidata(s) à espera do teu julgamento na Inteligência Humana.</div>";
    }
    if (concluding) {
      inner += concludeBlock(s);
    } else {
      inner += '<label>Melhorar — dá a tua direção; o ciclo repete preservando o que já decidiste</label>' +
        '<textarea id="improveDir" placeholder="ex.: gostei, mas quero mais humor e um final mais calmo"></textarea>' +
        '<div class="row" style="margin-top:10px">' +
        '<button onclick="improve()">Melhorar — nova passagem com a minha direção</button>' +
        '<button class="ghost" onclick="advance()">Nova passagem, sem direção</button>' +
        '<button class="ghost" onclick="concludeUI()">Concluir projeto…</button></div>';
    }
    h = primary("need", "Resultado entregue — avalia e decide o futuro", inner);
  }
  return h;
}

// ---------------- a superfície de decisão ----------------
function latestOptions(surface) {
  var byId = {};
  surface.options.forEach(function (o) {
    if (!byId[o.id] || o.version > byId[o.id].version) byId[o.id] = o;
  });
  return Object.keys(byId).sort().map(function (k) { return byId[k]; });
}

function decisionSurfaceCard(ds) {
  var h = primary("need", "Escolhe o rumo",
    '<div class="q">' + esc(ds.decision) + "</div>" +
    '<div class="kv">' + esc(ds.why) + " · O sistema mastigou; a escolha é tua. " +
    "Podes selecionar, ou refinar uma opção com uma frase antes de selecionar.</div>");
  if (ds.recommendation) {
    h += '<div class="card" style="border-color:var(--warn)"><div class="kv">' +
      '<b style="color:var(--warn)">Recomendação do Kernel:</b> ' +
      esc(ds.recommendation.optionId) + " — " + esc(ds.recommendation.reason) + "</div></div>";
  }
  latestOptions(ds).forEach(function (o) {
    // Ponto C: proveniência EVIDENTE — quem sugeriu esta opção; se a
    // escolheres, é esse Sensei que ganha a vitória e evolui.
    var voices = {};
    if (o.senseiTitle) voices[o.senseiTitle] = true;
    (o.seeds || []).forEach(function (s) {
      var t = s.senseiTitle || s.mentorTitle;
      if (t) voices[t] = true;
    });
    var rec = ds.recommendation && ds.recommendation.optionId === o.id;
    h += '<div class="card"' + (rec ? ' style="border-color:var(--acc)"' : "") + ">" +
      "<h2>" + esc(o.title) + (rec ? " ★" : "") +
      ' <span class="badge">' + esc(o.direction) + "</span>" +
      (o.refinement ? ' <span class="badge acc">v' + o.version + " · refinada</span>" : "") + "</h2>" +
      "<div>" + esc(o.description) + "</div>" +
      (o.benefits ? '<div class="kv" style="margin-top:6px">A favor: ' + esc(o.benefits) + "</div>" : "") +
      (o.tradeoffs ? '<div class="kv">Atenção: ' + esc(o.tradeoffs) + "</div>" : "") +
      (o.refinement ? '<div class="kv">Refinamento aplicado: "' + esc(o.refinement) + '"</div>' : "");
    if (Object.keys(voices).length) {
      h += "<div style='margin-top:6px'>";
      Object.keys(voices).forEach(function (m) {
        h += '<span class="xchip" title="se escolheres esta opção, a vitória evolui este Sensei">🥋 Sensei: ' + esc(m) + "</span>";
      });
      h += "</div>";
    } else {
      h += '<div class="kv" style="margin-top:6px">voz genérica do sistema — sem Sensei, sem vitória a atribuir</div>';
    }
    (o.seeds || []).forEach(function (s) {
      h += '<span class="xchip" title="' + esc(s.reason) + '">🧠 ' + esc(s.id) + " v" + s.version + "</span>";
    });
    h += '<label>Refinar (uma frase chega — o resto mantém-se)</label>' +
      '<div class="row"><input id="rf-' + esc(o.id) + '" class="grow" ' +
      'placeholder="ex.: menos dramático, mantém o final">' +
      '<button class="ghost" onclick="refine(\\'' + esc(ds.id) + '\\',\\'' + esc(o.id) + '\\')">Refinar</button>' +
      '<button onclick="pick(\\'' + esc(ds.id) + '\\',\\'' + esc(o.id) + '\\',' + o.version + ')">Selecionar</button>' +
      "</div></div>";
  });
  return h;
}
function refine(dsId, optionId) {
  var v = $("rf-" + optionId).value;
  post("/api/option/refine", { project: projectId, dsId: dsId, optionId: optionId, instruction: v })
    .then(load).catch(function (e) { alert(e.message); });
}
function pick(dsId, optionId, version) {
  post("/api/option/select", { project: projectId, dsId: dsId, optionId: optionId, version: String(version) })
    .then(load).catch(function (e) { alert(e.message); });
}

function stateDoc(doc) {
  function li(a) { return a.length ? "<ul>" + a.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>" : "<i class='kv'>—</i>"; }
  return '<dl class="stateDoc">' +
    "<dt>Objetivo</dt><dd>" + esc(doc.objective) + "</dd>" +
    "<dt>Fase</dt><dd>" + esc(doc.phase) + "</dd>" +
    "<dt>Decisões aprovadas</dt><dd>" + li(doc.approvedDecisions) + "</dd>" +
    "<dt>Artefactos ativos</dt><dd>" + li(doc.activeArtifacts) + "</dd>" +
    "<dt>Questões por resolver</dt><dd>" + li(doc.unresolvedQuestions) + "</dd>" +
    "<dt>Restrições</dt><dd>" + li(doc.constraints) + "</dd>" +
    "<dt>Próxima ação</dt><dd><b>" + esc(doc.nextAction) + "</b></dd></dl>";
}

function tabsBar() {
  function t(id, label) {
    return '<button class="tab' + (view === id ? " on" : "") +
      '" onclick="setView(\\'' + id + '\\')">' + label + "</button>";
  }
  return '<div class="tabs">' + t("agora", "Agora") + t("historia", "História") +
    t("hi", "Inteligência Humana") + t("audit", "Detalhes / Auditoria") + "</div>";
}
function setView(v) { view = v; render(); }

function render() {
  var s = state;
  if (!s || !s.project) return;
  var h = '<h1><a href="/">AgentOS</a> · ' + esc(s.project.name) + "</h1>" +
    '<div class="sub">passagem ' + s.project.iteration + " pelo ciclo" +
    (isConcluded(s.project) ? ' <span class="badge ok">concluído</span>' : "") + "</div>";
  h += journeyBar(s);
  h += tabsBar();
  if (view === "historia" || view === "hi") {
    h += '<div id="viewbox" class="kv">a carregar…</div>';
    app.innerHTML = h;
    if (view === "historia") loadStory();
    if (view === "hi") loadHi();
    return;
  }
  h += view === "audit" ? auditBody(s) : agoraBody(s);
  var focus = document.activeElement && document.activeElement.id;
  var vals = {};
  ["answer", "dnote", "pnote", "improveDir", "cnote"].forEach(function (id) {
    if ($(id)) vals[id] = $(id).value;
  });
  app.innerHTML = h;
  Object.keys(vals).forEach(function (id) { if ($(id)) $(id).value = vals[id]; });
  if (focus && $(focus)) $(focus).focus();
  if (view === "agora" && !isConcluded(s.project)) {
    if (s.stage === "consult") loadProbe("consult");
    if (s.stage === "candidate") loadProbe("decision");
    if (s.stage === "execute") loadProbe("execute");
  }
}

// Agora: o cartão dominante + o que já existe (resultados, respostas, estado).
// O diagnóstico técnico (agentes, work orders, eventos, runtime) vive na
// Auditoria — disponível, nunca a dominar o ecrã.
function agoraBody(s) {
  var h = "";
  if (s.lastError) {
    h += '<div class="card" style="border-left:4px solid var(--bad)"><div class="err">⚠ ' +
      esc(s.lastError) + "</div></div>";
  }
  h += primaryCard();

  if (s.artifacts.length) {
    h += '<div class="card"><h2>Resultados</h2>';
    s.artifacts.forEach(function (a) {
      h += "<details" + (a.content ? " open" : "") + "><summary>passagem " + a.iteration + " · " +
        esc(a.agentId) + "</summary>";
      if (a.seeds && a.seeds.length) {
        h += "<div>";
        a.seeds.forEach(function (x) {
          var voice = x.senseiTitle || x.mentorTitle;
          h += '<span class="xchip" title="' + esc(x.reason) + '">🧠 ' + esc(x.title) + " v" + x.version +
            (voice ? " · 🥋 " + esc(voice) : "") + "</span>";
        });
        h += '<span class="kv" style="font-size:11px"> inteligência humana que moldou este resultado</span></div>';
      }
      if (a.content) h += "<pre>" + esc(a.content) + "</pre>";
      else h += '<div class="kv">de uma passagem anterior — <a style="color:var(--acc);cursor:pointer" ' +
        'onclick="viewArtifact(' + a.iteration + ',\\'' + esc(a.agentId) + '\\', this)">ver</a></div>';
      h += "</details>";
    });
    h += "</div>";
  }
  if (s.approved && s.stage !== "approve") {
    h += '<div class="card"><details><summary>O que já está decidido (estado aprovado, passagem ' +
      s.approved.iteration + ")</summary>" + stateDoc(s.approved.state) + "</details></div>";
  }
  if (s.interview.answered.length) {
    h += '<div class="card"><details><summary>Respostas que já dei (' + s.interview.answered.length +
      ")</summary>";
    s.interview.answered.forEach(function (q) {
      h += '<div style="margin-top:10px"><div class="kv"><b>' + esc(q.text) + "</b></div><div>" +
        esc(q.answer) + "</div></div>";
    });
    h += "</details></div>";
  }
  if (!isConcluded(s.project)) {
    h += '<div class="card"><h2>Dar direção</h2>' +
      '<div class="kv">A tua nota entra no contexto de todo o trabalho seguinte.</div>' +
      '<div class="row" style="margin-top:8px"><input id="pnote" class="grow" placeholder="ex.: mantém tudo em PT-PT">' +
      '<button class="ghost" onclick="note()">Registar</button></div></div>';
    // Ponto D: a estratégia de esforço é do utilizador — um perfil por fase,
    // editável a qualquer momento; o slider por lançamento faz o override.
    var ep = s.effortProfile || { questions: "low", options: "low", execution: "low" };
    h += '<div class="card"><details><summary>Perfil de esforço por fase — perguntas <b>' +
      esc(ep.questions) + "</b> · opções <b>" + esc(ep.options) + "</b> · execução <b>" +
      esc(ep.execution) + "</b></summary>" +
      '<div class="kv" style="margin-top:6px">"Um modelo melhor a planear e um pior a executar, ou vice-versa" — a estratégia é tua. ' +
      "As re-consultas automáticas usam o nível de Perguntas.</div>" +
      '<div class="row" style="margin-top:8px">' +
      '<div class="grow"><label>Perguntas (consultas, re-consultas, refinamentos)</label>' + levelSelect("efq", ep.questions) + "</div>" +
      '<div class="grow"><label>Opções (superfícies de decisão, síntese)</label>' + levelSelect("efo", ep.options) + "</div>" +
      '<div class="grow"><label>Execução (criar)</label>' + levelSelect("efe", ep.execution) + "</div></div>" +
      '<div style="margin-top:10px"><button class="ghost" onclick="saveProfile()">Guardar perfil</button></div>' +
      "</details></div>";
  }
  return h;
}

function levelSelect(id, current) {
  var h = '<select id="' + id + '">';
  state.levels.forEach(function (l) {
    h += '<option value="' + esc(l.level) + '"' + (l.level === current ? " selected" : "") + ">" +
      esc(l.level) + " · " + esc(l.workerModel) + "</option>";
  });
  return h + "</select>";
}

// Detalhes / Auditoria: runtime, etapa interna, agentes, work orders, eventos —
// tudo inspecionável, nada disto é linguagem principal.
function auditBody(s) {
  var ep = s.effortProfile || {};
  var h = '<div class="card"><h2>Sistema</h2><div class="kv">' +
    "runtime <b>" + esc(s.runtime) + "</b> · etapa interna <b>" + esc(s.stage) + "</b>" +
    " · autoridade automática ≤ <b>" + esc(s.autoMaxLevel) + "</b>" +
    " · perfil de esforço <b>" + esc(ep.questions || "?") + "/" + esc(ep.options || "?") + "/" + esc(ep.execution || "?") + "</b>" +
    " · iteração <b>" + s.project.iteration + "</b>" +
    " · estado <b>" + esc(s.project.status || "active") + "</b>" +
    (s.busy ? ' · em curso: <b>' + esc(s.busy.op) + "</b> desde " + esc(s.busy.startedAt.slice(11, 19)) : "") +
    "</div>" + metersLine(s) + "</div>";
  if (s.roster) {
    h += '<div class="card"><h2>Agentes temporários</h2>' +
      '<div class="kv">Vasos operacionais, não personalidades: mandato + contexto + expertise admitida ' +
      "+ orçamento de esforço, compostos no momento.</div><div style='margin-top:8px'>";
    s.roster.forEach(function (a) {
      h += '<span class="agent"><b>' + esc(a.title) + "</b><div>" + esc(a.mandate) + "</div></span>";
    });
    h += "</div></div>";
  }
  if (s.workOrders.length) {
    h += '<div class="card"><h2>Work orders desta iteração</h2>';
    s.workOrders.forEach(function (w) {
      h += '<div class="wo"><b>' + esc(w.id) + "</b> · " + esc(w.kind) + " · " + esc(w.model) +
        " · esforço " + esc(w.effortLevel) + " · " + esc(w.status) +
        (w.error ? ' · <span class="err">' + esc(w.error) + "</span>" : "") + "</div>";
    });
    h += "</div>";
  }
  if (s.events.length) {
    h += '<div class="card"><h2>Evidência (últimos ' + s.events.length + " eventos)</h2>";
    s.events.forEach(function (e) {
      h += '<div class="ev">' + esc(e.ts.slice(11, 19)) + " it" + e.iteration + " <b>" +
        esc(e.action) + "</b> · " + esc(e.actor) +
        (e.agentId ? " · " + esc(e.agentId) : "") + (e.note ? " · " + esc(e.note) : "") + "</div>";
    });
    h += "</div>";
  }
  return h;
}

// ---------------- história (a linha do tempo do projeto) ----------------
var LBL = {
  project_init: "Projeto criado",
  project_concluded: "Concluí o projeto — congelado e arquivado, nada apagado",
  project_reopened: "Reabri o projeto",
  roster_ready: "Agentes temporários convocados",
  consulted: "Consulta",
  reconsulted: "Reconsulta (após a minha resposta)",
  question_answered: "Respondi a uma pergunta",
  candidate_built: "Estado candidato construído",
  state_approved: "Aprovei o estado do projeto",
  state_rejected: "Rejeitei o candidato, com direção",
  execution_started: "Mandei executar",
  artifact_returned: "Artefacto entregue",
  iteration_advanced: "Avancei a iteração",
  pilot_note: "Nota minha ao Kernel",
  expertise_added: "Expertise registada (candidata)",
  expertise_admitted: "Expertise admitida por mim",
  expertise_discarded: "Expertise descartada por mim",
  seed_candidate_added: "GuruSeed candidata registada",
  seed_admitted: "GuruSeed admitida por mim",
  seed_rejected: "GuruSeed rejeitada por mim",
  seed_candidate_extracted: "O refinamento gerou uma GuruSeed candidata",
  seed_evidence: "A minha evidência voltou à GuruSeed",
  seed_revised: "Revi uma GuruSeed — nova versão, a anterior fica na história",
  context_sufficient: "Declarei o contexto suficiente — perguntas adiadas",
  mentor_saved: "Mentor guardado/evoluído (pré-reforma)",
  sensei_saved: "Sensei guardado/evoluído",
  sensei_victory: "Vitória de um Sensei — a escolha evoluiu quem a sugeriu",
  effort_profile_set: "Defini o perfil de esforço por fase",
  decision_opened: "Superfície de decisão aberta",
  option_refined: "Refinei uma opção",
  option_selected: "Selecionei uma opção"
};

function tlItem(i) {
  var h = '<div class="tli' + (i.actor === "pilot" ? " pilot" : "") + '">' +
    '<div class="when">' + esc(i.ts.slice(11, 19)) + "</div><div>" +
    '<span class="lbl">' + (LBL[i.action] || esc(i.action)) + "</span>" +
    '<span class="who">' + (i.actor === "pilot" ? "Tu" : "Kernel") + "</span>";
  if (i.agentTitle) h += " · " + esc(i.agentTitle);
  if (i.effortLevel) h += ' <span class="badge">' + esc(i.effortLevel) + " · " + esc(i.model || "") + "</span>";
  h += "</div>";
  if (i.mandate) h += '<div class="kv">mandato: ' + esc(i.mandate) + "</div>";
  if (i.expertise && i.expertise.length) {
    h += "<div>";
    i.expertise.forEach(function (x) {
      h += '<span class="xchip" title="' + esc(x.reason) + '">🧠 ' + esc(x.title) + "</span>";
    });
    h += '<span class="kv" style="font-size:11px"> (passa o rato para veres porquê)</span></div>';
  }
  if (i.questionText) {
    h += '<div class="kv">Pergunta' + (i.askedBy ? " (de " + esc(i.askedBy.join(", ")) + ")" : "") +
      ": <b>" + esc(i.questionText) + "</b></div>";
    if (i.answer) h += "<div>" + esc(i.answer) + "</div>";
  }
  if (i.note) h += '<div class="kv">' + esc(i.note) + "</div>";
  if (i.output) {
    h += "<details><summary>output do trabalho (" + (i.outputChars || i.output.length) +
      " chars — proveniência operacional, nunca raciocínio)</summary><pre>" +
      esc(i.output) + "</pre></details>";
  }
  return h + "</div>";
}

function loadStory() {
  fetch("/api/story?project=" + encodeURIComponent(projectId))
    .then(function (r) { return r.json(); })
    .then(function (st) {
      var box = $("viewbox");
      if (!box || view !== "historia") return;
      var h = '<div class="card"><h2>O que pedi (a intenção fundadora, verbatim)</h2><div>' +
        esc(st.intent.description) + '</div><div class="kv" style="margin-top:6px">' +
        esc(st.intent.createdAt.slice(0, 16).replace("T", " ")) + "</div></div>";
      st.iterations.forEach(function (it) {
        h += '<div class="itdiv">Iteração ' + it.iteration + '</div><div class="tl">';
        it.items.forEach(function (i) { h += tlItem(i); });
        h += "</div>";
      });
      if (!st.iterations.length) h += '<div class="kv">ainda sem eventos — convoca a equipa no separador Agora.</div>';
      box.innerHTML = h;
    });
}

// ---------------- inteligência humana (o ativo durável) ----------------
function senseiTitleOf(id) {
  var m = hiData && hiData.senseis.filter(function (x) { return x.id === id; })[0];
  return m ? m.title : id;
}
function seedCard(s, isCandidate) {
  var scope = (s.scope.projects.length ? "local: " + s.scope.projects.join(", ") : "reutilizável") +
    (s.scope.domains.length ? " · domínios: " + s.scope.domains.join(", ") : "") +
    (s.sensei ? " · 🥋 " + esc(senseiTitleOf(s.sensei)) : " · sem Sensei (atribui ao admitir)");
  var h = '<div class="xp"><b>🧠 ' + esc(s.title) + '</b><span class="st ' + esc(s.status) + '">' +
    esc(s.status) + " v" + s.version + '</span> <span class="kv">' + esc(scope) + "</span>" +
    "<div style='margin-top:4px'>" + esc(s.rule) + "</div>" +
    (s.why ? '<div class="kv">porquê: ' + esc(s.why) + "</div>" : "") +
    '<div class="kv">proveniência: ' + esc(s.provenance.origin) +
    (s.provenance.note ? " — " + esc(s.provenance.note) : "") +
    (s.provenance.admitted_at ? " · admitida " + esc(s.provenance.admitted_at.slice(0, 10)) : "") + "</div>";
  if (s.applied_in && s.applied_in.length) {
    h += "<details><summary class='kv'>aplicada em " + s.applied_in.length +
      " work orders</summary><div class='kv'>";
    s.applied_in.forEach(function (a) {
      h += esc(a.project) + " · " + esc(a.workOrder) + " · " + esc(a.ts.slice(0, 16).replace("T", " ")) + "<br>";
    });
    h += "</div></details>";
  } else {
    h += '<div class="kv">ainda não aplicada</div>';
  }
  if (!isCandidate && s.status === "admitted") {
    var sup = (s.evidence && s.evidence.supporting) || [];
    var con = (s.evidence && s.evidence.contradicting) || [];
    if (sup.length || con.length) {
      h += "<details><summary class='kv'>evidência: " + sup.length + " a favor · " +
        con.length + " contra</summary><div class='kv'>";
      sup.forEach(function (e) { h += "✓ " + esc(e) + "<br>"; });
      con.forEach(function (e) { h += "✗ " + esc(e) + "<br>"; });
      h += "</div></details>";
    }
    h += '<label>O teu veredicto sobre esta seed em uso — a evidência volta ao ativo</label>' +
      '<div class="row"><input id="evn-' + esc(s.id) + '" class="grow" placeholder="ex.: o artefacto ganhou com esta regra">' +
      '<button class="ghost" onclick="seedEvidence(\\'' + esc(s.id) + '\\',\\'supporting\\')">Reforçou ✓</button>' +
      '<button class="danger" onclick="seedEvidence(\\'' + esc(s.id) + '\\',\\'contradicting\\')">Contradisse ✗</button></div>';
  }
  if (isCandidate) {
    var senseiSel = '<select id="sn-' + esc(s.id) + '" style="width:auto">';
    (hiData ? hiData.senseis : []).forEach(function (m) {
      senseiSel += '<option value="' + esc(m.id) + '"' + (s.sensei === m.id ? " selected" : "") + ">" +
        esc(m.title) + "</option>";
    });
    senseiSel += "</select>";
    h += '<label>Editar a regra antes de admitir (opcional — a última palavra é tua)</label>' +
      '<textarea id="ed-' + esc(s.id) + '">' + esc(s.rule) + "</textarea>" +
      '<label>Sensei dono — uma seed pertence a exatamente UM Sensei</label>' + senseiSel +
      '<div class="row" style="margin-top:8px">' +
      '<button onclick="decideSeed(\\'' + esc(s.id) + '\\',\\'admit\\')">Admitir</button>' +
      '<button class="danger" onclick="decideSeed(\\'' + esc(s.id) + '\\',\\'reject\\')">Rejeitar</button></div>';
  }
  return h + "</div>";
}

// O cartão do Sensei — a entidade que evolui: vitórias, graduação (faixa),
// e a sanidade face à fotografia de referência (base/), quando existe.
function senseiCard(m, seeds) {
  var byId = {};
  seeds.forEach(function (s) { byId[s.id] = s; });
  var owned = seeds.filter(function (s) { return s.sensei === m.id; });
  var h = '<div class="xp"><b>🥋 ' + esc(m.title) + '</b><span class="st admitted">v' + m.version + "</span>" +
    ' <span class="badge acc">' + esc(m.graduation) + " · " + m.victories.length + " vitória(s)</span>" +
    '<div class="kv">' + esc(m.persona) +
    (m.domains && m.domains.length ? " · ofício: " + esc(m.domains.join(", ")) : "") +
    "</div><div style='margin-top:4px'>";
  owned.forEach(function (s) {
    h += '<span class="xchip" title="' + esc(s.rule) + '">🧠 ' + esc(s.title) + "</span>";
  });
  if (!owned.length) h += '<span class="kv">ainda sem seeds próprias</span>';
  h += "</div>";
  if (m.victories.length) {
    h += "<details><summary class='kv'>as vitórias que o fizeram evoluir</summary><div class='kv'>";
    m.victories.forEach(function (v) {
      h += "🏆 " + esc(v.ts.slice(0, 16).replace("T", " ")) + " · " + esc(v.project) +
        " · " + esc(v.decision.slice(0, 80)) + "<br>";
    });
    h += "</div></details>";
  }
  if (m.sanity && m.sanity.hasBase) {
    var sa = m.sanity;
    h += '<div class="kv" style="margin-top:4px">Sanidade vs fotografia: base v' + sa.baseVersion +
      " → atual v" + sa.currentVersion +
      (sa.seedsAdded.length ? " · aprendeu: " + esc(sa.seedsAdded.join(", ")) : "") +
      (sa.seedsRemoved.length ? " · <span style='color:var(--warn)'>perdeu: " + esc(sa.seedsRemoved.join(", ")) + "</span>" : "") +
      (sa.seedsAdded.length || sa.seedsRemoved.length ? "" : " · fiel à base") + "</div>";
  }
  h += (m.selection_notes.length ?
    '<div class="kv">notas: ' + esc(m.selection_notes.join(" · ")) + "</div>" : "") +
    '<div class="row" style="margin-top:8px"><button class="ghost" onclick="editSensei(\\'' +
    esc(m.id) + '\\')">Editar / evoluir</button></div></div>';
  return h;
}

var hiData = null;
function loadHi() {
  fetch("/api/hi")
    .then(function (r) { return r.json(); })
    .then(function (d) {
      hiData = d;
      var box = $("viewbox");
      if (!box || view !== "hi") return;
      var h = '<div class="card"><h2>Senseis — o dojo do teu julgamento</h2>' +
        '<div class="kv">Um Sensei não é um agente de IA: é o perito com nome de UM ofício, ' +
        "dono das suas GuruSeeds. Quando escolhes uma opção que ele sugeriu, a vitória volta " +
        "para ele — evolui de faixa com o uso, como um lutador que ganha. Ranking por vitórias.</div>" +
        "<div style='margin-top:8px'>" +
        (d.senseis.length ? d.senseis.map(function (m) { return senseiCard(m, d.seeds); }).join("") :
          '<div class="kv">ainda sem Senseis — cria o primeiro em baixo.</div>') + "</div>" +
        '<details id="mform"><summary style="color:var(--acc);cursor:pointer;margin-top:8px">Criar / editar Sensei</summary>' +
        '<input type="hidden" id="mid">' +
        '<label>Nome (ex.: Sensei da Cozinha)</label><input id="mt">' +
        '<label>Persona — a voz, numa linha</label><input id="mp" placeholder="ex.: contenção antes do impacto; consequência física antes do espetáculo">' +
        '<label>Ofício — domínios que serve (vírgulas; são o que o convoca aos papéis)</label>' +
        '<input id="md" placeholder="ex.: culinaria, cozinha">' +
        '<label>GuruSeeds que este Sensei carrega</label><div id="mseeds">' +
        d.seeds.filter(function (s) { return s.status === "admitted"; }).map(function (s) {
          return '<label style="display:flex;gap:6px;align-items:center;margin:2px 0"><input type="checkbox" ' +
            'value="' + esc(s.id) + '" style="width:auto"> ' + esc(s.title) + "</label>";
        }).join("") + "</div>" +
        '<label>Notas de seleção (uma por linha)</label><textarea id="mn"></textarea>' +
        '<div style="margin-top:10px"><button onclick="saveSensei()">Guardar Sensei</button></div></details></div>';

      var candidates = d.candidates;
      h += '<div class="card"><h2>Candidatas — à espera do teu julgamento</h2>' +
        (candidates.length ? candidates.map(function (s) { return seedCard(s, true); }).join("") :
          '<div class="kv">nenhuma — candidatas nascem dos teus refinamentos, ou da tua mão em baixo.</div>') + "</div>";

      h += '<div class="card"><h2>GuruSeeds admitidas</h2>' +
        (d.seeds.length ? d.seeds.map(function (s) { return seedCard(s, false); }).join("") :
          '<div class="kv">vazia — a biblioteca cresce com o teu julgamento, não com transcrições.</div>') + "</div>";

      var seedSenseiSel = '<select id="ss">' + d.senseis.map(function (m) {
        return '<option value="' + esc(m.id) + '">' + esc(m.title) + "</option>";
      }).join("") + "</select>";
      h += '<div class="card"><h2>Registar GuruSeed à mão</h2>' +
        '<label>Título</label><input id="st">' +
        '<label>A regra (o julgamento, nas tuas palavras)</label><textarea id="sr"></textarea>' +
        '<label>Porquê</label><input id="sw">' +
        '<div class="row"><div class="grow"><label>Sensei dono</label>' +
        (d.senseis.length ? seedSenseiSel : '<span class="kv">cria primeiro um Sensei</span>') + "</div>" +
        '<div class="grow"><label>Domínios (vírgulas)</label><input id="sd"></div>' +
        '<div><label>Alcance</label><select id="sc"><option value="reusable">reutilizável</option>' +
        '<option value="project">só este projeto</option></select></div></div>' +
        '<div style="margin-top:10px"><button onclick="addSeed()">Registar candidata</button></div></div>';
      box.innerHTML = h;
    });
}
function addSeed() {
  post("/api/hi/seed", { project: projectId, title: $("st").value, rule: $("sr").value,
    why: $("sw").value, domains: $("sd").value, reach: $("sc").value,
    sensei: $("ss") ? $("ss").value : "" })
    .then(loadHi).catch(function (e) { alert(e.message); });
}
function decideSeed(id, d) {
  var edited = $("ed-" + id) ? $("ed-" + id).value : "";
  var sensei = $("sn-" + id) ? $("sn-" + id).value : "";
  post("/api/hi/seed/decide", { project: projectId, seedId: id, decision: d,
    editedRule: edited, senseiId: sensei })
    .then(loadHi).catch(function (e) { alert(e.message); });
}
function seedEvidence(id, kind) {
  var n = $("evn-" + id);
  post("/api/hi/seed/evidence", { project: projectId, seedId: id, kind: kind, note: n ? n.value : "" })
    .then(loadHi).catch(function (e) { alert(e.message); });
}
function editSensei(id) {
  var m = hiData && hiData.senseis.filter(function (x) { return x.id === id; })[0];
  if (!m) return;
  $("mform").open = true;
  $("mid").value = m.id;
  $("mt").value = m.title;
  $("mp").value = m.persona;
  $("md").value = (m.domains || []).join(", ");
  $("mn").value = m.selection_notes.join("\\n");
  var pinned = {};
  m.seeds.forEach(function (p) { pinned[p.id] = true; });
  document.querySelectorAll("#mseeds input").forEach(function (cb) { cb.checked = !!pinned[cb.value]; });
  $("mt").focus();
}
function saveSensei() {
  var ids = [];
  document.querySelectorAll("#mseeds input").forEach(function (cb) { if (cb.checked) ids.push(cb.value); });
  post("/api/hi/sensei", { project: projectId, id: $("mid").value, title: $("mt").value,
    persona: $("mp").value, domains: $("md").value, seedIds: ids.join(","), notes: $("mn").value })
    .then(loadHi).catch(function (e) { alert(e.message); });
}

function op(name) {
  var payload = { project: projectId, op: name, level: levelFor(name) };
  if (name === "decision" && $("optcount")) payload.options = $("optcount").value;
  post("/api/op", payload)
    .then(function () { levelChosen = null; load(); })
    .catch(function (e) { alert(e.message); });
}
function saveProfile() {
  post("/api/project/effort", { project: projectId,
    effortQuestions: $("efq").value, effortOptions: $("efo").value,
    effortExecution: $("efe").value })
    .then(function () { levelChosen = null; lastJson = ""; load(); })
    .catch(function (e) { alert(e.message); });
}
function answer(qid) {
  post("/api/answer", { project: projectId, questionId: qid, answer: $("answer").value })
    .then(load).catch(function (e) { alert(e.message); });
}
function enough() {
  post("/api/interview/enough", { project: projectId, note: "" })
    .then(load).catch(function (e) { alert(e.message); });
}
function decide(d) {
  var note = $("dnote").value;
  if (d === "reject" && !note.trim()) { alert("A rejeição pede a tua nota — é a direção da reconstrução."); return; }
  post("/api/decide", { project: projectId, decision: d, note: note })
    .then(load).catch(function (e) { alert(e.message); });
}
function advance() {
  post("/api/advance", { project: projectId }).then(load).catch(function (e) { alert(e.message); });
}
function improve() {
  // "Melhorar" não é uma etapa isolada: é uma nova passagem pelo ciclo com a
  // tua direção à frente, preservando as decisões anteriores.
  post("/api/advance", { project: projectId, direction: $("improveDir").value })
    .then(load).catch(function (e) { alert(e.message); });
}
function concludeUI() { concluding = true; lastJson = ""; render(); }
function cancelConclude() { concluding = false; lastJson = ""; render(); }
function doConclude() {
  post("/api/project/conclude", { project: projectId, note: $("cnote").value })
    .then(function () { concluding = false; lastJson = ""; load(); })
    .catch(function (e) { alert(e.message); });
}
function reopen() {
  post("/api/project/reopen", { project: projectId })
    .then(function () { lastJson = ""; load(); })
    .catch(function (e) { alert(e.message); });
}
function note() {
  post("/api/note", { project: projectId, note: $("pnote").value })
    .then(function () { $("pnote").value = ""; load(); }).catch(function (e) { alert(e.message); });
}
function viewArtifact(it, agent, el) {
  fetch("/api/artifact?project=" + encodeURIComponent(projectId) + "&iteration=" + it +
    "&agent=" + encodeURIComponent(agent))
    .then(function (r) { return r.json(); })
    .then(function (d) {
      var pre = document.createElement("pre");
      pre.textContent = d.content;
      el.parentElement.parentElement.appendChild(pre);
      el.parentElement.remove();
    });
}

if (projectId) { load(); setInterval(load, 2500); } else { renderHome(); }
</script>
</body>
</html>`;

server.listen(PORT, () => {
  console.log(`AgentOS shell — http://localhost:${PORT} (runtime: ${RUNTIME_NAME})`);
  if (RUNTIME_NAME === "cli") {
    console.log(
      `  the cli runtime needs a logged-in "claude" — if it fails, run "claude" once\n` +
        `  in a terminal, or restart with PRODUCT_RUNTIME=mailbox (human-in-the-middle).`,
    );
  }
});
