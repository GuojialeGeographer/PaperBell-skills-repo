---
name: paperbell-v4-to-v5
description: Upgrade a PaperBell 4.x Obsidian vault to the 5.x CIMPO layout (00 - Obsidian / 10 - Cards / 20 - Inputs / 30 - Metadata / 40 - Projects / 50 - Outputs). Use when the user wants to migrate, upgrade or convert an old PaperBell vault (folders like "40 - Obsidian", "Persons/Scholars", "Locations/Institutes", "00 - 每日日记", "Projects/X.md") to PaperBell 5, or asks why their vault does not match the v5 docs. Generates a migration plan that the PaperBell plugin executes, then guides the follow-up and verifies the result.
---

# PaperBell 4.x → 5.x（CIMPO）迁移

你是执行迁移的 coding agent。分工是固定的：

- **你**：用 `scripts/plan.mjs` 生成计划、和用户逐项确认、处理需要判断的事项、验收。
- **PaperBell 插件**：执行计划里的文件移动和改写。**你绝不自己移动或重命名库里的文件**——只有 Obsidian 的 `fileManager.renameFile` 会同步更新所有 `[[链接]]`，用 shell/`mv` 移动会把链接全部弄断。

`<skill>` 指本 skill 的安装目录（本文件所在目录）。规则的唯一来源是 `<skill>/references/mapping.json`（每条规则带 `provenance`）。

## 1. Confirm the vault（确认库与备份）

1. 找到库根目录：含 `.obsidian/` 的那一层。用户给的是仓库根而库在子目录时（如 `PaperBell/PaperBell/`），用子目录。
2. 确认是 v4：存在 `40 - Obsidian/`、`Persons/Scholars/`、`Locations/Institutes/` 或 `00 - 每日日记/` 之一。plan.mjs 也会检查，不是 v4 会以退出码 2 拒绝。
3. **坚持先备份**，用户确认之前不要往下走：
   - 库是 git 仓库：`git -C <vault> status` 干净后 `git -C <vault> commit -am "before v5 migration"`（或让用户自己提交）。
   - 不是 git：让用户把整个库文件夹复制一份（包括 `.obsidian/`）。
   - 插件执行前还会自动打一个 `backup-<时间>.zip`，但它**不含附件**，不能替代完整备份。
4. 确认 PaperBell 插件 ≥ 0.5.0 已安装（设置 → 社区插件）。没有插件 → 见文末 *Fallback*。

## 2. Generate the plan（生成计划）

```bash
node <skill>/scripts/plan.mjs "<vault>"
```

- 只读库，唯一的写入是 `<vault>/.paperbell/migration/plan.json`（`--out <path>` 可改，`--out -` 只打印）。
- 输出各类 op 数量、`needsReview` / `needsAgent` 数量。`--json` 打印完整计划。
- 需要 Node ≥ 20，无任何依赖。

计划结构（市场仓 `docs/CONTRACT.md` §2 定义）：`ops` 按 move → `rewritePathPrefix` → `patchFrontmatter` → `updateJson`/`setCimpoFolders` 排序。想知道某条 frontmatter 补丁为什么生成，看 `references/frontmatter-rules.md`。

## 3. Resolve needsReview（逐项确认，直到为空）

`needsReview` 非空时插件会**拒绝执行**。逐条拿给用户看，用用户的话做决定——**不要替用户编答案**，拿不准就问。

常见条目：

| id 前缀 | 含义 | 可选决定 |
|---|---|---|
| `unknown-top-folder:X` | 顶层文件夹不在 v4 映射里 | `move`（到某个 CIMPO 文件夹下）/ `keep` |
| `unknown-child:Locations/Places` 等 | v4 父目录下的未知子目录 | `move`（建议值写在 message 里）/ `keep` |
| `v5-missing-folder:Inputs/Links` | v5 删掉的目录 | `move`（如并入 `20 - Inputs/Clippings`）/ `keep` |
| `project-subfolder:Projects/X` | 没有同名 `X.md` 的项目子目录 | `move` / `keep` |
| `loose-file:…` / `project-loose-file:…` | 放错层级的文件 | `move` / `keep` |
| `partial-v5:X` | 库里已有 v5 文件夹（迁移做过一半？） | `accept`（合并进去） |
| `conflict:<path>` | 迁移后两个文件会落到同一路径 | 无法用决定解决：请用户在 Obsidian 里先重命名/合并其一，再重跑 |

**推荐做法**：把决定写进 `<vault>/.paperbell/migration/decisions.json`，然后重跑第 2 步。plan.mjs 会据此生成一致的 move、`rewritePathPrefix` 和 frontmatter 补丁（补丁路径是迁移后的路径，手改 plan 容易对不上）。

```json
{
  "decisions": {
    "unknown-child:Locations/Places": { "action": "move", "to": "30 - Metadata/Places" },
    "v5-missing-folder:Inputs/Links": { "action": "keep" },
    "unknown-top-folder:Archive": { "action": "move", "to": "50 - Outputs/Archive" }
  }
}
```

`to` 必须是库内相对路径（正斜杠、不以 `/` 开头、不含 `..`）。也可以直接编辑 `plan.json`（加 op、删 needsReview 条目），但 move 要放在 move 段、补丁里的 `file` 要用迁移后的路径。重跑直到输出 `needsReview: 0`。

## 4. Execute in Obsidian（由用户在 Obsidian 里执行）

告诉用户：

1. 在 Obsidian 里打开这个库，命令面板运行 **「PaperBell: 应用迁移计划」**（或在浏览器/终端打开 `obsidian://paperbell-migrate`）。
2. 插件会预览计划、做冲突预检、打备份，然后执行。
3. 完成后回来告诉你。

你在这一步什么都不改。执行期间不要碰库文件。

## 5. Read the report（读执行报告）

读 `<vault>/.paperbell/migration/report.json`（人读版是 `report.md`）。

- `status: "completed"`：**先请用户立刻重启 Obsidian**（期间不改任何设置）—— 计划改写了 `.obsidian/*.json` 和其它插件的 `data.json`，运行中的插件下次保存设置会把改动覆盖回去；重启后再继续第 6 步。`results` 里带 `error` 的 `skipped` 条目向用户说明原因。
- `status: "failed"`：其后的 op 都是 `skipped`（`error` 为"前面的操作失败,未执行"），不必逐条解释。找到第一个 `status: "failed"` 的 result，把 `op` 和 `error` 用大白话解释给用户（常见：目标已存在、文件被占用、frontmatter 无法解析）。提议在 Obsidian 运行 **「PaperBell: 回滚上次迁移」**，回滚后修正原因（改 decisions.json 或在库里处理冲突），回到第 2 步重新生成计划。
- `status: "rolled-back"`：库已恢复原状，同上排查后重来。

## 6. Handle needsAgent（处理需要判断的事项）

`report.json.needsAgent` 原样复制了计划里的条目。逐条和用户处理；每类的具体做法见 **`references/needs-agent-playbook.md`**。概要：

- `project-stage` / `project-acronym` / `project-workload` / `project-milestones` / `project-concepts` / `project-funds`：项目主页 schema 从 v4 改到 v5。已安装 **PaperBell Project Manager** 时，先运行它的 **「迁移项目 schema（status + phase → stage）」** 命令处理 status/phase→stage 与 `软件→开发`，其余（acronym、workload 小时数、里程碑转待办、concepts/keywords、funds→Grants）按 playbook 和用户逐项确认后再改。
- `scholar-profile`：从 `abstract`/`motto` 提炼 `keywords`，需用户确认。
- `templates`：从**官方 v5 发行版**（PaperBell 示例库的 v5 release）复制 `00 - Obsidian/模板/` 下的模板替换 v4 版；用户改过的先 diff 合并。`zt-field.eta.md` 必须换，否则新导入的 Zotero 笔记还会写 `concepts`。
- `base-file`：用 v5 版 `.base` 替换或修正筛选条件。
- `code-path-strings`：正文 dataviewjs / 查询字符串里的 v4 路径（`rewritePathPrefix` 不改代码）；按 message 里的对照替换，v5 已删除的脚本（`project_participants` 等）改用 v5 模板写法。
- `json-manual`：手动改一个插件配置值（键名里含 `.`，无法用计划表达）。
- `plugins`、`create-folders`：见第 8 步。

改笔记内容（frontmatter、正文）可以由你直接编辑文件——这些不涉及移动，不会断链。但**改之前先给用户看改动**，批量改动先做一两篇样例确认。

## 7. Verify（验收）

```bash
node <skill>/scripts/plan.mjs "<vault>" --verify
```

检查：残留的 v4 文件夹、frontmatter 与 `.base`/`.canvas` 里的 v4 路径、指向 v4 路径的断链（ERROR，退出码 1）；空的 v4 文件夹、代码里的 v4 路径、插件配置里的 v4 路径（warn）。有 ERROR 就和用户逐条处理后再跑，直到 `OK`。空的 v4 文件夹（如 `00 - 每日日记/`、`Persons/`）请用户在 Obsidian 里删除。

## 8. Plugins & folders（插件与文件夹收尾）

按 `plugins` 条目的 message 向用户总结（来源：`mapping.json` → `plugins`）：

- **停用/移除**：obsidian-dynamic-toc、obsidian-pandoc-reference-list、soundscapes、obsidian-enhancing-export、obsidian-tracker、datacore、obsidian42-brat（只列用户实际启用的）。
- **安装**（PaperBell 插件市场）：PaperBell Cards Wrangler、PaperBell Project Manager、PaperBell Section、Inputs Bell。
- **升级**：PaperBell ≥ 0.5.0、PaperOut To-Authors（longform-paperbell）、ZotLit。
- `create-folders`：在 Obsidian 里新建缺的 v5 文件夹（如 `30 - Metadata/Grants`）。

插件的安装/启停由用户在 Obsidian 里操作；不要直接改 `community-plugins.json`。

## Fallback：没有 PaperBell 插件

先建议安装 PaperBell ≥ 0.5.0 再迁移——这是唯一能保证链接不断的方式。用户坚持手动时，明确告知**链接有断裂风险**，并按 plan.json 的顺序在 **Obsidian 文件列表里拖拽/重命名**（打开「设置 → 文件与链接 → 始终更新内部链接」），不要用 Finder 或 shell：

1. 依次执行 `moveFolder` / `moveFile`（`from` 拖到 `to`）。
2. `rewritePathPrefix`：用 Obsidian 全局搜索 `40 - Obsidian/` 等前缀，只替换 frontmatter 值和链接目标里的。
3. `patchFrontmatter` / `updateJson`：你可以照计划逐条改（改前给用户看）；改 `.obsidian/` 下的 JSON 前先关闭 Obsidian。
4. `setCimpoFolders` 跳过（没有插件就没有这个设置）。
5. 跑第 7 步 `--verify`。
