// Test helpers: build throwaway repos in a temp dir.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import YAML from 'yaml';

export function tmpRepo() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'skills-market-test-'));
}

export function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
  return abs;
}

export function skillMd(name, description = `Does ${name} things.`) {
  return `---\nname: ${name}\ndescription: ${description}\n---\n\n# ${name}\n`;
}

export function skillYaml(id, extra = {}) {
  return YAML.stringify({
    id,
    version: '1.0.0',
    title: { en: `${id} title`, zh: `${id} 标题` },
    description: { en: `${id} description`, zh: `${id} 描述` },
    tier: 'core',
    requires: [],
    free: false,
    tags: [],
    ...extra,
  });
}

/** Add a skill. `files` maps extra relative paths -> content. */
export function addSkill(root, id, { yaml = {}, files = {}, md } = {}) {
  write(root, `skills/${id}/SKILL.md`, md ?? skillMd(id));
  write(root, `skills/${id}/skill.yaml`, skillYaml(id, yaml));
  for (const [rel, content] of Object.entries(files)) write(root, `skills/${id}/${rel}`, content);
}

export function addBundle(root, id, skills, extra = {}) {
  write(
    root,
    `catalog/bundles/${id}.yaml`,
    YAML.stringify({ id, version: '1.0.0', title: { en: 'B', zh: '包' }, description: { en: 'Bundle', zh: '套装' }, skills, ...extra })
  );
}

export function rm(root) {
  fs.rmSync(root, { recursive: true, force: true });
}
