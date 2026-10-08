import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { loadRepo } from '../scripts/lib/repo.mjs';
import { planSync, applySync, describePlan } from '../scripts/lib/shared.mjs';
import { buildMarketplace } from '../scripts/lib/marketplace.mjs';
import { tmpRepo, write, addSkill, addBundle, rm } from './helpers.mjs';

test('planSync / applySync bring mirrors in line with shared/', () => {
  const root = tmpRepo();
  try {
    write(root, 'shared/refs/a.md', 'A2');
    write(root, 'shared/refs/deep/b.md', 'B');
    write(root, 'shared/LICENSE', 'MIT');
    addSkill(root, 'alpha', { yaml: { agents: ['claude-code'], shared: ['refs', 'LICENSE'] }, files: { 'refs/a.md': 'A1', 'refs/gone/old.md': 'old' } });

    const plan = planSync(loadRepo(root));
    const lines = describePlan(plan).join('\n');
    assert.match(lines, /refs\/a\.md: differs/);
    assert.match(lines, /refs\/deep\/b\.md: missing mirror/);
    assert.match(lines, /LICENSE: missing mirror/);
    assert.match(lines, /refs\/gone\/old\.md: not in shared/);

    applySync(root, plan);
    assert.deepEqual(planSync(loadRepo(root)), []);
    const dir = path.join(root, 'skills/alpha');
    assert.equal(fs.readFileSync(path.join(dir, 'refs/a.md'), 'utf8'), 'A2');
    assert.equal(fs.readFileSync(path.join(dir, 'refs/deep/b.md'), 'utf8'), 'B');
    assert.ok(!fs.existsSync(path.join(dir, 'refs/gone')), 'empty dirs pruned');
  } finally {
    rm(root);
  }
});

test('marketplace has one plugin per skill and per bundle', () => {
  const root = tmpRepo();
  try {
    addSkill(root, 'alpha', { yaml: { tags: ['t'] } });
    addSkill(root, 'beta', { yaml: { version: '2.0.0' } });
    addBundle(root, 'pack', ['alpha', 'beta']);
    const mp = buildMarketplace(loadRepo(root));
    assert.equal(mp.name, 'paperbell-skills');
    assert.deepEqual(mp.plugins.map((p) => [p.name, p.version, p.skills]), [
      ['alpha', '1.0.0', ['./skills/alpha']],
      ['beta', '2.0.0', ['./skills/beta']],
      ['pack', '1.0.0', ['./skills/alpha', './skills/beta']],
    ]);
    for (const p of mp.plugins) {
      assert.equal(p.source, './');
      assert.equal(p.strict, false);
    }
  } finally {
    rm(root);
  }
});
