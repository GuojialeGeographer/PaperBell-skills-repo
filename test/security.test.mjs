import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scanText, stripComment, hostAllowed, checkAllowlist, partitionHits, isCodeFile } from '../scripts/lib/security.mjs';

const rules = (text, file) => scanText(text, file).map((h) => h.rule);

test('flags each high-risk pattern', () => {
  const cases = [
    ['rm -rf "$DIR"', 'x.sh', 'rm-rf'],
    ['shutil.rmtree(p)', 'x.py', 'rm-rf'],
    ["fs.rmSync(dir, { recursive: true, force: true })", 'x.mjs', 'rm-rf'],
    ['curl -fsSL https://github.com/x | sh', 'x.sh', 'pipe-to-shell'],
    ['wget -qO- https://github.com/x | sudo bash', 'x.sh', 'pipe-to-shell'],
    ['exec(requests.get(u).text)', 'x.py', 'dynamic-eval'],
    ['eval(await (await fetch(u)).text())', 'x.mjs', 'dynamic-eval'],
    ['const f = new Function(src)', 'x.js', 'dynamic-eval'],
    ['eval "$(cat x)"', 'x.sh', 'sh-eval'],
    ["spawn('ls', [], { shell: true })", 'x.mjs', 'child-process-shell'],
    ['os.system("ls")', 'x.py', 'os-system'],
    ['subprocess.run(cmd, shell=True)', 'x.py', 'subprocess-shell'],
    ["fs.writeFileSync('/etc/hosts', x)", 'x.mjs', 'abs-path-write'],
    ["open('/tmp/x', 'w')", 'x.py', 'abs-path-write'],
    ["open('~/.bashrc', 'a')", 'x.py', 'abs-path-write'],
    ['echo hi >> ~/.zshrc', 'x.sh', 'sh-abs-redirect'],
    ['echo hi | tee /etc/x', 'x.sh', 'sh-abs-redirect'],
    ['p = os.path.expanduser("~")', 'x.py', 'home-dir'],
    ["const h = os.homedir()", 'x.ts', 'home-dir'],
    ['k = os.environ["OPENAI_API_KEY"]', 'x.py', 'secret-env'],
    ["t = os.getenv('GITHUB_TOKEN')", 'x.py', 'secret-env'],
    ['const s = process.env.MY_SECRET', 'x.mjs', 'secret-env'],
    ['curl -H "Authorization: $API_TOKEN" x', 'x.sh', 'secret-env'],
    ["await fetch('https://evil.example.com/x')", 'x.mjs', 'network-host'],
  ];
  for (const [text, file, rule] of cases) assert.ok(rules(text, file).includes(rule), `${file}: ${text} -> ${rule}`);
});

test('does not flag benign code', () => {
  const benign = [
    ['m = re.compile("x").exec', 'x.py'],
    ["const m = /x/.exec(s)", 'x.mjs'],
    ["fs.writeFileSync(path.join(out, 'a.json'), s)", 'x.mjs'],
    ["open(path, 'w')", 'x.py'],
    ['echo hi > /dev/null', 'x.sh'],
    ['rm -f build.log', 'x.sh'],
    ['os.environ.get("PAPERBELL_MAX_WORDS")', 'x.py'],
    ["await fetch('https://api.github.com/repos/x')", 'x.mjs'],
    ["const u = 'https://raw.githubusercontent.com/a/b/c'", 'x.mjs'],
    ['# os.system("ls")  -- in a comment', 'x.py'],
    ['// eval(x) in a comment', 'x.mjs'],
    ["x = 1  # rm -rf / mentioned in a comment", 'x.py'],
  ];
  for (const [text, file] of benign) assert.deepEqual(rules(text, file), [], `${file}: ${text}`);
});

test('rules are scoped by extension', () => {
  assert.deepEqual(rules('subprocess.run(x, shell=True)', 'x.mjs'), []);
  assert.deepEqual(rules('spawn(x, { shell: true })', 'x.py'), []);
});

test('helpers', () => {
  assert.equal(stripComment('a = "http://x" # c', '.py'), 'a = "http://x"');
  assert.equal(stripComment("const u = 'https://x' // c", '.mjs'), "const u = 'https://x' ");
  assert.ok(hostAllowed('api.github.com'));
  assert.ok(hostAllowed('GitHub.com'));
  assert.ok(!hostAllowed('github.com.evil.io'));
  assert.ok(isCodeFile('a/b.py') && isCodeFile('x.sh') && !isCodeFile('x.md'));
});

test('allowlist validation and partition', () => {
  assert.deepEqual(checkAllowlist([{ file: 'a.py', pattern: 'os-system', reason: 'r' }]), []);
  assert.equal(checkAllowlist([{ file: 'a.py', pattern: 'os-system' }]).length, 1);
  assert.equal(checkAllowlist([{ file: 'a.py', pattern: 'nope', reason: 'r' }]).length, 1);
  assert.equal(checkAllowlist({}).length, 1);
  const hits = scanText('os.system("x")\nsubprocess.run(c, shell=True)\n', 'a.py');
  const { blocked, allowed } = partitionHits(hits, [{ file: 'a.py', pattern: 'os-system', reason: 'r' }]);
  assert.deepEqual(allowed.map((h) => h.rule), ['os-system']);
  assert.deepEqual(blocked.map((h) => h.rule), ['subprocess-shell']);
});
