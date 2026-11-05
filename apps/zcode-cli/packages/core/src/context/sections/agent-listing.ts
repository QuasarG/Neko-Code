// ============================================================
// Agent Listing Section Builder
// ============================================================

import type { ContextSection } from "../types.js";
import { estimateTokens } from "../utils.js";

const CONCURRENCY_NOTE =
  "When you launch multiple agents for independent work, send them in a single message with multiple tool uses so they run concurrently.";

/** 主 Agent 可用的子 Agent 类型属于 harness 固定事实，随 system prompt 下发。 */
export function buildAgentListingSection(content: string | undefined): ContextSection | null {
  if (!content) return null;
  const body = `${content}\n\n${CONCURRENCY_NOTE}`;
  return {
    name: "Agent Listing",
    source: "agent_listing",
    injectionTarget: "system",
    cacheHint: "dynamic",
    chars: body.length,
    tokens: estimateTokens(body),
    content: body,
    preview: body.slice(0, 100),
  };
}
