#!/usr/bin/env node
// Static security scan of every script a skill ships (its own files plus the
// shared/ resources it declares; tests/ are not shipped and not scanned).
// Legitimate exceptions go in .security-allowlist.json as { file, pattern, reason },
// reviewed by a maintainer — nothing passes silently.
//
//   node scripts/scan-security.mjs

import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './lib/cli.mjs';
import { loadRepo, skillFiles, walk, isExcludedSegmentPath } from './lib/repo.mjs';
import { scanText, checkAllowlist, partitionHits, isCodeFile } from './lib/security.mjs';

function loadAllowlist() {
  const fp = path.join(ROOT, '.security-allowlist.json');
  if (!fs.existsSync(fp)) return [];
  const list = JSON.parse(fs.readFileSync(fp, 'utf8'));
  const errs = checkAllowlist(list);
  if (errs.length) {
    for (const e of errs) console.error(`error: .security-allowlist.json ${e}`);
    process.exit(2);
  }
  return list;
}

// Collect sources: skills' own packaged code + everything under shared/
// (mirrors inside skill dirs are byte-identical to shared/, so scanning the
// source once is enough — sync-shared --check guarantees they match).
const sources = new Map();
const model = loadRepo(ROOT);
for (const s of model.skills) {
  if (!s.isDir || !s.yaml) continue;
  for (const f of skillFiles(ROOT, s).files) if (isCodeFile(f.path) && !f.symlink) sources.set(f.source, f.abs);
}
for (const f of walk(path.join(ROOT, 'shared'))) {
  if (!f.symlink && isCodeFile(f.rel) && !isExcludedSegmentPath(f.rel)) sources.set(`shared/${f.rel}`, f.abs);
}

const allowlist = loadAllowlist();
const hits = [];
for (const [rel, abs] of [...sources].sort()) hits.push(...scanText(fs.readFileSync(abs, 'utf8'), rel));
const { blocked, allowed } = partitionHits(hits, allowlist);

const unused = allowlist.filter((a) => !hits.some((h) => h.file === a.file && h.rule === a.pattern));
for (const u of unused) console.error(`warn: allowlist entry no longer matches anything: ${u.file} [${u.pattern}]`);
for (const a of allowed) console.error(`allow: ${a.file}:${a.line} [${a.rule}] (allowlisted)`);
for (const b of blocked) console.error(`BLOCK: ${b.file}:${b.line} [${b.rule}]${b.host ? ` host=${b.host}` : ''}  ${b.text}`);

if (blocked.length) {
  console.error(`\nsecurity scan failed: ${blocked.length} blocked pattern(s) in ${sources.size} file(s). If a use is legitimate, a maintainer must add it to .security-allowlist.json with a reason.`);
  process.exit(1);
}
console.error(`security scan passed: ${sources.size} file(s), ${hits.length} match(es), ${allowed.length} allowlisted`);
