// COPIED-with-adaptation from experiments/beta-governance/src/model.ts
// (ADR-0013 rig) — a copy with provenance beats an import. The boundary
// between the product shell and Claude Code (Operating Model §8): AgentOS
// prepares Work Orders and invokes Claude Code; Claude Code executes.
//
// Three ports:
//   fake    — deterministic, zero cost; building and smoke-testing
//   cli     — Claude Code invoked locally through PowerShell (the product path)
//   mailbox — human-in-the-middle file drop, for when the CLI is not logged in

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import type { ModelResult, WorkOrderKind } from "./types.js";

export interface GenerateArgs {
  system: string;
  prompt: string;
  /** Model the runtime is asked to use (haiku | sonnet | opus — effort-chosen). */
  model: string;
  maxTokens: number;
  timeoutMs: number;
  /** Stable id for this work order; names mailbox files and appears in errors. */
  jobId: string;
  /** Lets the fake port answer in the shape each step of the loop expects. */
  kind: WorkOrderKind;
  /** Cancels the call (parecer 2026-07-12, ponto E — the Pilot's "Parar esta
   *  operação"). Implementations kill only their own child/wait, never more. */
  signal?: AbortSignal;
  /** Heartbeat: called whenever there is REAL evidence of life (stdout/stderr
   *  chunks, poll ticks). Never faked on a timer alone. */
  onActivity?: () => void;
}

/** Thrown when a Pilot-initiated cancellation interrupts a runtime call. */
export class OpCancelledError extends Error {
  override readonly name = "OpCancelledError";
  constructor(jobId: string) {
    super(`operação cancelada pelo Piloto (job ${jobId})`);
  }
}

/** ~4 chars/token — the estimate used when no API metering is available. */
function estTokens(s: string): number {
  return Math.max(1, Math.ceil(s.length / 4));
}

function estimatedUsage(args: GenerateArgs, text: string): ModelResult["usage"] {
  return {
    inputTokens: estTokens(args.system) + estTokens(args.prompt),
    outputTokens: estTokens(text),
    cacheCreationInputTokens: 0,
    cacheReadInputTokens: 0,
    requestId: null,
    estimated: true,
  };
}

export interface Runtime {
  readonly name: string;
  generate(args: GenerateArgs): Promise<ModelResult>;
}

/**
 * Deterministic, free stand-in, aware of the loop step it is answering so the
 * whole 13-step pipeline can be exercised at zero cost. Output is derived only
 * from the input — identical calls yield identical bytes.
 */
export class FakeRuntime implements Runtime {
  readonly name = "fake";

  async generate(args: GenerateArgs): Promise<ModelResult> {
    // PRODUCT_FAKE_DELAY_MS: the deliberately-slow fake used for browser
    // verification of live execution observability (parecer 2026-07-12,
    // ponto H) — waits in ~200ms slices so cancellation and heartbeats are
    // both exercisable without a real runtime.
    const delayMs = Math.max(0, Number(process.env["PRODUCT_FAKE_DELAY_MS"] ?? 0) | 0);
    if (delayMs > 0) {
      const sliceMs = 200;
      let waited = 0;
      while (waited < delayMs) {
        if (args.signal?.aborted) throw new OpCancelledError(args.jobId);
        const slice = Math.min(sliceMs, delayMs - waited);
        await new Promise((r) => setTimeout(r, slice));
        waited += slice;
        args.onActivity?.();
        if (args.signal?.aborted) throw new OpCancelledError(args.jobId);
      }
    }
    if (args.signal?.aborted) throw new OpCancelledError(args.jobId);
    const text = this.#answer(args);
    return { text, usage: estimatedUsage(args, text) };
  }

  #answer(args: GenerateArgs): string {
    const seen = args.system.length + args.prompt.length;
    switch (args.kind) {
      case "roster":
        return (
          `Deterministic fake roster (input chars: ${seen}).\n\n` +
          "```json\n" +
          JSON.stringify(
            {
              agents: [
                {
                  id: "scope",
                  title: "Scope & Intent",
                  mandate:
                    "Understand what the user actually wants; keep the objective sharp and bounded.",
                  tags: ["intent", "objective"],
                },
                {
                  id: "options",
                  title: "Options & Craft",
                  mandate:
                    "Propose concrete ways to realize the objective; care about craft and coherence.",
                  tags: ["proposal", "craft"],
                },
                {
                  id: "risks",
                  title: "Constraints & Risks",
                  mandate:
                    "Surface constraints, dependencies and failure modes before they cost an iteration.",
                  tags: ["constraint", "risk"],
                },
              ],
            },
            null,
            2,
          ) +
          "\n```\n"
        );
      case "consult": {
        // Every agent shares one need (exercises dedup) and owns one of its own.
        const agent = /agent-id:\s*([a-z0-9-]+)/.exec(args.prompt)?.[1] ?? "agent";
        return (
          `Fake consultation from ${agent} (input chars: ${seen}).\n\n` +
          `Within my mandate I would proceed as the context suggests.\n\n` +
          "```json\n" +
          JSON.stringify({
            questions: [
              "What single outcome matters most to you in this project?",
              `What should the ${agent} specialist treat as out of bounds?`,
            ],
          }) +
          "\n```\n"
        );
      }
      case "reconsult":
        return (
          `Fake re-consultation (input chars: ${seen}). The answer received is ` +
          `sufficient; no further questions.\n\n` +
          "```json\n" +
          JSON.stringify({ questions: [] }) +
          "\n```\n"
        );
      case "synthesize":
        return (
          `Fake candidate state (input chars: ${seen}).\n\n` +
          "```json\n" +
          JSON.stringify(
            {
              objective: "Deterministic objective synthesized by the fake runtime.",
              phase: "shaping",
              approvedDecisions: [],
              activeArtifacts: [],
              unresolvedQuestions: [],
              constraints: ["fake-runtime output; replace with a real run"],
              nextAction: "Execute the first bounded work order toward the objective.",
            },
            null,
            2,
          ) +
          "\n```\n"
        );
      case "execute":
        return (
          `# Fake artifact\n\nDeterministic execution artifact (input chars: ${seen}).\n` +
          `The real work arrives when the cli or mailbox runtime runs.\n`
        );
      case "option": {
        const angle = /angle:\s*([a-z0-9-]+)/.exec(args.prompt)?.[1] ?? "generic";
        return (
          `Fake option from angle ${angle} (input chars: ${seen}).\n\n` +
          "```json\n" +
          JSON.stringify({
            title: `Caminho ${angle}`,
            direction: `direction-${angle}`,
            description: `A deterministic, genuinely distinct option produced from the ${angle} angle.`,
            benefits: `strongest on the ${angle} dimension`,
            tradeoffs: `weakest away from the ${angle} dimension`,
            assumptions: [`the ${angle} angle applies to this project`],
          }) +
          "\n```\n"
        );
      }
      case "refine": {
        const instruction =
          /refinement instruction:\s*(.+)/.exec(args.prompt)?.[1]?.trim() ?? "unchanged";
        return (
          `Fake refined option (input chars: ${seen}).\n\n` +
          "```json\n" +
          JSON.stringify({
            title: "Caminho refinado",
            direction: "direction-refined",
            description: `The original option, adjusted per: ${instruction}`,
            benefits: "keeps the original strength, honors the refinement",
            tradeoffs: "same as the original",
            assumptions: [`the refinement "${instruction}" preserves intent`],
          }) +
          "\n```\n"
        );
      }
      case "recommend": {
        const first = /option-[a-z0-9]+/.exec(args.prompt)?.[0] ?? "option-a";
        return (
          "```json\n" +
          JSON.stringify({
            optionId: first,
            reason: "deterministic fake recommendation: the first option on the table",
          }) +
          "\n```\n"
        );
      }
    }
  }
}

/**
 * Claude Code invoked locally through PowerShell (docs/PRODUCT-LOOP.md step 2).
 * One spawn per work order, prompt on stdin, artifact on stdout — the pattern
 * proven by the rig's dashboard worker (ADR-0013/0017). Runs on the Pilot's
 * subscription; requires `claude` to be logged in.
 */
export class CliRuntime implements Runtime {
  readonly name = "cli";

  async generate(args: GenerateArgs): Promise<ModelResult> {
    if (args.signal?.aborted) {
      return Promise.reject(new OpCancelledError(args.jobId));
    }
    const prompt = `${args.system}\n\n${args.prompt}\n`;
    const cmd =
      process.env["PRODUCT_WORKER_CMD"] ?? `claude -p --model ${args.model}`;
    return new Promise<ModelResult>((resolvePromise, reject) => {
      const child = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", cmd], {
        windowsHide: true,
      });
      let out = "";
      let err = "";
      // Cancellation kills only THIS child; a generic exit(code!=0) rejection
      // must never also fire once cancelled (settled guards the race).
      let settled = false;
      const timer = setTimeout(() => {
        settled = true;
        child.kill();
        reject(
          new Error(
            `cli runtime timed out after ${args.timeoutMs}ms on job ${args.jobId}`,
          ),
        );
      }, args.timeoutMs);
      const onAbort = (): void => {
        settled = true;
        clearTimeout(timer);
        child.kill();
        reject(new OpCancelledError(args.jobId));
      };
      args.signal?.addEventListener("abort", onAbort);
      const detach = (): void => {
        args.signal?.removeEventListener("abort", onAbort);
      };
      child.stdout.on("data", (d: Buffer) => {
        out += d.toString("utf8");
        args.onActivity?.();
      });
      child.stderr.on("data", (d: Buffer) => {
        err += d.toString("utf8");
        args.onActivity?.();
      });
      child.on("error", (e) => {
        clearTimeout(timer);
        detach();
        if (settled) return;
        settled = true;
        reject(new Error(`cli runtime spawn failed: ${e.message}`));
      });
      child.on("close", (code) => {
        clearTimeout(timer);
        detach();
        if (settled) return;
        settled = true;
        if (code === 0 && out.trim().length > 0) {
          resolvePromise({ text: out, usage: estimatedUsage(args, out) });
        } else {
          reject(
            new Error(
              `cli runtime failed (exit ${code}) on job ${args.jobId}: ` +
                `${(err || out).trim().slice(0, 300) || "empty output"}. ` +
                `If the CLI is not logged in, run "claude" once in a terminal — ` +
                `or switch to the mailbox runtime (PRODUCT_RUNTIME=mailbox).`,
            ),
          );
        }
      });
      child.stdin.write(prompt);
      child.stdin.end();
    });
  }
}

/**
 * Manual file-drop port (ADR-0013). Drops the assembled prompt into
 * mailbox/outbox/ and waits for a worker — a spawned Claude Code or a
 * human-in-the-middle — to write the answer into mailbox/inbox/. Both files
 * are consumed once collected, keeping the mailbox clean.
 */
export class MailboxRuntime implements Runtime {
  readonly name = "mailbox";
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
    mkdirSync(this.#outbox, { recursive: true });
    mkdirSync(this.#inbox, { recursive: true });
    const outPath = resolve(this.#outbox, `${args.jobId}.md`);
    const inPath = resolve(this.#inbox, `${args.jobId}.md`);

    writeFileSync(
      outPath,
      `<!-- job ${args.jobId} (${args.kind}) — respond with ONLY the artifact, no preamble -->\n\n` +
        `${args.system}\n\n${args.prompt}\n`,
      "utf8",
    );
    if (!this.#announced) {
      this.#announced = true;
      console.log(
        `\n  mailbox runtime: prompts land in product/mailbox/outbox/.\n` +
          `  A worker (spawned Claude Code or a human-in-the-middle) answers by\n` +
          `  writing the matching file into product/mailbox/inbox/. Waiting…\n`,
      );
    }

    const deadline = Date.now() + args.timeoutMs;
    while (!existsSync(inPath)) {
      if (args.signal?.aborted) throw new OpCancelledError(args.jobId);
      if (Date.now() > deadline) {
        throw new Error(
          `mailbox runtime timed out after ${args.timeoutMs}ms waiting for ` +
            `inbox/${args.jobId}.md — the outbox prompt is still there for a retry`,
        );
      }
      await new Promise((r) => setTimeout(r, this.#pollMs));
      args.onActivity?.();
    }
    const text = readFileSync(inPath, "utf8");
    rmSync(outPath, { force: true });
    rmSync(inPath, { force: true });
    return { text, usage: estimatedUsage(args, text) };
  }
}

/**
 * Select the runtime: PRODUCT_RUNTIME=fake|cli|mailbox (default cli — the
 * product-normal path; the shell surfaces the login hint when it fails).
 */
export function resolveRuntime(name: string, opts: { mailboxDir: string }): Runtime {
  switch (name) {
    case "fake":
      return new FakeRuntime();
    case "mailbox":
      return new MailboxRuntime(opts.mailboxDir);
    case "cli":
      return new CliRuntime();
    default:
      throw new Error(`unknown runtime "${name}" — use fake, cli or mailbox`);
  }
}
