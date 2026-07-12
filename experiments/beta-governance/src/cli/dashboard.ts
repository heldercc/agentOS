// The governance dashboard (ADR-0015) — Grand Objective B's surface: the
// owner iterates real work with clicks. One process serves everything: it
// fans a decision into blind proposals (one per approach, sealed mapping),
// records every click as an evidence event, shows the tray of candidate seeds
// the distiller drafted from selection statistics, and lets the owner admit
// or discard them. Admitted seeds enter every later proposal's context — the
// manifests prove it. Judging is pointwise FIRST (approve/reject each
// proposal in isolation), selection only afterwards and only among approved:
// the comparison protocol must not fabricate the winner.
//
// Usage: tsx src/cli/dashboard.ts [--port 4700]

import { spawn } from "node:child_process";
import { existsSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { resolve } from "node:path";

import { appendEvent, readAllEvents, readSessionEvents } from "../evidence.js";
import { admitCandidate, draftCandidates } from "../distill.js";
import { approvalRateByRound, decisionProgress } from "../metrics.js";
import { resolveModel } from "../model.js";
import { loadProject } from "../project.js";
import { DATA_DIR, LEARNED_DIR, MAILBOX_DIR, REPO_ROOT, RUNS_DIR } from "../paths.js";
import { roundDir, runRound } from "../propose.js";
import { abs, readJson, readText } from "../stores.js";
import type { EvidenceEvent, RoundMapping } from "../types.js";

const DEFAULT_PORT = 4700;

/** The daily loop: one session per day. */
function todaySession(): string {
  return new Date().toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Round generation — one at a time, driven in-process.

interface RoundBusy {
  decisionId: string;
  round: number;
  model: string;
  log: string[];
  error?: string;
}

let busy: RoundBusy | null = null;

function latestRound(session: string, decisionId: string): number {
  const dir = abs(RUNS_DIR, session, decisionId);
  if (!existsSync(dir)) return 0;
  return readdirSync(dir)
    .map((n) => /^round-(\d+)$/.exec(n))
    .filter((m): m is RegExpExecArray => m !== null)
    .reduce((max, m) => Math.max(max, Number(m[1])), 0);
}

async function startRound(decisionId: string, model: string): Promise<void> {
  const session = todaySession();
  const project = loadProject(REPO_ROOT, DATA_DIR, LEARNED_DIR);
  const decision = project.decisions.find((d) => d.id === decisionId);
  if (!decision) throw new Error(`unknown decision ${decisionId}`);
  const round = latestRound(session, decisionId) + 1;
  const state: RoundBusy = { decisionId, round, model, log: [] };
  busy = state;
  try {
    if (model === "manual") startWorker((m) => state.log.push(m));
    const { port, model: modelName } = resolveModel(model, { mailboxDir: MAILBOX_DIR });
    state.log.push(`round ${round} for ${decisionId} · model ${modelName}`);
    await runRound({
      repoRoot: REPO_ROOT,
      runsDir: RUNS_DIR,
      session,
      project,
      decision,
      round,
      port,
      model: modelName,
      log: (m) => state.log.push(m),
    });
    state.log.push("done — ready to judge");
  } catch (err) {
    state.error = err instanceof Error ? err.message : String(err);
    state.log.push(`ERROR: ${state.error}`);
  } finally {
    if (busy === state && !state.error) busy = null;
  }
}

// ---------------------------------------------------------------------------
// Mailbox worker (ADR-0013) — same bridge as the beta-coding dashboard:
// spawns one CLI worker per job on the owner's subscription, no API wallet.

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
// Derived views — everything from the audit trail on disk, nothing in memory.

interface OptionView {
  letter: string;
  body: string;
  verdict: "approve" | "reject" | "";
  selected: boolean;
}

interface JudgeView {
  decisionId: string;
  title: string;
  instruction: string;
  round: number;
  options: OptionView[];
  allJudged: boolean;
  approvedLetters: string[];
  closed: boolean;
  /** Revealed only after the decision closes. */
  reveal: Record<string, string> | null;
}

function judgeView(session: string, decisionId: string): JudgeView | null {
  const project = loadProject(REPO_ROOT, DATA_DIR, LEARNED_DIR);
  const decision = project.decisions.find((d) => d.id === decisionId);
  if (!decision) return null;
  const round = latestRound(session, decisionId);
  if (round === 0) return null;
  const dir = roundDir(RUNS_DIR, session, decisionId, round);
  const mapping = readJson<RoundMapping>(abs(dir, "mapping.sealed.json"));
  const events = readSessionEvents(RUNS_DIR, session).filter(
    (e) => e.decisionId === decisionId && e.round === round,
  );
  const verdictOf = (letter: string): "approve" | "reject" | "" => {
    let v: "approve" | "reject" | "" = "";
    for (const e of events) {
      if (e.proposalId === letter && (e.action === "approve" || e.action === "reject")) {
        v = e.action; // last click wins until selection closes the round
      }
    }
    return v;
  };
  const selectedLetter =
    events.find((e) => e.action === "select")?.proposalId ?? null;
  const options: OptionView[] = Object.keys(mapping.letters)
    .sort()
    .filter((l) => existsSync(abs(dir, l, "proposal.md")))
    .map((l) => ({
      letter: l,
      body: readText(abs(dir, l, "proposal.md")),
      verdict: verdictOf(l),
      selected: selectedLetter === l,
    }));
  const allJudged = options.length > 0 && options.every((o) => o.verdict !== "");
  const closed = readSessionEvents(RUNS_DIR, session).some(
    (e) => e.decisionId === decisionId && e.action === "select",
  );
  return {
    decisionId,
    title: decision.title,
    instruction: decision.instruction,
    round,
    options,
    allJudged,
    approvedLetters: options.filter((o) => o.verdict === "approve").map((o) => o.letter),
    closed,
    reveal: closed ? mapping.letters : null,
  };
}

function stateView(): unknown {
  const session = todaySession();
  const project = loadProject(REPO_ROOT, DATA_DIR, LEARNED_DIR);
  const sessionEvents = readSessionEvents(RUNS_DIR, session).filter((e) => !e.scripted);
  const allEvents = readAllEvents(RUNS_DIR);
  const progress = decisionProgress(project.decisions, sessionEvents);
  const decisions = project.decisions.map((d) => {
    const p = progress.find((x) => x.decisionId === d.id);
    const rounds = latestRound(session, d.id);
    const jv = rounds > 0 ? judgeView(session, d.id) : null;
    return {
      id: d.id,
      title: d.title,
      tags: d.tags,
      rounds,
      closed: p?.closed ?? false,
      judgeable: jv !== null && !jv.closed,
      allJudged: jv?.allJudged ?? false,
    };
  });
  return {
    session,
    learned: project.learned.map((s) => s.id),
    decisions,
    busy,
    worker: worker.active
      ? { cmd: worker.cmd, current: worker.current, served: worker.served, lastError: worker.lastError }
      : null,
    tray: draftCandidates(project.approaches, allEvents).map((c) => ({
      id: c.id,
      title: c.title,
      body: c.body,
      stats: c.stats,
    })),
    metrics: {
      byRound: approvalRateByRound(allEvents),
      progress,
    },
  };
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
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(JSON.stringify(value));
}

function clickEvent(
  session: string,
  decisionId: string,
  round: number,
  letter: string,
  action: "approve" | "reject" | "select",
): void {
  const dir = roundDir(RUNS_DIR, session, decisionId, round);
  const mapping = readJson<RoundMapping>(abs(dir, "mapping.sealed.json"));
  const approachId = mapping.letters[letter];
  if (!approachId) throw new Error(`unknown option ${letter}`);
  const e: EvidenceEvent = {
    ts: new Date().toISOString(),
    session,
    decisionId,
    round,
    proposalId: letter,
    approachId,
    action,
    scripted: false,
  };
  appendEvent(RUNS_DIR, e);
}

async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? "/", "http://localhost");
  const path = url.pathname;
  const session = todaySession();

  if (req.method === "GET" && path === "/") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
    res.end(PAGE);
    return;
  }

  if (req.method === "GET" && path === "/api/state") {
    sendJson(res, 200, stateView());
    return;
  }

  if (req.method === "POST" && path === "/api/round") {
    if (busy && !busy.error) {
      sendJson(res, 409, { error: "a round is already being generated" });
      return;
    }
    const body = JSON.parse((await readBody(req)) || "{}") as {
      decisionId?: string;
      model?: string;
    };
    const decisionId = body.decisionId ?? "";
    const jv = latestRound(session, decisionId) > 0 ? judgeView(session, decisionId) : null;
    if (jv && !jv.closed && !jv.allJudged) {
      sendJson(res, 409, { error: "judge the current round before opening a new one" });
      return;
    }
    const model = body.model === "manual" ? "manual" : "fake";
    void startRound(decisionId, model);
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === "GET" && path === "/api/judge") {
    const decisionId = url.searchParams.get("decision") ?? "";
    const jv = judgeView(session, decisionId);
    if (!jv) {
      sendJson(res, 404, { error: "no round to judge for this decision" });
      return;
    }
    sendJson(res, 200, jv);
    return;
  }

  if (req.method === "POST" && path === "/api/click") {
    const body = JSON.parse((await readBody(req)) || "{}") as {
      decisionId?: string;
      round?: number;
      letter?: string;
      action?: string;
    };
    const { decisionId, round, letter, action } = body;
    if (!decisionId || !round || !letter || !action) {
      sendJson(res, 400, { error: "decisionId, round, letter, action are required" });
      return;
    }
    if (action !== "approve" && action !== "reject" && action !== "select") {
      sendJson(res, 400, { error: "action must be approve, reject or select" });
      return;
    }
    const jv = judgeView(session, decisionId);
    if (!jv || jv.closed) {
      sendJson(res, 409, { error: "this decision is closed" });
      return;
    }
    if (action === "select") {
      // Selection only after every option was judged in isolation, and only
      // among approved options — pointwise before pairwise, enforced server-side.
      if (!jv.allJudged) {
        sendJson(res, 409, { error: "judge every option in isolation before selecting" });
        return;
      }
      if (!jv.approvedLetters.includes(letter)) {
        sendJson(res, 409, { error: "the winner must be an approved option" });
        return;
      }
    }
    clickEvent(session, decisionId, round, letter, action);
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === "POST" && path === "/api/tray") {
    const body = JSON.parse((await readBody(req)) || "{}") as {
      candidateId?: string;
      action?: string;
    };
    const { candidateId, action } = body;
    if (!candidateId || (action !== "admit" && action !== "discard")) {
      sendJson(res, 400, { error: "candidateId and action (admit|discard) are required" });
      return;
    }
    const project = loadProject(REPO_ROOT, DATA_DIR, LEARNED_DIR);
    const candidates = draftCandidates(project.approaches, readAllEvents(RUNS_DIR));
    const cand = candidates.find((c) => c.id === candidateId);
    if (!cand) {
      sendJson(res, 404, { error: "candidate not in the tray (already ruled on?)" });
      return;
    }
    if (action === "admit") admitCandidate(LEARNED_DIR, cand);
    appendEvent(RUNS_DIR, {
      ts: new Date().toISOString(),
      session,
      decisionId: "-",
      round: 0,
      candidateId,
      action: action === "admit" ? "admit_seed" : "discard_seed",
      scripted: false,
    });
    sendJson(res, 200, { ok: true });
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
<title>AgentOS — Governança (Beta 2)</title>
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
  button.ok { background: #14532d; }
  button.no { background: #7f1d1d; }
  button:disabled { opacity: .45; cursor: default; }
  .note { color: #8494a6; font-size: 13px; margin-top: 10px; }
  .err { color: #f87171; font-size: 13px; white-space: pre-wrap; }
  pre.log { background: #0c0f13; border: 1px solid #232a33; border-radius: 8px; padding: 12px; max-height: 200px; overflow: auto; font-size: 12.5px; white-space: pre-wrap; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #232a33; }
  th { color: #8494a6; font-weight: 500; font-size: 12.5px; }
  .chip { display: inline-block; border-radius: 20px; padding: 2px 10px; font-size: 12px; background: #232a33; }
  .chip.ok { background: #14532d; color: #86efac; }
  .chip.run { background: #1e3a8a; color: #93c5fd; }
  .card { border: 1px solid #232a33; border-radius: 10px; padding: 14px 16px; margin-bottom: 14px; }
  .card .inst { color: #aebbca; font-size: 13.5px; margin: 4px 0 12px; }
  .out { background: #0c0f13; border: 1px solid #232a33; border-radius: 8px; padding: 12px; font-size: 13px; white-space: pre-wrap; max-height: 300px; overflow: auto; margin-top: 8px; }
  .pick { display: flex; gap: 8px; margin-top: 10px; }
  .verdict { font-size: 12.5px; margin-left: 8px; }
  .sel { outline: 2px solid #2563eb; }
</style>
</head>
<body>
<header>
  <h1>AgentOS · Governança</h1>
  <span class="sub">ADR-0015 — a seleção governada melhora as propostas? Cada clique é evidência.</span>
  <span class="sub" id="sessionTag"></span>
</header>
<main>
  <section>
    <h2>Decisões de hoje</h2>
    <div style="margin-bottom:10px">
      Modelo: <label><input type="radio" name="model" value="fake" checked> fake (custo zero)</label>
      <label style="margin-left:10px"><input type="radio" name="model" value="manual"> manual (Claude Code, subscrição)</label>
    </div>
    <table id="decisions"><thead><tr>
      <th>decisão</th><th>rondas</th><th>estado</th><th></th>
    </tr></thead><tbody></tbody></table>
    <div id="busyBox" style="display:none">
      <pre class="log" id="busyLog"></pre>
      <div class="err" id="busyErr"></div>
    </div>
    <div class="note">Julgas cada proposta isolada (aprovar/rejeitar) antes de escolher a vencedora —
    o protocolo de comparação não pode fabricar o vencedor. As opções são cegas: o ângulo que as produziu só é revelado no fecho.</div>
  </section>

  <section id="judge" style="display:none">
    <h2 id="judgeTitle"></h2>
    <div class="inst" id="judgeInst"></div>
    <div id="judgeItems"></div>
    <div id="selectStep" style="display:none">
      <h2>Escolhe a vencedora (entre as aprovadas)</h2>
      <div class="pick" id="selectPick"></div>
    </div>
    <div id="revealBox" class="note" style="display:none"></div>
  </section>

  <section>
    <h2>Tabuleiro — seeds candidatas (destiladas da tua seleção)</h2>
    <div id="tray"></div>
    <div class="note">Nada é admitido automaticamente: a candidata mostra a sua evidência e espera o teu clique (O5).
    Admitidas entram no contexto das próximas propostas — o manifest prova-o.</div>
  </section>

  <section>
    <h2>Métricas</h2>
    <div id="metrics"></div>
  </section>
</main>
<script>
"use strict";
var state = null;
var openDecision = null;

function el(id) { return document.getElementById(id); }
function esc(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function api(method, path, body) {
  var opts = { method: method, headers: { "content-type": "application/json" } };
  if (body) opts.body = JSON.stringify(body);
  return fetch(path, opts).then(function (r) { return r.json(); });
}
function model() {
  return document.querySelector("input[name=model]:checked").value;
}

function refresh() {
  api("GET", "/api/state").then(function (s) {
    state = s;
    el("sessionTag").textContent = "sessão " + s.session +
      (s.learned.length ? " · " + s.learned.length + " seed(s) aprendida(s) ativa(s)" : "");
    renderDecisions();
    renderBusy();
    renderTray();
    renderMetrics();
    if (openDecision) loadJudge(openDecision, true);
  });
}
setInterval(refresh, 1500);
refresh();

function renderBusy() {
  var b = state.busy;
  var box = el("busyBox");
  if (!b) { box.style.display = "none"; return; }
  box.style.display = "";
  el("busyLog").textContent = b.log.join("\\n");
  var w = state.worker;
  el("busyErr").textContent = (w && w.lastError) ? w.lastError : (b.error || "");
}

var lastDecisionsJson = "";
function renderDecisions() {
  var json = JSON.stringify([state.decisions, !!state.busy]);
  if (json === lastDecisionsJson) return;
  lastDecisionsJson = json;
  var tb = el("decisions").querySelector("tbody");
  tb.innerHTML = "";
  state.decisions.forEach(function (d) {
    var tr = document.createElement("tr");
    var status = d.closed ? "<span class='chip ok'>fechada</span>"
      : d.judgeable ? "<span class='chip run'>a julgar (ronda " + d.rounds + ")</span>"
      : d.rounds > 0 ? "<span class='chip'>ronda " + d.rounds + "</span>"
      : "<span class='chip'>por abrir</span>";
    tr.innerHTML = "<td>" + esc(d.title) + " <span class='note'>(" + esc(d.id) + ")</span></td>"
      + "<td>" + d.rounds + "</td><td>" + status + "</td><td></td>";
    var cell = tr.lastChild;
    if (!d.closed && !d.judgeable) {
      var b = document.createElement("button");
      b.textContent = d.rounds === 0 ? "Propor ronda 1" : "Iterar (ronda " + (d.rounds + 1) + ")";
      b.disabled = !!state.busy;
      b.onclick = function () {
        api("POST", "/api/round", { decisionId: d.id, model: model() }).then(refresh);
      };
      cell.appendChild(b);
    }
    if (d.judgeable || d.closed) {
      var b2 = document.createElement("button");
      b2.className = "ghost";
      b2.textContent = d.closed ? "Rever" : "Julgar";
      b2.onclick = function () { openDecision = d.id; loadJudge(d.id, false); };
      cell.appendChild(b2);
    }
    tb.appendChild(tr);
  });
}

var lastJudgeJson = "";
function loadJudge(decisionId, quiet) {
  api("GET", "/api/judge?decision=" + encodeURIComponent(decisionId)).then(function (j) {
    if (j.error) { if (!quiet) alert(j.error); return; }
    var json = JSON.stringify(j);
    if (json === lastJudgeJson) return;
    lastJudgeJson = json;
    el("judge").style.display = "";
    el("judgeTitle").textContent = "Julgamento — " + j.title + " · ronda " + j.round + (j.closed ? " · FECHADA" : "");
    el("judgeInst").textContent = j.instruction;
    var host = el("judgeItems");
    host.innerHTML = "";
    j.options.forEach(function (o) {
      var card = document.createElement("div");
      card.className = "card" + (o.selected ? " sel" : "");
      card.innerHTML = "<strong>Proposta " + esc(o.letter) + "</strong>"
        + (o.verdict ? "<span class='verdict'>" + (o.verdict === "approve" ? "✔ aprovada" : "✘ rejeitada") + "</span>" : "")
        + (o.selected ? "<span class='verdict'>★ vencedora</span>" : "")
        + "<div class='out'>" + esc(o.body) + "</div>";
      if (!j.closed) {
        var pick = document.createElement("div");
        pick.className = "pick";
        [["approve", "Aprovar", "ok"], ["reject", "Rejeitar", "no"]].forEach(function (a) {
          var b = document.createElement("button");
          b.className = a[2] + (o.verdict === a[0] ? "" : " ghost");
          b.textContent = a[1];
          b.onclick = function () {
            api("POST", "/api/click", { decisionId: decisionId, round: j.round, letter: o.letter, action: a[0] })
              .then(function () { lastJudgeJson = ""; loadJudge(decisionId, false); refresh(); });
          };
          pick.appendChild(b);
        });
        card.appendChild(pick);
      }
      host.appendChild(card);
    });
    var stepBox = el("selectStep");
    if (!j.closed && j.allJudged && j.approvedLetters.length > 0) {
      stepBox.style.display = "";
      var pick2 = el("selectPick");
      pick2.innerHTML = "";
      j.approvedLetters.forEach(function (l) {
        var b = document.createElement("button");
        b.textContent = "Proposta " + l + " vence";
        b.onclick = function () {
          api("POST", "/api/click", { decisionId: decisionId, round: j.round, letter: l, action: "select" })
            .then(function () { lastJudgeJson = ""; loadJudge(decisionId, false); refresh(); });
        };
        pick2.appendChild(b);
      });
    } else {
      stepBox.style.display = "none";
    }
    var reveal = el("revealBox");
    if (j.reveal) {
      reveal.style.display = "";
      var parts = [];
      Object.keys(j.reveal).sort().forEach(function (k) { parts.push(k + " = " + j.reveal[k]); });
      reveal.textContent = "Revelação (decisão fechada): " + parts.join(" · ");
    } else {
      reveal.style.display = "none";
    }
    if (!quiet) el("judge").scrollIntoView({ behavior: "smooth" });
  });
}

var lastTrayJson = "";
function renderTray() {
  var json = JSON.stringify(state.tray);
  if (json === lastTrayJson) return;
  lastTrayJson = json;
  var host = el("tray");
  host.innerHTML = "";
  if (state.tray.length === 0) {
    host.innerHTML = "<div class='note'>Sem candidatas — o destilador precisa de pelo menos 2 vitórias do mesmo ângulo.</div>";
    return;
  }
  state.tray.forEach(function (c) {
    var card = document.createElement("div");
    card.className = "card";
    card.innerHTML = "<strong>" + esc(c.title) + "</strong>"
      + "<span class='note'> — " + c.stats.selections + " vitórias / " + c.stats.appearances + " aparições</span>"
      + "<div class='out'>" + esc(c.body) + "</div>";
    var pick = document.createElement("div");
    pick.className = "pick";
    [["admit", "Admitir seed", "ok"], ["discard", "Descartar", "no"]].forEach(function (a) {
      var b = document.createElement("button");
      b.className = a[2];
      b.textContent = a[1];
      b.onclick = function () {
        api("POST", "/api/tray", { candidateId: c.id, action: a[0] }).then(refresh);
      };
      pick.appendChild(b);
    });
    card.appendChild(pick);
    host.appendChild(card);
  });
}

var lastMetricsJson = "";
function renderMetrics() {
  var json = JSON.stringify(state.metrics);
  if (json === lastMetricsJson) return;
  lastMetricsJson = json;
  var m = state.metrics;
  var html = "<table><tr><th>ronda</th><th>propostas julgadas</th><th>aprovadas</th><th>taxa</th></tr>";
  m.byRound.forEach(function (r) {
    html += "<tr><td>" + r.round + "</td><td>" + r.proposals + "</td><td>" + r.approvals + "</td><td>"
      + Math.round(r.rate * 100) + "%</td></tr>";
  });
  html += "</table><div class='note'>Fechadas: "
    + m.progress.filter(function (p) { return p.closed; }).length + "/" + m.progress.length
    + " decisões (sessão de hoje). A taxa por ronda responde à pergunta do ADR-0015: a ronda N+1 aprova mais do que a ronda N?</div>";
  el("metrics").innerHTML = html;
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
      console.log(`governance dashboard already running — open http://localhost:${port}`);
      process.exit(0);
    }
    throw err;
  });
  server.listen(port, "127.0.0.1", () => {
    console.log(`AgentOS governance dashboard (Beta 2): http://localhost:${port}`);
    console.log(`(local only — nothing is exposed beyond this machine)`);
  });
}

main();
