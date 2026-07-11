// Real token accounting. The MeterRecord is the honest measurement the whole
// experiment rests on, so this module is strict about cache being zero.

import type { MeterRecord, ModelUsage } from "./types.js";

export function makeMeterRecord(
  workOrderId: string,
  model: string,
  usage: ModelUsage,
  durationMs: number,
): MeterRecord {
  // Prompt caching would make input_tokens incomparable across paths. We never
  // send cache_control, so cache reads/creations must be zero. Fail loud if not.
  if (usage.cacheReadInputTokens !== 0 || usage.cacheCreationInputTokens !== 0) {
    throw new Error(
      `cache tokens must be zero for an honest comparison, got ` +
        `create=${usage.cacheCreationInputTokens} read=${usage.cacheReadInputTokens}`,
    );
  }
  return {
    workOrderId,
    model,
    requestId: usage.requestId,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    cacheCreationInputTokens: usage.cacheCreationInputTokens,
    cacheReadInputTokens: usage.cacheReadInputTokens,
    timestamp: new Date().toISOString(),
    durationMs,
  };
}
