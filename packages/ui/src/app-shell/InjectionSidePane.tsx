import { MessageResponse } from "@/components/ai-elements/message.js";
import type { InjectionSidePaneTab } from "@/lib/workspaceSidePane.js";

/** 系统右侧栏里的注入详情页：按 Markdown 渲染这一轮实际投递的隐藏上下文。 */
export function InjectionSidePane({ tab }: { tab: InjectionSidePaneTab }) {
  return (
    <div className="h-full min-h-0 overflow-y-auto bg-background px-4 py-4">
      <MessageResponse className="mx-auto w-full max-w-4xl min-w-0 break-words text-foreground">
        {tab.text}
      </MessageResponse>
    </div>
  );
}
