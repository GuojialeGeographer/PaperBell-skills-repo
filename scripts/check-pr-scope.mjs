#!/usr/bin/env node
// PR scope gate. Contributions should ADD skills; modifying/deleting an existing
// core skill, shared/, scripts/, test/, catalog/, .github/ (and a few root files)
// needs the `core-change` label. Runs in CI with GITHUB_BASE_REF + PR_LABELS set;
// skips gracefully off-PR.
//
//   node scripts/check-pr-scope.mjs [--base=<ref>]

import { execFileSync } from 'node:child_process';
import YAML from 'yaml';
import { ROOT, getArg, isMain } from './lib/cli.mjs';
import { hasCoreChangeLabel, scopeViolations } from './lib/scope.mjs';

const git = (args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });

function resolveBase(base) {
  for (const ref of [`origin/${base}`, base]) {
    try {
      git(['rev-parse', '--verify', `${ref}^{commit}`]);
      return ref;
    } catch {
      /* next */
    }
  }
  return null;
}

function main() {
  const baseArg = getArg(process.argv.slice(2), 'base');
  const base = process.env.GITHUB_BASE_REF || (typeof baseArg === 'string' ? baseArg : 'main');
  const ref = resolveBase(base);
  if (!ref) {
    console.error(`check-pr-scope: cannot resolve ${base} (skipping — not a PR context)`);
    return 0;
  }
  const lines = git(['diff', '--name-status', `${ref}...HEAD`]).trim().split('\n').filter(Boolean);
  const coreCache = new Map();
  const isCoreAtBase = (id) => {
    if (!coreCache.has(id)) {
      let core = false;
      try {
        core = YAML.parse(git(['show', `${ref}:skills/${id}/skill.yaml`]))?.tier === 'core';
      } catch {
        core = false; // skill did not exist at base
      }
      coreCache.set(id, core);
    }
    return coreCache.get(id);
  };
  const violations = scopeViolations(lines, isCoreAtBase);
  if (violations.length && !hasCoreChangeLabel(process.env.PR_LABELS)) {
    console.error('check-pr-scope: this PR modifies/deletes protected files:');
    for (const v of violations) console.error(`  ${v}`);
    console.error('\nContributions should ADD skills. To change an existing core skill, shared/ or the toolchain, a maintainer must apply the "core-change" label.');
    return 1;
  }
  console.error(
    violations.length
      ? `check-pr-scope: ${violations.length} protected change(s) approved via core-change label`
      : 'check-pr-scope: ok — no protected files modified'
  );
  return 0;
}

if (isMain(import.meta.url)) process.exitCode = main();
