// Semver helpers. Every skill and bundle carries its own independent version;
// none of them is tied to the repository's release tag.

// semver.org §2/§9/§10, without a leading "v".
const SEMVER =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

export function isSemver(v) {
  return typeof v === 'string' && SEMVER.test(v);
}

/** Release tags: X.Y.Z or X.Y.Z-<anything>. */
export function isReleaseTag(t) {
  return isSemver(String(t || ''));
}

export function isPrerelease(t) {
  return isSemver(t) && String(t).split('+')[0].includes('-');
}
