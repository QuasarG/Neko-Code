import { create } from "zustand";
import type {
  FeedbackTicketModule,
  FeedbackTicketSeverity,
  FeedbackTicketType,
} from "@zcode/shared";

type FeedbackTab = "submit" | "tickets";

export interface FeedbackAttachmentDraft {
  readonly filename: string;
  readonly contentType: string;
  readonly dataBase64: string;
  readonly size: number;
}

export interface FeedbackSubmitDraft {
  readonly title?: string;
  readonly description?: string;
  readonly contact?: string;
  readonly type?: FeedbackTicketType;
  readonly module?: FeedbackTicketModule;
  readonly severity?: FeedbackTicketSeverity;
  readonly screenshots?: readonly FeedbackAttachmentDraft[];
  readonly includeLogs?: boolean;
}

interface FeedbackUiState {
  open: boolean;
  featureRequestOpen: boolean;
  tab: FeedbackTab;
  submitDraft: FeedbackSubmitDraft | null;
  /** 仅查看指定后台提交时设置；新建反馈必须保持为 null */
  submissionJobId: string | null;
  /** 打开"我的反馈"列表时，可选地高亮某条工单 */
  selectedTicketId: string | null;
  /** 打开后立刻聚焦到提交表单 */
  openSubmit: (draft?: FeedbackSubmitDraft) => void;
  /** 打开指定后台提交任务的进度弹窗 */
  openSubmissionJob: (jobId: string) => void;
  /** 打开独立产品需求反馈弹窗 */
  openFeatureRequest: () => void;
  /** 打开后立刻聚焦到工单列表，可选 highlight */
  openTickets: (ticketId?: string) => void;
  /** 切换 Tab，但不关闭 dialog */
  setTab: (tab: FeedbackTab) => void;
  setSelectedTicketId: (ticketId: string | null) => void;
  close: () => void;
}

export const useFeedbackStore = create<FeedbackUiState>((set) => ({
  open: false,
  featureRequestOpen: false,
  tab: "submit",
  submitDraft: null,
  submissionJobId: null,
  selectedTicketId: null,
  // Nekode：反馈通道已砍掉，所有打开入口保持 no-op（签名保留，旧调用点可编译）。
  openSubmit: (_draft) => {},
  openSubmissionJob: (jobId) =>
    set({
      open: true,
      featureRequestOpen: false,
      tab: "submit",
      submitDraft: null,
      submissionJobId: jobId,
      selectedTicketId: null,
    }),
  openFeatureRequest: () => {},
  openTickets: (_ticketId) => {},
  setTab: (tab) =>
    set({
      tab,
      ...(tab === "submit" ? { submissionJobId: null } : {}),
    }),
  setSelectedTicketId: (ticketId) => set({ selectedTicketId: ticketId }),
  close: () =>
    set({
      open: false,
      featureRequestOpen: false,
      submitDraft: null,
      submissionJobId: null,
      selectedTicketId: null,
    }),
}));
