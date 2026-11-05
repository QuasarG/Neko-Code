import {
  DEFAULT_FEEDBACK_TICKET_FRAMEWORK,
  type NekodeProvider,
  type FeedbackTicketFramework,
} from "@zcode/shared";

export function inferFeedbackFrameworkFromAgentProvider(
  _provider: NekodeProvider | null | undefined,
): FeedbackTicketFramework {
  return DEFAULT_FEEDBACK_TICKET_FRAMEWORK;
}
