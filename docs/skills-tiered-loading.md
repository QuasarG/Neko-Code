# Skill 三级加载（L0/L1/L2）与分类目录

与 neko-pi `packages/coding-agent` 的分级设计同源，2026-11-04 落进 Nekode agent 运行时（apps/zcode-cli）与桌面 UI。当日按 zexin 定稿：**进入提示词的描述只到分类粒度，单个技能的 description 不进提示词**。

## 分级

- **L0 分类索引**：`<available_skills><index total="N">` 每个分类一行，**行内携带该分类全部技能名**（名字不是描述文本）；另有 `<skill-roots>` 根目录清单。永远完整，不受预算影响。
- **L1 分类描述**：`<categories>` 每分类一句统一描述，来源是分类目录里的 `category.json`（`{"description": "…"}`）。单条 ≤160 字符、总预算 `SKILL_CATEGORY_BUDGET = 2048` 字节，预算外只留分类名。子代理可经 `skillMetadataBudget` 覆盖。
- **L2 全文**：模型用 Skill 工具按名字加载 SKILL.md；名字全量在 L0，**调用与预算无关**。

## 分类目录布局

```
~/.nekode/skills/
  <分类>/                 # 可为整目录软链（如 -> ~/.agents/skill-vault/machine-fix）
    category.json         # 分类级描述（可选）
    <技能>/SKILL.md
```

- 分类归属推断：frontmatter `category` > 分组目录名 > 插件名（plugin scope）> `other`。
- 扫描深度：用户/项目级根支持一层分组目录（`allowGroupedDirectory`，adapters scan + services 有界遍历）；plugin scope 维持一层、不跟随软链。
- 2026-11-04 迁移基线：83 个技能（vault 五类整目录软链 + 常驻 7 件分类软链 + Neko 专属 2 件复制），办公四件不迁（内置官方插件已覆盖）。

## 实现

- 契约：`contracts/src/skills/index.ts`（`SkillMetadata.category?`、`SkillLoadOutcome.categories`、`SkillCategoryInfo`）；UI 侧 `shared/skills-types.ts` `SkillSummary.category?`
- agent：`adapters/src/skills/scan.ts`（分组下钻）、`adapters/src/skills/index.ts`（category.json 读取 + 归属推断）、`core/src/context/sections/skills.ts`（L0 名单 + L1 分类描述）
- 桌面 UI：`services/src/skills/skillsService.ts` 同规则推断；`SkillsSection` 按分类分组；`skillsMentionProvider` 带 `[分类]` 标签与检索
- 测试：`core/tests/context-builder.test.ts`（L0 名单、分类描述、无逐技能卡片）
