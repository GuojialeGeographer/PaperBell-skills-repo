import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hasCoreChangeLabel, scopeViolations } from '../scripts/lib/scope.mjs';

test('hasCoreChangeLabel compares whole names', () => {
  assert.ok(hasCoreChangeLabel('bug,core-change'));
  assert.ok(hasCoreChangeLabel(' Core-Change '));
  assert.ok(!hasCoreChangeLabel('not-core-change'));
  assert.ok(!hasCoreChangeLabel(''));
  assert.ok(!hasCoreChangeLabel(undefined));
});

test('scopeViolations', () => {
  const core = new Set(['paperbell']);
  const lines = [
    'A\tskills/new-skill/SKILL.md', // adding is fine
    'M\tskills/community-skill/SKILL.md', // community skill edits are fine
    'M\tskills/paperbell/SKILL.md', // core skill
    'D\tshared/references/a.md',
    'M\tscripts/validate.mjs',
    'M\t.github/workflows/validate.yml',
    'R100\tcatalog/bundles/a.yaml\tcatalog/bundles/b.yaml',
    'M\t.claude-plugin/marketplace.json', // generated, exempt
    'M\tREADME.md',
    'A\tscripts/new.mjs', // new toolchain code runs in CI — needs the label
    'M\t.security-allowlist.json',
    'A\tskills/paperbell/scripts/x.mjs', // ships inside a core skill
    'A\t.github/workflows/new.yml',
    'R100\tnotes/x.mjs\tshared/scripts/x.mjs', // moved INTO a protected place
    'A\tcatalog/bundles/new-bundle.yaml', // new bundle is fine
  ];
  assert.deepEqual(scopeViolations(lines, (id) => core.has(id)), [
    'M\tskills/paperbell/SKILL.md',
    'D\tshared/references/a.md',
    'M\tscripts/validate.mjs',
    'M\t.github/workflows/validate.yml',
    'R100\tcatalog/bundles/a.yaml\tcatalog/bundles/b.yaml',
    'A\tscripts/new.mjs',
    'M\t.security-allowlist.json',
    'A\tskills/paperbell/scripts/x.mjs',
    'A\t.github/workflows/new.yml',
    'R100\tnotes/x.mjs\tshared/scripts/x.mjs',
  ]);
});
