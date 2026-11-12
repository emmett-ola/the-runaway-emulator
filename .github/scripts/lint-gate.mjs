import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function validateLintReport(text, normalStatus, jsonStatus, cap = 5) {
  for (const status of [normalStatus, jsonStatus]) {
    if (status !== 0 && status !== 1) throw new Error(`ESLint tooling failed (exit ${status})`);
  }
  const report = JSON.parse(text);
  if (!Array.isArray(report) || report.length === 0) throw new Error('Missing ESLint file results');
  let errors = 0;
  let warnings = 0;
  for (const file of report) {
    if (!file || typeof file.filePath !== 'string' || !Array.isArray(file.messages)) {
      throw new Error('Malformed ESLint result');
    }
    for (const key of ['errorCount', 'warningCount', 'fatalErrorCount']) {
      if (!Number.isInteger(file[key]) || file[key] < 0) throw new Error(`Invalid ${key}`);
    }
    if (file.fatalErrorCount !== 0) throw new Error(`ESLint parse failure: ${file.filePath}`);
    let fileErrors = 0;
    let fileWarnings = 0;
    for (const message of file.messages) {
      if (!message || message.fatal || ![1, 2].includes(message.severity) ||
          typeof message.ruleId !== 'string' || typeof message.message !== 'string' ||
          /^Definition for rule .+ was not found\.?$/.test(message.message)) {
        throw new Error(`ESLint tooling/parser diagnostic: ${file.filePath}`);
      }
      if (message.severity === 2) fileErrors++;
      else fileWarnings++;
    }
    if (fileErrors !== file.errorCount || fileWarnings !== file.warningCount) {
      throw new Error('ESLint counts disagree with diagnostics');
    }
    errors += fileErrors;
    warnings += fileWarnings;
  }
  const expectedStatus = errors > 0 ? 1 : 0;
  if (normalStatus !== expectedStatus || jsonStatus !== expectedStatus) {
    throw new Error('Normal and JSON ESLint exits disagree with reported errors');
  }
  if (errors > cap || warnings !== 0) throw new Error(`Lint cap exceeded: ${errors} errors, ${warnings} warnings (cap ${cap}/0)`);
  return { errors, warnings };
}

export function main() {
  const normal = spawnSync('npm', ['run', 'lint'], { stdio: 'inherit' });
  if (normal.error || ![0, 1].includes(normal.status)) throw normal.error ?? new Error(`npm run lint failed: ${normal.status}`);
  const machine = spawnSync('node', ['node_modules/eslint/bin/eslint.js', '.', '--format', 'json'], {
    encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
  });
  if (machine.stderr) process.stderr.write(machine.stderr);
  if (machine.error) throw machine.error;
  if (process.env.LINT_REPORT) writeFileSync(process.env.LINT_REPORT, machine.stdout ?? '');
  const counts = validateLintReport(machine.stdout, normal.status, machine.status);
  console.log(`Lint baseline accepted: ${counts.errors}/5 errors, ${counts.warnings}/0 warnings`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { main(); } catch (error) { console.error(error); process.exitCode = 1; }
}
