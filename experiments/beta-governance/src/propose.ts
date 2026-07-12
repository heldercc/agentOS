// Proposal rounds: for one decision, assemble one context per approach,
// generate, and write the full audit trail (manifest, meter, proposal body,
// sealed blind mapping). The judge sees letters, never approach identities —
// and judges each proposal in isolation first (pointwise-before-pairwise seed:
// the comparison protocol itself can fabricate the winner).

import { existsSync } from "node:fs";

import { readSessionEvents } from "./evidence.js";
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

/** Prior rounds' verdicts, folded from evidence — failures stay visible. */
function priorFeedback(
  runsDir: string,
  session: string,
  decision: Decision,
  round: number,
): FeedbackItem[] {
  const events = readSessionEvents(runsDir, session).filter(
    (e) => e.decisionId === decision.id && e.round < round && e.proposalId,
  );
  const items: FeedbackItem[] = [];
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
      selectionReason: "prior round verdict — failures stay visible",
    });
  }

  const system =
    "You produce one focused work proposal for the decision below, following " +
    "the working angle you are given. Answer with only the proposal body.";
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
    decisionsPath: abs(args.runsDir, "..", "data", "decisions.json"),
    approachesPath: abs(args.runsDir, "..", "data", "approaches.json"),
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
  return mapping;
}
