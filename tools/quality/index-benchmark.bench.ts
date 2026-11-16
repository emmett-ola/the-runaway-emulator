import { describe, expect, it } from 'vitest';
import { mkdir, writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { cpus, platform, release, arch } from 'node:os';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { IDBFactory } from 'fake-indexeddb';
import { createAccount, appendHit, initializeStorage, resetStorage, importHits, readRecord, withPinnedGeneration, iterateFiles } from '../../src/lib/storage';
import { DATABASE_NAME } from '../../src/lib/storage/idb';
import { buildRunView } from '../../src/lib/storage/snapshot';
import { Statistics } from '../../src/features/run/Statistics';
import { canonicalHit } from '../../src/test/archive-fixtures';
import { i18n } from '../../src/lib/i18n';

const directory = 'tools/quality/evidence';
const median = (samples: number[]) => [...samples].sort((a, b) => a - b)[Math.floor(samples.length / 2)];
const now = Date.UTC(2026, 10, 16, 9, 0);
interface Measurement {
  count: number;
  seedMs?: number;
  baselineCount?: number;
  indexBytesBeforeAppend?: number;
  timestampCardinality?: number;
  projectionMs: number[];
  statisticsRenderMs: number[];
  appendMs: number[];
  appendCounts: number[];
  projectionMedianMs?: number;
  statisticsRenderMedianMs?: number;
  appendMedianMs?: number;
  finalCount?: number;
  cleanup?: string;
  status: string;
  error?: string;
}

// This file is intentionally not *.test.ts. Run only with the tools-only config.
describe.skipIf(process.env.RUN_INDEX_BENCHMARK !== '1')('real storage command index scaling', () => {
  it('measures exact baselines and five actual append/projection/statistics samples', async () => {
    await mkdir(directory, { recursive: true });
    const results = {
      startedAt: new Date().toISOString(), finishedAt: '',
      environment: { node: process.version, platform: platform(), osRelease: release(), arch: arch(), cpu: cpus()[0]?.model,
        cpuCount: cpus().length, backend: 'fake-indexeddb in Node/jsdom, not physical disk or browser timing' },
      methodology: {
        seed: 'Production createAccount then importHits(target UUID, { hits, sources: [] }, replace), a real queued batch command with full validation. No direct IDB writes. No ZIP import claimed for this benchmark.',
        data: 'Unique UUID hit IDs; unique hourly timestamps ending before fixed now, sorted ascending; production schema metadata on each hit. No import provenance, sources intentionally empty for batch command workload.',
        indexBytes: 'Exact committed byteLength from iterateFiles at N before append samples.',
        projection: 'Fresh production buildRunView against a pinned generation; actual metadata validation, index/day projection and recent chunk IO. One warmup, then five wall-clock samples at exact N.',
        statistics: 'Fresh server render of actual production Statistics component using verified RunView, executing its useMemo calculation; includes React/i18n/markup overhead. One warmup then five samples, no fake selector.',
        append: 'Five sequential awaited production appendHit receipts, timing includes command validation/publication/hydration; count checks outside timing. Samples operate at N through N+4; final total N+5. No append warmup.',
        timezone: 'UTC', month: '2026-11', fixedNow: now, sampleCount: 5,
      }, measurements: [] as Measurement[],
    };
    let failure: unknown;
    const originalFactory = globalThis.indexedDB;
    try {
      for (const count of [1000, 10000, 50000]) {
        const row: Measurement = { count, status: 'running', projectionMs: [], statisticsRenderMs: [], appendMs: [], appendCounts: [] };
        results.measurements.push(row);
        try {
          await resetStorage();
          const factory = new IDBFactory();
          Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: factory });
          await initializeStorage();
          await i18n.setLanguage('en_us');
          const receipt = await createAccount(`quality-index-${count}`);
          const id = receipt.accountId!;
          expect(id).toBeTruthy();
          const hits = Array.from({ length: count }, (_, ordinal) => canonicalHit(
            `10000000-0000-4000-8000-${String(ordinal + 1).padStart(12, '0')}`, now - (count - ordinal) * 3_600_000,
          ));
          const seedStart = performance.now();
          await importHits(id, { hits, sources: [] }, 'replace');
          row.seedMs = performance.now() - seedStart;
          const baseline = await readRecord(id);
          expect(baseline?.total).toBe(count);
          row.baselineCount = baseline!.total;
          row.timestampCardinality = baseline!.index.timestamps.length;
          const path = `accounts/${id}/run/index.json`;
          await withPinnedGeneration(async generation => {
            for await (const file of iterateFiles(generation, [path])) {
              expect(file.path).toBe(path);
              row.indexBytesBeforeAppend = file.bytes.byteLength;
            }
            const warmup = await buildRunView(generation, id, 'UTC', '2026-11');
            expect(warmup.total).toBe(count);
            renderToStaticMarkup(createElement(Statistics, { view: warmup, timezone: 'UTC', now }));
            for (let sample = 0; sample < 5; sample++) {
              const start = performance.now();
              const view = await buildRunView(generation, id, 'UTC', '2026-11');
              row.projectionMs.push(performance.now() - start);
              expect(view.total).toBe(count);
              const renderStart = performance.now();
              const markup = renderToStaticMarkup(createElement(Statistics, { view, timezone: 'UTC', now }));
              row.statisticsRenderMs.push(performance.now() - renderStart);
              expect(markup).toContain(`>${count}</div>`);
            }
          });
          expect(row.indexBytesBeforeAppend).toBeGreaterThan(0);
          for (let sample = 0; sample < 5; sample++) {
            const hit = canonicalHit(`20000000-0000-4000-8000-${String(sample + 1).padStart(12, '0')}`, now + sample * 1000);
            const start = performance.now();
            await appendHit(id, hit);
            row.appendMs.push(performance.now() - start);
            const total = (await readRecord(id))!.total;
            row.appendCounts.push(total);
            expect(total).toBe(count + sample + 1);
          }
          row.finalCount = (await readRecord(id))!.total;
          row.appendMedianMs = median(row.appendMs);
          row.projectionMedianMs = median(row.projectionMs);
          row.statisticsRenderMedianMs = median(row.statisticsRenderMs);
          row.status = 'pass';
        } catch (error) {
          row.status = 'fail'; row.error = error instanceof Error ? error.stack : String(error);
          failure = error;
        } finally {
          await resetStorage();
          await new Promise<void>((yes, no) => {
            const operation = indexedDB.deleteDatabase(DATABASE_NAME);
            operation.onsuccess = () => yes();
            operation.onerror = () => no(operation.error);
            operation.onblocked = () => no(new Error('Owned benchmark database deletion blocked.'));
          });
          row.cleanup = 'Storage queue flushed, connection/channel/listeners closed, owned fake database deleted.';
          await writeFile(`${directory}/index-measurements.json`, JSON.stringify(results, null, 2) + '\n');
          console.log(JSON.stringify(row));
        }
      }
    } finally {
      await resetStorage();
      Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: originalFactory });
      results.finishedAt = new Date().toISOString();
      await writeFile(`${directory}/index-measurements.json`, JSON.stringify(results, null, 2) + '\n');
    }
    if (failure) throw failure;
  });
});
