// The AgentOS shell — the product's face (docs/PRODUCT-LOOP.md, Operating
// Model §12): "I state what I want. The system digests it. A team works
// underneath. I see only the questions and choices that matter. I decide."
//
// One HTTP server, no dependencies, localhost:4900. The user sees one primary
// action per loop stage; everything below the authority line moves by itself.

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { existsSync } from "node:fs";

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
  decideCandidate,
  decideSeedGoverned,
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
  declareContextSufficient,
  recordSeedEvidenceGoverned,
  runCandidate,
  runConsult,
  runDecisionSurface,
  runExecute,
  saveMentorGoverned,
  selectOption,
  stageOf,
  storyOf,
  topOpenQuestion,
} from "../kernel.js";
import {
  ensureImmutableProvenance,
  listCandidates,
  listMentors,
  listSeeds,
  migrateLegacyExpertise,
} from "../hi.js";
import { iterationDir, MAILBOX_DIR, projectDir, WORKSPACE_DIR } from "../paths.js";
import { resolveRuntime } from "../runtime.js";
import { abs, readText, writeJson } from "../stores.js";

const PORT = 4900;
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

function plannedCalls(projectId: string, op: string, level: EffortLevel): number {
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
    const options = Math.max(2, Math.min(spec.maxAgents, 4));
    return options + (level === "minimal" ? 0 : 1); // +1 for the recommendation
  }
  return 1;
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
    busy: busy.get(projectId) ?? null,
    lastError: lastError.get(projectId) ?? null,
  };
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
    json(res, 200, { projects: listProjects(), runtime: RUNTIME_NAME });
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/project") {
    const b = await body(req);
    if (!b["name"]?.trim() || !b["description"]?.trim()) {
      json(res, 400, { error: "nome e descrição são obrigatórios" });
      return;
    }
    const project = initProject(b["name"], b["description"]);
    json(res, 200, { id: project.id });
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
    json(res, 200, {
      probe: probeEffort({
        workspaceDir: WORKSPACE_DIR,
        level,
        plannedCalls: plannedCalls(project.id, q("op") || "execute", level),
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
    json(res, 200, {
      seeds: listSeeds(),
      candidates: listCandidates(),
      mentors: listMentors(),
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
    );
    json(res, 200, { ok: true });
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/interview/enough") {
    const b = await body(req);
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
  if (req.method === "POST" && url.pathname === "/api/hi/mentor") {
    const b = await body(req);
    if (!b["title"]?.trim()) {
      json(res, 400, { error: "o Mentor precisa de um nome" });
      return;
    }
    const mentor = saveMentorGoverned(b["project"] ?? "", {
      ...(b["id"]?.trim() ? { id: b["id"].trim() } : {}),
      title: b["title"],
      persona: b["persona"] ?? "",
      seedIds: (b["seedIds"] ?? "").split(",").map((s) => s.trim()).filter((s) => s !== ""),
      selectionNotes: (b["notes"] ?? "").split("\n").map((n) => n.trim()).filter((n) => n !== ""),
    });
    json(res, 200, { id: mentor.id, version: mentor.version });
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/option/refine") {
    const b = await body(req);
    const projectId = b["project"] ?? "";
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
    const op = b["op"] ?? "";
    const level = asLevel(b["level"]);
    const project = getProject(projectId);
    const work = async (): Promise<void> => {
      if (op === "consult") {
        await runConsult({ projectId, level, runtime });
      } else if (op === "candidate") {
        await runCandidate({ projectId, level, runtime });
      } else if (op === "decision") {
        await runDecisionSurface({ projectId, level, runtime });
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
    advanceIteration(b["project"] ?? "");
    json(res, 200, { ok: true });
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/note") {
    const b = await body(req);
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
  h2 { font-size:15px; margin:0 0 10px; color:var(--acc); }
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

// ---------------- home ----------------
function renderHome() {
  fetch("/api/projects").then(function (r) { return r.json(); }).then(function (data) {
    var h = '<h1>AgentOS</h1><div class="sub">Declara a intenção. O sistema digere. ' +
      'Tu governas. <span class="badge">runtime: ' + esc(data.runtime) + '</span></div>';
    h += '<div class="card"><h2>Novo projeto</h2>' +
      '<label>Nome</label><input id="pname" placeholder="O nome do projeto">' +
      '<label>O que queres? (texto livre — a intenção fundadora)</label>' +
      '<textarea id="pdesc" placeholder="Descreve o que queres que exista no fim…"></textarea>' +
      '<div style="margin-top:12px"><button onclick="createProject()">Criar projeto</button></div>' +
      '<div class="err" id="cerr"></div></div>';
    if (data.projects.length) {
      h += "<h2 style='margin:18px 0 10px'>Projetos</h2>";
      data.projects.forEach(function (p) {
        h += '<a class="proj" href="/?p=' + esc(p.id) + '"><b>' + esc(p.name) + "</b> " +
          '<small>· iteração ' + p.iteration + " · " + esc(p.id) + "</small></a>";
      });
    }
    app.innerHTML = h;
  });
}
function createProject() {
  post("/api/project", { name: $("pname").value, description: $("pdesc").value })
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

function levelSelector(op) {
  var lv = levelChosen || "low";
  var idx = state.levels.map(function (l) { return l.level; }).indexOf(lv);
  var spec = state.levels[idx];
  return '<label>Esforço — controla modelo, nº de agentes, contexto e retries</label>' +
    '<div class="row"><input type="range" min="0" max="4" step="1" value="' + idx + '" class="grow" ' +
    'oninput="setLevel(this.value, \\'' + op + '\\')">' +
    '<span class="badge acc">' + esc(lv) + " · " + esc(spec.workerModel) + "</span></div>" +
    '<div class="probe" id="probe">a estimar…</div>';
}
function setLevel(idx, op) {
  levelChosen = state.levels[Number(idx)].level;
  render();
  loadProbe(op);
}
function loadProbe(op) {
  if (!$("probe")) return;
  fetch("/api/probe?project=" + encodeURIComponent(projectId) + "&level=" +
    (levelChosen || "low") + "&op=" + op)
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

function primaryCard() {
  var s = state, h = "";
  if (s.busy) {
    return '<div class="card"><h2>Em curso</h2><div class="spin">⏳ ' + esc(s.busy.op) +
      " — desde " + esc(s.busy.startedAt.slice(11, 19)) +
      '</div><div class="kv" style="margin-top:6px">O Kernel move; tu decides quando ele voltar.</div></div>';
  }
  if (s.stage === "consult") {
    h = '<div class="card"><h2>1 · Convocar a equipa</h2>' +
      '<div class="kv">O Kernel ' + (s.roster ? "reconsulta os agentes" :
        "propõe agentes especialistas delimitados a partir da tua intenção") +
      " e recolhe as perguntas deles.</div>" + levelSelector("consult") +
      '<div style="margin-top:12px"><button onclick="op(\\'consult\\')">Convocar agentes e recolher perguntas</button></div></div>';
  } else if (s.stage === "interview" && s.interview.top) {
    var t = s.interview.top;
    h = '<div class="card"><h2>2 · Uma pergunta de cada vez</h2>' +
      '<div class="q">' + esc(t.text) + "</div>" +
      '<div class="kv">pedida por: <b>' + esc(t.askedBy.join(", ")) + "</b> · " +
      s.interview.open + " em aberto (as restantes esperam)</div>" +
      '<label>A tua resposta</label><textarea id="answer"></textarea>' +
      '<div class="row" style="margin-top:10px"><button onclick="answer(\\'' + esc(t.id) + '\\')">Responder</button>' +
      '<button class="ghost" onclick="enough()">Chega — constrói com o que tens</button></div>' +
      '<div class="kv" style="margin-top:6px">Ao responder, os agentes que perguntaram reconsultam automaticamente. ' +
      "Declarar suficiência é teu por direito: as perguntas em aberto ficam adiadas e visíveis, nunca respondidas por ti.</div></div>";
  } else if (s.stage === "decide" && s.surface) {
    h = decisionSurfaceCard(s.surface);
  } else if (s.stage === "candidate") {
    var rej = s.candidate && s.candidate.status === "rejected" && s.candidate.iteration === s.project.iteration;
    h = '<div class="card"><h2>3 · Decidir e condensar</h2><div class="kv">' +
      (rej ? "Rejeitaste o candidato anterior — o Kernel reconstrói com a tua nota." :
        "Sem perguntas em aberto. Podes pedir opções concretas (o Kernel mastiga e tu escolhes) " +
        "ou condensar já o estado do projeto.") +
      "</div>" + levelSelector("candidate") +
      '<div class="row" style="margin-top:12px">' +
      '<button onclick="op(\\'decision\\')">Quero opções (superfície de decisão)</button>' +
      '<button class="ghost" onclick="op(\\'candidate\\')">Construir estado candidato</button></div></div>';
  } else if (s.stage === "approve" && s.candidate) {
    h = '<div class="card"><h2>4 · Aprovas este estado?</h2>' + stateDoc(s.candidate.state) +
      '<label>Nota (obrigatória se rejeitares — é a tua direção)</label><textarea id="dnote"></textarea>' +
      '<div class="row" style="margin-top:10px"><button onclick="decide(\\'approve\\')">Aprovar</button>' +
      '<button class="danger" onclick="decide(\\'reject\\')">Rejeitar com nota</button></div></div>';
  } else if (s.stage === "execute") {
    h = '<div class="card"><h2>5 · Execução governada</h2>' +
      '<div class="kv">Estado aprovado. Próxima ação: <b>' +
      esc(s.approved ? s.approved.state.nextAction : "") + "</b></div>" + levelSelector("execute") +
      '<div style="margin-top:12px"><button onclick="op(\\'execute\\')">Executar</button></div>' +
      '<div class="kv" style="margin-top:6px">Os artefactos regressam sozinhos ao workspace do projeto.</div></div>';
  } else if (s.stage === "advance") {
    h = '<div class="card"><h2>6 · Iteração concluída</h2>' +
      '<div class="kv">Os artefactos desta iteração estão em baixo. O loop continua.</div>' +
      '<div style="margin-top:12px"><button onclick="advance()">Avançar para a iteração ' +
      (s.project.iteration + 1) + "</button></div></div>";
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
  var h = '<div class="card"><h2>Decisão governada</h2>' +
    '<div class="q">' + esc(ds.decision) + "</div>" +
    '<div class="kv">' + esc(ds.why) + " · O Kernel mastigou; a escolha é tua. " +
    "Podes selecionar, ou refinar uma opção com uma frase antes de selecionar.</div></div>";
  if (ds.recommendation) {
    h += '<div class="card" style="border-color:var(--warn)"><div class="kv">' +
      '<b style="color:var(--warn)">Recomendação do Kernel:</b> ' +
      esc(ds.recommendation.optionId) + " — " + esc(ds.recommendation.reason) + "</div></div>";
  }
  latestOptions(ds).forEach(function (o) {
    var mentors = {};
    (o.seeds || []).forEach(function (s) { if (s.mentorTitle) mentors[s.mentorTitle] = true; });
    var rec = ds.recommendation && ds.recommendation.optionId === o.id;
    h += '<div class="card"' + (rec ? ' style="border-color:var(--acc)"' : "") + ">" +
      "<h2>" + esc(o.title) + (rec ? " ★" : "") +
      ' <span class="badge">' + esc(o.direction) + "</span>" +
      (o.refinement ? ' <span class="badge acc">v' + o.version + " · refinada</span>" : "") + "</h2>" +
      "<div>" + esc(o.description) + "</div>" +
      (o.benefits ? '<div class="kv" style="margin-top:6px">A favor: ' + esc(o.benefits) + "</div>" : "") +
      (o.tradeoffs ? '<div class="kv">Atenção: ' + esc(o.tradeoffs) + "</div>" : "") +
      (o.refinement ? '<div class="kv">Refinamento aplicado: "' + esc(o.refinement) + '"</div>' : "");
    if (Object.keys(mentors).length) {
      h += "<div style='margin-top:6px'>";
      Object.keys(mentors).forEach(function (m) {
        h += '<span class="xchip">🎬 Mentor: ' + esc(m) + "</span>";
      });
      h += "</div>";
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
    t("hi", "Inteligência Humana") + "</div>";
}
function setView(v) { view = v; render(); }

function render() {
  var s = state;
  if (!s || !s.project) return;
  var h = '<h1><a href="/">AgentOS</a> · ' + esc(s.project.name) + "</h1>" +
    '<div class="sub">iteração ' + s.project.iteration +
    ' <span class="badge acc">' + esc(s.stage) + "</span>" +
    '<span class="badge">runtime: ' + esc(s.runtime) + "</span>" +
    '<span class="badge">autoridade automática ≤ ' + esc(s.autoMaxLevel) + "</span></div>";
  h += tabsBar();
  if (view !== "agora") {
    h += '<div id="viewbox" class="kv">a carregar…</div>';
    app.innerHTML = h;
    if (view === "historia") loadStory();
    if (view === "hi") loadHi();
    return;
  }
  h += agoraBody(s);
  var focus = document.activeElement && document.activeElement.id;
  var vals = {};
  ["answer", "dnote", "pnote"].forEach(function (id) { if ($(id)) vals[id] = $(id).value; });
  app.innerHTML = h;
  Object.keys(vals).forEach(function (id) { if ($(id)) $(id).value = vals[id]; });
  if (focus && $(focus)) $(focus).focus();
  if (s.stage === "consult") loadProbe("consult");
  if (s.stage === "candidate") loadProbe("candidate");
  if (s.stage === "execute") loadProbe("execute");
}

function agoraBody(s) {
  var h = "";
  if (s.lastError) {
    h += '<div class="card"><div class="err">⚠ ' + esc(s.lastError) + "</div></div>";
  }
  h += primaryCard();

  if (s.approved && s.stage !== "approve") {
    h += '<div class="card"><details><summary>Estado aprovado (it-' + s.approved.iteration +
      ")</summary>" + stateDoc(s.approved.state) + "</details></div>";
  }
  if (s.roster) {
    h += '<div class="card"><h2>Agentes temporários desta fase</h2>' +
      '<div class="kv">Vasos operacionais, não personalidades: cada um é composto no momento — ' +
      "mandato + contexto do projeto + expertise admitida + orçamento de esforço.</div><div style='margin-top:8px'>";
    s.roster.forEach(function (a) {
      h += '<span class="agent"><b>' + esc(a.title) + "</b><div>" + esc(a.mandate) + "</div></span>";
    });
    h += "</div></div>";
  }
  if (s.interview.answered.length) {
    h += '<div class="card"><details><summary>Respostas dadas (' + s.interview.answered.length +
      ")</summary>";
    s.interview.answered.forEach(function (q) {
      h += '<div style="margin-top:10px"><div class="kv"><b>' + esc(q.text) + "</b> · " +
        esc(q.askedBy.join(", ")) + "</div><div>" + esc(q.answer) + "</div></div>";
    });
    h += "</details></div>";
  }
  if (s.artifacts.length) {
    h += '<div class="card"><h2>Artefactos</h2>';
    s.artifacts.forEach(function (a) {
      h += "<details" + (a.content ? " open" : "") + "><summary>it-" + a.iteration + " · " +
        esc(a.agentId) + " · " + a.chars + " chars</summary>";
      if (a.seeds && a.seeds.length) {
        h += "<div>";
        a.seeds.forEach(function (x) {
          h += '<span class="xchip" title="' + esc(x.reason) + '">🧠 ' + esc(x.title) + " v" + x.version +
            (x.mentorTitle ? " · " + esc(x.mentorTitle) : "") + "</span>";
        });
        h += '<span class="kv" style="font-size:11px"> inteligência humana que moldou este artefacto</span></div>';
      }
      if (a.content) h += "<pre>" + esc(a.content) + "</pre>";
      else h += '<div class="kv">de uma iteração anterior — <a style="color:var(--acc);cursor:pointer" ' +
        'onclick="viewArtifact(' + a.iteration + ',\\'' + esc(a.agentId) + '\\', this)">ver</a></div>';
      h += "</details>";
    });
    h += "</div>";
  }
  h += '<div class="card"><h2>Nota ao Kernel</h2>' +
    '<div class="kv">A tua direção entra no contexto de todo o trabalho seguinte.</div>' +
    '<div class="row" style="margin-top:8px"><input id="pnote" class="grow" placeholder="ex.: mantém tudo em PT-PT">' +
    '<button class="ghost" onclick="note()">Registar</button></div></div>';
  if (s.events.length) {
    h += '<div class="card"><details><summary>Evidência (últimos ' + s.events.length +
      " eventos)</summary>";
    s.events.forEach(function (e) {
      h += '<div class="ev">' + esc(e.ts.slice(11, 19)) + " it" + e.iteration + " <b>" +
        esc(e.action) + "</b> · " + esc(e.actor) +
        (e.agentId ? " · " + esc(e.agentId) : "") + (e.note ? " · " + esc(e.note) : "") + "</div>";
    });
    h += "</details></div>";
  }
  return h;
}

// ---------------- história (a linha do tempo do projeto) ----------------
var LBL = {
  project_init: "Projeto criado",
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
  mentor_saved: "Mentor guardado/evoluído",
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
function seedCard(s, isCandidate) {
  var scope = (s.scope.projects.length ? "local: " + s.scope.projects.join(", ") : "reutilizável") +
    (s.scope.domains.length ? " · domínios: " + s.scope.domains.join(", ") : " · universal");
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
    h += '<label>Editar a regra antes de admitir (opcional — a última palavra é tua)</label>' +
      '<textarea id="ed-' + esc(s.id) + '">' + esc(s.rule) + "</textarea>" +
      '<div class="row" style="margin-top:8px">' +
      '<button onclick="decideSeed(\\'' + esc(s.id) + '\\',\\'admit\\')">Admitir</button>' +
      '<button class="danger" onclick="decideSeed(\\'' + esc(s.id) + '\\',\\'reject\\')">Rejeitar</button></div>';
  }
  return h + "</div>";
}

function mentorCard(m, seeds) {
  var byId = {};
  seeds.forEach(function (s) { byId[s.id] = s; });
  var h = '<div class="xp"><b>🎬 ' + esc(m.title) + '</b><span class="st admitted">v' + m.version + "</span>" +
    '<div class="kv">' + esc(m.persona) + "</div><div style='margin-top:4px'>";
  m.seeds.forEach(function (p) {
    var s = byId[p.id];
    h += '<span class="xchip" title="' + esc(s ? s.rule : "") + '">🧠 ' + esc(s ? s.title : p.id) + "</span>";
  });
  h += "</div>" + (m.selection_notes.length ?
    '<div class="kv">notas: ' + esc(m.selection_notes.join(" · ")) + "</div>" : "") +
    '<div class="row" style="margin-top:8px"><button class="ghost" onclick="editMentor(\\'' +
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
      var h = '<div class="card"><h2>Mentores — julgamento humano com nome</h2>' +
        '<div class="kv">Um Mentor não é um agente de IA: é a TUA inteligência composta ' +
        "(GuruSeeds) que os papéis temporários carregam. Constróis, evoluis, e nas decisões " +
        "vês qual Mentor sugeriu o quê.</div><div style='margin-top:8px'>" +
        (d.mentors.length ? d.mentors.map(function (m) { return mentorCard(m, d.seeds); }).join("") :
          '<div class="kv">ainda sem mentores — cria o primeiro em baixo.</div>') + "</div>" +
        '<details id="mform"><summary style="color:var(--acc);cursor:pointer;margin-top:8px">Criar / editar Mentor</summary>' +
        '<input type="hidden" id="mid">' +
        '<label>Nome (ex.: Realizador de Ação Contida)</label><input id="mt">' +
        '<label>Persona — a voz, numa linha</label><input id="mp" placeholder="ex.: contenção antes do impacto; consequência física antes do espetáculo">' +
        '<label>GuruSeeds que compõem este Mentor</label><div id="mseeds">' +
        d.seeds.filter(function (s) { return s.status === "admitted"; }).map(function (s) {
          return '<label style="display:flex;gap:6px;align-items:center;margin:2px 0"><input type="checkbox" ' +
            'value="' + esc(s.id) + '" style="width:auto"> ' + esc(s.title) + "</label>";
        }).join("") + "</div>" +
        '<label>Notas de seleção (uma por linha)</label><textarea id="mn"></textarea>' +
        '<div style="margin-top:10px"><button onclick="saveMentor()">Guardar Mentor</button></div></details></div>';

      var candidates = d.candidates;
      h += '<div class="card"><h2>Candidatas — à espera do teu julgamento</h2>' +
        (candidates.length ? candidates.map(function (s) { return seedCard(s, true); }).join("") :
          '<div class="kv">nenhuma — candidatas nascem dos teus refinamentos, ou da tua mão em baixo.</div>') + "</div>";

      h += '<div class="card"><h2>GuruSeeds admitidas</h2>' +
        (d.seeds.length ? d.seeds.map(function (s) { return seedCard(s, false); }).join("") :
          '<div class="kv">vazia — a biblioteca cresce com o teu julgamento, não com transcrições.</div>') + "</div>";

      h += '<div class="card"><h2>Registar GuruSeed à mão</h2>' +
        '<label>Título</label><input id="st">' +
        '<label>A regra (o julgamento, nas tuas palavras)</label><textarea id="sr"></textarea>' +
        '<label>Porquê</label><input id="sw">' +
        '<div class="row"><div class="grow"><label>Domínios (vírgulas; vazio = universal)</label><input id="sd"></div>' +
        '<div><label>Alcance</label><select id="sc"><option value="reusable">reutilizável</option>' +
        '<option value="project">só este projeto</option></select></div></div>' +
        '<div style="margin-top:10px"><button onclick="addSeed()">Registar candidata</button></div></div>';
      box.innerHTML = h;
    });
}
function addSeed() {
  post("/api/hi/seed", { project: projectId, title: $("st").value, rule: $("sr").value,
    why: $("sw").value, domains: $("sd").value, reach: $("sc").value })
    .then(loadHi).catch(function (e) { alert(e.message); });
}
function decideSeed(id, d) {
  var edited = $("ed-" + id) ? $("ed-" + id).value : "";
  post("/api/hi/seed/decide", { project: projectId, seedId: id, decision: d, editedRule: edited })
    .then(loadHi).catch(function (e) { alert(e.message); });
}
function seedEvidence(id, kind) {
  var n = $("evn-" + id);
  post("/api/hi/seed/evidence", { project: projectId, seedId: id, kind: kind, note: n ? n.value : "" })
    .then(loadHi).catch(function (e) { alert(e.message); });
}
function editMentor(id) {
  var m = hiData && hiData.mentors.filter(function (x) { return x.id === id; })[0];
  if (!m) return;
  $("mform").open = true;
  $("mid").value = m.id;
  $("mt").value = m.title;
  $("mp").value = m.persona;
  $("mn").value = m.selection_notes.join("\\n");
  var pinned = {};
  m.seeds.forEach(function (p) { pinned[p.id] = true; });
  document.querySelectorAll("#mseeds input").forEach(function (cb) { cb.checked = !!pinned[cb.value]; });
  $("mt").focus();
}
function saveMentor() {
  var ids = [];
  document.querySelectorAll("#mseeds input").forEach(function (cb) { if (cb.checked) ids.push(cb.value); });
  post("/api/hi/mentor", { project: projectId, id: $("mid").value, title: $("mt").value,
    persona: $("mp").value, seedIds: ids.join(","), notes: $("mn").value })
    .then(loadHi).catch(function (e) { alert(e.message); });
}

function op(name) {
  post("/api/op", { project: projectId, op: name, level: levelChosen || "low" })
    .then(load).catch(function (e) { alert(e.message); });
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
