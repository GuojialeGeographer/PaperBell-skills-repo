// Version rules. Every skill and bundle carries an independent semver; a change
// to anything a skill ships must come with a bump of that skill's version, or
// clients that already installed it will never see the change.

import { isSemver } from './version.mjs';

/** Every skill.yaml / bundle declares semver. Returns error strings. */
export function checkSemverAll(model) {
  const bad = [];
  for (const s of model.skills) {
    if (!s.isDir) continue;
    if (!s.yaml) bad.push(`skills/${s.id}/skill.yaml: missing or unparsable`);
    else if (!isSemver(s.yaml.version)) bad.push(`skills/${s.id}/skill.yaml: version ${JSON.stringify(s.yaml.version)}`);
  }
  for (const b of model.bundles) {
    if (!b.data) bad.push(`${b.file}: missing or unparsable`);
    else if (!isSemver(b.data.version)) bad.push(`${b.file}: version ${JSON.stringify(b.data.version)}`);
  }
  return bad;
}

/**
 * Units whose content changed vs base but whose version did not.
 *
 * @param {object} p
 * @param {Set<string>|string[]} p.changed     repo paths changed vs base
 * @param {Array<{ key: string, version: string, sources: string[] }>} p.units
 *        key e.g. "skills/foo" or "catalog/bundles/x.yaml"; sources = repo paths it ships
 *        (for a skill: packaged files incl. shared/ sources; for a bundle: its yaml).
 * @param {Map<string, string|null>} p.baseVersions key -> version at base (null/absent = new unit)
 * @returns {Array<{ key, version, changed: string[] }>}
 */
export function findUnbumped({ changed, units, baseVersions }) {
  const ch = changed instanceof Set ? changed : new Set(changed);
  const out = [];
  for (const u of units) {
    const base = baseVersions.get(u.key);
    if (base === undefined || base === null) continue; // new at HEAD — nothing to bump from
    const hits = u.sources.filter((p) => ch.has(p));
    if (hits.length && base === u.version) out.push({ key: u.key, version: u.version, changed: hits });
  }
  return out;
}
