import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { loadRepo, parseFrontmatter } from '../scripts/lib/repo.mjs';
import { validateRepo, findCycle, flatAgentConflict } from '../scripts/lib/validate.mjs';
import { tmpRepo, write, addSkill, addBundle, skillMd, rm } from './helpers.mjs';

const DIR_AGENTS = ['claude-code', 'openai-codex'];
const run = (root) => validateRepo(loadRepo(root), { checkSync: false });
const has = (errors, re) => errors.some((e) => re.test(e));

function withRepo(fn) {
  const root = tmpRepo();
  try {
    return fn(root);
  } finally {
    rm(root);
  }
}

test('a minimal valid repo passes', () =>
  withRepo((root) => {
    addSkill(root, 'alpha');
    addSkill(root, 'beta', { yaml: { agents: DIR_AGENTS, requires: ['alpha'] }, files: { 'references/x.md': 'x' } });
    addBundle(root, 'pack', ['alpha', 'beta']);
    const { errors } = run(root);
    assert.deepEqual(errors, []);
  }));

test('frontmatter parsing', () => {
  assert.equal(parseFrontmatter(skillMd('a')).data.name, 'a');
  assert.match(parseFrontmatter('# no fm').error, /missing YAML frontmatter/);
  assert.match(parseFrontmatter('---\n: : bad\n---\n').error, /YAML/);
});

test('SKILL.md needs name and description; name == id == dir', () =>
  withRepo((root) => {
    addSkill(root, 'alpha', { md: '---\nname: other\n---\n' });
    addSkill(root, 'beta', { yaml: { id: 'gamma' } });
    const { errors } = run(root);
    assert.ok(has(errors, /alpha\/SKILL\.md: frontmatter name "other" must equal/));
    assert.ok(has(errors, /alpha\/SKILL\.md: frontmatter needs a `description`/));
    assert.ok(has(errors, /beta\/skill\.yaml: id "gamma" must equal/));
  }));

test('missing SKILL.md / skill.yaml are errors', () =>
  withRepo((root) => {
    write(root, 'skills/lonely/SKILL.md', skillMd('lonely'));
    write(root, 'skills/empty/.keep', '');
    const { errors } = run(root);
    assert.ok(has(errors, /skills\/lonely: missing skill\.yaml/));
    assert.ok(has(errors, /skills\/empty: missing SKILL\.md/));
  }));

test('semver, tier, agents, free, unknown keys, i18n', () =>
  withRepo((root) => {
    addSkill(root, 'alpha', {
      yaml: { version: '1.0', tier: 'gold', agents: ['claude-code', 'emacs'], free: 'yes', colour: 'red', title: { en: 'only en' }, minPluginVersion: 'latest' },
    });
    const { errors } = run(root);
    assert.ok(has(errors, /version "1\.0" is not semver/));
    assert.ok(has(errors, /tier must be one of/));
    assert.ok(has(errors, /unknown agent "emacs"/));
    assert.ok(has(errors, /free must be true or false/));
    assert.ok(has(errors, /unknown key "colour"/));
    assert.ok(has(errors, /`title\.zh` must be a non-empty string/));
    assert.ok(has(errors, /minPluginVersion "latest" is not semver/));
  }));

test('requires must resolve and be acyclic', () =>
  withRepo((root) => {
    addSkill(root, 'a', { yaml: { requires: ['b'] } });
    addSkill(root, 'b', { yaml: { requires: ['c'] } });
    addSkill(root, 'c', { yaml: { requires: ['a', 'ghost'] } });
    addSkill(root, 'd', { yaml: { requires: ['d'] } });
    const { errors } = run(root);
    assert.ok(has(errors, /requires unknown skill "ghost"/));
    assert.ok(has(errors, /d\/skill\.yaml: requires itself/));
    assert.ok(has(errors, /requires cycle: (a|b|c) -> /));
  }));

test('findCycle', () => {
  assert.equal(findCycle(new Map([['a', ['b']], ['b', []]])), null);
  assert.deepEqual(findCycle(new Map([['a', ['b']], ['b', ['a']]])), ['a', 'b', 'a']);
  assert.equal(findCycle(new Map([['a', ['missing']]])), null);
});

test('shared paths must exist and be safe', () =>
  withRepo((root) => {
    write(root, 'shared/refs/a.md', 'a');
    addSkill(root, 'alpha', { yaml: { agents: DIR_AGENTS, shared: ['refs', 'nope', '../etc'] } });
    const { errors } = run(root);
    assert.ok(has(errors, /shared entry "nope" does not exist/));
    assert.ok(has(errors, /shared entry "\.\.\/etc" must be a relative path/));
  }));

test('a skill-dir file at a shared path is a mirror, not an own file', () =>
  withRepo((root) => {
    write(root, 'shared/notes.md', 'shared');
    addSkill(root, 'alpha', { yaml: { agents: DIR_AGENTS, shared: ['notes.md'] } });
    // a mirror is fine (identical path under a shared entry is treated as a mirror)
    write(root, 'skills/alpha/notes.md', 'shared');
    assert.deepEqual(run(root).errors, []);
  }));

test('bundles: id == file, semver, known skills, no clash with skill ids', () =>
  withRepo((root) => {
    addSkill(root, 'alpha');
    addBundle(root, 'pack', ['alpha', 'ghost'], { id: 'pack2', version: 'x' });
    addBundle(root, 'alpha', ['alpha']);
    write(root, 'catalog/bundles/readme.txt', 'nope');
    const { errors } = run(root);
    assert.ok(has(errors, /pack\.yaml: id "pack2" must equal the file name "pack"/));
    assert.ok(has(errors, /pack\.yaml: unknown skill "ghost"/));
    assert.ok(has(errors, /pack\.yaml: version "x" is not semver/));
    assert.ok(has(errors, /bundle id "alpha" collides with a skill id/));
    assert.ok(has(errors, /readme\.txt: bundles are <id>\.yaml files/));
  }));

test('multi-file skill may not target flat agents (explicitly or by omission)', () =>
  withRepo((root) => {
    addSkill(root, 'listed', { yaml: { agents: ['claude-code', 'cursor'] }, files: { 'scripts/x.py': 'print(1)\n' } });
    addSkill(root, 'omitted', { files: { 'references/a.md': 'a' } });
    addSkill(root, 'single', { yaml: { agents: ['cursor', 'cline'] } });
    const { errors } = run(root);
    assert.ok(has(errors, /skills\/listed: ships 2 files but lists flat agent\(s\) cursor/));
    assert.ok(has(errors, /skills\/omitted: ships 2 files but omits `agents`/));
    assert.ok(!has(errors, /skills\/single/));
  }));

test('flatAgentConflict', () => {
  assert.deepEqual(flatAgentConflict(['cursor'], 1), []);
  assert.deepEqual(flatAgentConflict(['cursor', 'claude-code'], 2), ['cursor']);
  assert.deepEqual(flatAgentConflict(undefined, 3), ['cursor', 'windsurf', 'cline']);
});

test('excluded files do not count towards the file total', () =>
  withRepo((root) => {
    addSkill(root, 'alpha', {
      yaml: { agents: ['cursor'] },
      files: { 'tests/test_x.py': 'x', '__pycache__/a.pyc': 'x', '.DS_Store': 'x', 'sub/.hidden': 'x' },
    });
    assert.deepEqual(run(root).errors, []);
  }));

test('symlinks and oversized files are rejected', () =>
  withRepo((root) => {
    addSkill(root, 'alpha', { yaml: { agents: DIR_AGENTS }, files: { 'assets/big.bin': Buffer.alloc(1024 * 1024 + 1) } });
    fs.symlinkSync(path.join(root, 'skills/alpha/SKILL.md'), path.join(root, 'skills/alpha/link.md'));
    const { errors } = run(root);
    assert.ok(has(errors, /link\.md: symlinks are not allowed/));
    assert.ok(has(errors, /big\.bin: 1048577 bytes exceeds/));
  }));

test('readme must exist inside the skill dir', () =>
  withRepo((root) => {
    addSkill(root, 'alpha', { yaml: { readme: 'README.md' } });
    addSkill(root, 'beta', { yaml: { readme: '../alpha/SKILL.md' } });
    const { errors } = run(root);
    assert.ok(has(errors, /alpha\/skill\.yaml: readme "README\.md" does not exist/));
    assert.ok(has(errors, /beta\/skill\.yaml: readme must be a relative path/));
  }));

test('sync checks: stale shared mirror and stale marketplace.json', () =>
  withRepo((root) => {
    write(root, 'shared/refs/a.md', 'v2');
    addSkill(root, 'alpha', { yaml: { agents: DIR_AGENTS, shared: ['refs'] }, files: { 'refs/a.md': 'v1', 'refs/old.md': 'gone' } });
    const { errors } = validateRepo(loadRepo(root));
    assert.ok(has(errors, /skills\/alpha\/refs\/a\.md: differs from shared\/refs\/a\.md/));
    assert.ok(has(errors, /skills\/alpha\/refs\/old\.md: not in shared\/ any more/));
    assert.ok(has(errors, /marketplace\.json: out of date/));
  }));
