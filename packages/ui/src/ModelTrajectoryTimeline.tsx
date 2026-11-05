import { useVirtualizer } from "@tanstack/react-virtual";
import { useEffect, type RefObject } from "react";
import type { NekodeModelTrajectoryRecord } from "@zcode/services";
import {
  type TrajectorySearchMatch,
  type TrajectorySearchTimelineItem,
} from "@/ModelTrajectorySearch.js";
import {
  applyTrajectorySearchHighlights,
  clearTrajectorySearchHighlights,
  isTrajectorySearchTargetMounted,
  scrollTrajectorySearchRangeIntoView,
} from "@/ModelTrajectorySearchHighlight.js";
import { CallCard, type IntlShape } from "@/ModelTrajectoryPaneParts.js";

export function ModelTrajectoryTimeline({
  items,
  searchQuery,
  searchMatches,
  activeSearchMatch,
  intl,
  scrollContainerRef,
}: {
  items: TrajectorySearchTimelineItem[];
  searchQuery: string;
  searchMatches: TrajectorySearchMatch[];
  activeSearchMatch: TrajectorySearchMatch | null;
  intl: IntlShape;
  scrollContainerRef: RefObject<HTMLDivElement | null>;
}) {
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollContainerRef.current,
    getItemKey: (index) => items[index]?.key ?? index,
    estimateSize: () => 240,
    overscan: 3,
  });
  // 搜索切换会同时收起旧命中并展开新命中；此时禁止 virtualizer 根据每次测高回调连续
  // 修正滚动锚点，由下方文本级定位在布局稳定后一次完成滚动。
  virtualizer.shouldAdjustScrollPositionOnItemSizeChange = () => !searchQuery;
  const roleWidthLabels = ["system", "user", "assistant", "tool"].map((role) =>
    intl.formatMessage({ id: `modelTrajectory.role.${role}` }),
  );
  const virtualItems = virtualizer.getVirtualItems();
  const firstVirtualItem = virtualItems[0];
  const lastVirtualItem = virtualItems.at(-1);
  const topSpacerHeight = firstVirtualItem?.start ?? 0;
  const bottomSpacerHeight = lastVirtualItem ? virtualizer.getTotalSize() - lastVirtualItem.end : 0;
  // 只跟踪挂载集合。把 start 放进依赖会让每次动态测高都重新安排一次精确滚动。
  const mountedRowsKey = virtualItems.map((item) => item.key).join("|");

  useEffect(() => () => clearTrajectorySearchHighlights(), []);

  useEffect(() => {
    const root = scrollContainerRef.current;
    if (
      !activeSearchMatch ||
      !root ||
      isTrajectorySearchTargetMounted(root, activeSearchMatch.expansionKey)
    ) {
      return;
    }
    // 目标已经挂载时跳过 Call 级预滚动，否则随后文本级定位会造成连续两次跳动。
    virtualizer.scrollToIndex(activeSearchMatch.callIndex, { align: "center" });
  }, [activeSearchMatch, scrollContainerRef, virtualizer]);

  useEffect(() => {
    const root = scrollContainerRef.current;
    if (!root || !searchQuery) {
      clearTrajectorySearchHighlights();
      return;
    }
    let secondFrame = 0;
    const firstFrame = window.requestAnimationFrame(() => {
      virtualizer.measure();
      secondFrame = window.requestAnimationFrame(() => {
        const activeRange = applyTrajectorySearchHighlights({
          root,
          query: searchQuery,
          matches: searchMatches,
          activeMatch: activeSearchMatch,
        });
        if (activeRange) scrollTrajectorySearchRangeIntoView(activeRange, root);
      });
    });
    return () => {
      window.cancelAnimationFrame(firstFrame);
      window.cancelAnimationFrame(secondFrame);
    };
  }, [
    activeSearchMatch,
    mountedRowsKey,
    scrollContainerRef,
    searchMatches,
    searchQuery,
    virtualizer,
  ]);

  return (
    <ol
      data-trajectory-timeline=""
      className="grid grid-cols-[max-content_minmax(0,1fr)_auto] gap-x-2"
    >
      {roleWidthLabels.map((label) => (
        <li
          key={label}
          aria-hidden="true"
          className="invisible col-start-1 row-start-1 h-0 overflow-hidden whitespace-nowrap font-mono text-ui-sm"
        >
          {label}
        </li>
      ))}
      {topSpacerHeight > 0 ? (
        <li aria-hidden="true" className="col-span-full" style={{ height: topSpacerHeight }} />
      ) : null}
      {virtualItems.map((virtualItem) => {
        const item = items[virtualItem.index];
        if (!item) return null;
        return (
          <li
            key={item.key}
            ref={virtualizer.measureElement}
            data-index={virtualItem.index}
            data-trajectory-virtual-row=""
            className="col-span-full grid w-full grid-cols-subgrid"
          >
            <CallCard
              record={item.record}
              index={virtualItem.index}
              inputMessages={item.inputMessages}
              expansionKeyPrefix={item.key}
              intl={intl}
            />
          </li>
        );
      })}
      {bottomSpacerHeight > 0 ? (
        <li aria-hidden="true" className="col-span-full" style={{ height: bottomSpacerHeight }} />
      ) : null}
    </ol>
  );
}

export function resolveTrajectoryTimelineItems(records: NekodeModelTrajectoryRecord[]) {
  let previousMessages: NekodeModelTrajectoryRecord["request"]["messages"] = [];

  return records.map((record, index) => {
    const messages = record.request.messages;
    const usesConversationDelta = shouldUseConversationDelta(record);
    // 首条展示完整起始上下文；后续主会话只展示相对上一请求真正新增的尾部。
    // 不能只按消息数取 delta：编辑/retry 的 rewind 会让消息数变小或从中间分叉，
    // 按数量切片会把整段历史重新显示成“新增”，轨迹看起来就顺序错乱。
    const changedTail =
      index === 0 || !usesConversationDelta
        ? messages
        : messages.slice(commonMessagePrefixLength(previousMessages, messages));
    const inputMessages =
      index === 0 || !usesConversationDelta
        ? changedTail
        : changedTail.filter((message) => message.role !== "assistant");
    if (usesConversationDelta) {
      previousMessages = messages;
    }
    return {
      key: `${record.requestId}:${index}`,
      record,
      inputMessages,
    };
  });
}

/** 兼容旧调用：按上一请求的消息数取尾部；主路径使用 resolveTrajectoryTimelineItems。 */
export function resolveTrajectoryInputMessages({
  record,
  index,
  previousConversationMessageCount,
}: {
  record: NekodeModelTrajectoryRecord;
  index: number;
  previousConversationMessageCount: number;
}): {
  inputMessages: NekodeModelTrajectoryRecord["request"]["messages"];
  nextConversationMessageCount: number;
} {
  const messages = record.request.messages;
  const usesConversationDelta = shouldUseConversationDelta(record);
  const inputMessages =
    index === 0 || !usesConversationDelta
      ? messages
      : messages
          .slice(previousConversationMessageCount)
          .filter((message) => message.role !== "assistant");
  return {
    inputMessages,
    nextConversationMessageCount: usesConversationDelta
      ? messages.length
      : previousConversationMessageCount,
  };
}

function commonMessagePrefixLength(
  left: NekodeModelTrajectoryRecord["request"]["messages"],
  right: NekodeModelTrajectoryRecord["request"]["messages"],
): number {
  const max = Math.min(left.length, right.length);
  let index = 0;
  while (index < max && JSON.stringify(left[index]) === JSON.stringify(right[index])) {
    index += 1;
  }
  return index;
}

function shouldUseConversationDelta(record: NekodeModelTrajectoryRecord): boolean {
  const kind = record.callSource?.kind;
  return kind === undefined || kind === "main" || kind === "subagent";
}


