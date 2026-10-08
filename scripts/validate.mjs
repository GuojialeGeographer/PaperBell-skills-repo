#!/usr/bin/env node
// Strict validation of every skill, bundle, shared resource and generated file.
//
//   node scripts/validate.mjs            # errors fail, warnings print
//   node scripts/validate.mjs --no-sync  # skip the shared-mirror / marketplace sync checks

import { ROOT, getArg } from './lib/cli.mjs';
import { loadRepo } from './lib/repo.mjs';
import { validateRepo } from './lib/validate.mjs';

const argv = process.argv.slice(2);
const model = loadRepo(ROOT);
const { errors, warnings, files } = validateRepo(model, { checkSync: !getArg(argv, 'no-sync') });

for (const w of warnings) console.error(`warn: ${w}`);
for (const e of errors) console.error(`ERROR: ${e}`);
if (errors.length) {
  console.error(`\nvalidate: ${errors.length} error(s)`);
  process.exit(1);
}
const n = [...files.values()].reduce((a, f) => a + f.length, 0);
console.error(`validate: ok — ${files.size} skill(s), ${model.bundles.length} bundle(s), ${n} packaged file(s)`);
