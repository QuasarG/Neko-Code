import { useCallback, useEffect, useState } from "react";
import type { ProviderSettingsFormProvider } from "@/lib/providerSettingsFormTypes.js";
import { isApiKeyAccess } from "@zcode/provider";
import type { ModelConnectivityResult } from "@zcode/shared";
import { useNekodeIntl } from "@/i18n/IntlProvider.js";
import { Button } from "@/components/ui/button.js";
import { useConfirmDialog } from "@/hooks/useConfirmDialog.js";
import { useModelProviders } from "@/hooks/useModelProviders.js";
import { logger } from "@/logger.js";
import { sortModelProvidersForDisplay } from "@/lib/modelProviderOrdering.js";
import {
  addPendingSettingsSectionListener,
  type SettingsModelProviderTarget,
} from "@/lib/settingsNavigation.js";
import { ModelProviderSectionDetail } from "./model-provider-section/Detail.js";
import { ModelProviderSectionLayout } from "./model-provider-section/SectionLayout.js";
import { ProviderTemplatePicker } from "./model-provider-section/ProviderTemplatePicker.js";
import { useModelProviderNavigation } from "./model-provider-section/useModelProviderNavigation.js";
import { createCustomProviderNodeKey } from "./model-provider-section/utils.js";
import { confirmAndDeleteModelProvider } from "./model-provider-section/modelProviderActions.js";

export {
  fuzzyMatch,
  handleEndpointSuggestionPopoverOpenAutoFocus,
  resolveEndpointSuggestionOpenRequest,
} from "./model-provider-section/utils.js";

/**
 * 模型供应商设置只负责 API Key provider 的新增、编辑与删除。
 * 账号登录、Coding Plan / Start Plan / Team Plan 套餐入口已移除。
 */
export function ModelProviderSection({
  workspacePath = "",
  connectivityWorkspacePath,
  connectivityWorkspaceRequired = false,
  pendingModelProviderTarget,
  onConsumePendingModelProviderTarget,
}: {
  workspacePath?: string;
  connectivityWorkspacePath?: string;
  connectivityWorkspaceRequired?: boolean;
  pendingModelProviderTarget?: SettingsModelProviderTarget;
  onConsumePendingModelProviderTarget?: () => void;
} = {}) {
  const { intl, locale } = useNekodeIntl();
  const confirmDialog = useConfirmDialog();
  const {
    modelProviders,
    providerTemplates,
    displayOrder,
    loading,
    loadError,
    reload,
    refresh,
    refreshing,
    saveProvider,
    createPersonalProvider,
    addPersonalModel,
    savePersonalModelDraft,
    setPersonalModelEnabled,
    deletePersonalModel,
    deleteProvider,
    reorderProviderModels,
    saveDisplayOrder,
    reorderableProviderIds,
    testModelConnectivity,
  } = useModelProviders({
    workspacePath,
    connectivityWorkspacePath,
    connectivityWorkspaceRequired,
    connectivityUnavailableMessage: intl.formatMessage({
      id: "settings.modelProvider.testModel.localWorkspaceUnavailable",
    }),
  });

  const [selectedNodeKey, setSelectedNodeKey] = useState<string | null>(null);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [creatingProvider, setCreatingProvider] = useState(false);
  const [pendingCreatedProviderId, setPendingCreatedProviderId] = useState<string | null>(null);

  const { navigationGroups, navigationItems, selectedNavItem } = useModelProviderNavigation({
    modelProviders,
    displayOrder,
    selectedNodeKey,
    setSelectedNodeKey,
    intl,
  });

  useEffect(() => {
    if (
      !pendingCreatedProviderId ||
      !modelProviders.some((provider) => provider.providerId === pendingCreatedProviderId)
    ) {
      return;
    }
    // saveProvider 会先发布共享快照，再异步落盘；React 在高负载下可能先提交
    // selectedNodeKey、后提交 provider 列表。导航校正会把暂时不存在的 custom key 回退，
    // 新 provider 随后出现也不会再自动选中。只在列表事实可见后完成选中与草稿清理。
    setSelectedNodeKey(createCustomProviderNodeKey(pendingCreatedProviderId));
    setPendingCreatedProviderId(null);
  }, [modelProviders, pendingCreatedProviderId]);

  useEffect(() => {
    const providerId = pendingModelProviderTarget?.providerId?.trim();
    if (!providerId) {
      return;
    }
    const provider = modelProviders.find((item) => item.providerId === providerId);
    if (!provider) {
      logger.warn("[ModelProviderSection] 无法打开目标供应商", { providerId });
      onConsumePendingModelProviderTarget?.();
      return;
    }
    setTemplatePickerOpen(false);
    setSelectedNodeKey(createCustomProviderNodeKey(providerId));
    onConsumePendingModelProviderTarget?.();
  }, [modelProviders, onConsumePendingModelProviderTarget, pendingModelProviderTarget]);

  useEffect(
    () =>
      addPendingSettingsSectionListener((section, detail) => {
        if (section !== "modelProvider" || !detail?.modelProviderId) {
          return;
        }
        const providerId = detail.modelProviderId.trim();
        if (!providerId) {
          return;
        }
        setTemplatePickerOpen(false);
        setSelectedNodeKey(createCustomProviderNodeKey(providerId));
      }),
    [],
  );

  const handleCreateProvider = useCallback(
    async (input: { templateId?: string; providerName?: string }) => {
      setCreatingProvider(true);
      try {
        const created = await createPersonalProvider({ ...input, locale });
        setPendingCreatedProviderId(created.providerId);
        setSelectedNodeKey(createCustomProviderNodeKey(created.providerId));
        setTemplatePickerOpen(false);
      } catch (error) {
        setPendingCreatedProviderId(null);
        throw error;
      } finally {
        setCreatingProvider(false);
      }
    },
    [createPersonalProvider, locale],
  );

  const handleSave = useCallback(
    async (config: ProviderSettingsFormProvider) => {
      try {
        await saveProvider(config);
      } catch (error) {
        logger.error("[ModelProviderSection] 保存模型供应商失败", error);
        throw error;
      }
    },
    [saveProvider],
  );

  const handleDelete = useCallback(
    async (provider: ProviderSettingsFormProvider) => {
      await confirmAndDeleteModelProvider({
        provider,
        confirmDialog,
        intl,
        deleteProvider,
      });
    },
    [confirmDialog, deleteProvider, intl],
  );

  const handleReorderProviderIds = useCallback(
    async (orderedGroupProviderIds: string[]) => {
      const groupProviderIdSet = new Set(orderedGroupProviderIds);
      const currentProviderIds = sortModelProvidersForDisplay(modelProviders, displayOrder).map(
        (provider) => provider.providerId,
      );
      const insertionIndex = currentProviderIds.findIndex((providerId) =>
        groupProviderIdSet.has(providerId),
      );
      if (insertionIndex < 0) {
        return;
      }
      const nextProviderIds = currentProviderIds.filter(
        (providerId) => !groupProviderIdSet.has(providerId),
      );
      nextProviderIds.splice(insertionIndex, 0, ...orderedGroupProviderIds);
      await saveDisplayOrder({
        providerIds: nextProviderIds,
      });
    },
    [displayOrder, modelProviders, saveDisplayOrder],
  );

  const handleTestModel = useCallback(
    async (providerId: string, modelId: string): Promise<ModelConnectivityResult> => {
      return testModelConnectivity(providerId, modelId);
    },
    [testModelConnectivity],
  );

  const loadingLabel = intl.formatMessage({ id: "common.loading" });
  const presetLoading = loading || refreshing;
  const customLoading = loading || refreshing;

  if (loadError) {
    return (
      <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-ui-base">
        <p className="text-destructive">{loadError.message}</p>
        <Button type="button" variant="outline" onClick={reload}>
          {intl.formatMessage({ id: "common.retry" })}
        </Button>
      </div>
    );
  }

  const emptyState =
    !loading && !refreshing && navigationItems.length === 0 && !templatePickerOpen ? (
      <p className="mb-3 text-ui-base text-foreground-subtle">
        {intl.formatMessage({ id: "settings.modelProvider.empty" })}
      </p>
    ) : null;

  return (
    <ModelProviderSectionLayout
      description={intl.formatMessage({ id: "settings.modelProviderDescription" })}
      refreshLabel={intl.formatMessage({ id: "settings.modelProvider.refresh" })}
      loadingLabel={loadingLabel}
      presetLoading={presetLoading}
      customLoading={customLoading}
      onRefresh={() => {
        void refresh();
      }}
      addProviderLabel={intl.formatMessage({ id: "settings.modelProvider.addProviderAction" })}
      onAddProvider={() => setTemplatePickerOpen(true)}
      navigationGroups={navigationGroups}
      selectedNodeKey={selectedNodeKey}
      onSelectNavItem={(item) => setSelectedNodeKey(item.key)}
      onReorderProviderIds={handleReorderProviderIds}
      reorderableProviderIds={reorderableProviderIds}
    >
      {emptyState}
      {templatePickerOpen ? (
        <ProviderTemplatePicker
          templates={providerTemplates.filter((template) =>
            isApiKeyAccess(template.config.access),
          )}
          creating={creatingProvider}
          onBack={() => setTemplatePickerOpen(false)}
          onCreateFromTemplate={(templateId) => handleCreateProvider({ templateId })}
          onCreateCustom={(label) => handleCreateProvider({ providerName: label })}
        />
      ) : (
        <ModelProviderSectionDetail
          selectedNavItem={selectedNavItem}
          presetLoading={presetLoading}
          onSave={handleSave}
          onAddPersonalModel={addPersonalModel}
          onSavePersonalModelDraft={savePersonalModelDraft}
          onSetPersonalModelEnabled={setPersonalModelEnabled}
          onDeletePersonalModel={deletePersonalModel}
          onDelete={handleDelete}
          onReorderProviderModels={reorderProviderModels}
          onTestModel={handleTestModel}
        />
      )}
    </ModelProviderSectionLayout>
  );
}
