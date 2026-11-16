import type { HitLog, UserData, Store } from '../../types';
import { withPinnedGeneration, iterateFiles, readRecoverySnapshot } from '../storage';
import { createExportArchive, createRecoveryArchive } from './archive';
import { ExportError } from './validation';

export type ImportedUserData = UserData & { importSource?: Store };
export type ExportSelection = string | { username: string };

export const combineImportedHits = (current: HitLog[], incoming: HitLog[]): HitLog[] => {
  const ids = new Set(current.map(hit => hit.id));
  return [...current, ...incoming.filter(hit => {
    if (ids.has(hit.id)) return false;
    ids.add(hit.id);
    return true;
  })];
};

/** Legacy pure helper only. No importer may persist this result in increment 13(a). */
export const applyImportedData = (current: UserData, incoming: ImportedUserData, mode: 'merge' | 'replace'): UserData => {
  const source = incoming.importSource ?? { schemaVersion: 2, users: { [incoming.username]: incoming } };
  const imports = Array.isArray(current.importBackups) ? [...current.importBackups] : current.importBackups === undefined ? [] : [current.importBackups];
  const serialized = JSON.stringify(source);
  if (!imports.some(item => JSON.stringify(item) === serialized)) imports.push(source);
  return {
    ...current,
    hits: mode === 'merge' ? combineImportedHits(current.hits, incoming.hits).sort((a, b) => a.at - b.at) : incoming.hits,
    importBackups: imports,
  };
};

export const createExportDocument = async (selection: ExportSelection): Promise<Uint8Array> => {
  const username = typeof selection === 'string' ? selection : selection.username;
  return withPinnedGeneration(async generation => {
    let manifest: Uint8Array | undefined;
    for await (const file of iterateFiles(generation, ['manifest.json'])) {
      if (file.path !== 'manifest.json' || manifest) throw new ExportError('membership', 'Pinned generation returned an invalid manifest entry.');
      manifest = file.bytes;
    }
    if (!manifest) throw new ExportError('missing-file', 'Committed manifest is missing; no archive was created.');
    return createExportArchive({ manifest, manifestDigest: generation.manifestDigest, revision: generation.revision,
      paths: Object.keys(generation.map), files: paths => iterateFiles(generation, paths) }, username);
  });
};

const download = (bytes: Uint8Array, filename: string): void => {
  const blob = new Blob([new Uint8Array(bytes)], { type: 'application/zip' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  try {
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
  } finally {
    link.remove();
    URL.revokeObjectURL(url);
  }
};

export const exportUserData = async (selection: ExportSelection): Promise<void> => {
  const bytes = await createExportDocument(selection);
  download(bytes, `runawaylog-${new Date().toISOString().split('T')[0]}.zip`);
};
export const exportRecoveryData = async (): Promise<void> => {
  const bytes = await createRecoveryArchive(await readRecoverySnapshot());
  download(bytes, 'runawaylog-recovery.zip');
};

/** Import parsing/preview is deliberately deferred to ADR 0006 increment 13(b). */
export const importUserData = (file: File, username?: string): Promise<ImportedUserData> => {
  void file;
  void username;
  return Promise.reject(new ExportError('import-deferred', 'Archive import is deferred to the import/recovery implementation increment.'));
};

/** Retains the dormant synchronous UI signature, but cannot read or mutate storage. */
export const confirmImportedData = (username: string, incoming: ImportedUserData, mode: 'merge' | 'replace'): UserData => {
  void username;
  void incoming;
  void mode;
  throw new ExportError('import-deferred', 'Archive import confirmation is deferred to the import/recovery implementation increment.');
};
