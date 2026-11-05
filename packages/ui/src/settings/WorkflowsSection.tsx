import { useNekodeIntl } from "@/i18n/IntlProvider.js";
import {
  SavedWorkflowsSection,
  type SavedWorkflowsOpenTarget,
} from "@/settings/saved-workflows/SavedWorkflowsSection.js";
import type {
  SavedWorkflowProjectTarget,
  SavedWorkflowsOpenArtifactParams,
  SavedWorkflowsOpenRunParams,
} from "@/settings/saved-workflows/savedWorkflowContract.js";
import type { SavedWorkflowLaunchTarget } from "@/settings/saved-workflows/useSavedWorkflowLauncher.js";

interface WorkflowsSectionProps {
  workspacePath?: string | null;
  workspaceIdentity?: string;
  /** 「通过对话创建」/「在对话里修订」：只预填草稿，不发送。 */
  onCreateViaChat?: (prompt: string, target: SavedWorkflowProjectTarget) => void;
  /** 「运行」= GUI 直接启动：accepted 后切到新会话。 */
  onNavigateToLaunchedRun?: (target: SavedWorkflowLaunchTarget, sessionId: string) => void;
  /** 运行历史「查看实例」：切到发起它的会话并打开实例详情页。 */
  onOpenWorkflowRun?: (params: SavedWorkflowsOpenRunParams) => void;
  /** 产物 chip → `workflow-artifact` tab。 */
  onOpenWorkflowArtifact?: (params: SavedWorkflowsOpenArtifactParams) => void;
  /** 深链直接落到详情页；定位后由调用方清空。 */
  openWorkflow?: SavedWorkflowsOpenTarget | null;
  onOpenWorkflowConsumed?: () => void;
}

/** 工作区「工作流」主视图：页头 + 已保存工作流中枢。 */
export function WorkflowsSection({
  workspacePath,
  workspaceIdentity,
  onCreateViaChat,
  onNavigateToLaunchedRun,
  onOpenWorkflowRun,
  onOpenWorkflowArtifact,
  openWorkflow,
  onOpenWorkflowConsumed,
}: WorkflowsSectionProps) {
  const { intl } = useNekodeIntl();
  const header = (
    <div className="flex flex-col gap-3">
      <h1 className="text-[30px] font-medium leading-[34px] tracking-[0.114px] text-foreground">
        {intl.formatMessage({ id: "workflows.hub.title" })}
      </h1>
      <p className="text-ui-base leading-5 text-foreground-subtlest">
        {intl.formatMessage({ id: "workflows.hub.description" })}
      </p>
    </div>
  );

  return (
    <SavedWorkflowsSection
      header={header}
      workspacePath={workspacePath}
      workspaceIdentity={workspaceIdentity}
      onCreateViaChat={onCreateViaChat}
      onNavigateToLaunchedRun={onNavigateToLaunchedRun}
      onOpenWorkflowRun={onOpenWorkflowRun}
      onOpenWorkflowArtifact={onOpenWorkflowArtifact}
      openWorkflow={openWorkflow}
      onOpenWorkflowConsumed={onOpenWorkflowConsumed}
    />
  );
}
