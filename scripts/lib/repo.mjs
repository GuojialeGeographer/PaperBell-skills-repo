// Loading the repository into a plain model: skills (skill.yaml + SKILL.md
// frontmatter), bundles, and each skill's packaged file list. Loading never
// throws on bad content — problems are recorded so validate.mjs can report all
// of them at once.

import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';

export const SKILLS_DIR = 'skills';
export const SHARED_DIR = 'shared';
export const BUNDLES_DIR = path.join('catalog', 'bundles');

const toPosix = (p) => p.split(path.sep).join('/');

/**
 * Parse the YAML frontmatter of a SKILL.md. Returns { data, error }.
 * The block must open on the first line with `---` and close with a `---` line.
 */
export function parseFrontmatter(text) {
  const src = String(text).replace(/^﻿/, '');
  const m = src.match(/^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/);
  if (!m) return { data: null, error: 'missing YAML frontmatter (--- … ---) at the top of SKILL.md' };
  try {
    const data = YAML.parse(m[1]);
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return { data: null, error: 'frontmatter is not a YAML mapping' };
    }
    return { data, error: null };
  } catch (e) {
    return { data: null, error: `frontmatter YAML error: ${e.message.split('\n')[0]}` };
  }
}

function readYaml(abs) {
  try {
    const data = YAML.parse(fs.readFileSync(abs, 'utf8'));
    if (!data || typeof data !== 'object' || Array.isArray(data)) return { data: null, error: 'not a YAML mapping' };
    return { data, error: null };
  } catch (e) {
    return { data: null, error: `YAML error: ${e.message.split('\n')[0]}` };
  }
}

/**
 * Whether a path (relative, posix) is never packaged: dotfiles/dot-dirs,
 * __pycache__, compiled python, and any `tests/` directory.
 */
export function isExcludedSegmentPath(rel) {
  const segs = rel.split('/');
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i];
    if (s.startsWith('.')) return true;
    if (s === '__pycache__') return true;
    if (s === 'tests' && i < segs.length - 1) return true;
  }
  return /\.py[co]$/.test(rel);
}

/**
 * Recursively list a directory without following symlinks.
 * Returns [{ rel, abs, size, symlink }], rel posix and relative to `absDir`.
 */
export function walk(absDir, base = absDir) {
  if (!fs.existsSync(absDir)) return [];
  const out = [];
  const entries = fs.readdirSync(absDir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1));
  for (const e of entries) {
    const abs = path.join(absDir, e.name);
    const rel = toPosix(path.relative(base, abs));
    if (e.isSymbolicLink()) {
      out.push({ rel, abs, size: 0, symlink: true });
    } else if (e.isDirectory()) {
      out.push(...walk(abs, base));
    } else if (e.isFile()) {
      out.push({ rel, abs, size: fs.statSync(abs).size, symlink: false });
    }
  }
  return out;
}

/** A relative posix path that cannot escape its root. */
export function isSafeRelPath(p) {
  if (typeof p !== 'string' || !p || p.startsWith('/') || p.includes('\\') || /^[A-Za-z]:/.test(p)) return false;
  return p.split('/').every((s) => s !== '' && s !== '.' && s !== '..');
}

/** True when `rel` is `prefix` itself or lies under it. */
export function isUnder(rel, prefix) {
  return rel === prefix || rel.startsWith(prefix + '/');
}

/**
 * Expand a skill's `shared:` entries into files.
 * Returns { files: [{ path, source, abs, size, symlink }], problems: [string] }.
 * `path` is where the file lands inside the installed skill dir, `source` its repo path.
 */
export function expandShared(root, sharedList) {
  const files = [];
  const problems = [];
  for (const entry of sharedList || []) {
    if (!isSafeRelPath(entry)) {
      problems.push(`shared entry ${JSON.stringify(entry)} must be a relative path under shared/ without "..", "." or a leading "/"`);
      continue;
    }
    const abs = path.join(root, SHARED_DIR, entry);
    let st;
    try {
      st = fs.lstatSync(abs);
    } catch {
      problems.push(`shared entry "${entry}" does not exist (expected shared/${entry})`);
      continue;
    }
    if (st.isSymbolicLink()) {
      files.push({ path: entry, source: `${SHARED_DIR}/${entry}`, abs, size: 0, symlink: true });
    } else if (st.isDirectory()) {
      const inner = walk(abs).filter((f) => !isExcludedSegmentPath(f.rel));
      if (!inner.length) problems.push(`shared entry "${entry}" is an empty directory`);
      for (const f of inner) {
        files.push({ path: `${entry}/${f.rel}`, source: `${SHARED_DIR}/${entry}/${f.rel}`, abs: f.abs, size: f.size, symlink: f.symlink });
      }
    } else {
      files.push({ path: entry, source: `${SHARED_DIR}/${entry}`, abs, size: st.size, symlink: false });
    }
  }
  return { files, problems };
}

/**
 * Every file of a skill as it will be installed, SKILL.md first, the rest sorted by path.
 *
 * - Own files: everything under skills/<id>/ except skill.yaml, the market-only
 *   `readme`, excluded paths (dotfiles, __pycache__, tests/), and the committed
 *   mirrors of shared resources (anything under a declared `shared:` path —
 *   those come from shared/ instead, so the index points at the single source).
 * - Shared files: from shared/<entry>, landing at <entry> inside the skill dir.
 *
 * Returns { files: [{ path, source, abs, size, symlink, origin }], mirrors, problems }.
 * `mirrors` are the skill-dir files under shared paths (checked by sync-shared).
 */
export function skillFiles(root, skill) {
  const id = skill.id;
  const y = skill.yaml || {};
  const sharedList = Array.isArray(y.shared) ? y.shared.filter((s) => typeof s === 'string') : [];
  const readme = typeof y.readme === 'string' ? y.readme.replace(/^\.\//, '') : null;
  const skillDir = path.join(root, SKILLS_DIR, id);
  const problems = [];

  const own = [];
  const mirrors = [];
  for (const f of walk(skillDir)) {
    if (f.rel === 'skill.yaml' || f.rel === readme) continue;
    if (isExcludedSegmentPath(f.rel)) continue;
    const entry = { path: f.rel, source: `${SKILLS_DIR}/${id}/${f.rel}`, abs: f.abs, size: f.size, symlink: f.symlink, origin: 'skill' };
    if (sharedList.some((s) => isUnder(f.rel, s))) mirrors.push(entry);
    else own.push(entry);
  }

  const shared = expandShared(root, sharedList);
  problems.push(...shared.problems);
  const sharedFiles = shared.files.map((f) => ({ ...f, origin: 'shared' }));

  const ownPaths = new Set(own.map((f) => f.path));
  for (const f of sharedFiles) {
    if (ownPaths.has(f.path)) problems.push(`shared file "${f.path}" collides with the skill's own file of the same path`);
    if (f.path === 'SKILL.md' || f.path === 'skill.yaml') problems.push(`shared entry may not install over ${f.path}`);
  }

  const all = [...own, ...sharedFiles];
  const skillMd = all.filter((f) => f.path === 'SKILL.md' && f.origin === 'skill');
  const rest = all.filter((f) => !(f.path === 'SKILL.md' && f.origin === 'skill')).sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return { files: [...skillMd, ...rest], mirrors, problems };
}

/** Load all skills and bundles. */
export function loadRepo(root) {
  const skillsRoot = path.join(root, SKILLS_DIR);
  const skills = [];
  if (fs.existsSync(skillsRoot)) {
    for (const e of fs.readdirSync(skillsRoot, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
      if (e.name.startsWith('.')) continue;
      const dir = path.join(skillsRoot, e.name);
      const skill = { id: e.name, dir, isDir: e.isDirectory(), isSymlink: e.isSymbolicLink() };
      if (skill.isDir) {
        const mdPath = path.join(dir, 'SKILL.md');
        const yPath = path.join(dir, 'skill.yaml');
        skill.hasSkillMd = fs.existsSync(mdPath);
        skill.hasYaml = fs.existsSync(yPath);
        if (skill.hasSkillMd) {
          const fm = parseFrontmatter(fs.readFileSync(mdPath, 'utf8'));
          skill.frontmatter = fm.data;
          skill.frontmatterError = fm.error;
        }
        if (skill.hasYaml) {
          const y = readYaml(yPath);
          skill.yaml = y.data;
          skill.yamlError = y.error;
        }
      }
      skills.push(skill);
    }
  }

  const bundlesRoot = path.join(root, BUNDLES_DIR);
  const bundles = [];
  if (fs.existsSync(bundlesRoot)) {
    for (const name of fs.readdirSync(bundlesRoot).sort()) {
      if (name.startsWith('.')) continue;
      const abs = path.join(bundlesRoot, name);
      const b = { file: `${toPosix(BUNDLES_DIR)}/${name}`, fileId: name.replace(/\.ya?ml$/, ''), isYaml: /\.ya?ml$/.test(name) };
      if (b.isYaml) {
        const y = readYaml(abs);
        b.data = y.data;
        b.error = y.error;
      }
      bundles.push(b);
    }
  }
  return { root, skills, bundles };
}
