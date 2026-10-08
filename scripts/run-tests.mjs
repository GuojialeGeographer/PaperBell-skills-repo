#!/usr/bin/env node
// Collect *.test.mjs under test/ and skills/*/tests/ and run them with node:test.
// (Node 20's `node --test` takes no globs, so we expand them here.)
//
//   node scripts/run-tests.mjs [extra node --test args]

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT } from './lib/cli.mjs';

function collect(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) collect(abs, out);
    else if (e.isFile() && /\.test\.mjs$/.test(e.name)) out.push(abs);
  }
  return out;
}

const files = collect(path.join(ROOT, 'test'));
const skillsDir = path.join(ROOT, 'skills');
if (fs.existsSync(skillsDir)) {
  for (const id of fs.readdirSync(skillsDir).sort()) collect(path.join(skillsDir, id, 'tests'), files);
}
if (!files.length) {
  console.error('run-tests: no *.test.mjs files found');
  process.exit(1);
}
const rel = files.sort().map((f) => path.relative(ROOT, f));
const r = spawnSync(process.execPath, ['--test', ...process.argv.slice(2), ...rel], { cwd: ROOT, stdio: 'inherit' });
process.exit(r.status ?? 1);
