#!/usr/bin/env node
// Run the stdlib-only python suites: test/python/test_*.py and
// skills/*/tests/test_*.py. Each is a plain script that exits non-zero on failure.
// Skips (exit 0) when no python suites exist.
//
//   node scripts/run-python-tests.mjs [--python python3]

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT, getArg } from './lib/cli.mjs';

const py = typeof getArg(process.argv.slice(2), 'python') === 'string' ? getArg(process.argv.slice(2), 'python') : 'python3';
const dirs = [path.join(ROOT, 'test', 'python')];
const skillsDir = path.join(ROOT, 'skills');
if (fs.existsSync(skillsDir)) for (const id of fs.readdirSync(skillsDir).sort()) dirs.push(path.join(skillsDir, id, 'tests'));

const suites = [];
for (const d of dirs) {
  if (!fs.existsSync(d)) continue;
  for (const n of fs.readdirSync(d).sort()) if (/^test_.*\.py$/.test(n)) suites.push(path.join(d, n));
}
if (!suites.length) {
  console.error('run-python-tests: no python suites');
  process.exit(0);
}
let failed = 0;
for (const s of suites) {
  const rel = path.relative(ROOT, s);
  console.error(`\n== ${rel}`);
  const r = spawnSync(py, ['-B', s], { cwd: ROOT, stdio: 'inherit', env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' } });
  if (r.status !== 0) {
    failed++;
    console.error(`FAILED: ${rel} (exit ${r.status ?? r.error?.message})`);
  }
}
console.error(`\nrun-python-tests: ${suites.length - failed}/${suites.length} suite(s) passed`);
process.exit(failed ? 1 : 0);
