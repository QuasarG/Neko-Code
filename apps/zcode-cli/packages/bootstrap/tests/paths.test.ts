import { describe, expect, it } from "vitest";
import { getModelIoDir } from "../src/app/paths.js";


describe("getModelIoDir", () => {
  it("derives debug and rollout from the configured CLI storage root", () => {
    expect(getModelIoDir("/custom/storage/cli", true)).toBe("/custom/storage/cli/debug");
    expect(getModelIoDir("/custom/storage/cli", false)).toBe("/custom/storage/cli/rollout");
  });
});
