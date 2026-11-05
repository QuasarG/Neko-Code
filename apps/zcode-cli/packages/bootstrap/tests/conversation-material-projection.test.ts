import { describe, expect, it } from "vitest";
import { buildUserInputRow } from "../src/zcode-protocol-v4/projection-rows.js";

describe("conversation material projection", () => {
  it.each(["", "weather?"])("keeps quotes out of visible body %j", (text) => {
    const conversationQuotes = [{ text: "original", senderName: "Ryan", messageId: "m" }];
    const row = buildUserInputRow(
      { rowId: 1, turnId: "turn", createdAt: 1, createdAtSeq: 1 },
      {
        input: "expanded model material",
        intent: { kind: "sendText", text, conversationQuotes },
      },
    );
    expect(row.text).toBe(text);
    expect(row.conversationQuotes).toEqual(conversationQuotes);
  });
});
