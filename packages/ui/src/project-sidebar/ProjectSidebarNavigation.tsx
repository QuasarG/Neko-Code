import { Blocks, CalendarClock } from "lucide-react";
import { TID_AUTOMATIONS_OPEN } from "@zcode/shared/test-ids";
import type { ProjectSidebarProps } from "@/project-sidebar/contract.js";
import { Button } from "@/components/ui/button.js";
import { NewTaskButtonGroup } from "@/NewTaskButtonGroup.js";
import { useNekodeIntl } from "@/i18n/IntlProvider.js";
import { WebRemoteControlDeviceHeader } from "@/web-remote-control/WebRemoteControlDeviceHeader.js";

/** 顶部导航只展示 Shell 的选中状态，路由仍由 Shell 唯一持有。 */
export function ProjectSidebarNavigation({
  props,
  onCreate,
}: {
  props: Pick<
    ProjectSidebarProps,
    | "isWebRemoteControl"
    | "onOpenWorkflows"
    | "workflowsActive"
    | "onOpenPluginStore"
    | "pluginStoreActive"
    | "webRemoteControlWorkspaceSwitcher"
  >;
  onCreate(): void;
}) {
  const { intl } = useNekodeIntl();
  const deviceNavigation = props.webRemoteControlWorkspaceSwitcher?.deviceNavigation;
  return (
    <div
      data-testid="sidebar-primary-navigation"
      className={`flex flex-col gap-1 px-2 py-3 ${props.isWebRemoteControl && !deviceNavigation ? "max-md:pt-11" : ""}`}
    >
      {/* Relay V2 远控：当前电脑是项目与任务的上一级，放在导航首行；手机端占用原顶部留白。 */}
      {deviceNavigation ? <WebRemoteControlDeviceHeader navigation={deviceNavigation} /> : null}
      <NewTaskButtonGroup onCreateTask={onCreate} />
      {/* 远控主视图会把自动化和插件市场重置为聊天；入口必须一同隐藏，避免点击无效。 */}
      {!props.isWebRemoteControl && props.onOpenWorkflows ? (
        <Button
          variant="ghost"
          size="lg"
          className={`w-full justify-start gap-2 ${props.workflowsActive ? "bg-selected text-foreground" : ""}`}
          aria-pressed={props.workflowsActive ?? false}
          data-testid={TID_AUTOMATIONS_OPEN}
          // 点击事件不能进入业务导航的可选 automationId 参数。
          onClick={() => props.onOpenWorkflows?.()}
        >
          <CalendarClock className="size-4" />
          {intl.formatMessage({ id: "workspace.openWorkflows" })}
        </Button>
      ) : null}
      {!props.isWebRemoteControl ? (
        <Button
          variant="ghost"
          size="lg"
          className={`w-full justify-start gap-2 ${props.pluginStoreActive ? "bg-selected text-foreground" : ""}`}
          aria-pressed={props.pluginStoreActive ?? false}
          data-testid="plugin-store-sidebar-open"
          onClick={() => props.onOpenPluginStore?.()}
        >
          <Blocks className="size-4" />
          {intl.formatMessage({ id: "workspace.openPluginsSettings" })}
        </Button>
      ) : null}
    </div>
  );
}
