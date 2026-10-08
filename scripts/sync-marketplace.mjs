#!/usr/bin/env node
// Regenerate .claude-plugin/marketplace.json from skill.yaml + bundles.
//
//   node scripts/sync-marketplace.mjs          # write
//   node scripts/sync-marketplace.mjs --check  # CI: fail if out of date

import fs from 'node:fs';
import path from 'node:path';
import { ROOT, getArg } from './lib/cli.mjs';
import { loadRepo } from './lib/repo.mjs';
import { buildMarketplace, serializeMarketplace, MARKETPLACE_PATH } from './lib/marketplace.mjs';

const check = Boolean(getArg(process.argv.slice(2), 'check'));
const abs = path.join(ROOT, MARKETPLACE_PATH);
const want = serializeMarketplace(buildMarketplace(loadRepo(ROOT)));
const have = fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : null;
if (have === want) {
  console.error(`sync-marketplace: ${MARKETPLACE_PATH} up to date`);
  process.exit(0);
}
if (check) {
  console.error(`sync-marketplace: ${MARKETPLACE_PATH} is out of date — run \`npm run sync\``);
  process.exit(1);
}
fs.mkdirSync(path.dirname(abs), { recursive: true });
fs.writeFileSync(abs, want);
console.error(`sync-marketplace: wrote ${MARKETPLACE_PATH}`);
