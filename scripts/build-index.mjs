#!/usr/bin/env node
// Emit index.json (schemaVersion 1, docs/CONTRACT.md §1).
//
//   node scripts/build-index.mjs --tag 0.1.0 --out dist/index.json
//
// --tag defaults to the tag exactly at HEAD (`git describe --tags --exact-match`),
// else "dev". Every file URL is pinned to that tag, so build with the tag you
// are about to publish. Refuses to build from a repo that does not validate.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT, getArg } from './lib/cli.mjs';
import { loadRepo } from './lib/repo.mjs';
import { validateRepo } from './lib/validate.mjs';
import { buildIndex } from './lib/build-index.mjs';
import { REPO } from './lib/constants.mjs';

function defaultTag() {
  try {
    return execFileSync('git', ['describe', '--tags', '--exact-match'], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() || 'dev';
  } catch {
    return 'dev';
  }
}

const argv = process.argv.slice(2);
const tag = typeof getArg(argv, 'tag') === 'string' ? getArg(argv, 'tag') : defaultTag();
const out = typeof getArg(argv, 'out') === 'string' ? getArg(argv, 'out') : path.join('dist', 'index.json');
const repo = typeof getArg(argv, 'repo') === 'string' ? getArg(argv, 'repo') : REPO;
const generatedAt = process.env.SOURCE_DATE_EPOCH
  ? new Date(Number(process.env.SOURCE_DATE_EPOCH) * 1000).toISOString()
  : new Date().toISOString();

const model = loadRepo(ROOT);
const { errors } = validateRepo(model);
if (errors.length) {
  for (const e of errors) console.error(`ERROR: ${e}`);
  console.error('build-index: repo does not validate — fix the errors above first');
  process.exit(1);
}

const index = buildIndex(model, { tag, repo, generatedAt });
const outAbs = path.resolve(ROOT, out);
fs.mkdirSync(path.dirname(outAbs), { recursive: true });
fs.writeFileSync(outAbs, JSON.stringify(index, null, 2) + '\n');
console.error(`build-index: ${index.skills.length} skill(s), ${index.bundles.length} bundle(s) @ ${tag} -> ${path.relative(ROOT, outAbs)}`);
