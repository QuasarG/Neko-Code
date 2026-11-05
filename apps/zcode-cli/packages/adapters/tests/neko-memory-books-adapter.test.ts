import { realpathSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  NekoMemoryBooksAdapter,
  NekoMemorySnapshotStore,
  resolveNekoProjectIdentityForKey,
} from "../src/neko-memory/index.js";

const roots: Array<{ dir: string; store: NekoMemorySnapshotStore }> = [];

async function freshAdapter(): Promise<NekoMemoryBooksAdapter> {
  const dir = await mkdtemp(join(tmpdir(), "neko-books-adapter-"));
  const store = new NekoMemorySnapshotStore(":memory:");
  roots.push({ dir, store });
  return new NekoMemoryBooksAdapter(dir, store);
}

afterEach(async () => {
  while (roots.length) {
    const { dir, store } = roots.pop() as (typeof roots)[number];
    store.close();
    await rm(dir, { recursive: true, force: true });
  }
});

describe("NekoMemoryBooksAdapter.books", () => {
  it("home workspace only gets the four global books", async () => {
    const adapter = await freshAdapter();
    const books = adapter.books({ workspacePath: homedir() });
    expect(books.map((book) => book.relativePath).sort()).toEqual([
      "global/experiences.md",
      "global/plans.md",
      "global/playbook.md",
      "global/profile.md",
    ]);
  });

  it("project workspace gets global four plus project two", async () => {
    const adapter = await freshAdapter();
    const workspace = await mkdtemp(join(tmpdir(), "neko-project-ws-"));
    roots.push({ dir: workspace, store: new NekoMemorySnapshotStore(":memory:") });
    const books = adapter.books({ workspacePath: workspace });
    const projectBooks = books.filter((book) => book.scope === "project");
    expect(projectBooks.map((book) => book.kind).sort()).toEqual(["experiences", "playbook"]);
    expect(projectBooks[0].relativePath).toMatch(/^projects\/.+--[0-9a-f]{16}\/playbook\.md$/u);
  });

  it("remote identity strings also get project books", async () => {
    const adapter = await freshAdapter();
    const books = adapter.books({ workspaceIdentity: "remote:session/abc" });
    expect(books).toHaveLength(6);
    const identity = resolveNekoProjectIdentityForKey("remote:session/abc");
    expect(books[4].relativePath).toBe(`projects/${identity.folder}/playbook.md`);
  });

  it("non-empty workspaceIdentity wins over workspacePath", async () => {
    const adapter = await freshAdapter();
    // workspacePath 指向 home；identity 命中远端项目，应得到 6 本而非 4 本。
    const books = adapter.books({ workspacePath: homedir(), workspaceIdentity: "remote-ws" });
    expect(books).toHaveLength(6);
  });

  it("blank workspaceIdentity falls back to workspacePath", async () => {
    const adapter = await freshAdapter();
    const books = adapter.books({ workspacePath: homedir(), workspaceIdentity: "   " });
    expect(books).toHaveLength(4);
  });

  it("missing books are created with a header line exactly once", async () => {
    const adapter = await freshAdapter();
    const books = adapter.books({ workspacePath: homedir() });
    const profile = books.find((book) => book.relativePath === "global/profile.md");
    if (!profile) throw new Error("profile book missing");
    expect(await readFile(profile.path, "utf8")).toBe("# 档案\n");

    // 手改后再次枚举：ensure 不能把正文覆盖回标题行（同实例走缓存，新实例走 stat）。
    await writeFile(profile.path, "# 档案\n\n- 手写条目\n", "utf8");
    adapter.books({ workspacePath: homedir() });
    expect(await readFile(profile.path, "utf8")).toBe("# 档案\n\n- 手写条目\n");
  });

  it("a fresh adapter does not rewrite existing book files", async () => {
    const adapter = await freshAdapter();
    const books = adapter.books({ workspacePath: homedir() });
    const plans = books.find((book) => book.relativePath === "global/plans.md");
    if (!plans) throw new Error("plans book missing");
    await writeFile(plans.path, "# 约定\n\n- [x] 2026-01-01 done\n", "utf8");
    const second = new NekoMemoryBooksAdapter(
      adapter.memoryRoot,
      new NekoMemorySnapshotStore(":memory:"),
    );
    second.books({ workspacePath: homedir() });
    expect(await readFile(plans.path, "utf8")).toBe("# 约定\n\n- [x] 2026-01-01 done\n");
  });
});

describe("NekoMemoryBooksAdapter.bookForPath", () => {
  it("recognizes global, project and rejects non-book paths", async () => {
    const adapter = await freshAdapter();
    const workspace = await mkdtemp(join(tmpdir(), "neko-project-ws-"));
    roots.push({ dir: workspace, store: new NekoMemorySnapshotStore(":memory:") });
    const books = adapter.books({ workspacePath: workspace });
    const global = adapter.bookForPath(join(adapter.memoryRoot, "global", "profile.md"));
    expect(global?.relativePath).toBe("global/profile.md");
    const projectBook = books.find((book) => book.scope === "project");
    if (!projectBook) throw new Error("project book missing");
    expect(adapter.bookForPath(projectBook.path)?.relativePath).toBe(projectBook.relativePath);
    // 不存在的 kind、记忆目录外的路径都不属于记忆书。
    expect(adapter.bookForPath(join(adapter.memoryRoot, "global", "unknown.md"))).toBeUndefined();
    expect(adapter.bookForPath(join(adapter.memoryRoot, "plans.md"))).toBeUndefined();
    expect(adapter.bookForPath(join(workspace, "profile.md"))).toBeUndefined();
  });
});

describe("NekoMemoryBooksAdapter.readBook", () => {
  it("returns undefined for missing files and content otherwise", async () => {
    const adapter = await freshAdapter();
    const books = adapter.books({ workspacePath: homedir() });
    const experiences = books.find((book) => book.relativePath === "global/experiences.md");
    if (!experiences) throw new Error("experiences book missing");
    expect(adapter.readBook(experiences.path)).toBe("# 经历\n");
    expect(adapter.readBook(join(adapter.memoryRoot, "global", "missing.md"))).toBeUndefined();
  });
});

describe("resolveNekoProjectIdentityForKey", () => {
  it("keeps remote identity untouched and the original key", () => {
    const identity = resolveNekoProjectIdentityForKey("remote-ws/01");
    expect(identity.canonical).toBe("remote-ws/01");
    expect(identity.original).toBe("remote-ws/01");
    expect(identity.folder).toMatch(/--[0-9a-f]{16}$/u);
  });

  it("realpaths absolute keys and reports the caller key as original", async () => {
    const real = await mkdtemp(join(tmpdir(), "neko-identity-"));
    roots.push({ dir: real, store: new NekoMemorySnapshotStore(":memory:") });
    // 带 .. 与尾斜杠的输入也应归一化到目录的真实路径。
    const rawKey = `${real}/./`;
    const identity = resolveNekoProjectIdentityForKey(rawKey);
    expect(identity.canonical).toBe(realpathSync(real));
    expect(identity.original).toBe(rawKey);
  });
});
