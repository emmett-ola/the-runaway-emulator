import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { readFile, writeFile, mkdir, readdir, mkdtemp, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { preview } from 'vite';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const evidence = resolve(root, process.env.QUALITY_EVIDENCE_DIR || 'tools/quality/evidence/browser');
const require = createRequire(import.meta.url);
const hostModule = process.env.QUALITY_PLAYWRIGHT_MODULE;
if (!hostModule) throw new Error('Set QUALITY_PLAYWRIGHT_MODULE to the existing host playwright module.');
const playwright = require(hostModule);
const engines = (process.env.QUALITY_ENGINES || 'chromium,firefox,webkit').split(',');
const surfaces = ['login', 'homeRun', 'settings', 'printdialog'];
const results = { startedAt: new Date().toISOString(), node: process.version, platform: process.platform, architecture: process.arch,
  playwright: require(resolve(hostModule, 'package.json')).version, engines: [], axe: [], cleanup: {} };
const axePath = resolve(root, 'node_modules/axe-core/axe.min.js');
const secrets = [];
let server;
let port;
let temporaryDirectory;
const previousTmpdir = process.env.TMPDIR;
await mkdir(evidence, { recursive: true });
const sanitize = value => secrets.reduce((text, secret) => text.replaceAll(secret, '[REDACTED]'), String(value));
const persist = () => writeFile(resolve(evidence, 'results.json'), JSON.stringify(results, null, 2) + '\n');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

async function artifactFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...await artifactFiles(path));
    else files.push({ path: relative(root, path), bytes: (await readFile(path)).length, sha256: hash(await readFile(path)) });
  }
  return files.sort((a, b) => a.path.localeCompare(b.path));
}
async function freePort() {
  const probe = createServer();
  await new Promise((yes, no) => { probe.once('error', no); probe.listen(0, '127.0.0.1', yes); });
  const selected = probe.address().port;
  await new Promise((yes, no) => probe.close(error => error ? no(error) : yes()));
  assert.notEqual(selected, 4188);
  return selected;
}
async function waitCount(page, count) {
  await page.locator('.hit-count strong').filter({ hasText: new RegExp(`^${count}$`) }).waitFor();
  assert.equal(await page.locator('.hit-count strong').innerText(), String(count));
}
async function createIdentity(page, username) {
  const password = `Synthetic-${randomBytes(18).toString('hex')}!`;
  secrets.push(password);
  await page.locator('#username').fill(username);
  await page.locator('form button[type=submit]').click();
  await page.locator('#password').fill(password);
  await page.locator('#confirmation').fill(password);
  await page.locator('form button[type=submit]').click();
  await page.locator('.hit-button').first().waitFor();
  await waitCount(page, 0);
}
async function scan(page, surface, context = 'document') {
  const started = performance.now();
  const record = { engine: 'chromium', surface, context, status: 'error' };
  results.axe.push(record);
  try {
    if (!existsSync(axePath)) throw new Error('Local axe-core dependency unavailable.');
    if (!await page.evaluate(() => !!window.axe)) await page.addScriptTag({ path: axePath });
    const data = await page.evaluate(async scope => {
      const result = await window.axe.run(scope === 'document' ? document : document.querySelector(scope));
      return { version: result.testEngine.version, url: result.url, violations: result.violations,
        incomplete: result.incomplete, passes: result.passes.map(rule => ({ id: rule.id, impact: rule.impact, nodeCount: rule.nodes.length })),
        inapplicable: result.inapplicable.map(rule => rule.id) };
    }, context);
    Object.assign(record, data, { rules: data.violations.map(rule => ({ id: rule.id, severity: rule.impact, nodeCount: rule.nodes.length })) });
    record.critical = data.violations.filter(rule => rule.impact === 'critical').length;
    record.serious = data.violations.filter(rule => rule.impact === 'serious').length;
    record.criticalNodes = data.violations.filter(rule => rule.impact === 'critical').reduce((n, rule) => n + rule.nodes.length, 0);
    record.seriousNodes = data.violations.filter(rule => rule.impact === 'serious').reduce((n, rule) => n + rule.nodes.length, 0);
    try { assert.equal(record.critical + record.serious, 0, 'Expected zero critical/serious axe violations'); record.status = 'pass'; }
    catch (error) { record.status = 'fail'; record.error = error.message; }
  } catch (error) { record.error = sanitize(error.stack || error); }
  record.durationMs = performance.now() - started;
  await page.screenshot({ path: resolve(evidence, `chromium-${surface}.png`), fullPage: true }).catch(error => { record.screenshotError = sanitize(error.message); });
  await writeFile(resolve(evidence, `axe-${surface}.json`), JSON.stringify(record, null, 2) + '\n');
  await persist();
}
async function engineSmoke(name) {
  const record = { engine: name, startedAt: new Date().toISOString(), status: 'fail', step: 'launch', pageErrors: [], consoleErrors: [], dialogs: [],
    externalRequestsBlocked: [], contextsCreated: 0, contextsClosed: 0, steps: [] };
  results.engines.push(record);
  const started = performance.now();
  let browser;
  const contexts = [];
  let page;
  const step = async (label, action) => {
    record.step = label;
    const entry = { label, status: 'fail' };
    record.steps.push(entry);
    const begin = performance.now();
    try { await action(); entry.status = 'pass'; return true; }
    catch (error) {
      entry.error = sanitize(error.stack || error);
      if (page && !page.isClosed()) {
        entry.dom = await page.locator('body').innerText({ timeout: 2000 }).then(sanitize).catch(() => 'unavailable');
        await page.screenshot({ path: resolve(evidence, `${name}-failure-${record.steps.length}.png`), fullPage: true }).catch(() => {});
      }
      return false;
    } finally { entry.durationMs = performance.now() - begin; await persist(); }
  };
  async function newPage() {
    const context = await browser.newContext({ acceptDownloads: true, locale: 'en-US', timezoneId: 'UTC',
      viewport: { width: 1440, height: 1100 }, colorScheme: 'light', serviceWorkers: 'block' });
    contexts.push(context); record.contextsCreated++;
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.origin === results.origin || ['blob:', 'data:', 'about:'].includes(url.protocol)) return route.continue();
      record.externalRequestsBlocked.push(url.origin + url.pathname);
      return route.abort('blockedbyclient');
    });
    const next = await context.newPage();
    next.setDefaultTimeout(12000);
    next.on('pageerror', error => record.pageErrors.push(sanitize(error.message)));
    next.on('console', message => { if (message.type() === 'error') record.consoleErrors.push(sanitize(message.text())); });
    next.on('dialog', dialog => {
      record.dialogs.push({ type: dialog.type(), message: sanitize(dialog.message()) });
      dialog.accept().catch(error => (record.dialogErrors ||= []).push(sanitize(error.message)));
    });
    return next;
  }
  try {
    const executablePath = name === 'chromium' ? process.env.QUALITY_CHROMIUM_EXECUTABLE : undefined;
    browser = await playwright[name].launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
    record.browserVersion = browser.version();
    record.executable = executablePath || playwright[name].executablePath();
    page = await newPage();
    await step('fresh login page', async () => {
      await page.goto(results.origin, { waitUntil: 'networkidle' });
      await page.locator('#username').waitFor();
      await page.locator('.language-select').selectOption('en_us');
      await page.getByRole('button', { name: 'Next', exact: true }).waitFor();
      if (name === 'chromium') await scan(page, 'login');
    });
    const handle = `q-${name}-same`;
    assert(handle.length <= 20, 'Synthetic handle must fit the real input without truncation');
    await step('username-first synthetic password creation', () => createIdentity(page, handle));
    await step('one real Run commit', async () => {
      let attempts = 0;
      while (await page.locator('.hit-count strong').innerText() === '0' && attempts < 3) {
        attempts++;
        await page.locator('.hit-button').first().click();
        await page.waitForFunction(() => !document.querySelector('.hit-button')?.disabled);
      }
      record.runAttempts = attempts;
      await waitCount(page, 1);
      record.committedCount = 1;
      await page.screenshot({ path: resolve(evidence, `${name}-run-one.png`), fullPage: true });
      if (name === 'chromium') await scan(page, 'homeRun');
    });
    await step('reload preserves count one', async () => {
      await page.reload({ waitUntil: 'networkidle' }); await waitCount(page, 1); record.reloadCount = 1;
    });
    await step('settings surface', async () => {
      await page.locator('a[href="/settings"]').click();
      await page.locator('.settings-page').waitFor();
      record.settingsButtons = await page.locator('.import-export-buttons button').allTextContents();
      record.oldExactExportLocatorMatches = await page.getByRole('button', { name: 'Export Data', exact: true }).count();
      if (name === 'chromium') await scan(page, 'settings');
    });
    // Scan print before download: a broken export must not skip the fourth axe surface.
    await step('print dialog visible', async () => {
      await page.getByRole('button', { name: /Print Calendar$/u }).click();
      await page.getByRole('dialog', { name: 'Print Calendar', exact: true }).waitFor();
      if (name === 'chromium') await scan(page, 'printdialog', '.print-dialog');
      await page.screenshot({ path: resolve(evidence, `${name}-print.png`), fullPage: true });
      await page.getByRole('button', { name: 'Close', exact: true }).click();
    });
    let zipPath;
    const exported = await step('actual ZIP download', async () => {
      const button = page.getByRole('button', { name: /Export Data$/u });
      assert.equal(await button.count(), 1, 'Expected one real export button');
      record.exportButtonText = await button.innerText();
      // Attach rejection handling immediately; do not leave a rejected download waiter after a click failure.
      const downloading = page.waitForEvent('download').then(download => ({ download }), error => ({ error }));
      const alert = page.locator('.settings-page [role="alert"]').waitFor({ state: 'visible' })
        .then(async () => ({ alert: await page.locator('.settings-page [role="alert"]').innerText() }), () => ({ alertTimeout: true }));
      await button.click();
      const outcome = await Promise.race([downloading, alert]);
      if (outcome.alert) throw new Error(`Export product error: ${outcome.alert}`);
      if (!outcome.download) throw outcome.error || new Error('Export produced neither download nor error alert before timeout');
      const download = outcome.download;
      assert.equal(await download.failure(), null);
      const path = resolve(evidence, `${name}-real-export.zip`);
      await download.saveAs(path);
      const bytes = await readFile(path);
      assert(bytes.length > 4 && bytes[0] === 0x50 && bytes[1] === 0x4b, 'Expected actual ZIP bytes');
      record.export = { filename: download.suggestedFilename(), bytes: bytes.length, sha256: hash(bytes) };
      zipPath = path;
    });
    await step('fresh isolated context, same handle, different new password', async () => {
      page = await newPage();
      await page.goto(results.origin, { waitUntil: 'networkidle' });
      await page.locator('#username').waitFor();
      await page.locator('.language-select').selectOption('en_us');
      await createIdentity(page, handle);
      record.freshTargetCount = 0;
    });
    if (exported) {
      await step('native file chooser and explicit replace confirmation', async () => {
        await page.locator('a[href="/settings"]').click();
        const choosing = page.waitForEvent('filechooser').then(chooser => ({ chooser }), error => ({ error }));
        await page.getByRole('button', { name: /Import Data$/u }).click();
        const outcome = await choosing;
        if (outcome.error) throw outcome.error;
        await outcome.chooser.setFiles(zipPath);
        const dialog = page.locator('.import-dialog');
        await dialog.waitFor();
        record.importPreview = await dialog.innerText();
        await page.screenshot({ path: resolve(evidence, `${name}-import-preview.png`), fullPage: true });
        assert.equal(await dialog.getByRole('button', { name: 'Replace', exact: true }).isDisabled(), true);
        record.replaceInitiallyDisabled = true;
        await dialog.getByRole('checkbox').check();
        await dialog.getByRole('button', { name: 'Replace', exact: true }).click();
        await page.waitForFunction(() => !document.querySelector('.import-dialog'));
        await page.waitForLoadState('networkidle');
        await page.locator('.settings-page').waitFor();
        await page.locator('a[href="/"]').click();
        await waitCount(page, 1); record.importCount = 1;
        await page.reload({ waitUntil: 'networkidle' });
        await waitCount(page, 1); record.importReloadCount = 1;
        await page.screenshot({ path: resolve(evidence, `${name}-imported-one.png`), fullPage: true });
      });
    } else record.steps.push({ label: 'native file chooser and explicit replace confirmation', status: 'blocked', reason: 'No real exported ZIP; no replacement data invented.' });
    assert.deepEqual(record.pageErrors, [], 'Uncaught page errors');
    record.status = record.steps.every(item => item.status === 'pass') ? 'pass' : 'fail';
    record.step = record.status === 'pass' ? 'complete' : record.steps.find(item => item.status !== 'pass').label;
  } catch (error) { record.error = sanitize(error.stack || error); }
  finally {
    for (const context of contexts) {
      try { await context.close(); record.contextsClosed++; } catch (error) { (record.cleanupErrors ||= []).push(sanitize(error.message)); }
    }
    if (browser) {
      try { await browser.close(); record.browserDisconnected = !browser.isConnected(); } catch (error) { (record.cleanupErrors ||= []).push(sanitize(error.message)); }
    }
    record.durationMs = performance.now() - started;
    record.finishedAt = new Date().toISOString();
    await writeFile(resolve(evidence, `${name}.json`), JSON.stringify(record, null, 2) + '\n');
    await persist();
    console.log(JSON.stringify({ engine: name, status: record.status, step: record.step, durationMs: record.durationMs,
      error: record.error, failedSteps: record.steps.filter(item => item.status !== 'pass') }));
  }
}
const started = performance.now();
try {
  // Diagnostic isolation for the host Firefox profile-path launch failure.
  // This does not imply that relocating TMPDIR fixes the installed browser.
  temporaryDirectory = await mkdtemp(resolve(evidence, '.playwright-tmp-'));
  process.env.TMPDIR = temporaryDirectory;
  results.temporaryProfileRoot = relative(root, temporaryDirectory);
  port = await freePort();
  server = await preview({ configFile: false, root, preview: { host: '127.0.0.1', port, strictPort: true } });
  results.origin = `http://127.0.0.1:${port}`;
  results.artifact = { htmlSha256: hash(await readFile(resolve(root, 'dist/index.html'))), files: await artifactFiles(resolve(root, 'dist')) };
  await persist();
  for (const engine of engines) {
    try { await engineSmoke(engine); }
    catch (error) { (results.executorErrors ||= []).push({ engine, error: sanitize(error.stack || error) }); }
  }
} catch (error) { results.error = sanitize(error.stack || error); }
finally {
  if (server) {
    try { await new Promise((yes, no) => server.httpServer.close(error => error ? no(error) : yes())); }
    catch (error) { results.cleanup.error = sanitize(error.message); }
  }
  results.cleanup.serverClosed = !!server && !server.httpServer.listening;
  if (port) {
    const probe = createServer();
    try { await new Promise((yes, no) => { probe.once('error', no); probe.listen(port, '127.0.0.1', yes); }); results.cleanup.portRebindSucceeded = true; }
    catch (error) { results.cleanup.portRebindSucceeded = false; results.cleanup.error = sanitize(error.message); }
    finally { if (probe.listening) await new Promise(yes => probe.close(yes)); }
  }
  if (previousTmpdir === undefined) delete process.env.TMPDIR;
  else process.env.TMPDIR = previousTmpdir;
  if (temporaryDirectory) {
    try { await rm(temporaryDirectory, { recursive: true }); results.cleanup.ownedTemporaryProfilesRemoved = !existsSync(temporaryDirectory); }
    catch (error) { results.cleanup.temporaryProfileError = sanitize(error.message); }
  }
  for (const surface of surfaces) {
    if (!results.axe.some(scan => scan.surface === surface)) results.axe.push({ engine: 'chromium', surface, status: 'not_run', error: 'Surface unavailable; not a zero-violation result.' });
  }
  results.finishedAt = new Date().toISOString();
  results.durationMs = performance.now() - started;
  await persist();
  console.log(JSON.stringify({ cleanup: results.cleanup, axe: results.axe.map(({ surface, status, rules, error }) => ({ surface, status, rules, error })) }));
}
process.exitCode = results.error || results.executorErrors?.length || results.engines.length !== engines.length
  || results.engines.some(engine => engine.status !== 'pass' || engine.cleanupErrors?.length)
  || results.axe.some(scan => scan.status !== 'pass') || !results.cleanup.serverClosed || !results.cleanup.portRebindSucceeded ? 1 : 0;
