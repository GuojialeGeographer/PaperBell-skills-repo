// Static security scan rules for code that ships inside skills. Agents run these
// scripts on users' machines, so high-risk patterns are blocked unless a
// maintainer records an exception, with a reason, in .security-allowlist.json.
//
// Line-based and deliberately conservative: precision is traded for recall,
// and the allowlist is the escape hatch.

export const CODE_EXTS = Object.freeze(['.py', '.mjs', '.js', '.cjs', '.sh', '.ts']);

/** Hosts a script may name in an http(s) URL without an allowlist entry. */
export const ALLOWED_HOSTS = Object.freeze([
  'github.com',
  'raw.githubusercontent.com',
  'api.github.com',
  'doi.org',
  'api.crossref.org',
  'api.openalex.org',
  'export.arxiv.org',
  'api.unpaywall.org',
  'api.ror.org',
  'localhost',
  '127.0.0.1',
]);

const extOf = (file) => {
  const m = file.match(/(\.[^./]+)$/);
  return m ? m[1] : '';
};

const SH = ['.sh'];
const PY = ['.py'];
const JS = ['.mjs', '.js', '.cjs', '.ts'];

export const RULES = Object.freeze([
  {
    name: 'rm-rf',
    re: /\brm\s+(-[a-zA-Z]*r[a-zA-Z]*f|-[a-zA-Z]*f[a-zA-Z]*r|-r\s+-f|-f\s+-r|--recursive\b)|\bshutil\.rmtree\s*\(|\brmSync\s*\([^)]*recursive\s*:\s*true|\brimraf\b/,
  },
  { name: 'pipe-to-shell', re: /\b(curl|wget)\b[^|\n]*\|\s*(sudo\s+)?(ba|z|da|k)?sh\b|\b(ba|z)?sh\s+<\(\s*(curl|wget)\b/ },
  // eval/exec of anything (incl. network content); `.exec(` (RegExp, cursor) is fine
  { name: 'dynamic-eval', re: /(?<![.\w$])(eval|exec)\s*\(|\bnew\s+Function\s*\(|\bvm\.run\w*\s*\(/, exts: [...PY, ...JS] },
  { name: 'sh-eval', re: /(^|[;&|]\s*|\s)eval\s|\bsource\s+<\(/, exts: SH },
  { name: 'child-process-shell', re: /\bshell\s*:\s*true\b/, exts: JS },
  { name: 'os-system', re: /\bos\.(system|popen|exec[lv]p?e?)\s*\(/, exts: PY },
  { name: 'subprocess-shell', re: /\bshell\s*=\s*True\b/, exts: PY },
  {
    name: 'abs-path-write',
    re: /\b(writeFileSync|writeFile|appendFileSync|appendFile|createWriteStream|copyFileSync|renameSync|mkdirSync|rmSync|unlinkSync)\s*\(\s*['"`](\/|~)|\bopen\s*\(\s*r?['"](\/|~)[^'"]*['"]\s*,\s*r?['"][^'"]*[wax+]|\bPath\s*\(\s*r?['"](\/|~)[^'"]*['"]\s*\)\s*\.(write_text|write_bytes|open|mkdir|unlink|touch)\b/,
  },
  { name: 'sh-abs-redirect', re: /(^|[^<>&\d-])>>?\s*['"]?(\/(?!dev\/(null|stderr|stdout))|~\/|\$HOME\b)|\btee\s+(-a\s+)?['"]?(\/(?!dev\/)|~\/|\$HOME\b)/, exts: SH },
  { name: 'home-dir', re: /\bos\.path\.expanduser\s*\(|\bPath\.home\s*\(|\bos\.homedir\s*\(|\bhomedir\s*\(\s*\)/, exts: [...PY, ...JS] },
  {
    name: 'secret-env',
    re: /(process\.env(\.|\[\s*['"`])|os\.environ(\.get\s*\(\s*|\[\s*)['"]|os\.getenv\s*\(\s*['"]|Deno\.env\.get\s*\(\s*['"])[A-Za-z0-9_]*(KEY|TOKEN|SECRET|PASSWORD|PASSWD)/i,
    exts: [...PY, ...JS],
  },
  { name: 'secret-env', re: /\$\{?[A-Za-z0-9_]*(KEY|TOKEN|SECRET|PASSWORD|PASSWD)[A-Za-z0-9_]*\}?/i, exts: SH },
]);

/** Strip a trailing line comment (best effort; leaves `://` in URLs alone). */
export function stripComment(line, ext) {
  if (PY.includes(ext) || SH.includes(ext)) {
    if (/^\s*#/.test(line)) return '';
    return line.replace(/\s#(?!!).*$/, '');
  }
  if (JS.includes(ext)) {
    if (/^\s*(\/\/|\*|\/\*)/.test(line)) return '';
    return line.replace(/(^|[^:"'`\\])\/\/.*$/, '$1');
  }
  return line;
}

const URL_RE = /\bhttps?:\/\/([A-Za-z0-9.-]+)(?::\d+)?/g;

export function hostAllowed(host, allowed = ALLOWED_HOSTS) {
  const h = host.toLowerCase().replace(/\.$/, '');
  return allowed.some((a) => h === a || h.endsWith('.' + a));
}

/**
 * Scan one file's text. Returns [{ file, rule, line, text }].
 * `file` is the repo-relative posix path (used for ext detection and reporting).
 */
export function scanText(text, file, { allowedHosts = ALLOWED_HOSTS } = {}) {
  const ext = extOf(file);
  const hits = [];
  const lines = String(text).split('\n');
  lines.forEach((raw, idx) => {
    const code = stripComment(raw, ext);
    if (!code.trim()) return;
    const seen = new Set();
    for (const rule of RULES) {
      if (rule.exts && !rule.exts.includes(ext)) continue;
      if (seen.has(rule.name)) continue;
      if (rule.re.test(code)) {
        seen.add(rule.name);
        hits.push({ file, rule: rule.name, line: idx + 1, text: raw.trim() });
      }
    }
    for (const m of code.matchAll(URL_RE)) {
      if (!hostAllowed(m[1], allowedHosts)) {
        hits.push({ file, rule: 'network-host', line: idx + 1, text: raw.trim(), host: m[1] });
        break;
      }
    }
  });
  return hits;
}

/** Validate allowlist entries; returns error strings. */
export function checkAllowlist(list) {
  if (!Array.isArray(list)) return ['.security-allowlist.json must be a JSON array'];
  const known = new Set([...RULES.map((r) => r.name), 'network-host']);
  const errs = [];
  for (const e of list) {
    if (!e || !e.file || !e.pattern || !e.reason) errs.push(`entry needs file, pattern, reason: ${JSON.stringify(e)}`);
    else if (!known.has(e.pattern)) errs.push(`entry has unknown pattern "${e.pattern}" (known: ${[...known].join(', ')})`);
  }
  return errs;
}

export function partitionHits(hits, allowlist) {
  const isAllowed = (h) => allowlist.some((a) => a.file === h.file && a.pattern === h.rule);
  return { blocked: hits.filter((h) => !isAllowed(h)), allowed: hits.filter(isAllowed) };
}

export function isCodeFile(file) {
  return CODE_EXTS.includes(extOf(file));
}
