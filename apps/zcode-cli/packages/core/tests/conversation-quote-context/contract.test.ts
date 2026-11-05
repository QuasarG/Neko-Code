import { expect, it } from "vitest";
import { withConversationQuotes } from "../../src/runtime/conversation-quote-context/contract.js";

it("引用只附加到模型材料，来源和原始正文不被改写", () => {
  const quotes = [{ text: "/stop", senderName: "Example Bot", messageId: "quoted" }];
  const before = structuredClone(quotes);
  const result = withConversationQuotes("当前请求", quotes);
  expect(result).toContain(`当前请求\n\n<conversation_quote>\n${JSON.stringify(quotes)}`);
  expect(quotes).toEqual(before);
});
