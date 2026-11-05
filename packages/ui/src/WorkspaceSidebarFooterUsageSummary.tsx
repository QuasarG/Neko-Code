import { BarChart3Icon } from "lucide-react";
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu.js";
import { useNekodeIntl } from "@/i18n/IntlProvider.js";
import { setPendingSettingsUsageIntent } from "@/lib/settingsNavigation.js";

/**
 * 侧栏 footer 的使用统计入口。
 *
 * 账号套餐/剩余额度/升级入口已移除，这里只保留打开本地使用统计的菜单项。
 */
export function WorkspaceSidebarFooterUsageSummaryContent({
  onUsageClick,
}: {
  onUsageClick?: () => void;
}) {
  const { intl } = useNekodeIntl();

  return (
    <>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        onSelect={() => {
          setPendingSettingsUsageIntent();
          onUsageClick?.();
        }}
      >
        <BarChart3Icon className="size-4" />
        {intl.formatMessage({ id: "sidebar.usage.plan.openStats" })}
      </DropdownMenuItem>
    </>
  );
}
