// Proposal rounds: for one decision, assemble one context per approach,
// generate, and write the full audit trail (manifest, meter, proposal body,
// sealed blind mapping). The judge sees letters, never approach identities —
// and judges each proposal in isolation first (pointwise-before-pairwise seed:
// the comparison protocol itself can fabricate the winner).

import { existsSync } from "node:fs";

import { appendEvent, readSessionEvents } from "./evidence.js";
import type { ModelPort } from "./model.js";
import type { LearnedSeed, Project } from "./project.js";
import { abs, makeRef, readJson, readText, sha256, writeArtifactOnce, writeJson } from "./stores.js";
import type {
  Approach,
  ContextElement,
  ContextManifest,
  Decision,
  MeterRecord,
  RoundMapping,
} from "./types.js";

const MAX_TOKENS = 8000;
/** Rejected work stays visible, but trimmed — context is a scheduled resource. */
const FEEDBACK_EXCERPT_CHARS = 400;

export interface RoundArgs {
  repoRoot: string;
  runsDir: string;
  session: string;
  project: Project;
  decision: Decision;
  round: number;
  port: ModelPort;
  model: string;
  /** Marks the round's present event as scripted (smoke only). */
  scripted?: boolean;
  log?: (msg: string) => void;
}

export function roundDir(
  runsDir: string,
  session: string,
  decisionId: string,
  round: number,
): string {
  return abs(runsDir, session, decisionId, `round-${round}`);
}

/** Letters A, B, C… in a per-round shuffle, sealed to disk before judging. */
function shuffledLetters(approaches: Approach[], seedText: string): Record<string, string> {
  const letters = approaches.map((_, i) => String.fromCharCode(65 + i));
  // Deterministic shuffle from a hash so re-runs of the same round agree,
  // but the order varies across decisions/rounds (no stable position tell).
  const order = approaches
    .map((a, i) => ({ a, key: sha256(`${seedText}:${a.id}`), i }))
    .sort((x, y) => x.key.localeCompare(y.key));
  const map: Record<string, string> = {};
  order.forEach(({ a }, i) => {
    const letter = letters[i];
    if (letter) map[letter] = a.id;
  });
  return map;
}

interface FeedbackItem {
  proposalPath: string;
  proposalId: string;
  verdictLine: string;
  excerpt: string;
}

/** Prior rounds' verdicts and the owner's notes — failures stay visible. */
function priorFeedback(
  runsDir: string,
  session: string,
  decision: Decision,
  round: number,
): FeedbackItem[] {
  const all = readSessionEvents(runsDir, session).filter(
    (e) => e.decisionId === decision.id && !e.anchor,
  );
  const items: FeedbackItem[] = [];
  // The owner's own direction outranks derived feedback (pilot_note channel).
  for (const e of all) {
    if (e.action !== "pilot_note" || !e.note) continue;
    items.push({
      proposalPath: abs(runsDir, session, "evidence.jsonl"),
      proposalId: `note-${e.ts}`,
      verdictLine: "owner note",
      excerpt: e.note.slice(0, FEEDBACK_EXCERPT_CHARS),
    });
  }
  const events = all.filter((e) => e.round < round && e.proposalId);
  for (const e of events) {
    if (e.action !== "approve" && e.action !== "reject") continue;
    const dir = roundDir(runsDir, session, decision.id, e.round);
    // proposalId is `<letter>` scoped to its round dir.
    const path = abs(dir, `${e.proposalId}`, "proposal.md");
    if (!existsSync(path)) continue;
    items.push({
      proposalPath: path,
      proposalId: `round-${e.round}/${e.proposalId}`,
      verdictLine: `round ${e.round}, option ${e.proposalId}: ${e.action}ed`,
      excerpt: readText(path).slice(0, FEEDBACK_EXCERPT_CHARS),
    });
  }
  return items;
}

function assembleOne(
  repoRoot: string,
  dataDir: { decisionsPath: string; approachesPath: string },
  decision: Decision,
  approach: Approach,
  learned: LearnedSeed[],
  feedback: FeedbackItem[],
  proposalId: string,
): { system: string; prompt: string; manifest: ContextManifest } {
  const elements: ContextElement[] = [];
  const parts: string[] = [];

  const decisionText = `## Decision\n${decision.title}\n\n${decision.instruction}\n`;
  parts.push(decisionText);
  elements.push({
    ref: makeRef(repoRoot, dataDir.decisionsPath, decision.id, decisionText),
    kind: "decision",
    chars: decisionText.length,
    selectionReason: "the decision under governance",
  });

  const approachText = `## Working angle\n${approach.hint}\n`;
  parts.push(approachText);
  elements.push({
    ref: makeRef(repoRoot, dataDir.approachesPath, approach.id, approachText),
    kind: "approach",
    chars: approachText.length,
    selectionReason: "this proposal's assigned angle",
  });

  for (const seed of learned) {
    const text = `## Owner preference (admitted)\n${seed.body}\n`;
    parts.push(text);
    elements.push({
      ref: seed.ref,
      kind: "learned-seed",
      chars: text.length,
      selectionReason: "admitted by the owner from selection evidence",
    });
  }

  for (const fb of feedback) {
    const text = `## Prior work (${fb.verdictLine})\n${fb.excerpt}\n`;
    parts.push(text);
    elements.push({
      ref: makeRef(repoRoot, fb.proposalPath, fb.proposalId, fb.excerpt),
      kind: "feedback",
      chars: text.length,
      selectionReason: `prior feedback (${fb.verdictLine}) — failures stay visible`,
    });
  }

  // Article 9 at runtime: below ~90% certainty of the owner's governing
  // intent, the worker asks instead of silently guessing — but still works.
  const system =
    "You produce one focused work proposal for the decision below, following " +
    "the working angle you are given. If a governing choice materially " +
    "changes the work and you are less than ~90% certain of the owner's " +
    "intent, begin with a section titled 'Perguntas ao Pilot' (max 3 short " +
    "questions), then still produce your best proposal under explicitly " +
    "stated assumptions. Answer with only the proposal body.";
  const prompt = parts.join("\n");
  return {
    system,
    prompt,
    manifest: { proposalId, elements, assembledSha256: sha256(prompt) },
  };
}

/** Every element's chars must be found in the prompt — completeness, cheaply. */
function verifyManifest(manifest: ContextManifest, prompt: string): boolean {
  const total = manifest.elements.reduce((n, e) => n + e.chars, 0);
  return total > 0 && total <= prompt.length + manifest.elements.length * 8;
}

/** Run one proposal round. Returns the sealed mapping (letters only to the UI). */
export async function runRound(args: RoundArgs): Promise<RoundMapping> {
  const log = args.log ?? (() => undefined);
  const dir = roundDir(args.runsDir, args.session, args.decision.id, args.round);
  const mappingPath = abs(dir, "mapping.sealed.json");
  if (existsSync(mappingPath)) {
    return readJson<RoundMapping>(mappingPath);
  }

  const letters = shuffledLetters(
    args.project.approaches,
    `${args.session}:${args.decision.id}:${args.round}`,
  );
  const mapping: RoundMapping = {
    session: args.session,
    decisionId: args.decision.id,
    round: args.round,
    letters,
  };
  writeJson(mappingPath, mapping);

  const feedback = priorFeedback(args.runsDir, args.session, args.decision, args.round);
  const dataPaths = {
    decisionsPath: abs(args.project.dir, "decisions.json"),
    approachesPath: abs(args.project.dir, "approaches.json"),
  };

  for (const [letter, approachId] of Object.entries(letters)) {
    const approach = args.project.approaches.find((a) => a.id === approachId);
    if (!approach) throw new Error(`unknown approach ${approachId}`);
    const proposalId = letter;
    const { system, prompt, manifest } = assembleOne(
      args.repoRoot,
      dataPaths,
      args.decision,
      approach,
      args.project.learned,
      feedback,
      proposalId,
    );
    if (!verifyManifest(manifest, prompt)) {
      throw new Error(`manifest completeness check failed for ${proposalId}`);
    }
    const pDir = abs(dir, letter);
    writeJson(abs(pDir, "manifest.json"), manifest);

    const started = Date.now();
    const result = await args.port.generate({
      system,
      prompt,
      model: args.model,
      maxTokens: MAX_TOKENS,
      jobId: `${args.session}--${args.decision.id}--r${args.round}--${letter}`,
    });
    const meter: MeterRecord = {
      proposalId,
      model: args.model,
      requestId: result.usage.requestId,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      cacheCreationInputTokens: result.usage.cacheCreationInputTokens,
      cacheReadInputTokens: result.usage.cacheReadInputTokens,
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - started,
      estimated: result.usage.estimated ?? false,
    };
    writeJson(abs(pDir, "meter.json"), meter);
    writeArtifactOnce(abs(pDir, "proposal.md"), result.text);
    log(
      `  ${args.decision.id} r${args.round} ${letter}: in=${meter.inputTokens} ` +
        `out=${meter.outputTokens} tok${meter.estimated ? " (est)" : ""} · ` +
        `${manifest.elements.length} ctx`,
    );
  }

  // ADR-0016 §1–2: a click is only evidence relative to what was on the
  // table. Record the full choice set — display order, content hashes, and
  // the learned-seed versions active in this round's context.
  const order = Object.keys(letters).sort();
  const contentSha: Record<string, string> = {};
  for (const l of order) {
    contentSha[l] = sha256(readText(abs(dir, l, "proposal.md")));
  }
  appendEvent(args.runsDir, {
    ts: new Date().toISOString(),
    session: args.session,
    decisionId: args.decision.id,
    round: args.round,
    action: "present",
    scripted: args.scripted ?? false,
    order,
    contentSha,
    activeSeeds: args.project.learned.map((s) => `${s.id}@${s.ref.version}`),
  });
  return mapping;
}
