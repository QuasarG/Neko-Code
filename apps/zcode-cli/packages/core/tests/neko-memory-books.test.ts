import { describe, expect, it } from "vitest";

import {
  findNekoMemoryBookByPath,
  globalNekoMemoryBook,
  nekoMemoryBookHeader,
  nekoMemoryBooksFor,
  NEKO_MEMORY_GLOBAL_BOOK_KINDS,
  NEKO_MEMORY_PROJECT_BOOK_KINDS,
  projectNekoMemoryBook,
} from "../src/neko-memory/books.js";
import { nekoProjectIdentityForKey } from "../src/neko-memory/identity.js";

const ROOT = "/tmp/neko-memory-root";

describe("neko memory books", () => {
  it("global books cover exactly the four kinds with budgets", () => {
    expect([...NEKO_MEMORY_GLOBAL_BOOK_KINDS]).toEqual([
      "profile",
      "plans",
      "experiences",
      "playbook",
    ]);
    const profile = globalNekoMemoryBook(ROOT, "profile");
    expect(profile.path).toBe(`${ROOT}/global/profile.md`);
    expect(profile.relativePath).toBe("global/profile.md");
    expect(profile.budgetBytes).toBe(3 * 1024);
    expect(profile.label).toBe("档案");
    expect(globalNekoMemoryBook(ROOT, "playbook").budgetBytes).toBe(5 * 1024);
  });

  it("project books only allow playbook and experiences", () => {
    const project = nekoProjectIdentityForKey("/work/repo");
    expect(() => projectNekoMemoryBook(ROOT, project, "profile")).toThrow(/not allowed/);
    const playbook = projectNekoMemoryBook(ROOT, project, "playbook");
    expect(playbook.path).toBe(`${ROOT}/projects/${project.folder}/playbook.md`);
    expect(playbook.budgetBytes).toBe(3 * 1024);
    expect(projectNekoMemoryBook(ROOT, project, "experiences").budgetBytes).toBe(1024);
    expect([...NEKO_MEMORY_PROJECT_BOOK_KINDS]).toEqual(["playbook", "experiences"]);
  });

  it("four books without a project, six with one", () => {
    expect(nekoMemoryBooksFor(ROOT, undefined)).toHaveLength(4);
    expect(nekoMemoryBooksFor(ROOT, nekoProjectIdentityForKey("/work/repo"))).toHaveLength(6);
  });

  it("header carries the book label as the Edit anchor", () => {
    expect(nekoMemoryBookHeader(globalNekoMemoryBook(ROOT, "plans"))).toBe("# 约定\n");
  });

  it("findNekoMemoryBookByPath resolves global, project and rejects the rest", () => {
    const project = nekoProjectIdentityForKey("/work/repo");
    const globalBook = findNekoMemoryBookByPath(ROOT, `${ROOT}/global/playbook.md`);
    expect(globalBook?.scope).toBe("global");
    expect(globalBook?.kind).toBe("playbook");
    const projectBook = findNekoMemoryBookByPath(
      ROOT,
      `${ROOT}/projects/${project.folder}/experiences.md`,
    );
    expect(projectBook?.scope).toBe("project");
    expect(projectBook?.kind).toBe("experiences");
    // 项目册没有档案/约定；根外路径不属于记忆。
    expect(findNekoMemoryBookByPath(ROOT, `${ROOT}/projects/${project.folder}/profile.md`)).toBeUndefined();
    expect(findNekoMemoryBookByPath(ROOT, `${ROOT}/global/other.md`)).toBeUndefined();
    expect(findNekoMemoryBookByPath(ROOT, "/tmp/elsewhere/global/profile.md")).toBeUndefined();
  });

  it("project identity is stable across separators and trailing slashes", () => {
    const left = nekoProjectIdentityForKey("/work/repo/");
    const right = nekoProjectIdentityForKey("/work/repo");
    expect(left.projectId).toBe(right.projectId);
    expect(left.folder).toBe(right.folder);
    // 远端 identity 字符串同样可派生身份。
    const remote = nekoProjectIdentityForKey("remote:box:/srv/app");
    expect(remote.projectId).toHaveLength(64);
    expect(remote.folder.endsWith(`--${remote.projectId.slice(0, 16)}`)).toBe(true);
  });
});
