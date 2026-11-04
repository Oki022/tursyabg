// Turns a Playwright JSON report into one short Telegram message.
// Input: the Webhook node's output (body = the report, headers = build info from Azure).
// Output: one item { text } when something failed, or no items when everything passed
// (no items = the Telegram node does not run).

const input = $input.first().json;
const report = input.body || {};
const headers = input.headers || {};

const stripAnsi = (s) => String(s || '').replace(/\u001b\[[0-9;]*m/g, '');

// Short reason: the first line of the error plus the Expected/Received lines, if any.
function shortError(error) {
  const lines = stripAnsi(error && error.message).split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return '';
  const first = lines[0].replace(/^Error:\s*/, '');
  const diff = lines.filter((l) => /^(Expected|Received)/.test(l));
  return [first, ...diff].join(' | ').slice(0, 300);
}

// Walk the nested suites (file > describe > ...) and collect every test.
const failed = [];
const flaky = [];
function walk(suite, path) {
  const here = suite.title ? [...path, suite.title] : path;
  for (const spec of suite.specs || []) {
    for (const t of spec.tests || []) {
      const name = [...here, spec.title].join(' › ');
      const results = t.results || [];
      const last = results[results.length - 1] || {};
      if (t.status === 'unexpected') failed.push({ name, reason: shortError(last.error) });
      if (t.status === 'flaky') flaky.push(name);
    }
  }
  for (const child of suite.suites || []) walk(child, here);
}
for (const s of report.suites || []) walk(s, []);

const stats = report.stats || {};
const globalErrors = (report.errors || []).map(shortError).filter(Boolean);

// Nothing broke: stop here, no message.
if (failed.length === 0 && globalErrors.length === 0) return [];

const minutes = Math.floor((stats.duration || 0) / 60000);
const seconds = Math.round(((stats.duration || 0) % 60000) / 1000);

const lines = [];
lines.push('❌ tursya.bg tests failed');
if (headers['x-build-number']) lines.push(`Build ${headers['x-build-number']} · ${headers['x-branch'] || 'main'}`);
lines.push(
  `${stats.expected || 0} passed · ${failed.length} failed · ${flaky.length} flaky · ${stats.skipped || 0} skipped · ${minutes}m ${seconds}s`,
);

if (globalErrors.length) {
  lines.push('', 'Run errors:');
  globalErrors.slice(0, 3).forEach((e) => lines.push(`- ${e}`));
}
if (failed.length) {
  lines.push('', 'Failed:');
  failed.slice(0, 10).forEach((f, i) => {
    lines.push(`${i + 1}. ${f.name}`);
    if (f.reason) lines.push(`   ${f.reason}`);
  });
  if (failed.length > 10) lines.push(`…and ${failed.length - 10} more`);
}
if (flaky.length) {
  lines.push('', 'Flaky (passed on retry):');
  flaky.slice(0, 5).forEach((n) => lines.push(`- ${n}`));
}
if (headers['x-build-url']) lines.push('', headers['x-build-url']);

// Telegram allows 4096 characters per message.
return [{ json: { text: lines.join('\n').slice(0, 4000) } }];
