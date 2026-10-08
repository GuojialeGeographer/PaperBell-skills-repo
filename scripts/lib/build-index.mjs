// index.json (schemaVersion 1) — see docs/CONTRACT.md §1. The field order here
// is the contract's order; keep them in step.

import fs from 'node:fs';
import { REPO, SCHEMA_VERSION } from './constants.mjs';
import { sha256 } from './hash.mjs';
import { skillFiles } from './repo.mjs';

export function rawUrl(repo, tag, repoPath) {
  const enc = repoPath.split('/').map(encodeURIComponent).join('/');
  return `https://raw.githubusercontent.com/${repo}/${encodeURIComponent(tag)}/${enc}`;
}

/**
 * Build the index object from a loaded repo model. Assumes the model validated.
 * @param {object} model   loadRepo() result
 * @param {{ tag: string, repo?: string, generatedAt?: string }} opts
 */
export function buildIndex(model, { tag, repo = REPO, generatedAt = new Date().toISOString() }) {
  if (!tag) throw new Error('buildIndex: tag is required');
  const skills = [];
  for (const s of model.skills) {
    if (!s.isDir || !s.yaml) continue;
    const y = s.yaml;
    const { files } = skillFiles(model.root, s);
    const entry = {
      id: s.id,
      version: y.version,
      title: { en: y.title.en, zh: y.title.zh },
      description: { en: y.description.en, zh: y.description.zh },
      tier: y.tier,
    };
    if (Array.isArray(y.agents)) entry.agents = [...y.agents];
    entry.requires = Array.isArray(y.requires) ? [...y.requires] : [];
    if (y.minPluginVersion !== undefined) entry.minPluginVersion = y.minPluginVersion;
    entry.free = y.free === true;
    entry.tags = Array.isArray(y.tags) ? [...y.tags] : [];
    entry.files = files.map((f) => {
      const buf = fs.readFileSync(f.abs);
      return { path: f.path, url: rawUrl(repo, tag, f.source), sha256: sha256(buf), size: buf.length };
    });
    entry.readmeUrl = typeof y.readme === 'string' ? rawUrl(repo, tag, `skills/${s.id}/${y.readme.replace(/^\.\//, '')}`) : null;
    skills.push(entry);
  }
  const bundles = model.bundles
    .filter((b) => b.data)
    .map((b) => ({
      id: b.data.id,
      version: b.data.version,
      title: { en: b.data.title.en, zh: b.data.title.zh },
      description: { en: b.data.description.en, zh: b.data.description.zh },
      skills: [...b.data.skills],
    }));
  return { schemaVersion: SCHEMA_VERSION, generatedAt, repo, tag, skills, bundles };
}
