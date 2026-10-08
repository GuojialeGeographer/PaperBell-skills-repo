# needsAgent playbook

迁移执行完后，`report.json.needsAgent` 里每条是 `{kind, file, message}`，`file` 是迁移后的路径。原则：

- 每类先和用户确认一次规则，再批量改；批量前先改一篇给用户看。
- 只改笔记内容和插件配置值，不移动文件（移动请回到 plan → 插件）。
- 用户说"跳过"就跳过，记下来最后汇总。

## 项目（`40 - Projects/<X>/<X>.md`）

v5 项目主页 schema（来源：v5 `项目模板.md`、Project Manager 文档）：

```yaml
tags: [project/index, project/<acronym>]
project: <显示名，= 文件夹名>
acronym: <缩写，字母开头，仅字母数字 - _>
type: 研究 | 开发 | 管理
stage: 探索 | 进行 | 结题 | 归档 | 维护
workload: <每周小时数 1–40>
keywords: [挂靠关键词]
concepts: ["[[精选概念卡]]"]
banner: 40 - Projects/<X>/cover.jpg
```

### `project-stage`

1. 若已安装 **PaperBell Project Manager**：让用户运行命令 **「PaperBell Project Manager: 迁移项目 schema（status + phase → stage）」**。它按下表写 `stage`、删 `status`/`phase`、把 `type: 软件` 改成 `开发`，并同步改项目类 `.base`。
2. 未安装或命令没覆盖的，按下表手改（来源 `PaperBell-Project-Manager/src/core/stage.ts`；`phase` 优先于 `status`）：

| phase | status | → stage |
|---|---|---|
| 探索期 | 计划中 / `0` | 探索 |
| 执行期 | 进行中 / `1` | 进行 |
| 结题期 | 已完成 / `2` | 结题 |
| 归档期 | 已归档 / `3` | 归档 |
| 维护期 | 跟踪中 | 维护 |

3. `type`：v4（论文/基金/报告/书籍/其他）→ v5（研究/开发/管理）没有固定对应，**问用户**。参考：论文、报告、书籍多为「研究」；软件/工具为「开发」；行政、课程、基金申请本身多为「管理」。基金类项目还应考虑在 `30 - Metadata/Grants/` 建资助笔记（见 `project-funds`）。

### `project-acronym`

- v4 的 `project:` 字段就是项目 ID；message 里给了建议值。和用户确认缩写（要长期稳定、唯一）。
- 写入 `acronym: <缩写>`，`project:` 改为显示名（文件夹名），tags 加 `project/<缩写>`。
- 若库里已有 `#project/<旧ID>` 标签且旧 ID ≠ 新缩写：搜索全库，和用户确认后统一替换，否则任务会被拆成两个项目。v4 的 Zotero 笔记 tags 常带 `project/<ID>`。

### `project-workload`

v4 是 1–5 档，v5 是每周小时数。问用户"这个项目现在每周大概投入几小时？"。用户没概念时可给参考（1≈2h, 2≈4h, 3≈8h, 4≈12h, 5≈20h），但写入用户确认的数。已结题项目可以填 1。

### `project-milestones`

把 frontmatter 的

```yaml
milestones:
  - task: v-0.1.0 根基初现
    date: 2023-01-30
    done: true
```

转成正文 `## 🙋 Milestones` 下的待办（需先有 acronym）：

```markdown
- [x] v-0.1.0 根基初现 #milestone #project/<acronym> 📅 2023-01-30
```

`done: false` → `- [ ]`；无 `date` 就不写 📅。转换后删除 `milestones` 键。进度 = 已完成 / (总数 − `[-]` 取消数)。

### `project-concepts`

v4 项目 `concepts:` 是纯文本。v5 分成两个字段：`keywords`（挂靠关键词，供"相关素材"反查论文/学者/书）和 `concepts`（锚定的**精选**概念卡链接）。和用户逐个过：对应 `10 - Cards/` 里已有卡片且是核心概念的 → `concepts: ["[[卡片名]]"]`；其余 → `keywords`。

### `project-funds`

v5 项目不记 `funds`，资助是反查出来的。为每笔资助在 `30 - Metadata/Grants/` 新建笔记（字段参考 v5 示例）：

```yaml
tags: [grant]
name: <资助名>
agency: <资助方>
status: 撰写中 | 申请中 | 已获批
project: ["[[<项目主页名>]]"]
```

然后删除项目里的 `funds`。资助细节（金额、编号）问用户，没有就留空。

### 项目正文

v4 项目正文常有 `dv.view("40 - Obsidian/脚本/project_participants")`、`timeline_milestones` 等——这些脚本在 v5 已删除（会出现在 `code-path-strings`）。建议用 v5 `项目模板.md` 的正文区块（参与者 / 里程碑 / 资助 / 交付物 / 相关素材 / 导航的 `![[*.base]]` 嵌入）替换，保留用户自己写的内容。封面：v5 约定 `40 - Projects/<X>/cover.jpg`，`banner` 原来指向 `00 - Obsidian/img/...` 也能用，换不换问用户。

## `scholar-profile`

v5 学者模板去掉了 `abstract`/`motto`，用 `keywords` 记研究方向（供论文/概念反查）。从 abstract 提炼 3–6 个稳定的主题词给用户确认后写入 `keywords`。`abstract`/`motto` 本身不影响 v5 功能：问用户保留、移入正文，还是删除。

## `templates`

1. 从官方 PaperBell 示例库的 **v5 release**（GitHub `PaperBell-Org/PaperBell` 的 5.x 发行包，库在 `PaperBell/` 子目录）取 `00 - Obsidian/模板/`。
2. 对 message 里列出的必须替换项（尤其 `zt-field.eta.md`、`项目模板.md`、`机构模板.md`、`术语模板-手动.md`）：先 diff 用户当前版本与 v4 原版——用户没改过就直接覆盖；改过就把用户的改动合并进 v5 版，给用户看。
3. 复制 v5 新增模板；v5 已删除的（`术语模板.md`、`概念检索论文.base`、`custom-reference.docx`）问用户是否删除。
4. 主页 `00 - Obsidian/主页/00. 主页.md`、`00. 导航.md` 同样处理；`00. 文件管理.md` 在 v5 已删除。

## `base-file`

- message 说"v4 版本的 .base"：用 v5 发行版里同名文件替换；用户加过自定义视图的，把视图块合并进去。
- message 说"v5 新增的视图"：从 v5 发行版复制到对应路径。
- 其它用户自建的 `.base`：检查 `filters` 里 `file.inFolder("…")`、`file.path.startsWith("…")`、`file.folder…` 的路径是否已是 v5 路径；项目类视图里的 `status`/`phase` 改为 `stage`。

## `code-path-strings`

正文代码块或查询字符串里的 v4 路径。message 给了替换对照（如 `"00 - 每日日记/DailyNote"` → `"30 - Metadata/DailyNote"`、`"Inputs"` → `"20 - Inputs"`）。只改字符串字面量；涉及 v5 已删除脚本的代码块，换成 v5 模板对应写法或问用户是否删除。概念卡里的"相关想法" dataviewjs 可直接换成 v5 `术语模板-手动.md` 的版本。

## `json-manual`

某个插件配置的键名里带 `.`（如新版 ZotLit 的 `note.literature-folder`），计划无法表达。请用户**先关闭 Obsidian**，再按 message 改 `.obsidian/plugins/<id>/data.json` 里那个值（或在该插件设置界面里改，更安全）。

## `json-unparsed` / `frontmatter-unparsed`

文件解析失败，计划没碰它。打开文件看原因（常见：Templater 代码混在 frontmatter 里、缩进错误），和用户一起修，必要时重跑 plan 生成补丁。

## `plugins`

汇总给用户，由用户在 Obsidian 里操作（设置 → 社区插件；PaperBell 子插件在 PaperBell 插件市场）。不要直接改 `community-plugins.json`。

## `create-folders`

在 Obsidian 里新建列出的文件夹（如 `30 - Metadata/Grants`）。可以用 shell `mkdir`——新建空文件夹不影响链接。
