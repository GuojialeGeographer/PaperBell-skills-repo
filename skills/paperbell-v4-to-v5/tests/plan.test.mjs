// node --test skills/paperbell-v4-to-v5/tests/plan.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { buildPlan, loadMapping, verifyVault, checkOpOrder, isSafeVaultPath, validateOp, GENERATOR_VERSION } from '../scripts/plan.mjs';
import { readFrontmatter } from '../scripts/frontmatter.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PLAN = path.join(HERE, '..', 'scripts', 'plan.mjs');
const V4 = path.join(HERE, 'fixtures', 'v4-vault');
const V5 = path.join(HERE, 'fixtures', 'v5-vault');
const EXPECTED = path.join(HERE, 'fixtures', 'expected-plan.json');
const mapping = loadMapping();

function tmpdir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'pb-v4-to-v5-'));
}

function copyVault(src) {
  const dst = path.join(tmpdir(), 'vault');
  fs.cpSync(src, dst, { recursive: true });
  return dst;
}

function run(args) {
  return spawnSync(process.execPath, [PLAN, ...args], { encoding: 'utf8' });
}

function withoutTime(plan) {
  const { generatedAt, ...rest } = plan;
  return rest;
}

test('golden: plan for the v4 fixture equals expected-plan.json (minus generatedAt)', () => {
  const { plan } = buildPlan(V4, mapping);
  assert.match(plan.generatedAt, /^\d{4}-\d\d-\d\dT/);
  const expected = JSON.parse(fs.readFileSync(EXPECTED, 'utf8'));
  assert.deepEqual(withoutTime(plan), expected);
});

test('CLI writes <vault>/.paperbell/migration/plan.json and touches nothing else', () => {
  const vault = copyVault(V4);
  const before = snapshot(vault);
  const r = run([vault]);
  assert.equal(r.status, 0, r.stderr);
  const out = path.join(vault, '.paperbell', 'migration', 'plan.json');
  const plan = JSON.parse(fs.readFileSync(out, 'utf8'));
  assert.deepEqual(withoutTime(plan), JSON.parse(fs.readFileSync(EXPECTED, 'utf8')));
  const after = snapshot(vault);
  delete after['.paperbell/migration/plan.json'];
  assert.deepEqual(after, before);
});

test('contract header and op whitelist', () => {
  const { plan } = buildPlan(V4, mapping);
  assert.equal(plan.schemaVersion, 1);
  assert.equal(plan.kind, 'paperbell-migration');
  assert.equal(plan.source, 'paperbell-v4');
  assert.equal(plan.target, 'paperbell-v5');
  assert.match(plan.generator, /^paperbell-v4-to-v5@\d+\.\d+\.\d+$/);
  const allowed = new Set(['moveFolder', 'moveFile', 'rewritePathPrefix', 'patchFrontmatter', 'updateJson', 'setCimpoFolders']);
  for (const op of plan.ops) {
    assert.ok(allowed.has(op.op), op.op);
    validateOp(op);
  }
  for (const r of plan.needsReview) assert.deepEqual(Object.keys(r).sort(), ['id', 'message']);
  for (const a of plan.needsAgent) assert.deepEqual(Object.keys(a).sort(), ['file', 'kind', 'message']);
});

test('ops are in contract order: move* → rewritePathPrefix → patchFrontmatter → updateJson/setCimpoFolders', () => {
  const { plan } = buildPlan(V4, mapping);
  assert.ok(checkOpOrder(plan.ops));
  const kinds = [...new Set(plan.ops.map((o) => (o.op.startsWith('move') ? 'move' : o.op)))];
  assert.deepEqual(kinds, ['move', 'rewritePathPrefix', 'patchFrontmatter', 'updateJson', 'setCimpoFolders']);
  assert.equal(plan.ops.at(-1).op, 'setCimpoFolders');
  assert.deepEqual(plan.ops.at(-1).folders, {
    concepts: '10 - Cards', inputs: '20 - Inputs', metadata: '30 - Metadata', projects: '40 - Projects', outputs: '50 - Outputs',
  });
});

test('every path is vault-relative, forward-slashed, without ".." segments', () => {
  const { plan } = buildPlan(V4, mapping);
  const paths = [];
  for (const op of plan.ops) {
    for (const k of ['from', 'to', 'file']) if (op[k] !== undefined) paths.push(op[k]);
    if (op.folders) paths.push(...Object.values(op.folders));
  }
  for (const a of plan.needsAgent) paths.push(a.file);
  assert.ok(paths.length > 20);
  for (const p of paths) {
    assert.ok(isSafeVaultPath(p), p);
    assert.ok(!p.split('/').includes('..'), p);
  }
  assert.equal(isSafeVaultPath('../etc'), false);
  assert.equal(isSafeVaultPath('/abs'), false);
  assert.equal(isSafeVaultPath('a\\b'), false);
});

test('folder mapping: parent-first moves, pandoc nested move uses the post-move path', () => {
  const { plan } = buildPlan(V4, mapping);
  const moves = plan.ops.filter((o) => o.op === 'moveFolder').map((o) => `${o.from} -> ${o.to}`);
  assert.ok(moves.indexOf('40 - Obsidian -> 00 - Obsidian') < moves.indexOf('00 - Obsidian/脚本/pandoc -> 00 - Obsidian/pandoc'));
  for (const m of ['Cards -> 10 - Cards', 'Inputs -> 20 - Inputs', 'Persons/Scholars -> 30 - Metadata/Scholars',
    'Locations/Institutes -> 30 - Metadata/Institutes', '00 - 每日日记/DailyNote -> 30 - Metadata/DailyNote',
    'Drafts -> 50 - Outputs/Drafts', 'Outputs -> 50 - Outputs/Longform', 'Projects/ABSESpy -> 40 - Projects/ABSESpy']) {
    assert.ok(moves.includes(m), m);
  }
  const files = plan.ops.filter((o) => o.op === 'moveFile').map((o) => `${o.from} -> ${o.to}`);
  assert.ok(files.includes('Projects/ABSESpy.md -> 40 - Projects/ABSESpy/ABSESpy.md'));
  assert.ok(files.includes('Projects/PaperBell.md -> 40 - Projects/PaperBell/PaperBell.md'));
  assert.ok(files.includes('Persons/00. 学者列表.base -> 30 - Metadata/00. 学者列表.base'));
  const rewrites = plan.ops.filter((o) => o.op === 'rewritePathPrefix').map((o) => o.from);
  assert.ok(rewrites.indexOf('40 - Obsidian/脚本/pandoc') < rewrites.indexOf('40 - Obsidian'), 'specific prefix first');
});

test('needsReview: unknown top folder, Locations/Places, Inputs/Links, project subfolder without home note', () => {
  const { plan } = buildPlan(V4, mapping);
  const ids = plan.needsReview.map((r) => r.id);
  assert.deepEqual(ids.sort(), [
    'project-subfolder:Projects/Misc',
    'unknown-child:Locations/Places',
    'unknown-top-folder:Archive',
    'v5-missing-folder:Inputs/Links',
  ]);
  // no patches for notes whose destination is undecided
  assert.ok(!plan.ops.some((o) => o.op === 'patchFrontmatter' && o.file.includes('Links')));
  assert.ok(!plan.ops.some((o) => o.op === 'moveFolder' && o.from === 'Archive'));
});

test('decisions resolve every review item and the plan stays consistent', () => {
  const dir = tmpdir();
  const decisionsFile = path.join(dir, 'decisions.json');
  fs.writeFileSync(decisionsFile, JSON.stringify({
    decisions: {
      'unknown-top-folder:Archive': { action: 'move', to: '50 - Outputs/Archive' },
      'unknown-child:Locations/Places': { action: 'move', to: '30 - Metadata/Places' },
      'project-subfolder:Projects/Misc': { action: 'keep' },
      'v5-missing-folder:Inputs/Links': { action: 'move', to: '20 - Inputs/Clippings' },
    },
  }));
  const out = path.join(dir, 'plan.json');
  const r = run([V4, '--decisions', decisionsFile, '--out', out]);
  assert.equal(r.status, 0, r.stderr);
  const plan = JSON.parse(fs.readFileSync(out, 'utf8'));
  assert.deepEqual(plan.needsReview, []);
  const moves = plan.ops.filter((o) => o.op === 'moveFolder').map((o) => `${o.from} -> ${o.to}`);
  assert.ok(moves.includes('Archive -> 50 - Outputs/Archive'));
  assert.ok(moves.includes('Locations/Places -> 30 - Metadata/Places'));
  assert.ok(moves.includes('20 - Inputs/Links -> 20 - Inputs/Clippings'), 'nested move starts from the post-move location');
  assert.ok(moves.indexOf('Inputs -> 20 - Inputs') < moves.indexOf('20 - Inputs/Links -> 20 - Inputs/Clippings'));
  const rewrites = plan.ops.filter((o) => o.op === 'rewritePathPrefix').map((o) => `${o.from} -> ${o.to}`);
  assert.ok(rewrites.indexOf('Inputs/Links -> 20 - Inputs/Clippings') < rewrites.indexOf('Inputs -> 20 - Inputs'));
  assert.ok(rewrites.includes('Locations/Places -> 30 - Metadata/Places'));
  const linkPatch = plan.ops.find((o) => o.op === 'patchFrontmatter' && o.file === '20 - Inputs/Clippings/文献互助平台 - 科研通(AbleSci.com).md');
  assert.deepEqual(linkPatch, { op: 'patchFrontmatter', file: '20 - Inputs/Clippings/文献互助平台 - 科研通(AbleSci.com).md', unset: ['concepts'], set: { keywords: ['文献下载'] } });
  assert.ok(checkOpOrder(plan.ops));
});

test('frontmatter rules: concepts→keywords with stars → important; concept defaults; institute tag', () => {
  const { plan } = buildPlan(V4, mapping);
  const patch = (f) => plan.ops.find((o) => o.op === 'patchFrontmatter' && o.file === f);
  assert.deepEqual(patch('20 - Inputs/Zotero/song2024c.md'), {
    op: 'patchFrontmatter', file: '20 - Inputs/Zotero/song2024c.md', unset: ['concepts'], set: { keywords: ['corr:2'] },
  }, '⭐⭐ dropped; important already true so untouched');
  assert.deepEqual(patch('20 - Inputs/Zotero/ortman2015a.md').set, { keywords: ['scale', 'urban', 'to-read', 'city'], important: true },
    'merges existing keywords, unwraps [[city]], 🌟 overrides important:false');
  assert.deepEqual(patch('20 - Inputs/Zotero/tsvetkova2024a.md').setIfMissing, { important: true }, '⭐ only sets a missing important');
  assert.deepEqual(patch('20 - Inputs/Zotero/Song2019b.md').set, { keywords: [] });
  assert.equal(patch('20 - Inputs/Books/逃避主义.md'), undefined);
  assert.deepEqual(patch('10 - Cards/Concepts/多主体模型.md').setIfMissing, { category: 'concept', featured: false });
  assert.deepEqual(patch('10 - Cards/Concepts/科研项目.md').setIfMissing, { featured: false }, 'existing category kept');
  assert.deepEqual(patch('30 - Metadata/Institutes/中山大学.md').set, { tags: ['institute'] });
});

test('banner / embed path strings are left to rewritePathPrefix (40 - Obsidian → 00 - Obsidian)', () => {
  const { plan } = buildPlan(V4, mapping);
  assert.ok(plan.ops.some((o) => o.op === 'rewritePathPrefix' && o.from === '40 - Obsidian' && o.to === '00 - Obsidian'));
  // the fixture really has both kinds of reference
  const draft = fs.readFileSync(path.join(V4, 'Drafts', '草稿测试.md'), 'utf8');
  assert.match(draft, /^banner: 40 - Obsidian\/img\/x\.png$/m);
  assert.match(draft, /!\[\[40 - Obsidian\/img\/x\.png\]\]/);
});

test('updateJson: config paths rewritten, labels and caches left alone, dotted keys go to needsAgent', () => {
  const { plan } = buildPlan(V4, mapping);
  const set = (f) => (plan.ops.find((o) => o.op === 'updateJson' && o.file === f) || {}).set;
  assert.deepEqual(set('.obsidian/daily-notes.json'), { folder: '30 - Metadata/DailyNote', template: '00 - Obsidian/模板/每日日记模板' });
  const t = set('.obsidian/plugins/templater-obsidian/data.json');
  assert.equal(t.templates_folder, '00 - Obsidian/模板');
  assert.equal(t['folder_templates.2.folder'], '40 - Projects');
  assert.equal(t['folder_templates.3.folder'], '30 - Metadata/Scholars');
  assert.equal(set('.obsidian/plugins/obsidian-map-view/data.json')['markerIconRules.0.query'], 'tag:#institute');
  const tg = set('.obsidian/plugins/obsidian-task-progress-bar/data.json');
  assert.equal(tg.dailyNotePath, '30 - Metadata/DailyNote');
  assert.equal(tg['reviewSettings.PaperBell.reviewedTaskIds.0'], '40 - Projects/PaperBell/PaperBell.md-L24');
  assert.ok(!Object.keys(tg).some((k) => k.startsWith('enhancedProjectData')), 'cache skipped');
  assert.ok(!Object.keys(tg).some((k) => k.startsWith('viewConfiguration')), 'label "Projects" not a path');
  const ws = set('.obsidian/workspaces.json');
  assert.ok(!Object.values(ws).includes('40 - Projects'), 'workspace title untouched');
  assert.equal(set('.obsidian/workspace.json'), undefined, 'workspace.json skipped');
  assert.ok(plan.needsAgent.some((a) => a.kind === 'json-manual' && a.file === '.obsidian/plugins/zotlit/data.json'));
});

test('needsAgent covers projects, scholars, templates, bases, plugins', () => {
  const { plan } = buildPlan(V4, mapping);
  const kinds = (f) => plan.needsAgent.filter((a) => a.file === f).map((a) => a.kind).sort();
  assert.deepEqual(kinds('40 - Projects/ABSESpy/ABSESpy.md'), ['code-path-strings', 'project-acronym', 'project-milestones', 'project-stage', 'project-workload']);
  assert.deepEqual(kinds('40 - Projects/PaperBell/PaperBell.md'), ['project-acronym', 'project-concepts', 'project-funds', 'project-stage', 'project-workload']);
  const stage = plan.needsAgent.find((a) => a.kind === 'project-stage' && a.file.endsWith('PaperBell.md'));
  assert.match(stage.message, /stage=进行, type=开发/);
  assert.ok(plan.needsAgent.some((a) => a.kind === 'scholar-profile' && a.file === '30 - Metadata/Scholars/宋爽.md'));
  assert.ok(plan.needsAgent.some((a) => a.kind === 'templates'));
  assert.ok(plan.needsAgent.some((a) => a.kind === 'plugins' && /obsidian-dynamic-toc/.test(a.message) && /paperbell-project-manager/.test(a.message)));
  assert.ok(plan.needsAgent.some((a) => a.kind === 'base-file' && a.file === '30 - Metadata/00. 学者列表.base'));
});

test('refuses a vault that is not v4 (exit 2, clear message)', () => {
  const r = run([V5]);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /不是 PaperBell v4 库/);
  assert.match(r.stderr, /--verify/);
  const notVault = tmpdir();
  const r2 = run([notVault]);
  assert.equal(r2.status, 2);
  assert.match(r2.stderr, /\.obsidian/);
});

test('flags a vault that already has v5 folders and colliding destinations', () => {
  const vault = copyVault(V4);
  fs.mkdirSync(path.join(vault, '20 - Inputs', 'Zotero'), { recursive: true });
  fs.writeFileSync(path.join(vault, '20 - Inputs', 'Zotero', 'song2024c.md'), '---\ntitle: dup\n---\n');
  const { plan } = buildPlan(vault, mapping);
  const ids = plan.needsReview.map((r) => r.id);
  assert.ok(ids.includes('partial-v5:20 - Inputs'));
  assert.ok(ids.includes('conflict:20 - Inputs/Zotero/song2024c.md'));
});

test('symlinks are never followed', { skip: process.platform === 'win32' }, () => {
  const vault = copyVault(V4);
  const outside = tmpdir();
  fs.mkdirSync(path.join(outside, 'secret'));
  fs.writeFileSync(path.join(outside, 'secret', 'x.md'), '---\nconcepts: [a]\n---\n');
  fs.symlinkSync(path.join(outside, 'secret'), path.join(vault, 'Inputs', 'linked'));
  const { plan } = buildPlan(vault, mapping);
  assert.ok(!JSON.stringify(plan).includes('linked'));
});

test('verify: clean v5 fixture passes', () => {
  const res = verifyVault(V5, mapping);
  assert.deepEqual(res.errors, []);
  assert.deepEqual(res.warnings, []);
  const r = run([V5, '--verify']);
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

test('verify: leftovers fail with exit 1', () => {
  const vault = copyVault(V5);
  fs.mkdirSync(path.join(vault, 'Persons', 'Scholars'), { recursive: true });
  fs.writeFileSync(path.join(vault, 'Persons', 'Scholars', '武旭同.md'), '---\nname: 武旭同\n---\n');
  fs.mkdirSync(path.join(vault, '00 - 每日日记'));
  fs.writeFileSync(path.join(vault, '50 - Outputs', 'Drafts', '旧.md'),
    '---\nbanner: 40 - Obsidian/img/x.png\n---\n\n![[40 - Obsidian/img/x.png]] [[Inputs/Zotero/song2024c]]\n\n```dataviewjs\ndv.pages(\'"Inputs/Zotero"\')\n```\n');
  fs.writeFileSync(path.join(vault, '10 - Cards', '旧.base'), 'filters:\n  and:\n    - file.inFolder("Cards/Concepts")\n');
  const res = verifyVault(vault, mapping);
  const kinds = res.errors.map((e) => e.kind).sort();
  assert.deepEqual(kinds, ['base-v4-path', 'broken-v4-link', 'broken-v4-link', 'frontmatter-v4-path', 'leftover-v4-folder']);
  assert.ok(res.warnings.some((w) => w.kind === 'empty-v4-folder' && w.path === '00 - 每日日记'));
  assert.ok(res.warnings.some((w) => w.kind === 'code-v4-path'));
  const r = run([vault, '--verify', '--json']);
  assert.equal(r.status, 1);
  assert.equal(JSON.parse(r.stdout).ok, false);
});

test('frontmatter reader handles the shapes Obsidian writes', () => {
  const src = [
    '---',
    'title: "A: b \\"q\\""',
    "single: 'it''s'",
    'tags: [paper, "project/X"]',
    'list:',
    '- a',
    '- 2',
    'nested:',
    '  - task: one',
    '    done: true',
    '  - task: two',
    'empty:',
    'flag: False',
    'date: 2025-03-01',
    'block: |',
    '  line 1',
    '  line 2',
    'url: https://x.org/a#b',
    'note: text # comment',
    '---',
    'body',
  ].join('\n');
  const { data, body, error } = readFrontmatter(src);
  assert.equal(error, null);
  assert.equal(body, 'body');
  assert.deepEqual(data, {
    title: 'A: b "q"', single: "it's", tags: ['paper', 'project/X'], list: ['a', 2],
    nested: [{ task: 'one', done: true }, { task: 'two' }], empty: null, flag: false, date: '2025-03-01',
    block: 'line 1\nline 2', url: 'https://x.org/a#b', note: 'text',
  });
  assert.deepEqual(readFrontmatter('no frontmatter').data, null);
  assert.deepEqual(readFrontmatter('---\n---\nx').data, {});
});

function snapshot(root) {
  const out = {};
  const walk = (rel) => {
    for (const name of fs.readdirSync(path.join(root, rel))) {
      const r = rel ? `${rel}/${name}` : name;
      const st = fs.lstatSync(path.join(root, r));
      if (st.isDirectory()) walk(r);
      else out[r] = fs.readFileSync(path.join(root, r)).toString('base64');
    }
  };
  walk('');
  return out;
}

test('GENERATOR_VERSION matches skill.yaml (skill.yaml is not installed, so plan.mjs carries its own copy)', () => {
  const y = fs.readFileSync(path.join(HERE, '..', 'skill.yaml'), 'utf8');
  const m = /^version:\s*["']?([^"'\s#]+)/m.exec(y);
  assert.equal(GENERATOR_VERSION, m && m[1]);
});
