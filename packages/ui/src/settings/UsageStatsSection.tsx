import { AppUsagePanel } from "@/settings/usage-stats/AppUsagePanel.js";

/**
 * 使用统计分区只保留本地 App 用量（token 统计/热图）。
 * 账号套餐额度（Coding Plan）已移除。
 */
export function UsageStatsSection() {
  return <AppUsagePanel />;
}
