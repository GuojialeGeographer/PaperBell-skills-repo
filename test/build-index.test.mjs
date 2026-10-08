import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { loadRepo } from '../scripts/lib/repo.mjs';
import { validateRepo } from '../scripts/lib/validate.mjs';
import { buildIndex, rawUrl } from '../scripts/lib/build-index.mjs';
import { tmpRepo, write, addSkill, addBundle, rm } from './helpers.mjs';

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');

function fixture() {
  const root = tmpRepo();
  write(root, 'shared/references/guide.md', 'shared guide\n');
  write(root, 'shared/scripts/check.py', 'print("ok")\n');
  write(root, 'shared/scripts/__pycache__/check.cpython-312.pyc', 'bin');
  addSkill(root, 'fmt', {
    yaml: { agents: ['claude-code', 'gemini-cli'], shared: ['references', 'scripts'], tags: ['formatting'], minPluginVersion: '0.5.0', readme: 'README.md' },
    files: {
      'assets/a b.txt': 'space\n',
      'README.md': 'market page\n',
      'tests/test_fmt.py': 'x',
      '.env': 'SECRET=1',
      // committed mirrors of shared/
      'references/guide.md': 'shared guide\n',
      'scripts/check.py': 'print("ok")\n',
    },
  });
  addSkill(root, 'solo', { yaml: { free: true } });
  addBundle(root, 'pack', ['fmt', 'solo']);
  return root;
}

test('builds the contract shape', () => {
  const root = fixture();
  try {
    const model = loadRepo(root);
    assert.deepEqual(validateRepo(model, { checkSync: false }).errors, []);
    const idx = buildIndex(model, { tag: '0.1.0', repo: 'O/R', generatedAt: '2026-01-01T00:00:00.000Z' });
    assert.deepEqual(Object.keys(idx), ['schemaVersion', 'generatedAt', 'repo', 'tag', 'skills', 'bundles']);
    assert.equal(idx.schemaVersion, 1);
    assert.equal(idx.tag, '0.1.0');

    const fmt = idx.skills.find((s) => s.id === 'fmt');
    assert.deepEqual(Object.keys(fmt), ['id', 'version', 'title', 'description', 'tier', 'agents', 'requires', 'minPluginVersion', 'free', 'tags', 'files', 'readmeUrl']);
    assert.equal(fmt.free, false);
    assert.equal(fmt.readmeUrl, 'https://raw.githubusercontent.com/O/R/0.1.0/skills/fmt/README.md');

    const paths = fmt.files.map((f) => f.path);
    assert.equal(paths[0], 'SKILL.md');
    assert.deepEqual(paths, ['SKILL.md', 'assets/a b.txt', 'references/guide.md', 'scripts/check.py']);

    const guide = fmt.files.find((f) => f.path === 'references/guide.md');
    assert.equal(guide.url, 'https://raw.githubusercontent.com/O/R/0.1.0/shared/references/guide.md');
    assert.equal(guide.sha256, sha('shared guide\n'));
    assert.equal(guide.size, Buffer.byteLength('shared guide\n'));
    assert.equal(fmt.files.find((f) => f.path === 'assets/a b.txt').url, 'https://raw.githubusercontent.com/O/R/0.1.0/skills/fmt/assets/a%20b.txt');

    const solo = idx.skills.find((s) => s.id === 'solo');
    assert.ok(!('agents' in solo), 'omitted agents stays omitted (= all agents)');
    assert.ok(!('minPluginVersion' in solo));
    assert.equal(solo.free, true);
    assert.equal(solo.readmeUrl, null);
    assert.equal(solo.files.length, 1);

    assert.deepEqual(idx.bundles, [{ id: 'pack', version: '1.0.0', title: { en: 'B', zh: '包' }, description: { en: 'Bundle', zh: '套装' }, skills: ['fmt', 'solo'] }]);
  } finally {
    rm(root);
  }
});

test('rawUrl encodes each segment', () => {
  assert.equal(rawUrl('O/R', '1.0.0-rc.1', 'skills/x/中 文.md'), 'https://raw.githubusercontent.com/O/R/1.0.0-rc.1/skills/x/%E4%B8%AD%20%E6%96%87.md');
});

test('tag is required', () => {
  assert.throws(() => buildIndex({ root: '/', skills: [], bundles: [] }, {}), /tag is required/);
});
