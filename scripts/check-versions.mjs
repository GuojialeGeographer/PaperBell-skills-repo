#!/usr/bin/env node
// Version gate.
//
//   node scripts/check-versions.mjs                     # every skill.yaml / bundle has semver
//   node scripts/check-versions.mjs --base origin/main  # + anything changed vs base got a bump
//
// With --base, a skill whose packaged files (its own files, or the shared/
// resources it declares) changed since the merge-base with <base> must carry a
// different version than it had at <base>; same for a bundle whose yaml changed.
// Uncommitted and untracked files count, so it is useful locally too.

import { execFileSync } from 'node:child_process';
import YAML from 'yaml';
import { ROOT, getArg } from './lib/cli.mjs';
import { loadRepo, skillFiles } from './lib/repo.mjs';
import { checkSemverAll, findUnbumped } from './lib/versions.mjs';

const git = (args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

const model = loadRepo(ROOT);
const bad = checkSemverAll(model);
if (bad.length) {
  console.error('check-versions: invalid/missing semver version:');
  for (const b of bad) console.error(`  ${b}`);
  process.exit(1);
}

const base = getArg(process.argv.slice(2), 'base');
if (!base || base === true) {
  console.error('check-versions: all skill/bundle versions are valid semver');
  process.exit(0);
}

let mergeBase;
try {
  mergeBase = git(['merge-base', base, 'HEAD']).trim();
} catch (e) {
  console.error(`check-versions: cannot resolve merge-base with "${base}": ${String(e.stderr || e.message).trim()}`);
  process.exit(2);
}

const changed = new Set([
  ...git(['diff', '--name-only', '--no-renames', mergeBase]).split('\n'),
  ...git(['ls-files', '--others', '--exclude-standard']).split('\n'),
].map((s) => s.trim()).filter(Boolean));

function versionAt(ref, file) {
  try {
    return YAML.parse(git(['show', `${ref}:${file}`]))?.version ?? null;
  } catch {
    return null; // absent at base
  }
}

const units = [];
const baseVersions = new Map();
for (const s of model.skills) {
  if (!s.isDir || !s.yaml) continue;
  const key = `skills/${s.id}`;
  const { files } = skillFiles(ROOT, s);
  units.push({ key, version: s.yaml.version, sources: files.map((f) => f.source) });
  baseVersions.set(key, versionAt(mergeBase, `${key}/skill.yaml`));
}
for (const b of model.bundles) {
  if (!b.data) continue;
  units.push({ key: b.file, version: b.data.version, sources: [b.file] });
  baseVersions.set(b.file, versionAt(mergeBase, b.file));
}

const unbumped = findUnbumped({ changed, units, baseVersions });
if (unbumped.length) {
  console.error(`check-versions: content changed vs ${base} without a version bump:`);
  for (const u of unbumped) {
    console.error(`  ${u.key} (still ${u.version})`);
    for (const c of u.changed.slice(0, 10)) console.error(`      ${c}`);
    if (u.changed.length > 10) console.error(`      … and ${u.changed.length - 10} more`);
  }
  console.error('\nBump `version` in the skill.yaml / bundle yaml (and run `npm run sync`).');
  process.exit(1);
}
console.error(`check-versions: ok — ${changed.size} changed path(s) vs ${base}, every touched skill/bundle bumped`);
