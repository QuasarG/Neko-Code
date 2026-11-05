/* oxlint-disable eslint(max-lines) -- 模型供应商详情集中编排 API Key 卡片和模型编辑。 */
import { resolveModelProviderFamilySpecByProviderId } from "@zcode/shared";
import type { ProviderSettingsFormProvider } from "@/lib/providerSettingsFormTypes.js";
import type { ModelConnectivityResult } from "@zcode/shared";
import type { SavePersonalModelDraftInput } from "@zcode/provider";
import { useNekodeIntl } from "@/i18n/IntlProvider.js";
import type { ModelProviderNavItem } from "./constants.js";
import { InlineEditableProviderCard } from "./InlineEditableProviderCard.js";
import { ModelProviderLoadingCard, PresetProviderPlaceholderCard } from "./StatusCards.js";
import { ProviderFamilyDetailShell, ProviderFamilyHeader } from "./ProviderFamilyModeHeader.js";

export function ModelProviderSectionDetail({
  selectedNavItem,
  presetLoading,
  onSave,
  onAddPersonalModel,
  onSavePersonalModelDraft,
  onSetPersonalModelEnabled,
  onDeletePersonalModel,
  onDelete,
  onReorderProviderModels,
  onTestModel,
}: {
  selectedNavItem: ModelProviderNavItem | null;
  presetLoading: boolean;
  onSave: (config: ProviderSettingsFormProvider) => void | Promise<void>;
  onAddPersonalModel?: (
    providerId: string,
    modelId: string,
    config: ProviderSettingsFormProvider["models"][number]["personalConfig"],
    useRecommendedConfig?: boolean,
  ) => Promise<unknown>;
  onSavePersonalModelDraft?: (input: SavePersonalModelDraftInput) => Promise<unknown>;
  onSetPersonalModelEnabled?: (
    providerId: string,
    modelId: string,
    enabled: boolean,
  ) => Promise<unknown>;
  onDeletePersonalModel?: (providerId: string, modelId: string) => Promise<unknown>;
  onDelete: (provider: ProviderSettingsFormProvider) => Promise<void>;
  onReorderProviderModels?: (providerId: string, modelIds: string[]) => Promise<void>;
  onTestModel: (providerId: string, modelId: string) => Promise<ModelConnectivityResult>;
}) {
  const { intl } = useNekodeIntl();
  const loadingLabel = intl.formatMessage({ id: "common.loading" });

  if (!selectedNavItem) {
    // 没有任何供应商时列表区已经给出空态；这里再挂一张加载卡会永远转圈。
    return presetLoading ? <ModelProviderLoadingCard loadingLabel={loadingLabel} /> : null;
  }

  if (selectedNavItem.type !== "custom") {
    if (presetLoading) {
      return <ModelProviderLoadingCard loadingLabel={loadingLabel} />;
    }
    return <PresetProviderPlaceholderCard displayName={selectedNavItem.label} />;
  }

  const provider = selectedNavItem.provider;
  const familySpec = resolveModelProviderFamilySpecByProviderId(provider.providerId);
  return (
    <ProviderFamilyDetailShell
      header={
        familySpec ? <ProviderFamilyHeader selectedNavItem={selectedNavItem} /> : undefined
      }
    >
      <InlineEditableProviderCard
        provider={provider}
        onSave={onSave}
        onAddPersonalModel={onAddPersonalModel}
        onSavePersonalModelDraft={onSavePersonalModelDraft}
        onSetPersonalModelEnabled={onSetPersonalModelEnabled}
        onDeletePersonalModel={onDeletePersonalModel}
        onDelete={() => onDelete(provider)}
        onReorderModelIds={
          onReorderProviderModels
            ? (modelIds) => onReorderProviderModels(provider.providerId, modelIds)
            : undefined
        }
        onTestModel={onTestModel}
        readOnlyEndpoints={Boolean(familySpec)}
        nameEditable={!familySpec}
        headerVisible={!familySpec}
      />
    </ProviderFamilyDetailShell>
  );
}
