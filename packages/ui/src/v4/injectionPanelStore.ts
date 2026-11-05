import { create } from "zustand";

interface InjectionPanelState {
  open: boolean;
  title: string;
  text: string;
  parentSessionId: string;
  rowId: string;
  show: (payload: {
    title: string;
    text: string;
    parentSessionId: string;
    rowId: string;
  }) => void;
  close: () => void;
}

/** 用户气泡下方的“注入”入口与右侧注入面板共用的一份临时状态。 */
export const useInjectionPanelStore = create<InjectionPanelState>((set) => ({
  open: false,
  title: "",
  text: "",
  parentSessionId: "",
  rowId: "",
  show: ({ title, text, parentSessionId, rowId }) =>
    set({ open: true, title, text, parentSessionId, rowId }),
  close: () => set({ open: false }),
}));
