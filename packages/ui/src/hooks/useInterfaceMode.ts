import { useNekodeStoreWithDefault } from "@/store/StoreProvider.js";

export function useIsOfficeMode(): boolean {
  return useNekodeStoreWithDefault((state) => state.interfaceMode === "office", false);
}
