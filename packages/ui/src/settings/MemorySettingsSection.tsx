import type { INekoMemoryService } from "@zcode/services";
import { useNekodeIntl } from "@/i18n/IntlProvider.js";
import { NekoMemorySettingsView } from "@/settings/NekoMemorySettingsView.js";
import { SettingsGroupCard } from "@/settings/SettingsPageParts.js";

export function MemorySettingsSection({
  nekoMemoryService,
  workspacePath,
  workspaceIdentity,
  nekoMemoryViewerAvailable,
}: {
  nekoMemoryService?: INekoMemoryService;
  workspacePath?: string | null;
  workspaceIdentity?: string | null;
  nekoMemoryViewerAvailable: boolean;
}) {
  const { intl } = useNekodeIntl();

  if (!nekoMemoryViewerAvailable) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-transparent px-4 py-8 text-center text-ui-base text-foreground-subtle">
        {intl.formatMessage({ id: "settings.memory.viewer.localOnly" })}
      </div>
    );
  }

  return (
    <SettingsGroupCard>
      <div className="px-4 py-4">
        <NekoMemorySettingsView
          service={nekoMemoryService}
          workspacePath={workspacePath ?? null}
          workspaceIdentity={workspaceIdentity}
        />
      </div>
    </SettingsGroupCard>
  );
}
