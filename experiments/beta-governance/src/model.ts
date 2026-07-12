// COPIED from experiments/beta-coding/src/model.ts (ADR-0012/0013 rig) — rigs
// are disposable science and stay uncoupled; a copy with provenance beats an import.
// The boundary between the experiment and the model. One interface, three ports:
// a fake (zero cost, deterministic — for building and smoke-testing), a manual
// file-drop port (spawned Claude Codes do the work; no API wallet — ADR-0013),
// and the real Anthropic port (gated on ANTHROPIC_API_KEY).

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import type { ModelResult } from "./types.js";

export interface GenerateArgs {
  system: string;
  prompt: string;
  model: string;
  maxTokens: number;
  /** Stable id for this work order; used by the manual port to name mailbox files. */
  jobId?: string;
}

/** ~4 chars/token — the estimate used when no API metering is available. */
function estTokens(s: string): number {
  return Math.max(1, Math.ceil(s.length / 4));
}

export interface ModelPort {
  readonly name: string;
  generate(args: GenerateArgs): Promise<ModelResult>;
}

/**
 * Deterministic, free stand-in. Token counts approximate the usual ~4 chars/token
 * so the pipeline's numbers are shaped like real ones without spending anything.
 * Output is derived from the input so two identical prompts yield identical bytes
 * (the determinism the experiment's assertions check).
 */
export class FakeModel implements ModelPort {
  readonly name = "fake";

  async generate(args: GenerateArgs): Promise<ModelResult> {
    const inputChars = args.system.length + args.prompt.length;
    const text =
      `# Fake Mentor output\n\n` +
      `This is a deterministic placeholder produced by the fake model so the\n` +
      `Beta Coding pipeline can be exercised at zero cost.\n\n` +
      `- input characters seen: ${inputChars}\n` +
      `- requested model: ${args.model}\n` +
      `- max tokens: ${args.maxTokens}\n\n` +
      `The real Mentor's judgment arrives when the Anthropic port runs (slice 3).\n`;
    return {
      text,
      usage: {
        inputTokens: estTokens(args.system) + estTokens(args.prompt),
        outputTokens: estTokens(text),
        cacheCreationInputTokens: 0,
        cacheReadInputTokens: 0,
        requestId: null,
        estimated: true,
      },
    };
  }
}

/**
 * Manual file-drop port (ADR-0013). Instead of calling a metered API, it drops
 * the assembled prompt into a mailbox outbox and waits for a spawned worker
 * (a Claude Code launched by tools/spawn.bat, running on the Pilot's own
 * subscription — not the API wallet) to write the answer into the inbox.
 *
 * Protocol, per work order:
 *   mailbox/outbox/<jobId>.md   ← this port writes the prompt here
 *   mailbox/inbox/<jobId>.md    ← the worker writes the artifact here
 * Both files are consumed (deleted) once collected, keeping the mailbox clean.
 *
 * Tokens are chars/4 estimates — the reduction *ratio* between paths is faithful
 * (same estimator), the absolute count is not API-metered. See ADR-0013.
 */
export class FileDropModel implements ModelPort {
  readonly name = "manual";
  #outbox: string;
  #inbox: string;
  #pollMs: number;
  #announced = false;

  constructor(mailboxDir: string, pollMs = 2000) {
    this.#outbox = resolve(mailboxDir, "outbox");
    this.#inbox = resolve(mailboxDir, "inbox");
    this.#pollMs = pollMs;
  }

  async generate(args: GenerateArgs): Promise<ModelResult> {
    const jobId = args.jobId;
    if (!jobId) throw new Error("manual port requires a jobId");
    mkdirSync(this.#outbox, { recursive: true });
    mkdirSync(this.#inbox, { recursive: true });

    const outPath = resolve(this.#outbox, `${jobId}.md`);
    const inPath = resolve(this.#inbox, `${jobId}.md`);

    // Assemble the worker's prompt: framing + context, plus a plain instruction
    // to answer with only the artifact (the worker is a fresh Claude Code).
    const jobFile =
      `<!-- job ${jobId} — respond with ONLY the artifact below, no preamble -->\n\n` +
      `${args.system}\n\n${args.prompt}\n`;
    writeFileSync(outPath, jobFile, "utf8");

    if (!this.#announced) {
      this.#announced = true;
      console.log(
        `\n  manual port: prompts are being dropped in mailbox/outbox/.\n` +
          `  In another terminal run:  experiments\\beta-coding\\tools\\spawn.bat\n` +
          `  (it spawns a Claude Code per job and writes answers to mailbox/inbox/).\n` +
          `  Waiting for answers…\n`,
      );
    }

    // Wait for the worker's answer.
    while (!existsSync(inPath)) {
      await new Promise((r) => setTimeout(r, this.#pollMs));
    }
    const text = readFileSync(inPath, "utf8");

    // Consume both files so the mailbox is clean and re-runs regenerate.
    rmSync(outPath, { force: true });
    rmSync(inPath, { force: true });

    return {
      text,
      usage: {
        inputTokens: estTokens(args.system) + estTokens(args.prompt),
        outputTokens: estTokens(text),
        cacheCreationInputTokens: 0,
        cacheReadInputTokens: 0,
        requestId: null,
        estimated: true,
      },
    };
  }
}

/**
 * The real port. Lazily imports the SDK so the fake path never needs the
 * dependency resolved and never touches the network. No cache_control is ever
 * sent — the metering honesty rule (see meter.ts) depends on it.
 */
export class AnthropicModel implements ModelPort {
  readonly name = "anthropic";
  #apiKey: string;

  constructor(apiKey: string) {
    this.#apiKey = apiKey;
  }

  async generate(args: GenerateArgs): Promise<ModelResult> {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey: this.#apiKey });
    const resp = await client.messages.create({
      model: args.model,
      max_tokens: args.maxTokens,
      system: args.system,
      messages: [{ role: "user", content: args.prompt }],
    });
    const text = resp.content
      .filter((b): b is Extract<typeof b, { type: "text" }> => b.type === "text")
      .map((b) => b.text)
      .join("");
    const u = resp.usage;
    return {
      text,
      usage: {
        inputTokens: u.input_tokens,
        outputTokens: u.output_tokens,
        cacheCreationInputTokens: u.cache_creation_input_tokens ?? 0,
        cacheReadInputTokens: u.cache_read_input_tokens ?? 0,
        requestId: resp._request_id ?? null,
      },
    };
  }
}

export interface ResolveOptions {
  /** Mailbox directory for the manual file-drop port. */
  mailboxDir?: string;
}

/**
 * Select a port from a --model argument:
 *   "fake"   → FakeModel (zero cost, deterministic)
 *   "manual" → FileDropModel (spawned Claude Codes via the mailbox — ADR-0013)
 *   other    → real Anthropic model (needs ANTHROPIC_API_KEY)
 */
export function resolveModel(
  modelArg: string,
  opts: ResolveOptions = {},
): { port: ModelPort; model: string } {
  if (modelArg === "fake") {
    return { port: new FakeModel(), model: "fake" };
  }
  if (modelArg === "manual") {
    if (!opts.mailboxDir) throw new Error("manual model requires a mailboxDir");
    return { port: new FileDropModel(opts.mailboxDir), model: "manual" };
  }
  const apiKey = process.env["ANTHROPIC_API_KEY"];
  if (!apiKey) {
    throw new Error(
      `real model "${modelArg}" requested but ANTHROPIC_API_KEY is not set. ` +
        `Use --model fake (zero cost) or --model manual (spawned Claude Codes).`,
    );
  }
  return { port: new AnthropicModel(apiKey), model: modelArg };
}
