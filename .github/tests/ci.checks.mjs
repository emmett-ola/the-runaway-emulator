import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { validateLintReport } from '../scripts/lint-gate.mjs';
import { inventory, compareFiles, deploymentMetadata, verifyAttempt } from '../scripts/verify-production.mjs';

const report = (errors = 0, warnings = 0) => JSON.stringify([{
  filePath: '/src/example.ts', errorCount: errors, warningCount: warnings, fatalErrorCount: 0,
  messages: [
    ...Array.from({ length: errors }, () => ({ severity: 2, ruleId: 'no-explicit-any', message: 'example' })),
    ...Array.from({ length: warnings }, () => ({ severity: 1, ruleId: 'example', message: 'example' })),
  ],
}]);

test('lint accepts honest clean results and the five-error baseline', () => {
  assert.deepEqual(validateLintReport(report(), 0, 0), { errors: 0, warnings: 0 });
  assert.deepEqual(validateLintReport(report(5), 1, 1), { errors: 5, warnings: 0 });
});

test('lint rejects regression, warning, tooling exits and malformed output', () => {
  for (const args of [
    [report(6), 1, 1], [report(0, 1), 0, 0], [report(), 2, 0], [report(), 0, 2],
    [report(), null, 0], ['not JSON', 0, 0], ['[]', 0, 0], ['{}', 0, 0],
    [report(1), 0, 1], [report(), 1, 0],
  ]) assert.throws(() => validateLintReport(...args));
});

test('lint rejects parse failures, missing rules and dishonest counts', () => {
  const parsed = JSON.parse(report(1));
  parsed[0].fatalErrorCount = 1;
  assert.throws(() => validateLintReport(JSON.stringify(parsed), 1, 1), /parse failure/);
  parsed[0].fatalErrorCount = 0;
  parsed[0].messages[0].ruleId = null;
  assert.throws(() => validateLintReport(JSON.stringify(parsed), 1, 1), /parser diagnostic/);
  parsed[0].messages[0].ruleId = 'rule';
  parsed[0].errorCount = 0;
  assert.throws(() => validateLintReport(JSON.stringify(parsed), 1, 1), /counts disagree/);
});

async function fixture() {
  const dir = await mkdtemp(path.join(tmpdir(), 'ci-verifier-'));
  await mkdir(path.join(dir, 'assets', 'lazy'), { recursive: true });
  await writeFile(path.join(dir, 'index.html'), '<script type="module" src="/assets/main.js"></script><link href="/assets/main.css">');
  await writeFile(path.join(dir, 'assets/main.js'), 'import("./lazy/second.js"); const deps=["assets/lazy/second.css"];');
  await writeFile(path.join(dir, 'assets/main.css'), '@import "./lazy/second.css";');
  await writeFile(path.join(dir, 'assets/lazy/second.js'), 'export default 1');
  await writeFile(path.join(dir, 'assets/lazy/second.css'), 'body{color:black}');
  await writeFile(path.join(dir, 'sw.js'), '/* worker */');
  return dir;
}

test('artifact walk includes transitive/lazy chunks, nested CSS and workers', async () => {
  const files = await inventory(await fixture());
  assert.deepEqual([...files.keys()].sort(), ['assets/lazy/second.css', 'assets/lazy/second.js', 'assets/main.css', 'assets/main.js', 'index.html', 'sw.js']);
});

test('missing locally referenced chunks and shell fail instead of being skipped', async () => {
  const dir = await fixture();
  await writeFile(path.join(dir, 'assets/main.js'), 'import("./absent.js")');
  await assert.rejects(inventory(dir), /Missing referenced artifact/);
  const empty = await mkdtemp(path.join(tmpdir(), 'ci-empty-'));
  await assert.rejects(inventory(empty), /index.html is missing/);
});

test('served mismatch and missing transitive asset both fail', async () => {
  const files = await inventory(await fixture());
  const fetcher = async url => {
    const name = new URL(url).pathname.replace(/^\//, '') || 'index.html';
    return new Response(files.get(name) ?? 'missing', { status: files.has(name) ? 200 : 404 });
  };
  await compareFiles(files, 'https://example.test', fetcher);
  await assert.rejects(compareFiles(files, 'https://example.test', async () => new Response('wrong')), /SHA256 mismatch/);
  await assert.rejects(compareFiles(files, 'https://example.test', async () => new Response('missing', { status: 404 })), /HTTP 404/);
  const missingNested = async url => url.endsWith('/lazy/second.js') ? new Response('missing', { status: 404 }) : fetcher(url);
  await assert.rejects(compareFiles(files, 'https://example.test', missingNested), /HTTP 404/);
});

const deployment = { id: 'dpl_test123', url: 'runaway-unique.vercel.app' };
const aliases = { aliases: [{ alias: 'runaway.macacloud.com' }, { alias: 'runaway-git-main-team.vercel.app' }], pagination: { next: null } };
function metadataFetcher(deploy = deployment, aliasData = aliases) {
  return async url => new Response(JSON.stringify(url.includes('/v13/') ? deploy : aliasData));
}

test('metadata needs actual deployment ID, prod alias, main alias and complete list', async () => {
  assert.equal((await deploymentMetadata(metadataFetcher())).id, 'dpl_test123');
  for (const [deploy, list] of [
    [{ ...deployment, id: 'sfo1::request-id' }, aliases],
    [deployment, { aliases: [{ alias: 'runaway.macacloud.com' }] }],
    [deployment, { aliases: [{ alias: 'runaway-git-main-team.vercel.app' }] }],
    [deployment, {}], [deployment, { ...aliases, pagination: { next: 'repeat' } }],
  ]) await assert.rejects(deploymentMetadata(metadataFetcher(deploy, list)));
});

test('anonymous metadata 403 and SPA HTML fail closed, even with matching bytes', async () => {
  await assert.rejects(deploymentMetadata(async () => new Response('{"error":"missingToken"}', { status: 403 })), /identity unavailable/);
  await assert.rejects(deploymentMetadata(async () => new Response('<html>SPA fallback</html>')), /identity unavailable/);
  const files = new Map([['index.html', Buffer.from('same')]]);
  await assert.rejects(verifyAttempt(files, async url => url.startsWith('https://api.vercel.com/')
    ? new Response('forbidden', { status: 403 }) : new Response('same')), /failing closed/);
});

test('alias pagination is fetched fully', async () => {
  const visited = [];
  const fetcher = async url => {
    visited.push(url);
    if (url.includes('/v13/')) return new Response(JSON.stringify(deployment));
    if (!url.includes('?until=')) return new Response(JSON.stringify({ aliases: [aliases.aliases[0]], pagination: { next: 123 } }));
    return new Response(JSON.stringify({ aliases: [aliases.aliases[1]], pagination: { next: null } }));
  };
  assert.equal((await deploymentMetadata(fetcher)).aliases.length, 2);
  assert.ok(visited.some(url => url.endsWith('?until=123')));
});
