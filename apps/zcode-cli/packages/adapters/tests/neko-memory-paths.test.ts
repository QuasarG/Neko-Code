import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { resolveNekoMemoryRoot } from "../src/neko-memory/paths.js";

const home = resolve("/tmp/nekode-memory-paths-home");
const env = { HOME: home } as NodeJS.ProcessEnv;

describe("resolveNekoMemoryRoot", () => {
  it("defaults to ~/.nekode/memory", () => {
    expect(resolveNekoMemoryRoot(env)).toBe(join(home, ".nekode", "memory"));
  });

  it("follows the unified CLI root aliases", () => {
    expect(resolveNekoMemoryRoot({ ...env, NEKODE_HOME: join(home, "home") })).toBe(
      join(home, "home", "memory"),
    );
    expect(resolveNekoMemoryRoot({ ...env, NEKODE_STORAGE_DIR: join(home, "beta") })).toBe(
      join(home, "beta", "memory"),
    );
    expect(resolveNekoMemoryRoot({ ...env, NEKODE_ROOT: join(home, "legacy") })).toBe(
      join(home, "legacy", "memory"),
    );
  });

  it("falls back to ~/.nekode/memory for official ZCode roots", () => {
    expect(
      resolveNekoMemoryRoot({ ...env, NEKODE_ROOT: join(home, ".zcode", "memory") }),
    ).toBe(join(home, ".nekode", "memory"));
  });
});
