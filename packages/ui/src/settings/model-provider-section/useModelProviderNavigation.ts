import { useEffect, useMemo } from "react";
import type { ProviderSettingsFormProvider } from "@/lib/providerSettingsFormTypes.js";
import {
  sortModelProvidersForDisplay,
  type ProviderOrderView,
} from "@/lib/modelProviderOrdering.js";
import { useNekodeIntl } from "@/i18n/IntlProvider.js";
import type { ModelProviderNavGroup, ModelProviderNavItem } from "./constants.js";
import { createCustomProviderNodeKey } from "./utils.js";

/**
 * 模型供应商导航只保留 API Key 配置的 provider。
 * Coding Plan / Start Plan / Team Plan 等账号套餐入口已移除。
 */
interface UseModelProviderNavigationOptions {
  modelProviders: ProviderSettingsFormProvider[];
  modelProvidersLoading?: boolean;
  displayOrder?: ProviderOrderView;
  selectedNodeKey: string | null;
  setSelectedNodeKey: (key: string | null) => void;
  intl: ReturnType<typeof useNekodeIntl>["intl"];
}

export function useModelProviderNavigation({
  modelProviders,
  displayOrder,
  selectedNodeKey,
  setSelectedNodeKey,
  intl,
}: UseModelProviderNavigationOptions) {
  const customProviders = useMemo(() => {
    const allCustomProviders = modelProviders.filter(
      (provider) => provider.config.group === "standard-personal",
    );
    // 这里复用模型菜单的展示排序，确保设置页和聊天框供应商顺序一致。
    return sortModelProvidersForDisplay(allCustomProviders, displayOrder);
  }, [displayOrder, modelProviders]);

  const navigationGroups = useMemo<ModelProviderNavGroup[]>(
    () => [
      {
        id: "custom",
        title: intl.formatMessage({ id: "settings.modelProvider.customTitle" }),
        items: customProviders.map(
          (provider): ModelProviderNavItem => ({
            key: createCustomProviderNodeKey(provider.providerId),
            type: "custom",
            label: provider.providerName?.trim() || provider.providerId,
            provider,
            statusActive: provider.executable === true,
          }),
        ),
      },
    ],
    [customProviders, intl],
  );

  const navigationItems = useMemo(
    () => navigationGroups.flatMap((group) => group.items),
    [navigationGroups],
  );

  useEffect(() => {
    if (navigationItems.length === 0) {
      if (selectedNodeKey !== null) setSelectedNodeKey(null);
      return;
    }
    if (!navigationItems.some((item) => item.key === selectedNodeKey)) {
      setSelectedNodeKey(navigationItems[0]!.key);
    }
  }, [navigationItems, selectedNodeKey, setSelectedNodeKey]);

  const selectedNavItem =
    navigationItems.find((item) => item.key === selectedNodeKey) ?? navigationItems[0] ?? null;

  return {
    navigationGroups,
    navigationItems,
    selectedNavItem,
    navigationUnavailable: false,
  };
}
