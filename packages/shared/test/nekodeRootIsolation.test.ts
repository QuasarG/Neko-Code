import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  guardNekodeRoot,
  isOfficialZcodeDataPath,
  resolveNekodeCliRoot,
  resolveNekodeDataBaseRoot,
  resolveNekodeRoot,
} from "../src/node.js";

const home = resolve("/tmp/nekode-root-isolation-home");
const env = { HOME: home } as NodeJS.ProcessEnv;

describe("Nekode data root isolation", () => {
  it("defaults the CLI root to ~/.nekode", () => {
    expect(resolveNekodeCliRoot(env)).toBe(join(home, ".nekode"));
  });

  it("honors NEKODE_HOME first", () => {
    expect(
      resolveNekodeCliRoot({
        ...env,
        NEKODE_HOME: join(home, "custom-home"),
        NEKODE_STORAGE_DIR: join(home, "custom-storage"),
      }),
    ).toBe(join(home, "custom-home"));
  });

  it("honors NEKODE_STORAGE_DIR and NEKODE_ROOT as legacy roots", () => {
    expect(resolveNekodeCliRoot({ ...env, NEKODE_STORAGE_DIR: join(home, "beta") })).toBe(
      join(home, "beta"),
    );
    expect(resolveNekodeCliRoot({ ...env, NEKODE_ROOT: join(home, "legacy") })).toBe(
      join(home, "legacy"),
    );
  });

  it("rejects any candidate inside the official ~/.zcode root", () => {
    for (const key of ["NEKODE_HOME", "NEKODE_STORAGE_DIR", "NEKODE_ROOT"] as const) {
      const resolved = resolveNekodeCliRoot({
        ...env,
        [key]: join(home, ".zcode", "nekode-data"),
      });
      expect(resolved).toBe(join(home, ".nekode"));
    }
  });

  it("expands ~ before guarding the official root", () => {
    expect(resolveNekodeCliRoot({ ...env, NEKODE_HOME: "~/.zcode" })).toBe(join(home, ".nekode"));
    expect(resolveNekodeCliRoot({ ...env, NEKODE_HOME: "~/custom" })).toBe(join(home, "custom"));
  });

  it("guards App dataBaseDir roots against ~/.zcode", () => {
    expect(resolveNekodeDataBaseRoot(home, env)).toBe(join(home, ".nekode"));
    expect(resolveNekodeDataBaseRoot(join(home, "custom-base"), env)).toBe(
      join(home, "custom-base", ".nekode"),
    );
    expect(resolveNekodeDataBaseRoot(join(home, ".zcode"), env)).toBe(join(home, ".nekode"));
  });

  it("distinguishes ~/.zcode from similarly named siblings", () => {
    expect(isOfficialZcodeDataPath(join(home, ".zcode"), env)).toBe(true);
    expect(isOfficialZcodeDataPath(join(home, ".zcode", "memory"), env)).toBe(true);
    expect(isOfficialZcodeDataPath(join(home, ".zcode-backup"), env)).toBe(false);
    expect(isOfficialZcodeDataPath(join(home, ".nekode"), env)).toBe(false);
  });

  it("falls back to ~/.nekode for an unsafe fallback dir", () => {
    expect(
      resolveNekodeRoot({
        env,
        fallbackDir: join(home, ".zcode", "nekode-data"),
      }),
    ).toBe(join(home, ".nekode"));
  });

  it("guards a single candidate path", () => {
    expect(guardNekodeRoot(join(home, ".zcode", "memory"), env)).toBe(join(home, ".nekode"));
    expect(guardNekodeRoot(join(home, ".nekode", "memory"), env)).toBe(
      join(home, ".nekode", "memory"),
    );
  });
});
