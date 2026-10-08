// Committed mirrors of shared/ resources inside each skill directory.
//
// shared/ is the single source of truth. Each skill that declares a `shared:`
// entry also carries a byte-identical copy at the same relative path inside
// skills/<id>/, so that tools which copy a skill directory wholesale (Claude
// Code's plugin marketplace, a plain `cp -r`, a git checkout) get a complete,
// symlink-free skill. index.json still points at shared/ for these files.
//
// `planSync` is pure over the repo model; `applySync` performs the plan.

import fs from 'node:fs';
import path from 'node:path';
import { skillFiles, SKILLS_DIR } from './repo.mjs';

/**
 * For every skill: which mirrors are missing, stale (content differs), or extra
 * (under a shared path but no longer in shared/).
 * Returns [{ id, missing: [{path, from}], stale: [{path, from}], extra: [path] }].
 */
export function planSync(model) {
  const plan = [];
  for (const skill of model.skills) {
    if (!skill.isDir || !skill.yaml) continue;
    const { files, mirrors } = skillFiles(model.root, skill);
    const expected = new Map(files.filter((f) => f.origin === 'shared' && !f.symlink).map((f) => [f.path, f]));
    const present = new Map(mirrors.map((m) => [m.path, m]));
    const missing = [];
    const stale = [];
    const extra = [];
    for (const [p, src] of expected) {
      const m = present.get(p);
      if (!m) missing.push({ path: p, from: src.source });
      else if (m.symlink || !fs.readFileSync(m.abs).equals(fs.readFileSync(src.abs))) stale.push({ path: p, from: src.source });
    }
    for (const p of present.keys()) if (!expected.has(p)) extra.push(p);
    if (missing.length || stale.length || extra.length) plan.push({ id: skill.id, missing, stale, extra });
  }
  return plan;
}

export function describePlan(plan) {
  const lines = [];
  for (const s of plan) {
    for (const m of s.missing) lines.push(`skills/${s.id}/${m.path}: missing mirror of ${m.from}`);
    for (const m of s.stale) lines.push(`skills/${s.id}/${m.path}: differs from ${m.from}`);
    for (const p of s.extra) lines.push(`skills/${s.id}/${p}: not in shared/ any more (stale mirror)`);
  }
  return lines;
}

export function applySync(root, plan) {
  for (const s of plan) {
    const dir = path.join(root, SKILLS_DIR, s.id);
    for (const m of [...s.missing, ...s.stale]) {
      const dest = path.join(dir, m.path);
      fs.rmSync(dest, { force: true });
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(path.join(root, m.from), dest);
    }
    for (const p of s.extra) {
      fs.rmSync(path.join(dir, p), { force: true });
      // prune now-empty parent dirs, stopping at the skill dir
      let d = path.dirname(path.join(dir, p));
      while (d.startsWith(dir + path.sep) && fs.existsSync(d) && fs.readdirSync(d).length === 0) {
        fs.rmdirSync(d);
        d = path.dirname(d);
      }
    }
  }
}
