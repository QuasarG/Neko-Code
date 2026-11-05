// ============================================================
// Neko Memory Diff - minimal line edit script for update delivery
// ============================================================

export interface NekoMemoryDiffLine {
  kind: "+" | "-";
  text: string;
}

/** LCS 中间表超过这个格数就放弃 diff，退回整篇正文。 */
const CELL_GUARD = 4_000_000;
/** 渲染后的 diff 超过新正文约一半字节就不值得发。 */
const RENDER_RATIO = 0.5;

function trimCommonEdges(
  oldLines: string[],
  newLines: string[],
): { oldMiddle: string[]; newMiddle: string[] } {
  let start = 0;
  while (start < oldLines.length && start < newLines.length && oldLines[start] === newLines[start])
    start++;
  let endOld = oldLines.length;
  let endNew = newLines.length;
  while (endOld > start && endNew > start && oldLines[endOld - 1] === newLines[endNew - 1]) {
    endOld--;
    endNew--;
  }
  return { oldMiddle: oldLines.slice(start, endOld), newMiddle: newLines.slice(start, endNew) };
}

/** 无防护的最小 diff：只做公共前后缀裁剪 + LCS。 */
export function lineDiffRegions(oldBody: string, newBody: string): NekoMemoryDiffLine[] {
  const { oldMiddle, newMiddle } = trimCommonEdges(oldBody.split("\n"), newBody.split("\n"));
  return middleDiff(oldMiddle, newMiddle);
}

/**
 * 两版正文的最小行 diff；当 diff 不值得渲染时返回 null：
 * 中间表超限，或渲染行字节超过新正文的一半（调用方退回整篇正文）。
 */
export function diffNekoMemoryBodies(
  oldBody: string,
  newBody: string,
): NekoMemoryDiffLine[] | null {
  const { oldMiddle, newMiddle } = trimCommonEdges(oldBody.split("\n"), newBody.split("\n"));
  if (oldMiddle.length * newMiddle.length > CELL_GUARD) return null;
  const lines = middleDiff(oldMiddle, newMiddle);
  let renderedBytes = 0;
  for (const line of lines) renderedBytes += 3 + Buffer.byteLength(line.text);
  if (renderedBytes > RENDER_RATIO * Buffer.byteLength(newBody)) return null;
  return lines;
}

function middleDiff(oldLines: string[], newLines: string[]): NekoMemoryDiffLine[] {
  const rows = oldLines.length;
  const cols = newLines.length;
  const lcs = new Int32Array((rows + 1) * (cols + 1));
  for (let i = rows - 1; i >= 0; i--) {
    for (let j = cols - 1; j >= 0; j--) {
      lcs[i * (cols + 1) + j] =
        oldLines[i] === newLines[j]
          ? lcs[(i + 1) * (cols + 1) + j + 1] + 1
          : Math.max(lcs[(i + 1) * (cols + 1) + j], lcs[i * (cols + 1) + j + 1]);
    }
  }
  const ops: NekoMemoryDiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < rows && j < cols) {
    if (oldLines[i] === newLines[j]) {
      i++;
      j++;
      continue;
    }
    // 平局优先删除，替换块读起来是先 -旧 再 +新。
    if (lcs[(i + 1) * (cols + 1) + j] >= lcs[i * (cols + 1) + j + 1]) {
      ops.push({ kind: "-", text: oldLines[i++] ?? "" });
    } else {
      ops.push({ kind: "+", text: newLines[j++] ?? "" });
    }
  }
  while (i < rows) ops.push({ kind: "-", text: oldLines[i++] ?? "" });
  while (j < cols) ops.push({ kind: "+", text: newLines[j++] ?? "" });
  return groupRemovalsFirst(ops);
}

/** 每个变更区统一成先删后加，便于模型按块替换。 */
function groupRemovalsFirst(ops: NekoMemoryDiffLine[]): NekoMemoryDiffLine[] {
  const grouped: NekoMemoryDiffLine[] = [];
  let removals: NekoMemoryDiffLine[] = [];
  for (const op of ops) {
    if (op.kind === "-") {
      removals.push(op);
      continue;
    }
    if (removals.length > 0) {
      grouped.push(...removals);
      removals = [];
    }
    grouped.push(op);
  }
  grouped.push(...removals);
  return grouped;
}
