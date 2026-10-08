// Minimal, dependency-free reader for Obsidian YAML frontmatter.
//
// Supports what Obsidian (Properties UI, Templater, ZotLit) actually writes:
//   key: scalar            key: "quoted"         key: 'quoted'
//   key: [a, "b", 3]       key: {}               key: | / >  (block scalars)
//   key:                   key:
//     - item               - item               (sequence at the same indent)
//   - task: x              (sequence of mappings)
//     done: true
// Comments (# …) and blank lines are skipped. Anything it does not understand is
// kept as a raw string rather than throwing, so a weird value never aborts a plan.
// It is a reader only: writing is done by Obsidian's processFrontMatter.

/** Split a note into its frontmatter source and body. */
export function splitFrontmatter(text) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const m = /^---[ \t]*\r?\n(?:([\s\S]*?)\r?\n)?(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/.exec(text);
  if (!m) return { source: null, body: text };
  return { source: m[1] ?? '', body: text.slice(m[0].length) };
}

/** Parse a note's frontmatter. Returns { data, body, error }. data is null when there is none. */
export function readFrontmatter(text) {
  const { source, body } = splitFrontmatter(text);
  if (source === null) return { data: null, body, error: null };
  try {
    const data = parseYaml(source);
    if (data !== null && (typeof data !== 'object' || Array.isArray(data))) {
      return { data: null, body, error: 'frontmatter is not a mapping' };
    }
    return { data: data ?? {}, body, error: null };
  } catch (e) {
    return { data: null, body, error: String(e && e.message ? e.message : e) };
  }
}

export function parseYaml(src) {
  const lines = [];
  for (const raw of src.split(/\r?\n/)) {
    const indent = raw.length - raw.replace(/^[ ]*/, '').length;
    const content = raw.slice(indent);
    lines.push({ raw, indent, content });
  }
  const p = { lines, i: 0 };
  skipBlank(p);
  if (p.i >= lines.length) return null;
  return parseNode(p, lines[p.i].indent);
}

function isBlank(line) {
  const t = line.content.trim();
  return t === '' || t.startsWith('#');
}

function skipBlank(p) {
  while (p.i < p.lines.length && isBlank(p.lines[p.i])) p.i++;
}

function isSeqLine(content) {
  return content === '-' || content.startsWith('- ') || content.startsWith('-\t');
}

const KEY_RE = /^("(?:[^"\\]|\\.)*"|'(?:[^']|'')*'|[^\s"'#\[\]{},&*!|>%@`-][^:]*?|-[^\s:][^:]*?)[ \t]*:(?:[ \t]+(.*)|[ \t]*)$/;

function parseNode(p, indent) {
  skipBlank(p);
  const line = p.lines[p.i];
  if (!line) return null;
  if (isSeqLine(line.content)) return parseSeq(p, line.indent);
  if (KEY_RE.test(line.content)) return parseMap(p, line.indent);
  // A bare scalar block (rare in frontmatter): join the lines.
  const parts = [];
  while (p.i < p.lines.length && (isBlank(p.lines[p.i]) || p.lines[p.i].indent >= indent)) {
    if (!isBlank(p.lines[p.i])) parts.push(p.lines[p.i].content.trim());
    p.i++;
  }
  return parseScalar(parts.join(' '));
}

function parseMap(p, indent) {
  const out = {};
  while (true) {
    skipBlank(p);
    const line = p.lines[p.i];
    if (!line || line.indent !== indent) break;
    const m = KEY_RE.exec(line.content);
    if (!m) break;
    const key = unquoteKey(m[1]);
    const rest = stripComment(m[2] ?? '').trim();
    p.i++;
    out[key] = parseValueAfterKey(p, indent, rest);
  }
  return out;
}

function parseValueAfterKey(p, indent, rest) {
  if (rest === '' ) {
    skipBlank(p);
    const next = p.lines[p.i];
    if (!next) return null;
    if (next.indent > indent) return parseNode(p, next.indent);
    if (next.indent === indent && isSeqLine(next.content)) return parseSeq(p, indent);
    return null;
  }
  if (/^[|>][+-]?\d*$/.test(rest)) return parseBlockScalar(p, indent, rest[0] === '>');
  const value = parseInline(rest);
  // Plain multi-line continuation: deeper lines that are not structure.
  if (typeof value === 'string' && !/^["'\[{]/.test(rest)) {
    const extra = [];
    while (p.i < p.lines.length) {
      const l = p.lines[p.i];
      if (isBlank(l) || l.indent <= indent) break;
      extra.push(l.content.trim());
      p.i++;
    }
    if (extra.length) return [value, ...extra].join(' ');
  }
  return value;
}

function parseSeq(p, indent) {
  const out = [];
  while (true) {
    skipBlank(p);
    const line = p.lines[p.i];
    if (!line || line.indent !== indent || !isSeqLine(line.content)) break;
    const after = line.content.slice(1);
    const lead = after.length - after.replace(/^[ \t]*/, '').length;
    const rest = after.slice(lead);
    if (stripComment(rest).trim() === '') {
      p.i++;
      skipBlank(p);
      const next = p.lines[p.i];
      if (next && next.indent > indent) out.push(parseNode(p, next.indent));
      else out.push(null);
      continue;
    }
    if (!/^["'\[{]/.test(rest) && KEY_RE.test(rest)) {
      // "- key: value" starts a mapping whose indent is the column of "key".
      const col = indent + 1 + lead;
      p.lines[p.i] = { raw: line.raw, indent: col, content: rest };
      out.push(parseMap(p, col));
      continue;
    }
    p.i++;
    out.push(parseInline(stripComment(rest).trim()));
  }
  return out;
}

function parseBlockScalar(p, indent, folded) {
  const collected = [];
  let blockIndent = null;
  while (p.i < p.lines.length) {
    const l = p.lines[p.i];
    if (l.content.trim() === '') { collected.push(''); p.i++; continue; }
    if (l.indent <= indent) break;
    if (blockIndent === null) blockIndent = l.indent;
    collected.push(l.raw.slice(Math.min(blockIndent, l.indent)));
    p.i++;
  }
  while (collected.length && collected[collected.length - 1] === '') collected.pop();
  return folded ? collected.join(' ').replace(/ {2,}/g, ' ') : collected.join('\n');
}

function unquoteKey(k) {
  if (k.startsWith('"')) return parseDoubleQuoted(k);
  if (k.startsWith("'")) return k.slice(1, -1).replace(/''/g, "'");
  return k.trim();
}

function stripComment(s) {
  // Remove " # comment" outside quotes.
  let q = null;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === '\\' && q === '"') { i++; continue; }
      if (c === q) q = null;
      continue;
    }
    if (c === '"' || c === "'") { if (i === 0 || /[\s\[{,]/.test(s[i - 1])) q = c; continue; }
    if (c === '#' && (i === 0 || /\s/.test(s[i - 1]))) return s.slice(0, i);
  }
  return s;
}

export function parseInline(s) {
  s = s.trim();
  if (s.startsWith('[')) return parseFlowSeq(s);
  if (s.startsWith('{')) {
    const inner = s.slice(1, s.lastIndexOf('}')).trim();
    if (inner === '') return {};
    const out = {};
    for (const part of splitFlow(inner)) {
      const idx = part.indexOf(':');
      if (idx < 0) { out[part.trim()] = null; continue; }
      out[unquoteKey(part.slice(0, idx).trim())] = parseInline(part.slice(idx + 1));
    }
    return out;
  }
  if (s.startsWith('"')) {
    const end = findQuoteEnd(s, 0, '"');
    return parseDoubleQuoted(end > 0 ? s.slice(0, end + 1) : s + '"');
  }
  if (s.startsWith("'")) {
    const end = findQuoteEnd(s, 0, "'");
    return (end > 0 ? s.slice(1, end) : s.slice(1)).replace(/''/g, "'");
  }
  return parseScalar(stripComment(s).trim());
}

function findQuoteEnd(s, start, q) {
  for (let i = start + 1; i < s.length; i++) {
    if (q === '"' && s[i] === '\\') { i++; continue; }
    if (s[i] === q) {
      if (q === "'" && s[i + 1] === "'") { i++; continue; }
      return i;
    }
  }
  return -1;
}

function parseDoubleQuoted(s) {
  const body = s.slice(1, -1);
  return body.replace(/\\(u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2}|.)/g, (_, e) => {
    if (e[0] === 'u' && e.length === 5) return String.fromCharCode(parseInt(e.slice(1), 16));
    if (e[0] === 'x' && e.length === 3) return String.fromCharCode(parseInt(e.slice(1), 16));
    return { n: '\n', t: '\t', r: '\r', '0': '\0', '"': '"', '\\': '\\', '/': '/', ' ': ' ' }[e] ?? e;
  });
}

function splitFlow(inner) {
  const parts = [];
  let depth = 0, q = null, cur = '';
  for (let i = 0; i < inner.length; i++) {
    const c = inner[i];
    if (q) {
      cur += c;
      if (c === '\\' && q === '"') { cur += inner[++i] ?? ''; continue; }
      if (c === q) q = null;
      continue;
    }
    if (c === '"' || c === "'") { q = c; cur += c; continue; }
    if (c === '[' || c === '{') depth++;
    if (c === ']' || c === '}') depth--;
    if (c === ',' && depth === 0) { parts.push(cur); cur = ''; continue; }
    cur += c;
  }
  if (cur.trim() !== '') parts.push(cur);
  return parts.map((x) => x.trim()).filter((x) => x !== '');
}

function parseFlowSeq(s) {
  const end = s.lastIndexOf(']');
  const inner = s.slice(1, end < 0 ? s.length : end).trim();
  if (inner === '') return [];
  return splitFlow(inner).map(parseInline);
}

export function parseScalar(s) {
  if (s === '' || s === '~' || s === 'null' || s === 'Null' || s === 'NULL') return null;
  if (/^(true|True|TRUE)$/.test(s)) return true;
  if (/^(false|False|FALSE)$/.test(s)) return false;
  if (/^[-+]?(0|[1-9]\d*)$/.test(s)) {
    const n = Number(s);
    return Number.isSafeInteger(n) ? n : s;
  }
  if (/^[-+]?(0|[1-9]\d*)?\.\d+$/.test(s) || /^[-+]?(0|[1-9]\d*)\.\d*$/.test(s)) return Number(s);
  return s;
}
