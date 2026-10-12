# 逐项修改操作手册：按最终迁移结果复现

本手册补充“具体怎么改”，适用于详细说明、手工操作和 AI 执行。项目名、库名、日期等示例仅演示语法；先确认实际文件，再替换。先看完整操作顺序，再做替换表。

## 一、每批操作的固定顺序

1. 关闭目标库；确认旧库完整备份已验证。只打开新版库进行修改。
2. 写下本批源文件列表、目标列表和同名冲突；复制即将修改的目标文件到库外本批备份目录。
3. 复制旧内容到目标目录；同名不同内容先比较，不使用“全部覆盖”。
4. 完成这一类要求的字段、目录、Base、脚本和路径适配。
5. 保存所有文件；重新打开检查。逐项比较正文、元数据和文件数，检查实际图片与引用。
6. 记录本步结果和剩余依赖。每一项没有通过就留在本步，不以“复制成功”结束。
7. 可打开 Obsidian 抽查；进入下一批前重新关闭，核对是否被自动归类、自动套模板或手动编辑改变。

## 二、VS Code 批量替换：完整操作

### 2.1 设置工作范围

1. “文件 → 打开文件夹”，打开**新版库根目录**，不要打开两个库的共同父目录。
2. 按 `Ctrl+Shift+H` 打开跨文件替换。若只看见搜索框，展开替换框。展开搜索详情，显示“要包含的文件”和“要排除的文件”。不同语言版本标签可能略有差异。
3. “要包含的文件”先填本批目录，例如 `10 - Cards/Concepts/**/*.md`。本目录若混有新版原始示例，改为本次迁入的明确文件列表（逗号分隔），或逐文件用 `Ctrl+H`；目录范围不等于只会命中迁入文件。
4. “要排除的文件”填 `.obsidian/**,00 - Obsidian/**,**/.git/**`。备份与记录本来就应放库外。如果编辑必要插件设置，单独打开那个 JSON，不把它混入跨文件替换。
5. 普通字符串替换关闭 `.*`（正则）、关闭 `Ab`（全字匹配），需要严格匹配时开启 `Aa`（区分大小写）。下文写“正则开”时才打开 `.*`。
6. 先填查找内容，看结果数量和文件列表；无命中时先检查包含范围、空格、引号与斜杠，不直接扩大到整个磁盘。
7. 填替换内容，展开命中上下文/替换预览。删除不属于本批的结果，逐文件替换；只有所有命中都符合规则时才对这批“全部替换”。
8. 按 `Ctrl+K S` 保存全部。再次查找旧值，检查零命中或剩余是否有保留原因；搜索新值，检查没有重复编号。
9. 与库外改前文件比较。可以在资源管理器右键文件“选择以进行比较”，再右键另一个文件“与已选项目比较”；也可并排打开。确认改动只在计划区域。

### 2.2 包含范围示例

| 本批 | 包含范围（打开的是新库根目录） |
| --- | --- |
| 日记 | `30 - Metadata/DailyNote/**/*.md` |
| 文献 | `20 - Inputs/Zotero/**/*.md` |
| 学者 | `30 - Metadata/Scholars/**/*.md` |
| 机构 | `30 - Metadata/Institutes/**/*.md` |
| 概念 | `10 - Cards/Concepts/**/*.md` |
| 单个项目 | `40 - Projects/ABSESpy/**/*.md` |
| 单个写作项目 | `50 - Outputs/Longform/demo/**/*.md` |

修改前先验证搜索结果确实包含预期文件。含空格的路径直接填在包含栏，不加命令行引号。文件名本身含逗号时不使用逗号分隔文件列表，改用当前文件替换。

## 三、普通完整路径的批量替换表

先做特殊完整路径，再做通用目录前缀。表中内容按原样输入，不包含 Markdown 代码围栏。

### 3.1 高优先级：重命名后的确切路径（正则关）

| 查找 | 替换 | 适用范围与检查 |
| --- | --- | --- |
| `Projects/ABSESpy.md` | `40 - Projects/ABSESpy/ABSESpy.md` | 只处理旧完整链接；先排除原文已含 `40 - ` 的命中 |
| `[[Projects/ABSESpy]]` | `[[40 - Projects/ABSESpy/ABSESpy]]` | 不带扩展名、别名的 wiki 链接；其他形式见下一段 |
| `Projects/PaperBell.md` | `40 - Projects/PaperBell/PaperBell.md` | 目标唯一主页已确定后使用 |
| `[[Projects/PaperBell]]` | `[[40 - Projects/PaperBell/PaperBell]]` | 同上 |
| `Outputs/demo/Index.md` | `50 - Outputs/Longform/demo/Main Manuscript (Index).md` | 先排除已经有 `50 - ` 的命中；正文示例不强制改 |
| `Outputs/demo/source/` | `50 - Outputs/Longform/demo/manuscript/` | 实际章节已移动后才改 |

普通查找会匹配已有新前缀中的子字符串；这些行只有在命中内容确为旧路径时才能替换。希望同时排除新前缀时，用后面的正则方式，不直接“全部替换”。

### 3.2 Wiki 链接的项目主页重定向（正则开）

查找：

```regex
\[\[(?:40 - )?Projects/ABSESpy(?:\.md)?(?=[|#\]])
```

替换：

```text
[[40 - Projects/ABSESpy/ABSESpy
```

替换值直接包含 `[[`，不用捕获组回填。先检查预览，别名和标题后缀由原文保留。

适用示例：

```text
[[Projects/ABSESpy]] → [[40 - Projects/ABSESpy/ABSESpy]]
[[Projects/ABSESpy.md|模型框架]] → [[40 - Projects/ABSESpy/ABSESpy|模型框架]]
[[40 - Projects/ABSESpy#里程碑]] → [[40 - Projects/ABSESpy/ABSESpy#里程碑]]
```

原有 `[[ABSESpy]]` 不需要修改；已是 `[[40 - Projects/ABSESpy/ABSESpy]]` 不会匹配。其他项目分别替换真实项目名；名字含正则符号时需转义，复杂名称优先用普通查找。

### 3.3 通用前缀（正则开，限定迁入 MD）

| 查找正则 | 替换 | 使用条件 |
| --- | --- | --- |
| `00 - 每日日记/DailyNote/` | `30 - Metadata/DailyNote/` | 指向实际迁入日记 |
| `00 - 每日日记/WeeklyNote/` | `30 - Metadata/WeeklyNote/` | 确认真实周记或保存目录 |
| `Persons/Scholars/` | `30 - Metadata/Scholars/` | 实际链接或查询路径 |
| `Locations/Institutes/` | `30 - Metadata/Institutes/` | 同上；Places 不做替换 |
| `(?<!10 - )\bCards/Concepts/` | `10 - Cards/Concepts/` | 排除已有新路径 |
| `(?<!20 - )\bInputs/Books/` | `20 - Inputs/Books/` | Books 笔记实际已迁入 |
| `(?<!20 - )\bInputs/Clippings/` | `20 - Inputs/Clippings/` | Clippings 已迁入 |
| `(?<!20 - )\bInputs/Zotero/` | `20 - Inputs/Zotero/` | Zotero MD 已迁入，不代表 PDF 已迁入 |
| `(?<!50 - Outputs/)\bDrafts/` | `50 - Outputs/Drafts/` | 只用于根目录旧 Drafts 完整路径 |
| `40 - Obsidian/img/` | `00 - Obsidian/img/` | 图片在新位置已存在；项目独立封面另行处理 |
| `40 - Obsidian/附件/` | `00 - Obsidian/附件/` | 确认已补必要附件 |

这些表达式只防特定重复前缀，不是全文语义过滤器。仍可能命中文档例子、网页 URL 或自定义更深层目录，所以必须检查上下文。反斜杠 Windows 路径、URL 编码路径不使用这张表。

不提供全库 `Projects/ → 40 - Projects/`、`Outputs/ → 50 - Outputs/` 的一键规则：项目有嵌套主页、Longform 有重命名，通用替换会遗漏结构变化。Links/Places 暂缓时也不能提前把所有引用改到不存在的新目录。

### 3.4 字段和脚本路径（优先当前文件、正则关）

| 查找 | 替换 | 注意 |
| --- | --- | --- |
| `![[概念检索论文.base]]` | `![[概念反查.base#相关论文]]` | 只替换概念卡嵌入，不修改旧 Base 程序 |
| `sceneTemplate: 40 - Obsidian/模板/` | `sceneTemplate: 00 - Obsidian/模板/` | Longform 索引 |
| `workflow: PaperBell-Standard` | `workflow: PaperBell Manuscript` | metadata.json 已准备好才执行 |
| `sceneFolder: source` | `sceneFolder: manuscript` | source 实际已重命名 |
| `dv.view("40 - Obsidian/脚本/navigation_buttons")` | `dv.view("00 - Obsidian/脚本/navigation_buttons")` | 只保留新版确实存在的导航脚本 |
| `name => line.includes(name)` | `name => name && line.includes(name)` | 仅旧概念相关想法脚本，与新版模板一致时采用 |

概念脚本目录数组直接整行换成新版数组，不分别裸替换字符串 Inputs、Outputs、Projects。机构标签和 YAML 主题字段按后文方法，不用全文匹配。

## 四、URI 与 URL 编码：单独一批

普通路径和编码路径是两套文本，不要混合。迁入日记曾实际出现以下变化：

```text
vault=PaperBell& → vault=PaperBell-v5.0.3&
paperbell%3Ashow-section-view → paperbell-section%3Aopen-paperbell-section
```

第一个替换必须用实际新库名称的 URL 编码值；匹配结尾 `&` 可避免再次修改以旧名开头的新库名。参数位于末尾、含空格或不同编码时逐项检查，不套这个模式。

第二个是已核对的 5.0.3 插件命令对应示例，不是所有版本的通用规则。应核对新版命令再改。Inbox 的 `obsidian-task-progress-bar%3Aswitch-view-inbox` 在该示例中保持，不能把所有旧命令都换掉。

编码链接的 `file=` 参数应先解码看原目标，再用最终完整目标重新编码；空格为 `%20`，斜杠常见 `%2F`。保留 vault、标题、块 ID 与其他参数的语义。不要对整个 URI 重复编码，避免 `%` 变 `%25`。

本机 `file:///Users/.../Zotero/storage/...` 不是库内文件：必须找到实际 Windows PDF 才能改。迁移笔记本身不会导入 Zotero 条目。

## 五、YAML 与正文：不能靠全库替换的部分

### 5.1 文献 concepts 和 keywords

逐篇打开文件顶部第一对 `---` 之间的 frontmatter。只处理文献目录：

```yaml
# 原文件
concepts:
  - modelling
  - memory
  - ⭐⭐
```

改后保留上述所有原值，在同一属性区添加：

```yaml
keywords:
  - modelling
  - memory
```

无明确主题词时 `keywords: []`，已有字段则合并，不能追加第二个 keywords。`to-read`、星标、`corr:2` 等不确定标记保留 concepts。正文、citekey 和块 ID 不动。主题值中含冒号或特殊字符时使用正确 YAML 引号。

### 5.2 学者删除查询的边界

查找 `## 最新动态`，确认紧随其后的 DataviewJS 是旧日记动态查询。选中该标题、其查询围栏和多余空行，删除到查询围栏结束；若后面还有下一节，下一节保留。

不能用 `dataviewjs[\s\S]*` 一类贪婪正则删除：它可能吞掉个人正文或后续代码块。不能仅删除开头围栏留下 JS 正文。删后检查姓名、机构、研究兴趣、`![[论文检索.base]]` 都还在。Dataview 插件不因此卸载。

### 5.3 机构标签

只在 frontmatter 的 tags 下把列表项 `university` 改成 `institute`，无关正文中的英文 university 保留。有效 aliases 原样保留；空占位可清理为 `aliases: []`。坐标不改，地图区未被新版取消且数据合法时保留。

### 5.4 项目里程碑转换核对表

先在库外记录逐条抽取：任务文本、done、date、progress、endDate、其他字段。再生成正文任务。

```yaml
milestones:
  - task: v1 框架搭建
    date: 2023-09-01
    done: true
    progress: 100
    endDate: 2025-12-11
```

```markdown
- [x] v1 框架搭建 #project/PaperBell #milestone 📅 2023-09-01 （旧记录：progress: 100；endDate: 2025-12-11）
```

done 决定复选框，不能只看 progress。旧项目 status 与里程碑不一致时记录矛盾，不自动替用户判断。所有任务核对后才移除旧 milestones 字段；其他 frontmatter 不随之删除。新版示例多出来的任务不自动算个人任务。

## 六、Longform 完整转换实例

### 6.1 改名与链接执行顺序

1. 复制整个旧写作项目到新 Longform 下自己的独立目录，保留改前副本。
2. `Index.md → Main Manuscript (Index).md`；`source → manuscript`。
3. 将原 imgs 中使用的图片合并进 figs；同名同哈希复用，不同哈希先决定新名，不能直接覆盖。
4. 索引 sceneFolder 改 manuscript，sceneTemplate 改新版路径，保留原 scenes 顺序。
5. 建 metadata.json 并核对作者关系，再将 workflow 改 PaperBell Manuscript。
6. 查旧索引/章节/图片路径，修实际链接。选中新索引或仅修改 selectedDraftVaultPath。
7. 逐个打开场景和图片，确认历史 PDF/Word 没被覆盖，后续导出使用不冲突的输出名。

例如，旧引言的 `](organizing.png)` 最终改为 `](../figs/organizing.png)`；`](formatting.png)` 最终改为 `](../figs/formatting.png)`。图片统一到 figs 后，不应继续指向旧 imgs 目录。

### 6.2 metadata.json 可填写模板

以下为**虚构占位例子**，必须替换为原项目真实信息，不能直接作为用户身份使用：

```json
{
  "title": "原项目标题",
  "publication_date": "2025-10-11",
  "upload_type": "publication",
  "publication_type": "article",
  "description": "原摘要",
  "creators": [
    {"name": "作者甲", "affiliation": "机构一", "email": "author@example.org"},
    {"name": "作者乙", "affiliation": "机构二"}
  ],
  "keywords": ["原关键词"],
  "journal_title": "原目标期刊或用途",
  "_longform": {
    "acronym": "DEMO",
    "csl": "nature",
    "template": "paperbell",
    "lineno": false,
    "figures_at_end": false,
    "author_affiliations": {"作者甲": ["机构一", "机构二"], "作者乙": ["机构二"]},
    "corresponding": ["作者甲"],
    "extra_yaml": "subtitle: 原副标题\ntitlepage: true\nnumbersections: true\nlineno: false\nfigures-at-end: false\n"
  }
}
```

迁移后检查：creators 数量与顺序等于旧 authors；数字机构编号映射成真实名称列表；对应关系没有反转；corresponding 名称与 creators.name 完全一致；邮箱来自原文；日期仍是原日期，不能自动换成迁移当天。

`false` 是 JSON 布尔值，不是字符串 `"false"`。extra_yaml 是一个字符串，里面换行写 `\n`；JSON 不允许尾逗号和注释。使用项目字体覆盖时，追加实际安装字体对应的 CJKmainfont 等 YAML 字段；不要盲抄 Mac 字体或 Windows 字体。

移除旧索引中已转换的 authors、affiliations、abstract 等出版配置，避免维护两套；索引 title 等用于显示的属性可保留。原索引全文备份于库外。只把新使用说明放进新版索引时，确保个人正文也有明确保留去向，不能把所有 Index 正文当可丢弃说明。

### 6.3 检查必要配置而不恢复旧设置

关闭库后单独打开 `.obsidian/plugins/longform-paperbell/data.json`：

```json
"selectedDraftVaultPath": "50 - Outputs/Longform/demo/Main Manuscript (Index).md"
```

只改这个字段到自己的索引；保留 workflows、pandocAssetsFolder、其他项目与用户设置。新版实际存在 PaperBell Manuscript 才能选择它，不能凭名称猜测。如果 GUI 已可用，也可在 Longform 面板选择新项目，不必手改 JSON。

其他通常不需要重设的值，只核对：

| 功能 | 应指向的新版位置或来源 |
| --- | --- |
| 日记 | 30 - Metadata/DailyNote |
| Calendar 周记 | 30 - Metadata/WeeklyNote |
| Templater 模板目录 | 00 - Obsidian/模板 |
| QuickAdd 新建学者/机构 | 对应 30 - Metadata/Scholars、Institutes |
| ZotLit note.literature-folder | 20 - Inputs/Zotero |
| ZotLit template.folder | 00 - Obsidian/模板 |
| Longform pandocAssetsFolder | 00 - Obsidian/pandoc |

ZotLit 的点号键是完整键名，不是嵌套 JSON 对象。值已正确就不写文件。完整插件配置不能用旧版替换。

## 七、剩余旧路径扫描与解释

只做搜索，不直接替换。开启正则，在迁入文件范围搜索：

```regex
00 - 每日日记|40 - Obsidian|Persons/Scholars|Locations/Institutes|(?<!20 - )\bInputs/|(?<!40 - )\bProjects/|PaperBell-Standard|概念检索论文\.base
```

再搜重命名和外部依赖：

```text
source/
imgs/
Index.md
file:///Users/
vault=PaperBell
```

这组宽搜索会命中新版 `Main Manuscript (Index).md`、历史说明或示例代码；每个结果应归类为“实际要修”“有意保留”“原缺失”“外部待确认”，不是要求全部清零。

最后搜索错误的新路径：`20 - 20 - Inputs`、`40 - 40 - Projects`、`50 - 50 - Outputs`、`00 - 00 - Obsidian`。有命中先用改前对照恢复正确值，不不断叠加替换。

## 八、验收模板与回退实例

每批在库外记录：

```text
本批：
源目录：
目标目录：
复制文件：
合并文件及取舍：
修改字段/路径：
改前副本：
保留正文/作者/批注/任务检查：
旧库未变检查：
原缺失项：
跨文件夹待迁依赖：
用户暂缓项：
静态通过项：
GUI/导出未验证项：
下一批：
```

例：本批三张概念卡中的一张替换错误，只恢复这一张的新库改前版本并重新适配；另外两张已通过文件保留。如果这张是本步新建且没有后续编辑，可移到库外隔离目录再重新复制，避免删除唯一内容。用户已编辑的版本先另存，不能用旧备份直接盖掉。

文件数相同不能证明内容没丢；至少逐文件去向、差异和关键正文检查。没有改内容的复制文件应比对 SHA-256；有格式转换的文件则比较允许变化范围。最终静态通过不代表图片网络服务、Zotero 条目和导出 GUI 已验证。
