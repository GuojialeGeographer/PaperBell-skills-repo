#!/usr/bin/env node
// Refresh the committed mirrors of shared/ resources inside skill dirs.
// shared/ is the source of truth; never edit a mirror directly.
//
//   node scripts/sync-shared.mjs          # write missing/stale mirrors, delete orphaned ones
//   node scripts/sync-shared.mjs --check  # CI: fail if any mirror is out of date
//   --verbose lists every file

import { ROOT, getArg } from './lib/cli.mjs';
import { loadRepo } from './lib/repo.mjs';
import { planSync, describePlan, applySync } from './lib/shared.mjs';

const check = Boolean(getArg(process.argv.slice(2), 'check'));
const plan = planSync(loadRepo(ROOT));
const lines = describePlan(plan);
if (!lines.length) {
  console.error('sync-shared: all shared mirrors up to date');
  process.exit(0);
}
const verbose = check || Boolean(getArg(process.argv.slice(2), 'verbose'));
if (verbose) for (const l of lines) console.error(`${check ? 'STALE' : 'sync'}: ${l}`);
else for (const s of plan) console.error(`sync: skills/${s.id}: ${s.missing.length} added, ${s.stale.length} refreshed, ${s.extra.length} removed`);
if (check) {
  console.error('\nsync-shared: mirrors are out of date — run `npm run sync` and commit the result');
  process.exit(1);
}
applySync(ROOT, plan);
console.error(`sync-shared: updated ${lines.length} file(s)`);
