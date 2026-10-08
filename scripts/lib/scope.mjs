// PR scope rules. Contributions should ADD new skills; touching an existing core
// skill, shared resources, the toolchain or CI (adding, changing, deleting or
// renaming files there) needs a maintainer to apply the `core-change` label.

/**
 * Whether a comma-joined label list contains exactly `core-change`. Names are
 * compared whole: `not-core-change` must not count.
 */
export function hasCoreChangeLabel(labels) {
  return String(labels || '')
    .split(',')
    .some((l) => l.trim().toLowerCase() === 'core-change');
}

export const PROTECTED = Object.freeze([
  /^shared\//,
  /^scripts\//,
  /^\.github\//,
  /^catalog\//,
  /^test\//,
  /^package(-lock)?\.json$/,
  /^\.security-allowlist\.json$/,
  /^docs\/CONTRACT\.md$/,
]);

/** Generated and enforced by CI; a skill bump legitimately rewrites it. */
const EXEMPT = [/^\.claude-plugin\/marketplace\.json$/];

/** A brand-new bundle only groups existing skills; adding one needs no label. */
const ADD_OK = [/^catalog\/bundles\/[^/]+\.yaml$/];

/**
 * @param {string[]} lines  `git diff --name-status` output lines
 * @param {(id: string) => boolean} isCoreAtBase  whether skills/<id> was tier core at base
 * @returns {string[]} violating lines
 */
export function scopeViolations(lines, isCoreAtBase) {
  const touchesProtected = (file) => {
    if (EXEMPT.some((re) => re.test(file))) return false;
    const m = file.match(/^skills\/([^/]+)\//);
    return (m && isCoreAtBase(m[1])) || PROTECTED.some((re) => re.test(file));
  };
  const out = [];
  for (const l of lines) {
    const parts = l.split('\t');
    const status = parts[0];
    if (!status || parts.length < 2) continue;
    // Every status counts — additions too: a new file under scripts/, shared/,
    // .github/ or inside an existing core skill ships (or runs) just like an edit.
    // Renames/copies carry "old\tnew"; both ends are checked, so moving a file
    // INTO a protected place is caught as well as moving one out.
    if (status === 'A' && ADD_OK.some((re) => re.test(parts[1]))) continue;
    const files = /^[RC]/.test(status) ? parts.slice(1, 3) : [parts[1]];
    if (files.some(touchesProtected)) out.push(l);
  }
  return out;
}
