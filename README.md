# PaperBell-skills-repo

PaperBell 的 **AI 技能（Agent Skills）市场**：学术写作、仓库笔记规范、稿件格式、4.6.1 → 5.0.3 迁移等技能的唯一来源。

- **PaperBell 插件**（消费方）读取每次 release 附带的 `index.json`，按用户选择的 agent（Claude Code / Copilot / Codex / Gemini CLI / Cursor / Windsurf / Cline）把技能装进仓库。契约见 [`docs/CONTRACT.md`](docs/CONTRACT.md)。
- **Claude Code** 用户也可以直接把本仓库当插件市场用：

  ```
  /plugin marketplace add PaperBell-Org/PaperBell-skills-repo
  /plugin install manuscript-formatting@paperbell-skills
  ```

- **贡献者**通过 fork + PR 添加新技能，见 [CONTRIBUTING.md](CONTRIBUTING.md)。

[English summary below](#english).

## 目录结构

```
skills/<id>/
  SKILL.md            技能正文（frontmatter: name == id, description）—— 永远是安装的第一个文件
  skill.yaml          市场元数据（不随技能安装）
  references/ scripts/ assets/ …   技能自带的资源（可选）
  tests/              技能自己的测试（不打包）
shared/               被多个技能共用的资源（单一事实来源）
catalog/bundles/<id>.yaml   套装：一次安装多个技能
scripts/              校验 / 构建 / 安全扫描 / 同步工具（scripts/lib/ 为可测纯逻辑）
test/                 工具的单元测试（node:test）；test/python/ 为共享 python 检查器的测试
.claude-plugin/marketplace.json   Claude Code 插件市场清单（自动生成，勿手改）
docs/CONTRACT.md      index.json 的对外契约
docs/migration/       PaperBell 4.6.1 → 5.0.3 手工迁移说明（AI 辅助版见 skills/paperbell-migrate）
```

### skill.yaml

```yaml
id: tables-to-workbook          # == 目录名 == SKILL.md 的 name
version: 1.0.0                  # 每个技能独立 semver；改了任何打包文件就必须 bump
title:       { en: ..., zh: ... }
description: { en: ..., zh: ... }
tier: core                      # core（官方维护）| community
agents: [claude-code, github-copilot, openai-codex, gemini-cli]   # 省略 = 全部 agent
requires: []                    # 依赖的其它技能 id，安装时先装
shared: [references, scripts]   # shared/ 下的路径，装到技能目录内同一相对路径
minPluginVersion: 0.5.0         # 可选
free: false                     # true = 免费用户也能装（默认 false）
tags: [formatting]
readme: README.md               # 可选：市场详情页用的 README（不随技能安装）
```

**不打包**的文件：`skill.yaml` 本身、`readme`、`tests/`、`__pycache__`、所有点文件。

**flat 型 agent**（Cursor / Windsurf / Cline）每个技能只能装一个 `.md`，所以**多于一个文件的技能必须显式列出 `agents`，且只能列目录型 agent**（省略 `agents` 也算包含 flat agent，会被校验拒绝）。

### shared/ 与技能目录里的镜像副本

`shared/` 是共享资源的唯一来源。`skill.yaml` 里声明 `shared: [references]`，意味着 `shared/references/**` 装到 `<技能目录>/references/**`。

为了让"整目录复制"的安装方式（Claude Code 插件市场、`cp -r`、直接 git clone）也能拿到完整、无符号链接的技能，每个技能目录里**提交了一份与 `shared/` 字节一致的镜像副本**：

- 只改 `shared/`，然后运行 `npm run sync` 刷新镜像（也会重新生成 `marketplace.json`）。
- 绝不直接改镜像 —— `npm run validate`（CI 也跑）发现镜像缺失、过期或多余时会报错。
- `index.json` 里这些文件的 `url` 指向 `shared/` 下的源文件，`path` 是在技能目录里的位置（见契约）。
- 改了 `shared/` 里的文件，所有声明它的技能都要 bump 版本（`check-versions --base` 会检查）。

选择"提交副本"而不是符号链接或发布时生成，是因为：仓库里禁止符号链接（Windows 与部分安装路径会丢失），而发布时生成的分支又要额外的推送权限和第二个事实来源；副本的代价只是仓库体积（几十 KB 文本），且由 CI 保证一致。

### Claude Code 插件市场

`.claude-plugin/marketplace.json` 由 `scripts/sync-marketplace.mjs` 从 `skill.yaml` 与 bundles 生成：每个技能一个同名插件，每个套装一个插件（如 `manuscript-formatting` 一次装三个格式技能）。所有插件的 `source` 都是仓库根（`"./"`，`strict: false`），只声明自己的 `skills/<id>` 目录；因为技能目录里已有 shared 镜像，运行时不依赖目录外的文件。注意：Claude Code 市场不区分 `free`，公开仓库里的技能对所有 Claude Code 用户可见。

## 常用命令

```sh
npm ci
npm run validate                 # 严格校验（含镜像 / marketplace 同步检查）
npm run sync                     # 改了 shared/ 或 skill.yaml 之后：刷新镜像 + marketplace.json
npm run check:versions -- --base origin/main   # 改了内容却没 bump 版本？
npm run scan:security            # 扫描技能里会被执行的脚本
npm test                         # node:test 单元测试（test/ 与 skills/*/tests/ 下的 *.test.mjs）
npm run test:python              # test/python/ 与 skills/*/tests/ 下的 python 测试
node scripts/build-index.mjs --tag 0.1.0 --out dist/index.json
```

## 发布

推送 `X.Y.Z`（或预发布 `X.Y.Z-rc.1`）tag 即触发 `release.yml`：校验 → 构建 `dist/index.json`（所有文件 URL 钉在该 tag 上）→ 创建 GitHub release 并附上 `index.json`。带 `-` 的 tag 是 prerelease，不会成为 `releases/latest`。

客户端默认地址：`https://github.com/PaperBell-Org/PaperBell-skills-repo/releases/latest/download/index.json`

## 来源与许可

- 本仓库以 MIT 许可发布（[LICENSE](LICENSE)）。
- `paperbell`、`tables-to-workbook`、`track-changes` 三个技能及 `shared/` 下的 references / scripts / profiles 迁自 [PaperBell-formatting-skills](https://github.com/PaperBell-Org/PaperBell-formatting-skills)（MIT，© Shuang Song），原许可证保存在 `shared/LICENSE` 并随这三个技能安装，来源说明见 `shared/references/ATTRIBUTION.md`。导入时取自该仓库 `decouple-and-split-by-element` 分支的 `b275ac1`（比 `main` 新 5 个提交），**没有保留 git 历史**。如需补回，可在原仓库的克隆里用 [git filter-repo](https://github.com/newren/git-filter-repo) 改写路径后合并：

  ```sh
  git clone -b decouple-and-split-by-element https://github.com/PaperBell-Org/PaperBell-formatting-skills fmt && cd fmt
  git filter-repo \
    --path references --path scripts --path profiles --path tests --path skills \
    --path-rename references/:shared/references/ \
    --path-rename scripts/:shared/scripts/ \
    --path-rename profiles/:shared/profiles/ \
    --path-rename tests/:test/python/
  cd ../PaperBell-skills-repo
  git remote add fmt ../fmt && git fetch fmt
  git merge --allow-unrelated-histories -s ours fmt/decouple-and-split-by-element   # 只接历史，保留当前树
  ```

- `paperbell-academic-writing`、`paperbell-note-conventions` 源自插件内置技能，已按 PaperBell 5.x 的 CIMPO 目录结构重写。

---

## English

The agent-skills market for **PaperBell** (Obsidian). Each release publishes an
`index.json` (schemaVersion 1, see [`docs/CONTRACT.md`](docs/CONTRACT.md)) that
the PaperBell plugin reads to install skills for the user's agent. The repo is
also a Claude Code plugin marketplace:
`/plugin marketplace add PaperBell-Org/PaperBell-skills-repo`.

- A skill is `skills/<id>/SKILL.md` + `skill.yaml` (+ optional resources).
  Resources shared by several skills live once in `shared/`, are declared via
  `shared:` in `skill.yaml`, and install at the same relative path inside the
  skill. Each skill dir also carries a committed, byte-identical mirror of its
  shared files so wholesale-copy installers (Claude Code) get a complete,
  symlink-free skill; edit `shared/` only and run `npm run sync` — CI rejects
  stale mirrors.
- Multi-file skills must list directory agents only; flat agents (Cursor,
  Windsurf, Cline) take single-file skills.
- Every skill and bundle has its own semver; any change to what a skill ships
  requires a bump (`check-versions --base`).
- Contributions add skills via PR; changing existing core skills, `shared/`,
  `scripts/`, `catalog/` or CI needs the `core-change` label. See
  [CONTRIBUTING.md](CONTRIBUTING.md).

MIT © PaperBell-Org. The three formatting skills derive from
PaperBell-formatting-skills (MIT © Shuang Song; see `shared/LICENSE` and
`shared/references/ATTRIBUTION.md`).
