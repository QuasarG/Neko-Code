import type { ReactNode } from "react";
import { resolveModelProviderNavLogo } from "@/settings/model-provider-section/utils.js";
import { ProviderLogo } from "./ProviderLogo.js";
import type { ModelProviderNavItem } from "./constants.js";

export function ProviderFamilyDetailShell({
  header,
  children,
}: {
  header: ReactNode;
  children: ReactNode;
}) {
  if (!header) {
    return children;
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {header}
      {children}
    </div>
  );
}

export function ProviderFamilyHeader({
  selectedNavItem,
  trailingAction,
}: {
  selectedNavItem: ModelProviderNavItem | null;
  trailingAction?: ReactNode;
}) {
  if (!selectedNavItem) {
    return null;
  }

  return (
    <div className="flex h-8 min-w-0 flex-wrap items-center justify-between gap-2">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <ProviderLogo logo={resolveModelProviderNavLogo(selectedNavItem)} className="size-5" />
        <h3 className="truncate text-ui-lg font-medium text-foreground">{selectedNavItem.label}</h3>
      </div>
      {trailingAction ? (
        <div className="min-w-0 max-w-full flex-1 basis-64">{trailingAction}</div>
      ) : null}
    </div>
  );
}
