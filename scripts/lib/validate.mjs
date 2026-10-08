// Validation rules over the repo model. Pure apart from reading files the model
// points at; validate.mjs is the CLI around `validateRepo`.

import fs from 'node:fs';
import path from 'node:path';
import {
  AGENTS,
  FLAT_AGENTS,
  TIERS,
  MAX_FILE_BYTES,
  ID_RE,
  SKILL_YAML_KEYS,
  BUNDLE_YAML_KEYS,
} from './constants.mjs';
import { isSemver } from './version.mjs';
import { skillFiles, walk, isSafeRelPath, SKILLS_DIR, SHARED_DIR } from './repo.mjs';
import { planSync, describePlan } from './shared.mjs';
import { buildMarketplace, serializeMarketplace, MARKETPLACE_PATH } from './marketplace.mjs';

const isNonEmptyString = (v) => typeof v === 'string' && v.trim() !== '';
const isStringArray = (v) => Array.isArray(v) && v.every((x) => typeof x === 'string' && x.trim() !== '');

function checkI18n(obj, field, where, errors) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    errors.push(`${where}: \`${field}\` must be a mapping { en, zh }`);
    return;
  }
  for (const lang of ['en', 'zh']) {
    if (!isNonEmptyString(obj[lang])) errors.push(`${where}: \`${field}.${lang}\` must be a non-empty string`);
  }
  for (const k of Object.keys(obj)) if (!['en', 'zh'].includes(k)) errors.push(`${where}: \`${field}\` has unknown language key "${k}"`);
}

/**
 * Find a dependency cycle in `requires`. Returns the cycle as a list of ids
 * (first id repeated at the end) or null.
 */
export function findCycle(graph) {
  const state = new Map(); // id -> 1 visiting, 2 done
  const stack = [];
  const visit = (id) => {
    state.set(id, 1);
    stack.push(id);
    for (const dep of graph.get(id) || []) {
      if (!graph.has(dep)) continue;
      if (state.get(dep) === 1) return [...stack.slice(stack.indexOf(dep)), dep];
      if (!state.has(dep)) {
        const c = visit(dep);
        if (c) return c;
      }
    }
    stack.pop();
    state.set(id, 2);
    return null;
  };
  for (const id of graph.keys()) {
    if (!state.has(id)) {
      const c = visit(id);
      if (c) return c;
    }
  }
  return null;
}

/** Rules on one parsed skill.yaml + frontmatter. Returns errors (strings). */
export function validateSkillMeta(skill) {
  const errors = [];
  const where = `skills/${skill.id}`;
  if (!ID_RE.test(skill.id)) errors.push(`${where}: directory name must be lowercase kebab-case`);
  if (!skill.hasSkillMd) errors.push(`${where}: missing SKILL.md`);
  if (!skill.hasYaml) errors.push(`${where}: missing skill.yaml`);

  if (skill.hasSkillMd) {
    if (skill.frontmatterError) errors.push(`${where}/SKILL.md: ${skill.frontmatterError}`);
    else {
      const fm = skill.frontmatter;
      if (!isNonEmptyString(fm.name)) errors.push(`${where}/SKILL.md: frontmatter needs a \`name\``);
      else if (fm.name !== skill.id) errors.push(`${where}/SKILL.md: frontmatter name "${fm.name}" must equal the directory name "${skill.id}"`);
      if (!isNonEmptyString(fm.description)) errors.push(`${where}/SKILL.md: frontmatter needs a \`description\``);
    }
  }

  if (!skill.hasYaml) return errors;
  if (skill.yamlError) {
    errors.push(`${where}/skill.yaml: ${skill.yamlError}`);
    return errors;
  }
  const y = skill.yaml;
  const yw = `${where}/skill.yaml`;
  for (const k of Object.keys(y)) if (!SKILL_YAML_KEYS.includes(k)) errors.push(`${yw}: unknown key "${k}"`);
  if (y.id !== skill.id) errors.push(`${yw}: id ${JSON.stringify(y.id)} must equal the directory name "${skill.id}"`);
  if (!isSemver(y.version)) errors.push(`${yw}: version ${JSON.stringify(y.version)} is not semver (X.Y.Z, quoted is fine)`);
  checkI18n(y.title, 'title', yw, errors);
  checkI18n(y.description, 'description', yw, errors);
  if (!TIERS.includes(y.tier)) errors.push(`${yw}: tier must be one of ${TIERS.join(' | ')}`);
  if (y.agents !== undefined) {
    if (!isStringArray(y.agents) || y.agents.length === 0) errors.push(`${yw}: agents must be a non-empty list (omit it to mean "all agents")`);
    else {
      for (const a of y.agents) if (!AGENTS.includes(a)) errors.push(`${yw}: unknown agent "${a}" (allowed: ${AGENTS.join(', ')})`);
      if (new Set(y.agents).size !== y.agents.length) errors.push(`${yw}: agents has duplicates`);
    }
  }
  for (const key of ['requires', 'shared', 'tags']) {
    if (y[key] !== undefined && !isStringArray(y[key])) errors.push(`${yw}: \`${key}\` must be a list of strings`);
    else if (y[key] && new Set(y[key]).size !== y[key].length) errors.push(`${yw}: \`${key}\` has duplicates`);
  }
  if (y.minPluginVersion !== undefined && !isSemver(y.minPluginVersion)) errors.push(`${yw}: minPluginVersion ${JSON.stringify(y.minPluginVersion)} is not semver`);
  if (y.free !== undefined && typeof y.free !== 'boolean') errors.push(`${yw}: free must be true or false`);
  if (y.readme !== undefined) {
    const r = typeof y.readme === 'string' ? y.readme.replace(/^\.\//, '') : y.readme;
    if (!isSafeRelPath(r)) errors.push(`${yw}: readme must be a relative path inside the skill dir`);
    else if (!fs.existsSync(path.join(skill.dir, r))) errors.push(`${yw}: readme "${y.readme}" does not exist`);
    else if (r === 'SKILL.md') errors.push(`${yw}: readme defaults to SKILL.md already — drop the key`);
  }
  return errors;
}

/** Agent/file-count rule. `agents` undefined means every agent, flat ones included. */
export function flatAgentConflict(agents, fileCount) {
  if (fileCount <= 1) return [];
  const effective = agents === undefined ? AGENTS : agents;
  return effective.filter((a) => FLAT_AGENTS.includes(a));
}

/**
 * Validate the whole repo. Returns { errors, warnings, files } where `files` maps
 * skill id -> packaged file list (handy for callers).
 */
export function validateRepo(model, { checkSync = true } = {}) {
  const errors = [];
  const warnings = [];
  const filesById = new Map();
  const ids = new Set(model.skills.filter((s) => s.isDir).map((s) => s.id));

  // Repo-wide: no symlinks, no oversized files, anywhere that gets packaged.
  for (const top of [SKILLS_DIR, SHARED_DIR, 'catalog']) {
    for (const f of walk(path.join(model.root, top))) {
      const rel = `${top}/${f.rel}`;
      if (f.symlink) errors.push(`${rel}: symlinks are not allowed (copy the file; shared resources go in shared/)`);
      else if (f.size > MAX_FILE_BYTES && !/(^|\/)(tests|__pycache__)\//.test(rel)) errors.push(`${rel}: ${f.size} bytes exceeds the ${MAX_FILE_BYTES}-byte limit`);
    }
  }

  for (const skill of model.skills) {
    if (skill.isSymlink) {
      errors.push(`skills/${skill.id}: symlinked skill dirs are not allowed`);
      continue;
    }
    if (!skill.isDir) {
      errors.push(`skills/${skill.id}: only directories belong in skills/`);
      continue;
    }
    errors.push(...validateSkillMeta(skill));
    if (!skill.yaml) continue;
    const y = skill.yaml;

    for (const dep of Array.isArray(y.requires) ? y.requires : []) {
      if (dep === skill.id) errors.push(`skills/${skill.id}/skill.yaml: requires itself`);
      else if (!ids.has(dep)) errors.push(`skills/${skill.id}/skill.yaml: requires unknown skill "${dep}"`);
    }

    const { files, problems } = skillFiles(model.root, skill);
    filesById.set(skill.id, files);
    for (const p of problems) errors.push(`skills/${skill.id}: ${p}`);
    if (skill.hasSkillMd && (!files.length || files[0].path !== 'SKILL.md')) errors.push(`skills/${skill.id}: SKILL.md must be packaged as the first file`);
    for (const f of files) {
      if (!isSafeRelPath(f.path)) errors.push(`skills/${skill.id}: unsafe install path "${f.path}"`);
    }
    const flat = Array.isArray(y.agents) || y.agents === undefined ? flatAgentConflict(y.agents, files.length) : [];
    if (flat.length) {
      errors.push(
        `skills/${skill.id}: ships ${files.length} files but ${y.agents === undefined ? 'omits `agents` (= all agents, including' : 'lists'} flat agent(s) ${flat.join(', ')}${y.agents === undefined ? ')' : ''}. Flat agents take a single .md — list only directory agents.`
      );
    }
    if (y.free === undefined) warnings.push(`skills/${skill.id}/skill.yaml: \`free\` not set — defaults to false (Pro only)`);
  }

  // requires graph must be acyclic
  const graph = new Map(model.skills.filter((s) => s.yaml).map((s) => [s.id, Array.isArray(s.yaml.requires) ? s.yaml.requires : []]));
  const cycle = findCycle(graph);
  if (cycle) errors.push(`requires cycle: ${cycle.join(' -> ')}`);

  // bundles
  const bundleIds = new Set();
  for (const b of model.bundles) {
    if (!b.isYaml) {
      errors.push(`${b.file}: bundles are <id>.yaml files`);
      continue;
    }
    if (b.error) {
      errors.push(`${b.file}: ${b.error}`);
      continue;
    }
    const d = b.data;
    for (const k of Object.keys(d)) if (!BUNDLE_YAML_KEYS.includes(k)) errors.push(`${b.file}: unknown key "${k}"`);
    if (d.id !== b.fileId) errors.push(`${b.file}: id ${JSON.stringify(d.id)} must equal the file name "${b.fileId}"`);
    if (!ID_RE.test(String(d.id))) errors.push(`${b.file}: id must be lowercase kebab-case`);
    if (ids.has(d.id)) errors.push(`${b.file}: bundle id "${d.id}" collides with a skill id`);
    if (bundleIds.has(d.id)) errors.push(`${b.file}: duplicate bundle id "${d.id}"`);
    bundleIds.add(d.id);
    if (!isSemver(d.version)) errors.push(`${b.file}: version ${JSON.stringify(d.version)} is not semver`);
    checkI18n(d.title, 'title', b.file, errors);
    checkI18n(d.description, 'description', b.file, errors);
    if (!isStringArray(d.skills) || !d.skills.length) errors.push(`${b.file}: skills must be a non-empty list of skill ids`);
    else {
      for (const s of d.skills) if (!ids.has(s)) errors.push(`${b.file}: unknown skill "${s}"`);
      if (new Set(d.skills).size !== d.skills.length) errors.push(`${b.file}: skills has duplicates`);
    }
  }

  // shared/ files nobody declares are dead weight
  const used = new Set();
  for (const files of filesById.values()) for (const f of files) if (f.origin === 'shared') used.add(f.source);
  for (const f of walk(path.join(model.root, SHARED_DIR))) {
    const src = `${SHARED_DIR}/${f.rel}`;
    if (!used.has(src) && !/(^|\/)(\.|__pycache__)/.test(f.rel)) warnings.push(`${src}: not declared by any skill's \`shared:\``);
  }

  if (checkSync && errors.length === 0) {
    for (const line of describePlan(planSync(model))) errors.push(`${line} — run \`npm run sync\``);
    const mpAbs = path.join(model.root, MARKETPLACE_PATH);
    const want = serializeMarketplace(buildMarketplace(model));
    const have = fs.existsSync(mpAbs) ? fs.readFileSync(mpAbs, 'utf8') : null;
    if (have !== want) errors.push(`${MARKETPLACE_PATH}: out of date with skill.yaml/bundles — run \`npm run sync\``);
  }

  return { errors, warnings, files: filesById };
}
