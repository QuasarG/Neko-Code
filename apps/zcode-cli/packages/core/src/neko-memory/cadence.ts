// ============================================================
// Neko Memory Cadence - checkpoint reminder and imperative hint
// ============================================================

export const NEKO_MEMORY_UPDATE_INTERVAL = 10;

/**
 * 会话级计数键（存于 NekoMemorySnapshotPort 的 session int 通道）：
 * query_count 是已计入的真实用户轮数；checkpoint_block 是已完成的 checkpoint
 * 区间（一次成功的记忆书 Edit 把它推进到当前区间，checkpoint 提醒随之关闭）。
 */
export const NEKO_MEMORY_QUERY_COUNT_KEY = "query_count";
export const NEKO_MEMORY_CHECKPOINT_BLOCK_KEY = "checkpoint_block";

/** Recall 问题只请求检索，不触发写入提示。 */
const MEMORY_RECALL_QUESTION =
  /记不记得|记得(吗|吧|么|没有)|是否记得|还想得起|想起来了|(do|did)\s+you\s+remember|you\s+remember/i;

/** 命令式记忆线索：用户要求把某件事留到以后。 */
const MEMORY_IMPERATIVE_CUE =
  /记住|记下|别忘了|不要忘记|不可忘记|牢牢地?记|下次|以后|今后|往后|remember\s+(this|that|to|it|the|a|everything|what)|don'?t\s+forget|does\s+not\s+forget|keep\s+(this|that|it)\s+in\s+mind|from\s+now\s+on|next\s+time|make\s+a\s+note|write\s+(this|that|it)\s+down/i;

/**
 * 用户消息里出现命令式记忆线索时的提示。只要求模型评估是否记，
 * 不是命令；"你还记得吗" 这类检索问题不触发。
 */
export function memoryHintFor(text: string): string | undefined {
  if (!text.trim()) return undefined;
  if (MEMORY_RECALL_QUESTION.test(text)) return undefined;
  if (!MEMORY_IMPERATIVE_CUE.test(text)) return undefined;
  return (
    "The user's message may be a request to keep something for later. " +
    "Consider whether it warrants a durable memory edit this turn: Read the matching book, then Edit it. " +
    "This hint only asks you to evaluate; it is not an order to write."
  );
}

export interface NekoMemoryCadence {
  queries: number;
  block: number;
  due: boolean;
}

/**
 * 十次用户查询的记忆下限。写入（Edit 记忆书）成功清掉当前 block；
 * 跳过则继续欠着。
 */
export function memoryUpdateCadence(input: {
  queries: number;
  completedBlock: number;
}): NekoMemoryCadence {
  const block = Math.floor(input.queries / NEKO_MEMORY_UPDATE_INTERVAL);
  return { queries: input.queries, block, due: block > input.completedBlock };
}

/**
 * 本次查询是否需要挂 checkpoint：已欠的 block，或本次查询恰好跨入
 * 下一个十次区间（含即将回答的这一问）。
 */
export function memoryCheckpointDue(input: { queries: number; completedBlock: number }): boolean {
  const cadence = memoryUpdateCadence(input);
  return (
    cadence.due || Math.floor((input.queries + 1) / NEKO_MEMORY_UPDATE_INTERVAL) > cadence.block
  );
}
