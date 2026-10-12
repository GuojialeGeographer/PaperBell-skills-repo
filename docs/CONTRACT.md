# PaperBell-skills-repo — 对外契约

本文件定义 `index.json` 这份 JSON 契约，市场仓（生产方）与 PaperBell 插件（消费方）都以此为准。
改动任何字段都必须 bump `schemaVersion`，并同步插件端的类型：
`Obsidian-PaperBell-Plugin-Pro/src/services/skill-market/types.ts`。

---

## 1. `index.json`（schemaVersion 1）

由 `scripts/build-index.mjs --tag <tag>` 生成，作为 GitHub release 资产发布。
客户端默认地址：`https://github.com/PaperBell-Org/PaperBell-skills-repo/releases/latest/download/index.json`

```jsonc
{
  "schemaVersion": 1,
  "generatedAt": "2026-10-08T00:00:00.000Z",
  "repo": "PaperBell-Org/PaperBell-skills-repo",
  "tag": "0.1.0",
  "skills": [
    {
      "id": "paperbell-migrate",            // == 目录名 == SKILL.md frontmatter.name
      "version": "1.0.0",                    // 每个 skill 独立 semver
      "title":       { "en": "...", "zh": "..." },
      "description": { "en": "...", "zh": "..." },
      "tier": "core",                        // "core" | "community"
      "agents": ["claude-code", "openai-codex"],   // 省略 = 全部 AgentType
      "requires": [],                        // 其它 skill id，安装时先装
      "minPluginVersion": "0.5.0",           // 可省略
      "free": true,                          // true = 免费用户也可安装
      "tags": ["migration"],
      "files": [                             // 第一项永远是 SKILL.md
        {
          "path": "SKILL.md",                // 相对 skill 安装目录，正斜杠，无 ".."
          "url": "https://raw.githubusercontent.com/PaperBell-Org/PaperBell-skills-repo/0.1.0/skills/paperbell-migrate/SKILL.md",
          "sha256": "<hex>",
          "size": 1234
        }
      ],
      "readmeUrl": null                      // 可选：市场页详情用的 README（默认展示 SKILL.md 正文）
    }
  ],
  "bundles": [
    {
      "id": "manuscript-formatting",
      "version": "1.0.0",
      "title":       { "en": "...", "zh": "..." },
      "description": { "en": "...", "zh": "..." },
      "skills": ["paperbell", "tables-to-workbook", "track-changes"]
    }
  ]
}
```

规则：

- `files[].url` 一律钉在 tag 上（`raw.githubusercontent.com/<repo>/<tag>/...`），客户端必须校验 `sha256`，不符拒装。
- 共享资源（`shared/**`，由 `skill.yaml` 的 `shared:` 声明）在 index 里表现为该 skill 的普通文件：`path` 是它在 skill 目录里的落盘位置，`url` 指向 `shared/` 下的原文件。
- **flat 型 agent**（Cursor / Windsurf / Cline，每个 skill 只有一个 `.md`）只能安装 `files.length === 1` 的 skill；有附加文件的 skill 在这些 agent 下显示"不支持"。
- 客户端遇到不认识的 `schemaVersion` 必须拒绝整份 index，而不是猜。

---

## 2. 迁移：`paperbell-migrate`

PaperBell 4.6.1 → 5.0.3 的迁移由 `skills/paperbell-migrate` 这一个技能完成，**没有机器契约**，
插件不执行任何迁移操作。规则只在技能自带的 `SKILL.md` 与 `references/` 里维护，这里不复述；
给人看的说明见技能目录的 `README.md` 和 [`docs/migration/手工迁移说明.md`](migration/手工迁移说明.md)。

早期设计中的 `migration-plan` 计划文件、`.paperbell/migration/` 目录、`obsidian://paperbell-migrate`
协议和插件内执行器均已撤销。插件端只在检测到当前库仍是 4.x 结构时提示用户，并把市场页定位到这个技能。
