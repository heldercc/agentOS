// The dashboard — a local, dependency-free web UI over the whole experiment
// (ADR-0012 / ADR-0013). One process serves everything: it runs the conductor
// in-process (baseline → scheduled → blind sheet), hosts the manual-model
// mailbox worker (spawning one Claude Code per work order on the Pilot's
// subscription — no API wallet), renders run progress live, lets the Pilot
// judge the blind sheet with buttons instead of hand-editing JSON, and shows
// RESULTS.md. The honesty guarantees all live in the engine modules this file
// calls; the dashboard only observes, forwards, and records verdicts.
//
// Usage: tsx src/cli/dashboard.ts [--port 4600]

import { spawn } from "node:child_process";
import {
  existsSync,
  readdirSync,
  renameSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { resolve } from "node:path";

import { aggregateResults, buildBlind } from "../eval.js";
import { runPath } from "../experiment.js";
import { loadProject } from "../project.js";
import { DATA_DIR, MAILBOX_DIR, REPO_ROOT, RUNS_DIR } from "../paths.js";
import { abs, readJson, readText, writeJson } from "../stores.js";

const DEFAULT_PORT = 4600;

// ---------------------------------------------------------------------------
// Conductor state — one comparison run at a time, driven in-process.

type Phase = "baseline" | "scheduled" | "blind" | "done" | "error";

interface ConductState {
  runId: string;
  model: string;
  phase: Phase;
  log: string[];
  error?: string;
  startedAt: string;
}

let conduct: ConductState | null = null;

function stamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

async function startConduct(model: string): Promise<void> {
  const runId = `${model}-${stamp()}`;
  const state: ConductState = {
    runId,
    model,
    phase: "baseline",
    log: [],
    startedAt: new Date().toISOString(),
  };
  conduct = state;
  const log = (m: string): void => {
    state.log.push(m);
  };
  try {
    if (model === "manual") startWorker(log);
    log(`[1/3] baseline (full reload)`);
    await runPath({ runId, path: "full-reload", modelArg: model, log });
    state.phase = "scheduled";
    log(`[2/3] scheduled`);
    await runPath({ runId, path: "scheduled", modelArg: model, log });
    state.phase = "blind";
    log(`[3/3] blind sheet`);
    buildBlind(runId, 1);
    state.phase = "done";
    log(`done — run ${runId} ready to judge`);
  } catch (err) {
    state.phase = "error";
    state.error = err instanceof Error ? err.message : String(err);
    log(`ERROR: ${state.error}`);
  }
}

// ---------------------------------------------------------------------------
// Mailbox worker (ADR-0013) — replaces tools/spawn.bat when the dashboard runs.
// Polls mailbox/outbox; for each job spawns the worker command (default:
// `claude -p`, the Pilot's subscription CLI), feeds it the prompt on stdin, and
// writes the answer to mailbox/inbox where the manual model port collects it.

interface WorkerState {
  active: boolean;
  cmd: string;
  current: string | null;
  served: number;
  lastError: string | null;
}

const worker: WorkerState = {
  active: false,
  cmd: process.env["WORKER_CMD"] ?? "claude -p",
  current: null,
  served: 0,
  lastError: null,
};
const workerFailures = new Map<string, number>();
const MAX_JOB_ATTEMPTS = 3;

function startWorker(log: (m: string) => void): void {
  if (worker.active) return;
  worker.active = true;
  log(`worker: "${worker.cmd}" watching mailbox/outbox`);
  const outbox = resolve(MAILBOX_DIR, "outbox");
  const inbox = resolve(MAILBOX_DIR, "inbox");

  const tick = (): void => {
    if (!worker.active || worker.current !== null) return;
    if (!existsSync(outbox)) return;
    const job = readdirSync(outbox)
      .filter((f) => f.endsWith(".md"))
      .filter((f) => !existsSync(resolve(inbox, f)))
      .find((f) => (workerFailures.get(f) ?? 0) < MAX_JOB_ATTEMPTS);
    if (!job) return;

    worker.current = job;
    const prompt = readText(resolve(outbox, job));
    const child = spawn(worker.cmd, { shell: true, windowsHide: true });
    let out = "";
    let errOut = "";
    child.stdout.on("data", (d: Buffer) => (out += d.toString("utf8")));
    child.stderr.on("data", (d: Buffer) => (errOut += d.toString("utf8")));
    child.on("error", (e) => {
      worker.lastError = `worker spawn failed: ${e.message}`;
      workerFailures.set(job, (workerFailures.get(job) ?? 0) + 1);
      worker.current = null;
    });
    child.on("close", (code) => {
      if (code === 0 && out.trim().length > 0) {
        const part = resolve(inbox, `${job}.part`);
        writeFileSync(part, out, "utf8");
        renameSync(part, resolve(inbox, job));
        worker.served += 1;
        worker.lastError = null;
      } else {
        const n = (workerFailures.get(job) ?? 0) + 1;
        workerFailures.set(job, n);
        worker.lastError =
          `job ${job} failed (attempt ${n}/${MAX_JOB_ATTEMPTS}, exit ${code}): ` +
          `${errOut.trim().slice(0, 300) || "empty output"}. ` +
          `If the CLI is not logged in, run "claude" once in a terminal.`;
      }
      worker.current = null;
    });
    child.stdin.write(prompt);
    child.stdin.end();
  };
  setInterval(tick, 1500);
}

// ---------------------------------------------------------------------------
// Run summaries — everything the UI needs, derived from the audit trail on disk.

interface RunSummary {
  runId: string;
  tasks: number;
  baseline: number;
  scheduled: number;
  sheet: boolean;
  judged: number;
  results: boolean;
}

interface VerdictsFile {
  runId: string;
  verdicts: Array<{ taskId: string; verdict: "A" | "B" | "tie" | "" }>;
}

function runsSummary(): RunSummary[] {
  if (!existsSync(RUNS_DIR)) return [];
  const project = loadProject(REPO_ROOT, DATA_DIR);
  const ids = project.tasks.map((t) => t.id);
  const out: RunSummary[] = [];
  for (const name of readdirSync(RUNS_DIR)) {
    const dir = abs(RUNS_DIR, name);
    if (!statSync(dir).isDirectory()) continue;
    const count = (p: string): number =>
      ids.filter((id) => existsSync(abs(dir, p, id, "meter.json"))).length;
    let judged = 0;
    const vPath = abs(dir, "eval", "verdicts.json");
    if (existsSync(vPath)) {
      try {
        judged = readJson<VerdictsFile>(vPath).verdicts.filter((v) => v.verdict !== "").length;
      } catch {
        judged = 0;
      }
    }
    out.push({
      runId: name,
      tasks: ids.length,
      baseline: count("full-reload"),
      scheduled: count("scheduled"),
      sheet: existsSync(abs(dir, "eval", "sheet.md")),
      judged,
      results: existsSync(abs(dir, "RESULTS.md")),
    });
  }
  return out.sort((a, b) => b.runId.localeCompare(a.runId));
}

// ---------------------------------------------------------------------------
// Blind sheet parsing — the UI shows A/B side by side; the mapping stays sealed.

interface SheetItem {
  taskId: string;
  title: string;
  instruction: string;
  a: string;
  b: string;
  verdict: "A" | "B" | "tie" | "";
}

function parseSheet(runId: string): SheetItem[] {
  const raw = readText(abs(RUNS_DIR, runId, "eval", "sheet.md"));
  const vPath = abs(RUNS_DIR, runId, "eval", "verdicts.json");
  const byTask = new Map<string, "A" | "B" | "tie" | "">();
  if (existsSync(vPath)) {
    for (const v of readJson<VerdictsFile>(vPath).verdicts) byTask.set(v.taskId, v.verdict);
  }
  const items: SheetItem[] = [];
  const re =
    /## Task: (.+?) \((.+?)\)\r?\n\r?\n\*\*Instruction:\*\* ([\s\S]*?)\r?\n\r?\n### Output A\r?\n\r?\n([\s\S]*?)\r?\n\r?\n### Output B\r?\n\r?\n([\s\S]*?)\r?\n\r?\n\*\*Verdict/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    const taskId = m[2] ?? "";
    items.push({
      taskId,
      title: m[1] ?? "",
      instruction: m[3] ?? "",
      a: m[4] ?? "",
      b: m[5] ?? "",
      verdict: byTask.get(taskId) ?? "",
    });
  }
  return items;
}

// ---------------------------------------------------------------------------
// HTTP plumbing.

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolvePromise, reject) => {
    let body = "";
    req.on("data", (c: Buffer) => (body += c.toString("utf8")));
    req.on("end", () => resolvePromise(body));
    req.on("error", reject);
  });
}

function sendJson(res: ServerResponse, status: number, value: unknown): void {
  const body = JSON.stringify(value);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(body);
}

function sendHtml(res: ServerResponse, html: string): void {
  res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
  res.end(html);
}

async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? "/", "http://localhost");
  const path = url.pathname;

  if (req.method === "GET" && path === "/") {
    sendHtml(res, PAGE);
    return;
  }

  if (req.method === "GET" && path === "/api/state") {
    sendJson(res, 200, {
      conduct,
      worker: worker.active
        ? { cmd: worker.cmd, current: worker.current, served: worker.served, lastError: worker.lastError }
        : null,
      runs: runsSummary(),
    });
    return;
  }

  if (req.method === "POST" && path === "/api/conduct") {
    if (conduct && conduct.phase !== "done" && conduct.phase !== "error") {
      sendJson(res, 409, { error: "a run is already in progress" });
      return;
    }
    const body = JSON.parse((await readBody(req)) || "{}") as { model?: string };
    const model = body.model === "manual" ? "manual" : "fake";
    void startConduct(model);
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === "GET" && path === "/api/sheet") {
    const runId = url.searchParams.get("run") ?? "";
    if (!existsSync(abs(RUNS_DIR, runId, "eval", "sheet.md"))) {
      sendJson(res, 404, { error: "no blind sheet for this run" });
      return;
    }
    sendJson(res, 200, {
      runId,
      final: existsSync(abs(RUNS_DIR, runId, "RESULTS.md")),
      items: parseSheet(runId),
    });
    return;
  }

  if (req.method === "POST" && path === "/api/verdicts") {
    const body = JSON.parse((await readBody(req)) || "{}") as Partial<VerdictsFile>;
    const runId = body.runId ?? "";
    if (!runId || !Array.isArray(body.verdicts)) {
      sendJson(res, 400, { error: "runId and verdicts are required" });
      return;
    }
    if (existsSync(abs(RUNS_DIR, runId, "RESULTS.md"))) {
      sendJson(res, 409, { error: "results are final; verdicts are closed for this run" });
      return;
    }
    const allowed = new Set(["A", "B", "tie", ""]);
    if (!body.verdicts.every((v) => allowed.has(v.verdict))) {
      sendJson(res, 400, { error: "verdicts must be A, B, tie or empty" });
      return;
    }
    writeJson(abs(RUNS_DIR, runId, "eval", "verdicts.json"), { runId, verdicts: body.verdicts });
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === "POST" && path === "/api/results") {
    const body = JSON.parse((await readBody(req)) || "{}") as { runId?: string };
    const runId = body.runId ?? "";
    const mdPath = abs(RUNS_DIR, runId, "RESULTS.md");
    try {
      if (!existsSync(mdPath)) aggregateResults(runId);
      sendJson(res, 200, { ok: true, md: readText(mdPath) });
    } catch (err) {
      sendJson(res, 500, { error: err instanceof Error ? err.message : String(err) });
    }
    return;
  }

  if (req.method === "GET" && path === "/api/results") {
    const runId = url.searchParams.get("run") ?? "";
    const mdPath = abs(RUNS_DIR, runId, "RESULTS.md");
    if (!existsSync(mdPath)) {
      sendJson(res, 404, { error: "no results yet for this run" });
      return;
    }
    sendJson(res, 200, { md: readText(mdPath) });
    return;
  }

  sendJson(res, 404, { error: "not found" });
}

// ---------------------------------------------------------------------------
// The page — single HTML document, no external assets, Portuguese for the Pilot.
// Client JS deliberately avoids template literals so this file nests cleanly.

const PAGE = `<!doctype html>
<html lang="pt">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>AgentOS — Beta Coding</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #101418; color: #dde3ea; font: 15px/1.5 system-ui, "Segoe UI", sans-serif; }
  header { padding: 18px 26px; border-bottom: 1px solid #232a33; display: flex; align-items: baseline; gap: 14px; }
  header h1 { font-size: 18px; margin: 0; }
  header .sub { color: #8494a6; font-size: 13px; }
  main { max-width: 1100px; margin: 0 auto; padding: 22px 26px 60px; }
  section { background: #171c22; border: 1px solid #232a33; border-radius: 10px; padding: 18px 20px; margin-bottom: 18px; }
  h2 { font-size: 15px; margin: 0 0 12px; color: #aebbca; }
  button { background: #2563eb; color: #fff; border: 0; border-radius: 8px; padding: 9px 16px; font: inherit; cursor: pointer; }
  button:hover { background: #1d4ed8; }
  button.ghost { background: #232a33; color: #dde3ea; }
  button.ghost:hover { background: #2c3540; }
  button:disabled { opacity: .45; cursor: default; }
  .note { color: #8494a6; font-size: 13px; margin-top: 10px; }
  .err { color: #f87171; font-size: 13px; white-space: pre-wrap; }
  pre.log { background: #0c0f13; border: 1px solid #232a33; border-radius: 8px; padding: 12px; max-height: 260px; overflow: auto; font-size: 12.5px; white-space: pre-wrap; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #232a33; }
  th { color: #8494a6; font-weight: 500; font-size: 12.5px; }
  .chip { display: inline-block; border-radius: 20px; padding: 2px 10px; font-size: 12px; background: #232a33; }
  .chip.ok { background: #14532d; color: #86efac; }
  .chip.run { background: #1e3a8a; color: #93c5fd; }
  .chip.err { background: #7f1d1d; color: #fca5a5; }
  .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  .out { background: #0c0f13; border: 1px solid #232a33; border-radius: 8px; padding: 12px; font-size: 13px; white-space: pre-wrap; max-height: 340px; overflow: auto; }
  .out h4 { margin: 0 0 8px; font-size: 13px; color: #93c5fd; }
  .card { border: 1px solid #232a33; border-radius: 10px; padding: 14px 16px; margin-bottom: 14px; }
  .card .inst { color: #aebbca; font-size: 13.5px; margin: 4px 0 12px; }
  .pick { display: flex; gap: 8px; margin-top: 12px; }
  .pick button { background: #232a33; color: #dde3ea; }
  .pick button.sel { background: #2563eb; color: #fff; }
  .md { font-size: 14px; }
  .md table { margin: 10px 0; }
  .md blockquote { border-left: 3px solid #2563eb; margin: 10px 0; padding: 4px 12px; color: #aebbca; }
  .md code { background: #0c0f13; border-radius: 4px; padding: 1px 5px; font-size: 13px; }
  a { color: #60a5fa; }
</style>
</head>
<body>
<header>
  <h1>AgentOS · Beta Coding</h1>
  <span class="sub">ADR-0012 — o Scheduler reduz contexto mantendo qualidade? · ADR-0013 — modelo manual na tua subscrição</span>
</header>
<main>
  <section id="new">
    <h2>Nova corrida</h2>
    <button id="btnFake">Correr · modelo fake (instantâneo, custo zero)</button>
    <button id="btnManual" class="ghost">Correr · modelo manual (Claude Code, subscrição)</button>
    <div class="note">Modelo manual: o dashboard trata da mailbox e lança um Claude Code por work order.
    Requer o CLI com sessão iniciada (corre <code>claude</code> uma vez num terminal). Baseline primeiro — imposto pelo motor.</div>
    <div id="conductBox" style="display:none">
      <p style="margin:14px 0 6px"><span id="conductChip" class="chip run"></span> <span id="conductRun" class="note"></span></p>
      <pre class="log" id="conductLog"></pre>
      <div class="err" id="workerErr"></div>
    </div>
  </section>

  <section>
    <h2>Corridas</h2>
    <table id="runs"><thead><tr>
      <th>run</th><th>baseline</th><th>scheduled</th><th>julgado</th><th>estado</th><th></th>
    </tr></thead><tbody></tbody></table>
    <div class="note">O julgamento é cego: A/B são baralhados por tarefa; o mapa fica selado até haver RESULTS.md.</div>
  </section>

  <section id="judge" style="display:none">
    <h2 id="judgeTitle"></h2>
    <div id="judgeItems"></div>
    <button id="btnSave">Guardar veredictos</button>
    <button id="btnFinal" class="ghost">Gerar RESULTS.md (fecha o julgamento)</button>
    <span class="note" id="judgeMsg"></span>
  </section>

  <section id="results" style="display:none">
    <h2 id="resultsTitle"></h2>
    <div class="md" id="resultsMd"></div>
  </section>
</main>
<script>
"use strict";
var state = null;
var judging = null;   // { runId, items, final }

function el(id) { return document.getElementById(id); }
function esc(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function api(method, path, body) {
  var opts = { method: method, headers: { "content-type": "application/json" } };
  if (body) opts.body = JSON.stringify(body);
  return fetch(path, opts).then(function (r) { return r.json(); });
}

// --- polling -------------------------------------------------------------
function refresh() {
  api("GET", "/api/state").then(function (s) {
    state = s;
    renderConduct();
    renderRuns();
  });
}
setInterval(refresh, 1200);
refresh();

function renderConduct() {
  var c = state.conduct;
  var box = el("conductBox");
  if (!c) { box.style.display = "none"; return; }
  box.style.display = "";
  var chip = el("conductChip");
  chip.textContent = c.phase;
  chip.className = "chip " + (c.phase === "done" ? "ok" : c.phase === "error" ? "err" : "run");
  el("conductRun").textContent = c.runId + " · modelo " + c.model;
  var log = el("conductLog");
  var atEnd = log.scrollTop + log.clientHeight >= log.scrollHeight - 8;
  log.textContent = c.log.join("\\n");
  if (atEnd) log.scrollTop = log.scrollHeight;
  var w = state.worker;
  el("workerErr").textContent = (w && w.lastError) ? w.lastError : (c.error || "");
  var busy = c.phase !== "done" && c.phase !== "error";
  el("btnFake").disabled = busy;
  el("btnManual").disabled = busy;
}

var lastRunsJson = "";
function renderRuns() {
  var json = JSON.stringify(state.runs);
  if (json === lastRunsJson) return; // don't rebuild (and kill clicks) needlessly
  lastRunsJson = json;
  var tb = el("runs").querySelector("tbody");
  tb.innerHTML = "";
  state.runs.forEach(function (r) {
    var tr = document.createElement("tr");
    var status = r.results ? "<span class='chip ok'>resultados</span>"
      : r.judged === r.tasks && r.sheet ? "<span class='chip run'>pronto a fechar</span>"
      : r.sheet ? "<span class='chip'>a julgar (" + r.judged + "/" + r.tasks + ")</span>"
      : "<span class='chip'>em curso</span>";
    tr.innerHTML = "<td>" + esc(r.runId) + "</td>"
      + "<td>" + r.baseline + "/" + r.tasks + "</td>"
      + "<td>" + r.scheduled + "/" + r.tasks + "</td>"
      + "<td>" + r.judged + "/" + r.tasks + "</td>"
      + "<td>" + status + "</td><td></td>";
    var cell = tr.lastChild;
    if (r.sheet && !r.results) {
      var b = document.createElement("button");
      b.className = "ghost"; b.textContent = "Julgar";
      b.onclick = function () { openJudge(r.runId); };
      cell.appendChild(b);
    }
    if (r.results) {
      var b2 = document.createElement("button");
      b2.className = "ghost"; b2.textContent = "Resultados";
      b2.onclick = function () { openResults(r.runId); };
      cell.appendChild(b2);
    }
    tb.appendChild(tr);
  });
}

// --- new run ---------------------------------------------------------------
el("btnFake").onclick = function () { api("POST", "/api/conduct", { model: "fake" }).then(refresh); };
el("btnManual").onclick = function () { api("POST", "/api/conduct", { model: "manual" }).then(refresh); };

// --- judging ----------------------------------------------------------------
function openJudge(runId) {
  api("GET", "/api/sheet?run=" + encodeURIComponent(runId)).then(function (s) {
    judging = { runId: runId, items: s.items, final: s.final };
    el("results").style.display = "none";
    el("judge").style.display = "";
    el("judgeTitle").textContent = "Julgamento cego — " + runId;
    el("judgeMsg").textContent = "";
    var host = el("judgeItems");
    host.innerHTML = "";
    s.items.forEach(function (it, idx) {
      var card = document.createElement("div");
      card.className = "card";
      card.innerHTML = "<strong>" + esc(it.title) + "</strong> <span class='note'>(" + esc(it.taskId) + ")</span>"
        + "<div class='inst'>" + esc(it.instruction) + "</div>"
        + "<div class='cols'>"
        + "<div class='out'><h4>Output A</h4>" + esc(it.a) + "</div>"
        + "<div class='out'><h4>Output B</h4>" + esc(it.b) + "</div>"
        + "</div>";
      var pick = document.createElement("div");
      pick.className = "pick";
      ["A", "B", "tie"].forEach(function (v) {
        var b = document.createElement("button");
        b.textContent = v === "tie" ? "Empate" : v + " é melhor";
        if (it.verdict === v) b.className = "sel";
        b.onclick = function () {
          judging.items[idx].verdict = v;
          Array.prototype.forEach.call(pick.children, function (x) { x.className = ""; });
          b.className = "sel";
        };
        pick.appendChild(b);
      });
      card.appendChild(pick);
      host.appendChild(card);
    });
    el("judge").scrollIntoView({ behavior: "smooth" });
  });
}

function saveVerdicts() {
  var payload = {
    runId: judging.runId,
    verdicts: judging.items.map(function (it) { return { taskId: it.taskId, verdict: it.verdict }; }),
  };
  return api("POST", "/api/verdicts", payload);
}

el("btnSave").onclick = function () {
  saveVerdicts().then(function (r) {
    el("judgeMsg").textContent = r.ok ? "Veredictos guardados." : (r.error || "erro");
    refresh();
  });
};

el("btnFinal").onclick = function () {
  var missing = judging.items.filter(function (it) { return it.verdict === ""; }).length;
  var warn = missing > 0 ? missing + " tarefa(s) por julgar contam como 'unjudged'. " : "";
  if (!confirm(warn + "RESULTS.md é imutável (write-once): depois de gerado, os veredictos ficam fechados. Continuar?")) return;
  saveVerdicts().then(function () {
    api("POST", "/api/results", { runId: judging.runId }).then(function (r) {
      if (r.error) { el("judgeMsg").textContent = r.error; return; }
      el("judge").style.display = "none";
      showResults(judging.runId, r.md);
      refresh();
    });
  });
};

// --- results -----------------------------------------------------------------
function openResults(runId) {
  api("GET", "/api/results?run=" + encodeURIComponent(runId)).then(function (r) {
    if (r.md) showResults(runId, r.md);
  });
}

function showResults(runId, md) {
  el("results").style.display = "";
  el("resultsTitle").textContent = "Resultados — " + runId;
  el("resultsMd").innerHTML = renderMd(md);
  el("results").scrollIntoView({ behavior: "smooth" });
}

// Minimal markdown: headers, tables, bold, inline code, blockquote, hr.
function renderMd(md) {
  var lines = md.split(/\\r?\\n/);
  var html = "";
  var table = [];
  function flushTable() {
    if (table.length === 0) return;
    var rows = table.filter(function (l) { return !/^\\|[\\s:-]+\\|/.test(l.replace(/\\|/g, "|")); });
    html += "<table>";
    rows.forEach(function (l, i) {
      var cells = l.split("|").slice(1, -1);
      var tag = i === 0 ? "th" : "td";
      html += "<tr>" + cells.map(function (c) { return "<" + tag + ">" + inline(c.trim()) + "</" + tag + ">"; }).join("") + "</tr>";
    });
    html += "</table>";
    table = [];
  }
  function inline(s) {
    return esc(s)
      .replace(/\\*\\*(.+?)\\*\\*/g, "<strong>$1</strong>")
      .replace(/\`(.+?)\`/g, "<code>$1</code>");
  }
  lines.forEach(function (l) {
    if (/^\\|/.test(l)) { table.push(l); return; }
    flushTable();
    if (/^### /.test(l)) html += "<h4>" + inline(l.slice(4)) + "</h4>";
    else if (/^## /.test(l)) html += "<h3>" + inline(l.slice(3)) + "</h3>";
    else if (/^# /.test(l)) html += "<h2>" + inline(l.slice(2)) + "</h2>";
    else if (/^> /.test(l)) html += "<blockquote>" + inline(l.slice(2)) + "</blockquote>";
    else if (/^---/.test(l)) html += "<hr>";
    else if (/^- /.test(l)) html += "<div>• " + inline(l.slice(2)) + "</div>";
    else if (l.trim() === "") html += "";
    else html += "<p>" + inline(l) + "</p>";
  });
  flushTable();
  return html;
}
</script>
</body>
</html>
`;

// ---------------------------------------------------------------------------

function main(): void {
  let port = DEFAULT_PORT;
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--port") port = Number(argv[++i] ?? DEFAULT_PORT);
  }
  const server = createServer((req, res) => {
    void handle(req, res).catch((err) => {
      sendJson(res, 500, { error: err instanceof Error ? err.message : String(err) });
    });
  });
  server.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      console.log(`dashboard already running — open http://localhost:${port}`);
      process.exit(0);
    }
    throw err;
  });
  server.listen(port, "127.0.0.1", () => {
    console.log(`AgentOS Beta Coding dashboard: http://localhost:${port}`);
    console.log(`(local only — nothing is exposed beyond this machine)`);
  });
}

main();
