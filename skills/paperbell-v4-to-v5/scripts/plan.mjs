#!/usr/bin/env node
// paperbell-v4-to-v5 — build a migration plan (docs/CONTRACT.md §2, schemaVersion 1)
// for a PaperBell 4.x vault, or verify a migrated 5.x vault.
//
//   node plan.mjs <vaultPath> [--out <path>|-] [--decisions <path>] [--json]
//   node plan.mjs <vaultPath> --verify [--json]
//
// Zero dependencies, Node >= 20. Read-only on the vault except for writing the plan
// (default <vault>/.paperbell/migration/plan.json). Never follows symlinks.
// All rules come from ../references/mapping.json.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFrontmatter, splitFrontmatter } from './frontmatter.mjs';

const SKILL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const P = path.posix;

// ---------------------------------------------------------------------------
// mapping / version

export function loadMapping(file = path.join(SKILL_DIR, 'references', 'mapping.json')) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

// skill.yaml is not installed with the skill, so the version lives here too;
// tests/plan.test.mjs asserts the two stay equal.
export const GENERATOR_VERSION = '1.0.0';

export function generatorId() {
  return `paperbell-v4-to-v5@${GENERATOR_VERSION}`;
}

// ---------------------------------------------------------------------------
// path helpers

export function isSafeVaultPath(p) {
  if (typeof p !== 'string' || p === '') return false;
  if (p.includes('\\') || p.includes('\0')) return false;
  if (p.startsWith('/') || /^[A-Za-z]:/.test(p)) return false;
  return p.split('/').every((seg) => seg !== '' && seg !== '.' && seg !== '..');
}

function assertSafe(p, what) {
  if (!isSafeVaultPath(p)) throw new Error(`unsafe vault path for ${what}: ${JSON.stringify(p)}`);
  return p;
}

function under(p, folder) {
  return p === folder || p.startsWith(folder + '/');
}

/** Apply the longest matching folder rule ({from,to}) to a path; null if none matches. */
function applyFolderRules(p, rules) {
  let best = null;
  for (const r of rules) {
    if (under(p, r.from) && (!best || r.from.length > best.from.length)) best = r;
  }
  return best ? best.to + p.slice(best.from.length) : null;
}

const byCodeUnit = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

// ---------------------------------------------------------------------------
// vault scan (no symlinks, no dot-entries, no ignored junk)

export function scanVault(root, ignoreNames) {
  const files = new Set();
  const dirs = new Set();
  const ignore = new Set(ignoreNames);
  const walk = (rel) => {
    const abs = rel ? path.join(root, rel) : root;
    let names;
    try { names = fs.readdirSync(abs); } catch { return; }
    names.sort(byCodeUnit);
    for (const name of names) {
      if (name.startsWith('.') || ignore.has(name)) continue;
      const childRel = rel ? `${rel}/${name}` : name;
      let st;
      try { st = fs.lstatSync(path.join(root, childRel)); } catch { continue; }
      if (st.isSymbolicLink()) continue;
      if (st.isDirectory()) { dirs.add(childRel); walk(childRel); }
      else if (st.isFile()) files.add(childRel);
    }
  };
  walk('');
  return { files, dirs };
}

function listJsonConfigs(root, skipFiles) {
  const out = [];
  const obs = path.join(root, '.obsidian');
  const isFile = (abs) => { try { const s = fs.lstatSync(abs); return s.isFile() && !s.isSymbolicLink(); } catch { return false; } };
  const isDir = (abs) => { try { const s = fs.lstatSync(abs); return s.isDirectory() && !s.isSymbolicLink(); } catch { return false; } };
  if (!isDir(obs)) return out;
  for (const name of fs.readdirSync(obs).sort(byCodeUnit)) {
    if (name.endsWith('.json') && isFile(path.join(obs, name))) out.push(`.obsidian/${name}`);
  }
  const plugins = path.join(obs, 'plugins');
  if (isDir(plugins)) {
    for (const id of fs.readdirSync(plugins).sort(byCodeUnit)) {
      if (!isDir(path.join(plugins, id))) continue;
      if (isFile(path.join(plugins, id, 'data.json'))) out.push(`.obsidian/plugins/${id}/data.json`);
    }
  }
  return out.filter((f) => !skipFiles.includes(f));
}

function readText(root, rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

// ---------------------------------------------------------------------------
// small value helpers

function toList(v) {
  if (v === null || v === undefined || v === '') return [];
  return Array.isArray(v) ? v : [v];
}

function normTag(t) {
  return String(t).trim().replace(/^#/, '');
}

function tagsOf(fm) {
  return toList(fm.tags).filter((t) => t !== null).map(normTag);
}

function unwrapLink(v) {
  if (typeof v !== 'string') return v;
  const m = /^\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]*)?\]\]$/.exec(v.trim());
  return m ? m[1].trim() : v;
}

function hasNonEmpty(v) {
  if (v === null || v === undefined) return false;
  if (typeof v === 'string') return v.trim() !== '';
  if (Array.isArray(v)) return v.some((x) => hasNonEmpty(x));
  return true;
}

function show(v) {
  if (v === undefined) return '∅';
  return typeof v === 'string' ? v : JSON.stringify(v);
}

// ---------------------------------------------------------------------------
// detection

export function detectVersion(root, mapping) {
  const exists = (rel) => { try { return fs.lstatSync(path.join(root, rel)).isDirectory(); } catch { return false; } };
  const v4 = mapping.detect.v4Markers.filter(exists);
  const v5 = mapping.detect.v5Markers.filter(exists);
  return { v4, v5, isV4: v4.length > 0 };
}

// ---------------------------------------------------------------------------
// plan

export function buildPlan(root, mapping, { decisions = {}, now = new Date() } = {}) {
  const det = detectVersion(root, mapping);
  if (!det.isV4) {
    const err = new Error(
      det.v5.length
        ? `这不是 PaperBell v4 库：没有任何 v4 标记（${mapping.detect.v4Markers.join(' / ')}），却已有 v5 文件夹（${det.v5.join(', ')}）。已迁移的库请用 --verify。`
        : `这不是 PaperBell v4 库：没有找到任何 v4 标记（${mapping.detect.v4Markers.join(' / ')}）。`,
    );
    err.code = 'NOT_V4';
    throw err;
  }

  const tree = scanVault(root, mapping.ignoreNames);
  const isDir = (p) => tree.dirs.has(p);
  const exists = (p) => tree.dirs.has(p) || tree.files.has(p);
  const childrenOf = (dir) => {
    const out = { dirs: [], files: [] };
    const prefix = dir ? dir + '/' : '';
    for (const d of tree.dirs) if (d.startsWith(prefix) && !d.slice(prefix.length).includes('/')) out.dirs.push(d.slice(prefix.length));
    for (const f of tree.files) if (f.startsWith(prefix) && !f.slice(prefix.length).includes('/')) out.files.push(f.slice(prefix.length));
    out.dirs.sort(byCodeUnit); out.files.sort(byCodeUnit);
    return out;
  };

  const needsReview = [];
  const needsAgent = [];
  const usedDecisions = new Set();
  const pending = []; // v4 paths whose destination is undecided: no patches inside
  const folderRules = []; // {from (v4), to (v5)}
  const fileRules = []; // {from (v4), to (v5)}

  const decide = (id, message, v4path, allowed) => {
    const d = decisions[id];
    if (d && allowed.includes(d.action)) {
      usedDecisions.add(id);
      if (d.action === 'move') assertSafe(d.to, `decision ${id}`);
      return d;
    }
    const hint = allowed.includes('move')
      ? `（在 decisions.json 里写 {"${id}": {"action": "move", "to": "<v5 路径>"}} 或 {"action": "keep"}，然后重跑 plan.mjs）`
      : allowed.includes('accept')
        ? `（确认后在 decisions.json 写 {"${id}": {"action": "accept"}}，然后重跑 plan.mjs）`
        : '（需先在库里手动处理，再重跑 plan.mjs）';
    needsReview.push({ id, message: message + hint });
    if (v4path) pending.push(v4path);
    return null;
  };

  // 1. mapped whole-folder moves
  for (const r of mapping.folderMoves) {
    if (isDir(r.from)) folderRules.push({ from: r.from, to: r.to });
  }

  // 2. top level
  const keep = new Set(mapping.keepTopLevel.names);
  const mappedFrom = new Set(mapping.folderMoves.map((r) => r.from));
  const v5Names = new Set(mapping.detect.v5Markers);
  const top = childrenOf('');
  for (const name of top.dirs) {
    if (keep.has(name) || mappedFrom.has(name)) continue;
    if (mapping.splitFolders[name]) { planSplit(name); continue; }
    if (name === mapping.projects.from) { planProjects(); continue; }
    if (v5Names.has(name)) {
      decide(`partial-v5:${name}`,
        `库里已经有 v5 文件夹「${name}」（像是迁移做了一半，或手动建过）。迁移会把 v4 内容合并进去；同名文件会在下方另列冲突。确认继续合并吗？`,
        null, ['accept']);
      continue;
    }
    const d = decide(`unknown-top-folder:${name}`,
      `顶层文件夹「${name}」不在 v4 映射里，迁到哪？可以保留原位（keep），或移进某个 CIMPO 文件夹（move，例如 20 - Inputs/${name} 或 50 - Outputs/${name}）。`,
      name, ['move', 'keep']);
    if (d && d.action === 'move') folderRules.push({ from: name, to: d.to });
  }

  function planSplit(parent) {
    const cfg = mapping.splitFolders[parent];
    const kids = childrenOf(parent);
    for (const c of kids.dirs) {
      const rel = `${parent}/${c}`;
      if (mappedFrom.has(rel)) continue;
      const rc = (cfg.reviewChildren || {})[c];
      const suggested = rc ? rc.suggestedTo : `${mapping.cimpoFolders.metadata}/${c}`;
      const msg = rc
        ? `「${rel}」：${rc.message}`
        : `「${rel}」不在 v4 映射里。建议迁到 ${suggested}（move），或保留原位（keep）。`;
      const d = decide(`unknown-child:${rel}`, msg, rel, ['move', 'keep']);
      if (d && d.action === 'move') folderRules.push({ from: rel, to: d.to });
    }
    for (const f of kids.files) {
      const rel = `${parent}/${f}`;
      if (f.endsWith('.base') && cfg.baseFilesTo) { fileRules.push({ from: rel, to: `${cfg.baseFilesTo}/${f}` }); continue; }
      const d = decide(`loose-file:${rel}`,
        `文件「${rel}」直接放在 ${parent}/ 下，v5 没有对应位置。建议迁到 ${mapping.cimpoFolders.metadata}/${f}（move），或保留原位（keep）。`,
        rel, ['move', 'keep']);
      if (d && d.action === 'move') fileRules.push({ from: rel, to: d.to });
    }
  }

  function planProjects() {
    const { from, to } = mapping.projects;
    const kids = childrenOf(from);
    const mdNames = new Set(kids.files.filter((f) => f.endsWith('.md')).map((f) => f.slice(0, -3)));
    for (const f of kids.files) {
      const rel = `${from}/${f}`;
      if (f.endsWith('.md')) { const n = f.slice(0, -3); fileRules.push({ from: rel, to: `${to}/${n}/${n}.md` }); continue; }
      if (f.endsWith('.base')) { fileRules.push({ from: rel, to: `${to}/${f}` }); continue; }
      const d = decide(`project-loose-file:${rel}`,
        `「${rel}」不是项目主页（.md）也不是 .base。v5 每个项目一个文件夹：建议移进对应项目文件夹（move，例如 ${to}/<项目>/${f}），或迁到 ${to}/${f}。`,
        rel, ['move', 'keep']);
      if (d && d.action === 'move') fileRules.push({ from: rel, to: d.to });
    }
    for (const c of kids.dirs) {
      const rel = `${from}/${c}`;
      if (mdNames.has(c)) { folderRules.push({ from: rel, to: `${to}/${c}` }); continue; }
      const d = decide(`project-subfolder:${rel}`,
        `「${rel}」没有同名的项目主页 ${from}/${c}.md。v5 要求 ${to}/<显示名>/<显示名>.md。建议迁到 ${to}/${c}（move，之后补一个 ${c}.md 主页），或保留原位（keep）。`,
        rel, ['move', 'keep']);
      if (d && d.action === 'move') folderRules.push({ from: rel, to: d.to });
    }
  }

  // 3. folders that v5 dropped (e.g. Inputs/Links): moved with their parent unless decided
  for (const r of mapping.postMoveReview) {
    if (!isDir(r.path)) continue;
    const d = decide(`v5-missing-folder:${r.path}`, `「${r.path}」：${r.message}`, r.path, ['move', 'keep']);
    if (d && d.action === 'move') folderRules.push({ from: r.path, to: d.to });
    if (d && d.action === 'keep') { /* follows its parent */ }
  }

  // validate + final-path function
  for (const r of [...folderRules, ...fileRules]) {
    assertSafe(r.from, 'move.from'); assertSafe(r.to, 'move.to');
    if (under(r.to, r.from)) throw new Error(`move target is inside its source: ${r.from} -> ${r.to}`);
  }
  for (const fr of fileRules) {
    if (applyFolderRules(fr.from, folderRules) !== null) throw new Error(`file rule inside a moved folder: ${fr.from}`);
  }
  const fileRuleMap = new Map(fileRules.map((r) => [r.from, r.to]));
  const finalPath = (p) => fileRuleMap.get(p) ?? applyFolderRules(p, folderRules) ?? p;
  const isPending = (p) => pending.some((x) => under(p, x));

  // 4. collisions in the simulated end state
  const finalOwners = new Map();
  for (const f of [...tree.files].sort(byCodeUnit)) {
    const fp = finalPath(f);
    if (!finalOwners.has(fp)) finalOwners.set(fp, []);
    finalOwners.get(fp).push(f);
  }
  for (const [fp, owners] of finalOwners) {
    if (owners.length < 2) continue;
    decide(`conflict:${fp}`,
      `迁移后会有多个文件落到同一路径「${fp}」：${owners.join('、')}。请先在库里重命名或合并其中之一。`,
      null, []);
  }
  for (const r of folderRules) {
    if (exists(r.to) && !tree.dirs.has(r.to)) {
      decide(`conflict:${r.to}`, `目标「${r.to}」已存在且是文件，不能把文件夹「${r.from}」迁过去。`, null, []);
    }
  }

  // 5. ops: moves (parent-first; each `from` is where the folder is at that moment)
  const ops = [];
  const sortedFolderRules = [...folderRules].sort((a, b) => a.from.split('/').length - b.from.split('/').length || byCodeUnit(a.from, b.from));
  const emitted = [];
  for (const r of sortedFolderRules) {
    const cur = applyFolderRules(r.from, emitted) ?? r.from;
    ops.push({ op: 'moveFolder', from: cur, to: r.to });
    emitted.push(r);
  }
  for (const r of [...fileRules].sort((a, b) => byCodeUnit(a.from, b.from))) {
    ops.push({ op: 'moveFile', from: r.from, to: r.to });
  }

  // 6. rewritePathPrefix: every known v4 folder -> final v5 location, most specific first
  const rewriteRules = rewriteTable(mapping, folderRules);
  for (const r of rewriteRules) ops.push({ op: 'rewritePathPrefix', from: r.from, to: r.to });

  // 7. per-note frontmatter patches + note-level needsAgent
  const v4Prefixes = v4PrefixList(mapping);
  const codeRe = codeStringRegex(v4Prefixes);
  const rules = mapping.frontmatterRules;
  const na = mapping.needsAgentRules;
  const patchOps = [];
  for (const f of [...tree.files].sort(byCodeUnit)) {
    if (!f.endsWith('.md') || isPending(f)) continue;
    const fp = finalPath(f);
    let text;
    try { text = readText(root, f); } catch { continue; }
    const { data, body, error } = readFrontmatter(text);
    const ruleTouches = rules.some((r) => fp.startsWith(r.match.pathPrefix)) || fp.startsWith(na.projectPathPrefix) || fp.startsWith(na.scholarPathPrefix);
    if (error && ruleTouches) {
      needsAgent.push({ kind: 'frontmatter-unparsed', file: fp, message: `frontmatter 解析失败（${error}），没有生成补丁；请手动检查这篇笔记是否需要 v5 字段调整。` });
    }
    if (data) {
      const patch = patchFor(fp, data, rules);
      if (patch) patchOps.push({ op: 'patchFrontmatter', file: fp, ...patch });
      needsAgent.push(...noteAgentItems(fp, data, na));
    }
    if (!mapping.codeStringCheck.excludePrefixes.some((x) => fp.startsWith(x))) {
      const hits = codeHits(body, codeRe);
      if (hits.length) {
        const examples = [...new Set(hits)].slice(0, 3).map((s) => `"${s}" → "${mapString(s, rewriteRules, fileRules, mapping) ?? '?'}"`);
        needsAgent.push({
          kind: 'code-path-strings',
          file: fp,
          message: `正文代码/查询字符串里有 ${hits.length} 处 v4 路径（rewritePathPrefix 不改代码）。例：${examples.join('；')}。v4 专用脚本（project_participants、timeline_milestones 等）在 v5 已删除，相关代码块应换成 v5 模板里的写法。`,
        });
      }
    }
  }
  ops.push(...patchOps);

  // 8. config JSON
  const jsonOps = [];
  for (const file of listJsonConfigs(root, mapping.json.skipFiles)) {
    let obj;
    try { obj = JSON.parse(readText(root, file)); } catch (e) {
      needsAgent.push({ kind: 'json-unparsed', file, message: `无法解析 JSON（${e.message}），没有检查其中的 v4 路径。` });
      continue;
    }
    const skipKeys = mapping.json.skipKeyPaths[file] || [];
    const replaces = mapping.json.stringReplace.filter((r) => r.file === file);
    const set = {};
    walkJson(obj, [], (keys, value) => {
      if (skipKeys.some((k) => keys.join('.') === k || keys.join('.').startsWith(k + '.'))) return;
      let nv = value;
      for (const r of replaces) nv = nv.split(r.find).join(r.replace);
      const mapped = mapString(nv, rewriteRules, fileRules, mapping, keys);
      if (mapped !== null) nv = mapped;
      if (nv === value) return;
      const expressible = keys.every((k) => typeof k === 'number' || (k !== '' && !k.includes('.') && !/^\d+$/.test(k)));
      if (!expressible) {
        needsAgent.push({ kind: 'json-manual', file, message: `键 ${JSON.stringify(keys)} 含 "." 等无法用点路径表达的字符：请手动把 ${JSON.stringify(value)} 改为 ${JSON.stringify(nv)}。` });
        return;
      }
      set[keys.join('.')] = nv;
    });
    if (Object.keys(set).length) jsonOps.push({ op: 'updateJson', file, set });
  }
  ops.push(...jsonOps);
  ops.push({ op: 'setCimpoFolders', folders: pick(mapping.cimpoFolders, ['concepts', 'inputs', 'metadata', 'projects', 'outputs']) });

  // 9. vault-level needsAgent
  needsAgent.push(...vaultAgentItems(root, mapping, tree, finalPath));

  for (const op of ops) validateOp(op);

  const unused = Object.keys(decisions).filter((k) => !usedDecisions.has(k));

  return {
    plan: {
      schemaVersion: 1,
      kind: 'paperbell-migration',
      source: 'paperbell-v4',
      target: 'paperbell-v5',
      generatedAt: now.toISOString(),
      generator: generatorId(),
      needsReview,
      needsAgent,
      ops,
    },
    detection: det,
    unusedDecisions: unused,
  };
}

function pick(obj, keys) {
  const out = {};
  for (const k of keys) out[k] = obj[k];
  return out;
}

export function rewriteTable(mapping, folderRules) {
  const map = new Map();
  for (const r of mapping.folderMoves) map.set(r.from, r.to);
  // Projects/ is not moved as a whole (each X.md gets its own folder), but a string such as
  // "Projects/" in a Task Genius setting or a "Projects/…" base filter still means 40 - Projects.
  map.set(mapping.projects.from, mapping.projects.to);
  for (const r of folderRules) map.set(r.from, r.to);
  return [...map].map(([from, to]) => ({ from, to })).sort((a, b) => b.from.length - a.from.length || byCodeUnit(a.from, b.from));
}

/** v4 path prefixes worth flagging when they still appear after migration. */
export function v4PrefixList(mapping) {
  const s = new Set();
  for (const r of mapping.folderMoves) s.add(r.from);
  for (const k of Object.keys(mapping.splitFolders)) s.add(k);
  s.add(mapping.projects.from);
  for (const a of mapping.json.exactAliases) s.add(a.from);
  return [...s].sort((a, b) => b.length - a.length || byCodeUnit(a, b));
}

function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function codeStringRegex(prefixes) {
  return new RegExp(`(["'])((?:${prefixes.map(escapeRe).join('|')})(?:/[^"'\\n]*)?)\\1`, 'g');
}

function codeHits(body, re) {
  const out = [];
  re.lastIndex = 0;
  let m;
  while ((m = re.exec(body))) out.push(m[2]);
  return out;
}

/**
 * True when a JSON value at `keys` may hold a bare folder name. "Projects" under
 * `folder_templates.2.folder` is a path; "Projects" under `…state.title` is a label.
 */
export function pathishKey(keys) {
  if (!keys) return true;
  const named = keys.filter((k) => typeof k === 'string');
  const last = named[named.length - 1] ?? '';
  return /folder|path|dir|location|template|file|capture/i.test(last);
}

/**
 * Map a JSON/code string that is (or starts with) a v4 path. Returns null if it is not one.
 * A bare folder name with no "/" (e.g. "Projects") is only mapped when `keys` is null
 * (a code string literal) or names a path-like setting, or when it is a numbered v4
 * folder such as "40 - Obsidian" that cannot be an ordinary word.
 */
export function mapString(v, rewriteRules, fileRules, mapping, keys = null) {
  if (typeof v !== 'string' || v === '') return null;
  const bareOk = pathishKey(keys) || / - /.test(v);
  for (const a of mapping.json.exactAliases) if (v === a.from && bareOk) return a.to;
  for (const fr of fileRules) {
    if (v === fr.from) return fr.to;
    if (v.startsWith(fr.from) && !/[\w./]/.test(v[fr.from.length])) return fr.to + v.slice(fr.from.length);
    if (fr.from.endsWith('.md') && fr.to.endsWith('.md') && v === fr.from.slice(0, -3)) return fr.to.slice(0, -3);
  }
  if (!v.includes('/') && !bareOk) return null;
  return applyFolderRules(v, rewriteRules);
}

function walkJson(v, keys, visit) {
  if (typeof v === 'string') { visit(keys, v); return; }
  if (Array.isArray(v)) { v.forEach((x, i) => walkJson(x, [...keys, i], visit)); return; }
  if (v && typeof v === 'object') for (const k of Object.keys(v)) walkJson(v[k], [...keys, k], visit);
}

// ---------------------------------------------------------------------------
// frontmatter rules

export function patchFor(fp, fm, rules) {
  const set = {};
  const unset = [];
  const setIfMissing = {};
  for (const rule of rules) {
    if (!fp.startsWith(rule.match.pathPrefix)) continue;
    if (rule.match.hasKey && !(rule.match.hasKey in fm)) continue;
    if (rule.match.tagOrFolder) {
      const { tag, folder } = rule.match.tagOrFolder;
      if (!tagsOf(fm).includes(tag) && !fp.startsWith(folder)) continue;
    }
    if (rule.action === 'conceptsToKeywords') {
      const isStar = (x) => typeof x === 'string' && rule.starChars.some((c) => x.includes(c));
      const items = toList(fm.concepts).filter((x) => x !== null && x !== '').map(unwrapLink);
      const stars = items.filter(isStar);
      const keep = items.filter((x) => !isStar(x));
      const keywords = toList(fm.keywords).filter((x) => x !== null && x !== '');
      const seen = new Set(keywords.map((x) => String(x)));
      for (const k of keep) if (!seen.has(String(k))) { keywords.push(k); seen.add(String(k)); }
      unset.push('concepts');
      set.keywords = keywords;
      if (stars.some((x) => x.includes('🌟'))) set.important = true;
      else if (stars.length && !('important' in fm)) setIfMissing.important = true;
    } else if (rule.action === 'setIfMissing') {
      for (const [k, v] of Object.entries(rule.values)) if (!(k in fm)) setIfMissing[k] = v;
    } else if (rule.action === 'replaceTag') {
      const tags = tagsOf(fm);
      if (!tags.includes(rule.fromTag)) continue;
      const out = [];
      for (const t of tags) { const n = t === rule.fromTag ? rule.toTag : t; if (!out.includes(n)) out.push(n); }
      set.tags = out;
    } else {
      throw new Error(`unknown frontmatter action ${rule.action}`);
    }
  }
  const patch = {};
  if (unset.length) patch.unset = unset;
  if (Object.keys(set).length) patch.set = set;
  if (Object.keys(setIfMissing).length) patch.setIfMissing = setIfMissing;
  return Object.keys(patch).length ? patch : null;
}

function noteAgentItems(fp, fm, na) {
  const out = [];
  const tags = tagsOf(fm);
  if (fp.startsWith(na.projectPathPrefix) && tags.includes(na.projectIndexTag)) {
    const status = fm.status === undefined || fm.status === null ? null : String(fm.status).trim();
    const phase = typeof fm.phase === 'string' ? fm.phase.trim() : null;
    const type = typeof fm.type === 'string' ? fm.type.trim() : null;
    const hasStage = typeof fm.stage === 'string' && fm.stage.trim() !== '';
    const typeOk = type !== null && na.v5ProjectTypes.includes(type);
    if (!hasStage || status !== null || phase !== null || !typeOk) {
      const stage = hasStage ? fm.stage.trim() : (phase && na.legacyPhaseToStage[phase]) || (status && na.legacyStatusToStage[status]) || '?';
      const newType = typeOk ? type : type === '软件' ? '开发' : '?';
      out.push({
        kind: 'project-stage',
        file: fp,
        message: `status=${show(fm.status)}, phase=${show(fm.phase)}, type=${show(fm.type)} → 需映射为 v5 type（${na.v5ProjectTypes.join('/')}）/ stage（${na.v5Stages.join('/')}）；建议 stage=${stage}, type=${newType}，删除 status/phase。`,
      });
    }
    if (!hasNonEmpty(fm.acronym)) {
      const id = typeof fm.project === 'string' ? fm.project.trim() : '';
      const ok = /^[A-Za-z][A-Za-z0-9_-]*$/.test(id);
      const display = P.basename(P.dirname(fp));
      out.push({
        kind: 'project-acronym',
        file: fp,
        message: `缺 acronym。v4 的 project=${show(fm.project)} 是项目 ID；v5 中 project=显示名（${display}），acronym=缩写（字母开头，仅字母数字-_）。${ok ? `建议 acronym=${id}，` : '需和用户确定缩写，'}并在 tags 加 project/<acronym>。`,
      });
    }
    const w = typeof fm.workload === 'number' ? fm.workload : Number(fm.workload);
    if (fm.workload !== undefined && fm.workload !== null && Number.isFinite(w) && w >= 1 && w <= 5) {
      out.push({ kind: 'project-workload', file: fp, message: `workload=${w} 是 v4 的 1–5 档；v5 是每周投入小时数（1–40）。问用户每周大约投入几小时。` });
    }
    if (Array.isArray(fm.milestones) && fm.milestones.length) {
      const done = fm.milestones.filter((m) => m && typeof m === 'object' && m.done === true).length;
      out.push({ kind: 'project-milestones', file: fp, message: `frontmatter 里有 ${fm.milestones.length} 个 milestones（已完成 ${done}）。v5 用正文待办：- [x] 任务 #milestone #project/<acronym> 📅 日期；转换后删除 milestones 键。` });
    }
    const concepts = toList(fm.concepts).filter((x) => x !== null && x !== '');
    if (concepts.length && concepts.some((x) => typeof x !== 'string' || !/^\[\[.*\]\]$/.test(x.trim()))) {
      out.push({ kind: 'project-concepts', file: fp, message: `concepts=${show(fm.concepts)} 是纯文本。v5 项目：keywords=挂靠关键词（纯文本），concepts=锚定的精选概念（"[[概念卡]]"）。和用户确认哪些进 keywords、哪些对应概念卡。` });
    }
    if (hasNonEmpty(fm.funds)) {
      out.push({ kind: 'project-funds', file: fp, message: `funds=${show(fm.funds)}。v5 项目不记 funds：在 30 - Metadata/Grants/ 为每笔资助建一篇带 grant 标签的笔记，写 project: "[[${P.basename(fp, '.md')}]]"，然后删除 funds。` });
    }
  }
  if (fp.startsWith(na.scholarPathPrefix)) {
    const keys = na.scholarProfileKeys.filter((k) => hasNonEmpty(fm[k]));
    if (keys.length) {
      out.push({ kind: 'scholar-profile', file: fp, message: `有 ${keys.join('/')}（v5 学者模板已不含）。v5 用 keywords 记研究方向：和用户确认是否从 ${keys.join('/')} 提炼 keywords；原字段可保留或移入正文。` });
    }
  }
  return out;
}

function vaultAgentItems(root, mapping, tree, finalPath) {
  const out = [];
  const na = mapping.needsAgentRules;
  const t = mapping.templates;
  if (tree.dirs.has('40 - Obsidian/模板')) {
    const present = [...tree.files].filter((f) => f.startsWith('40 - Obsidian/模板/')).map((f) => f.slice('40 - Obsidian/模板/'.length));
    const critical = t.critical.filter((x) => present.includes(x));
    out.push({
      kind: 'templates',
      file: na.templateFolder,
      message: `${na.templateFolder} 里仍是 v4 模板（${present.length} 个）。从官方 v5 发行版复制替换：必须换 ${critical.join('、') || t.critical.join('、')}（zt-field.eta.md 不换，新导入的 Zotero 笔记还会写 concepts）；v5 新增 ${t.added.join('、')}；v5 已删除 ${t.removed.join('、')}。主页：${t.homepage.changed.join('、')} 有新版，${t.homepage.removed.join('、')} 已删除。用户改过的模板先 diff 再合并。`,
    });
  }
  const bases = [...tree.files].filter((f) => f.endsWith('.base')).map(finalPath).filter((fp) => !fp.startsWith(na.templateFolder + '/')).sort(byCodeUnit);
  for (const fp of bases) {
    const v5 = mapping.baseFiles.v5.includes(fp);
    out.push({
      kind: 'base-file',
      file: fp,
      message: v5
        ? `这是 v4 版本的 .base；v5 同名文件的筛选与字段（stage/keywords/featured）都变了，建议用官方 v5 版本替换（用户自定义过的视图先合并）。`
        : `v4 的 .base 视图，rewritePathPrefix 已改写带引号的 "<v4>" 与 "<v4>/…" 路径；请检查拼接出来的路径或非引号写法是否仍指向 v4。`,
    });
  }
  const missingV5Bases = mapping.baseFiles.v5.filter((b) => !bases.includes(b));
  if (missingV5Bases.length) {
    out.push({ kind: 'base-file', file: missingV5Bases[0], message: `v5 新增的视图，库里没有：${missingV5Bases.join('、')}。从官方 v5 发行版复制。` });
  }
  // plugins
  let enabled = [];
  try { enabled = JSON.parse(readText(root, '.obsidian/community-plugins.json')); } catch { /* none */ }
  if (!Array.isArray(enabled)) enabled = [];
  const rm = mapping.plugins.removed.filter((p) => enabled.includes(p.id));
  const add = mapping.plugins.added.filter((p) => !enabled.includes(p.id));
  out.push({
    kind: 'plugins',
    file: '.obsidian/community-plugins.json',
    message: `v5 插件变化。建议停用/移除：${rm.map((p) => `${p.id}（${p.why}）`).join('、') || '无'}。需安装：${add.map((p) => `${p.name}（${p.id}，${p.why}）`).join('、') || '无'}。需升级：${mapping.plugins.upgraded.map((p) => p.id + (p.minVersion ? ` ≥${p.minVersion}` : '')).join('、')}。`,
  });
  // folders v5 expects that the migration will not create
  const finalTop = new Set([...tree.files, ...tree.dirs].map((p) => finalPath(p)).flatMap((p) => { const parts = p.split('/'); return [parts[0], parts.slice(0, 2).join('/')]; }));
  const want = [...Object.values(pick(mapping.cimpoFolders, ['concepts', 'inputs', 'metadata', 'projects', 'outputs'])), `${mapping.cimpoFolders.metadata}/Grants`];
  const missing = want.filter((f) => !finalTop.has(f));
  if (missing.length) {
    out.push({ kind: 'create-folders', file: missing[0], message: `迁移后这些 v5 文件夹仍不存在：${missing.join('、')}。在 Obsidian 里新建（空文件夹即可；Grants 用于资助笔记）。` });
  }
  return out;
}

// ---------------------------------------------------------------------------
// op validation (mirror of the contract whitelist)

const JSON_FILE_RE = /^\.obsidian\/(?:[^/]+\.json|plugins\/[^/]+\/data\.json)$/;

export function validateOp(op) {
  switch (op.op) {
    case 'moveFolder':
    case 'moveFile':
    case 'rewritePathPrefix':
      assertSafe(op.from, `${op.op}.from`); assertSafe(op.to, `${op.op}.to`); return;
    case 'patchFrontmatter':
      assertSafe(op.file, 'patchFrontmatter.file');
      if (!op.set && !op.unset && !op.setIfMissing) throw new Error(`empty patch for ${op.file}`);
      return;
    case 'updateJson':
      if (!JSON_FILE_RE.test(op.file) || !isSafeVaultPath(op.file)) throw new Error(`updateJson file not allowed: ${op.file}`);
      return;
    case 'setCimpoFolders':
      for (const k of ['concepts', 'inputs', 'metadata', 'projects', 'outputs']) assertSafe(op.folders[k], `setCimpoFolders.${k}`);
      return;
    default:
      throw new Error(`op not in whitelist: ${op.op}`);
  }
}

const KIND_ORDER = { moveFolder: 0, moveFile: 0, rewritePathPrefix: 1, patchFrontmatter: 2, updateJson: 3, setCimpoFolders: 3 };
export function checkOpOrder(ops) {
  let last = -1;
  for (const op of ops) {
    const k = KIND_ORDER[op.op];
    if (k < last) return false;
    last = k;
  }
  return true;
}

// ---------------------------------------------------------------------------
// verify

export function verifyVault(root, mapping) {
  const errors = [];
  const warnings = [];
  const tree = scanVault(root, mapping.ignoreNames);
  const prefixes = v4PrefixList(mapping);
  const startsV4 = (s) => typeof s === 'string' && prefixes.some((p) => s.startsWith(p + '/'));

  // leftover v4 folders
  const reported = [];
  const candidates = [...new Set([...mapping.folderMoves.map((r) => r.from), ...Object.keys(mapping.splitFolders), mapping.projects.from])]
    .sort((a, b) => a.split('/').length - b.split('/').length || byCodeUnit(a, b));
  for (const d of candidates) {
    if (!tree.dirs.has(d) || reported.some((r) => under(d, r))) continue;
    reported.push(d);
    const n = [...tree.files].filter((f) => under(f, d)).length;
    if (n) errors.push({ kind: 'leftover-v4-folder', path: d, message: `v4 文件夹仍有 ${n} 个文件` });
    else warnings.push({ kind: 'empty-v4-folder', path: d, message: '空的 v4 文件夹，可以删除' });
  }
  for (const f of Object.values(pick(mapping.cimpoFolders, ['concepts', 'inputs', 'metadata', 'projects', 'outputs']))) {
    if (!tree.dirs.has(f)) warnings.push({ kind: 'missing-cimpo-folder', path: f, message: 'CIMPO 文件夹不存在' });
  }

  const codeRe = codeStringRegex(prefixes);
  const resolves = (target) => tree.files.has(target) || tree.files.has(target + '.md') || tree.dirs.has(target);
  for (const f of [...tree.files].sort(byCodeUnit)) {
    if (f.endsWith('.md')) {
      let text;
      try { text = readText(root, f); } catch { continue; }
      const { data, body } = readFrontmatter(text);
      if (data) {
        walkJson(data, [], (keys, v) => {
          if (startsV4(v)) errors.push({ kind: 'frontmatter-v4-path', path: f, message: `${keys.join('.')}: ${v}` });
        });
      }
      const noCode = body.replace(/^(```|~~~)[^\n]*\n[\s\S]*?^\1[^\n]*$/gm, '').replace(/`[^`\n]*`/g, '');
      for (const target of linkTargets(noCode)) {
        if (startsV4(target) && !resolves(target)) errors.push({ kind: 'broken-v4-link', path: f, message: target });
        else if (target.includes('/') && !resolves(target) && Object.values(mapping.cimpoFolders).some((c) => target.startsWith(c + '/'))) {
          warnings.push({ kind: 'broken-link', path: f, message: target });
        }
      }
      const hits = codeHits(body, codeRe);
      if (hits.length) warnings.push({ kind: 'code-v4-path', path: f, message: [...new Set(hits)].slice(0, 5).join(', ') });
    } else if (f.endsWith('.base') || f.endsWith('.canvas')) {
      let text;
      try { text = readText(root, f); } catch { continue; }
      const hits = codeHits(text, codeRe);
      if (hits.length) errors.push({ kind: 'base-v4-path', path: f, message: [...new Set(hits)].slice(0, 5).join(', ') });
    }
  }

  for (const file of listJsonConfigs(root, mapping.json.skipFiles)) {
    let obj;
    try { obj = JSON.parse(readText(root, file)); } catch { continue; }
    const skipKeys = mapping.json.skipKeyPaths[file] || [];
    walkJson(obj, [], (keys, v) => {
      const kp = keys.join('.');
      if (skipKeys.some((k) => kp === k || kp.startsWith(k + '.'))) return;
      if (startsV4(v) || (prefixes.includes(v) && (pathishKey(keys) || / - /.test(v)))) warnings.push({ kind: 'json-v4-path', path: file, message: `${kp}: ${v}` });
    });
  }
  return { ok: errors.length === 0, errors, warnings };
}

function linkTargets(text) {
  const out = [];
  const wiki = /!?\[\[([^\]|#^\n]+)(?:[#^][^\]|\n]*)?(?:\|[^\]\n]*)?\]\]/g;
  let m;
  while ((m = wiki.exec(text))) out.push(m[1].trim());
  const md = /!?\[[^\]\n]*\]\(<?([^)\s>]+)>?(?:\s+"[^"]*")?\)/g;
  while ((m = md.exec(text))) {
    let t = m[1];
    if (/^[a-z][a-z0-9+.-]*:/i.test(t) || t.startsWith('#')) continue;
    t = t.replace(/#.*$/, '');
    try { t = decodeURIComponent(t); } catch { /* keep raw */ }
    out.push(t);
  }
  return out;
}

// ---------------------------------------------------------------------------
// CLI

function parseArgs(argv) {
  const args = { vault: null, out: null, verify: false, json: false, decisions: null, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--verify') args.verify = true;
    else if (a === '--json') args.json = true;
    else if (a === '--out') args.out = argv[++i];
    else if (a === '--decisions') args.decisions = argv[++i];
    else if (a === '-h' || a === '--help') args.help = true;
    else if (a.startsWith('--')) throw new Error(`unknown option ${a}`);
    else if (!args.vault) args.vault = a;
    else throw new Error(`unexpected argument ${a}`);
  }
  return args;
}

const USAGE = `usage: node plan.mjs <vaultPath> [--out <path>|-] [--decisions <path>] [--json]
       node plan.mjs <vaultPath> --verify [--json]`;

function loadDecisions(file) {
  if (!file || !fs.existsSync(file)) return {};
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  const d = raw && typeof raw === 'object' && raw.decisions && typeof raw.decisions === 'object' ? raw.decisions : raw;
  const out = {};
  for (const [k, v] of Object.entries(d || {})) {
    if (v && typeof v === 'object' && typeof v.action === 'string') out[k] = v;
  }
  return out;
}

export function main(argv = process.argv.slice(2)) {
  let args;
  try { args = parseArgs(argv); } catch (e) { console.error(`${e.message}\n${USAGE}`); return 2; }
  if (args.help || !args.vault) { console.log(USAGE); return args.help ? 0 : 2; }
  const root = path.resolve(args.vault);
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) { console.error(`vault not found: ${root}`); return 2; }
  if (!fs.existsSync(path.join(root, '.obsidian'))) {
    const hint = fs.existsSync(path.join(root, 'PaperBell', '.obsidian')) ? `（是不是应该指向 ${path.join(root, 'PaperBell')}？）` : '';
    console.error(`不是 Obsidian 库根目录：${root} 下没有 .obsidian/${hint}`);
    return 2;
  }
  const mapping = loadMapping();

  if (args.verify) {
    const res = verifyVault(root, mapping);
    if (args.json) console.log(JSON.stringify(res, null, 2));
    else {
      for (const e of res.errors) console.log(`ERROR  ${e.kind}  ${e.path}  ${e.message}`);
      for (const w of res.warnings) console.log(`warn   ${w.kind}  ${w.path}  ${w.message}`);
      console.log(`\n${res.ok ? 'OK' : 'FAILED'}: ${res.errors.length} error(s), ${res.warnings.length} warning(s)`);
    }
    return res.ok ? 0 : 1;
  }

  const decisionsFile = args.decisions ? path.resolve(args.decisions) : path.join(root, '.paperbell', 'migration', 'decisions.json');
  let result;
  try {
    result = buildPlan(root, mapping, { decisions: loadDecisions(decisionsFile) });
  } catch (e) {
    console.error(e.message);
    return 2;
  }
  const { plan } = result;
  const text = JSON.stringify(plan, null, 2) + '\n';
  let outPath = null;
  if (args.out !== '-') {
    outPath = args.out ? path.resolve(args.out) : path.join(root, '.paperbell', 'migration', 'plan.json');
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, text);
  }
  if (args.json || args.out === '-') process.stdout.write(text);
  else {
    const count = {};
    for (const op of plan.ops) count[op.op] = (count[op.op] || 0) + 1;
    console.log(`PaperBell v4 → v5 migration plan  (v4 markers: ${result.detection.v4.join(', ')})`);
    console.log(`ops: ${plan.ops.length}  ${Object.entries(count).map(([k, v]) => `${k}=${v}`).join(' ')}`);
    console.log(`needsReview: ${plan.needsReview.length}   needsAgent: ${plan.needsAgent.length}`);
    for (const r of plan.needsReview) console.log(`  [review] ${r.id}`);
    if (result.unusedDecisions.length) console.log(`unused decisions: ${result.unusedDecisions.join(', ')}`);
    if (outPath) console.log(`written: ${outPath}`);
    if (plan.needsReview.length) console.log('needsReview 非空：插件会拒绝执行，先逐项和用户确认。');
  }
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main();
}
