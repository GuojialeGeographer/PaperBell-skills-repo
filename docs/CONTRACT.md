# paperbell-skills-market — 对外契约

本文件定义两份 JSON 契约，市场仓（生产方）与 PaperBell 插件（消费方）都以此为准。
改动任何字段都必须 bump 对应的 `schemaVersion`，并同步插件端的类型：
`Obsidian-PaperBell-Plugin-Pro/src/services/skill-market/types.ts` 与
`src/services/vault-migration/plan-schema.ts`。

---

## 1. `index.json`（schemaVersion 1）

由 `scripts/build-index.mjs --tag <tag>` 生成，作为 GitHub release 资产发布。
客户端默认地址：`https://github.com/PaperBell-Org/paperbell-skills-market/releases/latest/download/index.json`

```jsonc
{
  "schemaVersion": 1,
  "generatedAt": "2026-10-08T00:00:00.000Z",
  "repo": "PaperBell-Org/paperbell-skills-market",
  "tag": "0.1.0",
  "skills": [
    {
      "id": "paperbell-v4-to-v5",            // == 目录名 == SKILL.md frontmatter.name
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
          "url": "https://raw.githubusercontent.com/PaperBell-Org/paperbell-skills-market/0.1.0/skills/paperbell-v4-to-v5/SKILL.md",
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

## 2. 迁移计划 `migration-plan`（schemaVersion 1）

由 `skills/paperbell-v4-to-v5/scripts/plan.mjs` 生成，写到 vault 内
`.paperbell/migration/plan.json`。插件读取、预览、执行。

```jsonc
{
  "schemaVersion": 1,
  "kind": "paperbell-migration",
  "source": "paperbell-v4",
  "target": "paperbell-v5",
  "generatedAt": "...",
  "generator": "paperbell-v4-to-v5@1.0.0",
  "needsReview": [                 // 非空时插件拒绝执行 —— agent 必须先和用户逐项确认并清空
    { "id": "unknown-top-folder:Foo", "message": "顶层文件夹 Foo 不在 v4 映射里，迁到哪？" }
  ],
  "needsAgent": [                  // 插件执行完原样写进 report.json，交还 agent 处理
    { "kind": "project-stage", "file": "40 - Projects/X/X.md", "message": "status=进行中, type=论文 → 需映射为 v5 type/stage" }
  ],
  "ops": [ /* 按顺序执行，见下 */ ]
}
```

### Op 白名单（插件遇到其它 `op` 一律拒绝整份计划）

所有路径都是 **vault 相对路径**、正斜杠、不以 `/` 开头、不含 `..` 段，否则拒绝。

| op | 字段 | 语义 |
|---|---|---|
| `moveFolder` | `from`, `to` | 目标不存在：建父目录后整体 `fileManager.renameFile`。目标已存在：逐个子项合并移动；任何同名文件冲突在**执行前**的预检中报错，不做任何改动。 |
| `moveFile` | `from`, `to` | 单文件 `fileManager.renameFile`（自动更新链接），按需建父目录；目标存在则预检报错。 |
| `rewritePathPrefix` | `from`, `to` | 在所有 `.md` 中把 `from/` 前缀替换为 `to/`，范围仅限：frontmatter 的字符串值（含数组元素）、`[[...]]` / `![[...]]` 链接目标、`[](...)` / `![](...)` 链接目标。另外在 `.base` / `.canvas` 中替换带引号的 `"from/` 前缀。用于 renameFile 管不到的纯字符串路径（如 `banner: 40 - Obsidian/img/x.png`）。 |
| `patchFrontmatter` | `file`, `set?: Record<string, unknown>`, `unset?: string[]`, `setIfMissing?: Record<string, unknown>` | 用 `fileManager.processFrontMatter`：先 `unset`，再 `set`（覆盖），再 `setIfMissing`。`file` 是**迁移后**的路径。 |
| `updateJson` | `file`, `set: Record<string, unknown>` | `file` 只能是 `.obsidian/*.json` 或 `.obsidian/plugins/<id>/data.json`。`set` 的 key 是用 `.` 分隔的路径（如 `"folder"`、`"folder_templates.0.folder"`，数字段索引数组），值整体替换。 |
| `setCimpoFolders` | `folders: { concepts, inputs, metadata, projects, outputs }` | 写 PaperBell 自己的 CIMPO 文件夹设置并广播给子插件。 |

执行顺序即数组顺序；`plan.mjs` 保证：所有 `move*` 在前，然后 `rewritePathPrefix`，然后 `patchFrontmatter`，最后 `updateJson` / `setCimpoFolders`。

### 插件写出的文件（同目录 `.paperbell/migration/`）

- `backup-<timestamp>.zip`：执行前备份（所有 `.md`、`.base`、`.canvas`，以及 `.obsidian/*.json` 和 `.obsidian/plugins/*/data.json`；不含附件）。
- `journal.jsonl`：每执行一条 op 追加一行，含回滚所需的原值：
  `{"index":3,"op":"moveFile","from":"...","to":"..."}`、
  `{"index":7,"op":"patchFrontmatter","file":"...","before":{"keywords":null,"concepts":["a"]}}`（`null` 表示原本不存在）、
  `{"index":5,"op":"rewritePathPrefix","files":{"a.md":"<原文>"}}`、
  `{"index":9,"op":"updateJson","file":"...","before":"<原文>"}`。
- `report.json`：
  ```jsonc
  { "schemaVersion": 1, "planSha256": "<hex>", "startedAt": "...", "finishedAt": "...",
    "status": "completed" | "failed" | "rolled-back",
    "results": [ { "index": 0, "op": "moveFolder", "status": "ok" | "skipped" | "failed", "error": "..." } ],
    "needsAgent": [ /* 原样复制 plan.needsAgent */ ] }
  ```
- `report.md`：给人看的摘要。

### 实现细节（插件端执行器的既定行为，生产方据此生成计划）

- **planSha256**：`plan.json` 磁盘原文（UTF-8）的 SHA-256。
- **校验比上表更严**：路径还拒绝 `.` 段、空段、结尾 `/`、反斜杠、盘符、NUL；`from === to` 拒绝；`.obsidian/`、`.paperbell/` 不能作 move 的源或目标、不能作 `rewritePathPrefix` 前缀或 CIMPO 文件夹；`patchFrontmatter.file` 必须以 `.md` 结尾且至少有 set/unset/setIfMissing 之一；`updateJson` 的 key 不得含空段或 `__proto__`/`constructor`/`prototype`。`needsReview`/`needsAgent` 可省略（默认 `[]`），`needsReview[].id` 可省略。
- **moveFolder 合并**：被合并清空的源文件夹会删除（含隐藏文件删不掉则保留，不算错误）；同名子文件夹递归合并；文件/文件、文件/文件夹撞名在预检报错。
- **rewritePathPrefix**：frontmatter 按文本改写（不经 `processFrontMatter`，避免重排 YAML），覆盖标量、引号值、块列表项和行内 `[...]`；只改以 `from/` 开头的值；链接目标保留 alias 与 `#heading`；支持 `%20` 编码与 `<...>` 目标，`to` 含空格时按 `%20` 写回；不改 fenced code block；`.base`/`.canvas` 的"带引号"包括 `"` 与 `'`。
- **updateJson**：目标文件不存在 → 该条 `skipped`，不新建；缺失的中间层按下一段是否为数字建数组或对象；索引 = 长度时追加，大于长度报错；保留原缩进、换行符和结尾换行。预检不检查 updateJson 的文件。
- **journal.jsonl**：首行 header `{"type":"header","schemaVersion":1,"planSha256","startedAt","backup"}`，每次执行覆盖重写。每条 op 都写一行（含 `ok: boolean`，失败也写已完成的部分），在上表字段之外还有：`moveFolder` 的 `mode: "rename"|"merge"`、`moves`、`createdFolders`、`removedFolders`；`moveFile` 的 `moves`、`createdFolders`；`patchFrontmatter` 的 `original`（整文件原文，回滚按字节还原）；`setCimpoFolders` 的 `before`。回滚后追加 `{"type":"rolled-back","at"}`，此后拒绝再次回滚。
- **回滚**尽力而为：遇错继续并汇总；其它文件里被 Obsidian 改写的链接靠反向 `renameFile` 还原，最短路径链接不保证逐字节一致 —— 备份 zip 是最后兜底。
- **report.json** 额外字段：`backup`（备份路径）、`rolledBackAt`；`skipped` 结果带 `error` 说明原因，首处失败之后的 op 统一为 `"前面的操作失败,未执行"`。成功执行过 `updateJson` 时，插件提示用户立即重启 Obsidian（运行中的插件会用内存里的设置覆盖文件改动）。只有 journal 的 planSha256 与 report 一致时才把状态改为 `rolled-back`。
- `.paperbell/` 不被 Obsidian 索引，插件里"打开报告"以弹窗显示 `report.md` 文本。
- 插件每 10 秒（及启动时）`stat` 一次 `plan.json`，mtime 变化且 report 中无相同 planSha256 时弹提示。`obsidian://paperbell-migrate` 打开预览，`?action=rollback` 打开回滚确认。
