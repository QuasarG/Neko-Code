// ============================================================
// Skills Section Builder（L0/L1/L2 三级加载，分类粒度描述）
// ============================================================
// L0：<available_skills> 里的分类索引——每个分类一行，含该分类全部技能名。
//     名字不是描述文本；索引永远完整，不受预算影响。
// L1：<categories> 分类级统一描述（<分类目录>/category.json），总量受预算约束；
//     单个技能的 description 不进提示词——要细节就用 Skill 工具读 SKILL.md。
// L2：模型用 Skill 工具按名字加载全文；名字全量在 L0，调用不受预算影响。
// （与 neko-pi packages/coding-agent src/core/skills.ts 的分级设计同源，
//   2026-11-04 按 zexin 要求把 L1 从"每技能名片"改为"每分类一句描述"。）

import type { SkillLoadOutcome, SkillMetadata } from "@zcode/contracts";
import type { ContextSection } from "../types.js";
import { estimateTokens } from "../utils.js";

/** 分类描述总预算（字节）。 */
export const SKILL_CATEGORY_BUDGET = 2048;
/** 单条分类描述上限（字符）：超过按字符边界截断。 */
export const SKILL_CATEGORY_DESCRIPTION_MAX = 160;
/** 无 category 的 skill 归入的分组名。 */
export const SKILL_DEFAULT_CATEGORY = "other";

interface SkillsSectionOptions {
  outcome: SkillLoadOutcome;
  /** 分类描述预算覆盖（子代理等场景传更小值）；L0 索引不受影响，永远完整。 */
  metadataBudget?: number;
}

export function buildSkillsSection(options: SkillsSectionOptions): ContextSection | null {
  if (options.outcome.skills.length === 0) {
    return null;
  }

  const content = buildSkillsContent(
    options.outcome,
    options.metadataBudget ?? SKILL_CATEGORY_BUDGET,
  );

  return {
    name: "Skills",
    source: "skills",
    injectionTarget: "system",
    cacheHint: "dynamic",
    chars: content.length,
    tokens: estimateTokens(content),
    content,
    preview: content.slice(0, 100),
  };
}

function buildSkillsContent(outcome: SkillLoadOutcome, categoryBudget: number): string {
  const sorted = [...outcome.skills].sort(
    (a, b) =>
      categoryOf(a).localeCompare(categoryOf(b)) ||
      skillDisplayName(a).localeCompare(skillDisplayName(b)),
  );

  const lines = [
    "The following skills provide specialized instructions for specific tasks.",
    "Skill names are grouped by category below; load one with the Skill tool by name when a task matches its category.",
    "When a skill references a relative path, resolve it against the skill directory (the parent directory of SKILL.md).",
  ];

  // L0：分类索引（组内列出全部技能名）＋ skill 根目录。
  const groups = new Map<string, string[]>();
  for (const skill of sorted) {
    const category = categoryOf(skill);
    const names = groups.get(category) ?? [];
    names.push(skillDisplayName(skill));
    groups.set(category, names);
  }
  const roots = [...new Set(sorted.map((skill) => skill.rootPath))].sort();
  lines.push("", "<available_skills>");
  lines.push(`  <index total="${sorted.length}">`);
  for (const [category, names] of [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    lines.push(
      `    <group name="${escapeXml(category)}" count="${names.length}">${escapeXml(names.join(", "))}</group>`,
    );
  }
  lines.push("  </index>");
  lines.push("  <skill-roots>");
  for (const root of roots) lines.push(`    <root>${escapeXml(root)}</root>`);
  lines.push("  </skill-roots>");

  // L1：分类级统一描述；预算耗尽后只保留分类名（索引里名字仍全量可见）。
  const categories = outcome.categories ?? [];
  if (categories.length > 0) {
    let used = 0;
    lines.push("  <categories>");
    for (const category of categories) {
      const name = category.name.trim();
      if (!name) continue;
      const description = truncateCategoryDescription(category.description ?? "");
      const cost = Buffer.byteLength(description, "utf8");
      if (!description || used + cost > categoryBudget) {
        lines.push(`    <category name="${escapeXml(name)}"/>`);
        continue;
      }
      used += cost;
      lines.push(`    <category name="${escapeXml(name)}">${escapeXml(description)}</category>`);
    }
    lines.push("  </categories>");
  }

  lines.push("</available_skills>");

  return lines.join("\n");
}

function truncateCategoryDescription(description: string): string {
  const flat = description.replace(/\s+/gu, " ").trim();
  if (Array.from(flat).length <= SKILL_CATEGORY_DESCRIPTION_MAX) return flat;
  const chars = Array.from(flat).slice(0, SKILL_CATEGORY_DESCRIPTION_MAX - 1).join("");
  return `${chars}…`;
}

function categoryOf(skill: SkillMetadata): string {
  return skill.category?.trim() || SKILL_DEFAULT_CATEGORY;
}

function skillDisplayName(skill: SkillMetadata): string {
  return skill.qualifiedName ?? skill.name;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
