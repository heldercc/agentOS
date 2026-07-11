// The boundary between the experiment and the model. One interface, two ports:
// a fake (zero cost, deterministic — for building and smoke-testing the pipeline)
// and the real Anthropic port (slice 3+, gated on ANTHROPIC_API_KEY).

import type { ModelResult } from "./types.js";

export interface GenerateArgs {
  system: string;
  prompt: string;
  model: string;
  maxTokens: number;
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
    const estTok = (s: string): number => Math.max(1, Math.ceil(s.length / 4));
    return {
      text,
      usage: {
        inputTokens: estTok(args.system) + estTok(args.prompt),
        outputTokens: estTok(text),
        cacheCreationInputTokens: 0,
        cacheReadInputTokens: 0,
        requestId: null,
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

/** Select a port from a --model argument. "fake" → FakeModel; anything else → real. */
export function resolveModel(modelArg: string): { port: ModelPort; model: string } {
  if (modelArg === "fake") {
    return { port: new FakeModel(), model: "fake" };
  }
  const apiKey = process.env["ANTHROPIC_API_KEY"];
  if (!apiKey) {
    throw new Error(
      `real model "${modelArg}" requested but ANTHROPIC_API_KEY is not set. ` +
        `Use --model fake for a zero-cost run.`,
    );
  }
  return { port: new AnthropicModel(apiKey), model: modelArg };
}
