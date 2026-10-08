// .claude-plugin/marketplace.json is GENERATED from skill.yaml + bundles, so
// the Claude Code marketplace never drifts from index.json.
//
// One plugin per skill (same id) and one per bundle. Every plugin uses the
// repo root as its source with `strict: false` and lists only its own skill
// dirs — Claude Code copies the source wholesale, and each skill dir already
// holds its committed shared/ mirrors (see lib/shared.mjs), so nothing outside
// the skill dir is needed at runtime.

import { REPO } from './constants.mjs';

export const MARKETPLACE_PATH = '.claude-plugin/marketplace.json';
export const MARKETPLACE_NAME = 'paperbell-skills';

export function buildMarketplace(model) {
  const homepage = `https://github.com/${REPO}`;
  const common = { author: { name: 'PaperBell-Org' }, homepage, repository: homepage, license: 'MIT' };
  const skills = model.skills.filter((s) => s.isDir && s.yaml && typeof s.yaml.version === 'string');
  const plugins = skills.map((s) => ({
    name: s.id,
    source: './',
    description: s.yaml.description?.en || '',
    version: s.yaml.version,
    ...common,
    keywords: Array.isArray(s.yaml.tags) ? s.yaml.tags : [],
    strict: false,
    skills: [`./skills/${s.id}`],
  }));
  for (const b of model.bundles) {
    if (!b.data || !Array.isArray(b.data.skills)) continue;
    plugins.push({
      name: b.data.id,
      source: './',
      description: b.data.description?.en || '',
      version: b.data.version,
      ...common,
      keywords: ['bundle'],
      strict: false,
      skills: b.data.skills.map((id) => `./skills/${id}`),
    });
  }
  return {
    name: MARKETPLACE_NAME,
    owner: { name: 'PaperBell-Org' },
    metadata: {
      description:
        'PaperBell agent skills: academic writing, vault conventions, manuscript formatting and vault migration. Generated from skills/*/skill.yaml by scripts/sync-marketplace.mjs — do not edit by hand.',
    },
    plugins,
  };
}

export function serializeMarketplace(obj) {
  return JSON.stringify(obj, null, 2) + '\n';
}
