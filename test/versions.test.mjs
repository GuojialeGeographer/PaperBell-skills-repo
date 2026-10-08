import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isSemver, isPrerelease } from '../scripts/lib/version.mjs';
import { findUnbumped, checkSemverAll } from '../scripts/lib/versions.mjs';

test('isSemver', () => {
  for (const v of ['0.0.1', '1.2.3', '1.0.0-rc.1', '1.0.0+build.5', '10.20.30-alpha-1']) assert.ok(isSemver(v), v);
  for (const v of ['1.0', 'v1.0.0', '01.0.0', '1.0.0-', '', null, 1, '1.0.0.0']) assert.ok(!isSemver(v), String(v));
  assert.ok(isPrerelease('0.1.0-dev'));
  assert.ok(!isPrerelease('0.1.0'));
});

test('checkSemverAll', () => {
  const model = {
    skills: [
      { id: 'a', isDir: true, yaml: { version: '1.0.0' } },
      { id: 'b', isDir: true, yaml: { version: '1' } },
      { id: 'c', isDir: true, yaml: null },
    ],
    bundles: [{ file: 'catalog/bundles/p.yaml', data: { version: 'x' } }],
  };
  assert.equal(checkSemverAll(model).length, 3);
});

test('findUnbumped', () => {
  const units = [
    { key: 'skills/a', version: '1.0.0', sources: ['skills/a/SKILL.md', 'shared/refs/x.md'] },
    { key: 'skills/b', version: '1.1.0', sources: ['skills/b/SKILL.md'] },
    { key: 'skills/new', version: '1.0.0', sources: ['skills/new/SKILL.md'] },
    { key: 'skills/c', version: '2.0.0', sources: ['skills/c/SKILL.md'] },
  ];
  const baseVersions = new Map([
    ['skills/a', '1.0.0'],
    ['skills/b', '1.0.0'],
    ['skills/new', null],
    ['skills/c', '2.0.0'],
  ]);
  const changed = new Set(['shared/refs/x.md', 'skills/b/SKILL.md', 'skills/new/SKILL.md', 'README.md']);
  const out = findUnbumped({ changed, units, baseVersions });
  assert.deepEqual(out, [{ key: 'skills/a', version: '1.0.0', changed: ['shared/refs/x.md'] }]);
});
