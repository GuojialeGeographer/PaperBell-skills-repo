# Frontmatter rules（确定性补丁）

plan.mjs 只对能机械判断的改动生成 `patchFrontmatter`，其余进 `needsAgent`。笔记类型按**迁移后的路径**（+ tags）判断。规则定义在 `mapping.json` → `frontmatterRules`。执行顺序（插件端）：先 `unset`，再 `set`，再 `setIfMissing`。

## 1. Inputs：`concepts` → `keywords`

- **匹配**：路径在 `20 - Inputs/` 下，且 frontmatter 有 `concepts` 键（Zotero、Books、Clippings 等都适用）。
- **来源**：v5 `zt-field.eta.md` 改写 `keywords:`，并排除含 ⭐/🌟 的标签（"星标进 important，不污染关键词"）；CIMPO 文档："输入只带 keywords，不带 concepts"。
- **做法**：
  - `keywords` = 原有 `keywords` ∪（`concepts` 去掉含 ⭐ 或 🌟 的条目；`[[X]]` 解包成 `X`），保持顺序、去重；
  - `unset: [concepts]`；
  - 有含 🌟 的条目（v4 的 `🌟星标`）→ `set.important = true`（v5 模板里 important 就是"有 🌟星标"）；
  - 只有 ⭐ 条目（如 `⭐⭐` 评分）→ 仅当 `important` 缺失时 `setIfMissing.important = true`，显式的 `important: false` 保留。
- 评分本身（⭐ 的个数）不保留；需要的话回滚日志里有原值。

| v4 | v5 补丁 |
|---|---|
| `concepts: [⭐⭐, corr:2]`, `important: true` | `unset [concepts]`, `set {keywords: [corr:2]}` |
| `concepts: [to-read, ⭐⭐⭐, 🌟星标, "[[city]]"]`, `keywords: [scale]`, `important: false` | `set {keywords: [scale, to-read, city], important: true}` |
| `concepts: [⭐, AI]`（无 important） | `set {keywords: [AI]}`, `setIfMissing {important: true}` |
| `concepts: []` | `set {keywords: []}` |

## 2. 概念卡默认字段

- **匹配**：路径在 `10 - Cards/` 下，且（tags 含 `concept` 或位于 `10 - Cards/Concepts/`）。
- **来源**：v5 `术语模板-手动.md` 写入 `category: concept`、`featured: false`，与 Cards Wrangler 同一 schema。
- **做法**：`setIfMissing {category: concept, featured: false}`（已有值不动）。是否精选（`featured: true`）由用户之后在 Cards Wrangler 里策展。

## 3. 机构标签

- **匹配**：路径在 `30 - Metadata/Institutes/` 下，tags 含 `university`。
- **来源**：v5 `机构模板.md` 的 tags 从 `university` 改为 `institute`；Map View 配置同步把 `tag:#university` 改成 `tag:#institute`（计划里有对应 `updateJson`）。
- **做法**：`set {tags: [...]}`，把 `university` 换成 `institute`，其余标签保留、去重。

## 不做的（交给 needsAgent）

| 情况 | 为什么不自动 | needsAgent kind |
|---|---|---|
| 项目 `status`/`phase`/`type` → `stage`/`type` | v4 type（论文/基金/报告/书籍/其他）与 v5（研究/开发/管理）不是一一对应 | `project-stage` |
| 项目缺 `acronym` | 缩写是长期 ID，要用户拍板 | `project-acronym` |
| `workload` 1–5 → 每周小时数 | 没有客观换算 | `project-workload` |
| frontmatter `milestones` → 正文 `#milestone` 待办 | 要改正文、要 acronym | `project-milestones` |
| 项目 `concepts`（纯文本）→ `keywords` / `concepts: "[[卡片]]"` | 哪些是精选概念要用户判断 | `project-concepts` |
| 项目 `funds` → `30 - Metadata/Grants/` 笔记 | 要新建笔记 | `project-funds` |
| 学者 `abstract`/`motto` → `keywords` | 要提炼 | `scholar-profile` |

## 路径字符串

`banner: 40 - Obsidian/img/x.png`、`![[40 - Obsidian/img/x.png]]` 这类 renameFile 管不到的纯字符串，由 `rewritePathPrefix` 处理（frontmatter 字符串值、`[[…]]`/`![[…]]`、`[](…)` 链接目标，以及 `.base`/`.canvas` 里带引号的 `"<v4>/` 前缀）。前缀表 = `mapping.json` 的 `folderMoves` + `Projects → 40 - Projects` + 用户决定的 move，按最长前缀优先。

注意它**不改**：正文代码块（→ `code-path-strings`）、`.base` 里不带斜杠结尾的 `"Persons/Scholars"`（→ `base-file`，建议换 v5 版本）。
