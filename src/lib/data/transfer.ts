import type { HitLog, UserData } from '../../types';
import { withPinnedGeneration, iterateFiles, readRecoverySnapshot, readFullRecord, importHits, validateCanonicalTree, decodeImportSources, sourceKey } from '../storage';
import type { Chunk, Envelope, ImportEntry, ImportIntent, ImportSource } from '../storage';
import { decodeCanonical } from '../../../shared/codec';
import { createExportArchive, createRecoveryArchive } from './archive';
import { readArchive } from './archive-import';
import { ExportError, UUID } from './validation';

export type ImportedUserData = UserData & { importSources?: readonly ImportSource[] };
export type ExportSelection = string | { username: string };
const previews = new WeakMap<ImportedUserData, ImportIntent>();

export const combineImportedHits = (current: HitLog[], incoming: HitLog[]): HitLog[] => {
  const ids = new Set(current.map(hit => hit.id));
  return [...current, ...incoming.filter(hit => {
    if (ids.has(hit.id)) return false;
    ids.add(hit.id);
    return true;
  })];
};

/** Pure preview helper; publication always uses the queued UUID-targeted command below. */
export const applyImportedData = (current: UserData, incoming: ImportedUserData, mode: 'merge' | 'replace'): UserData => {
  const imports = [...(current.importBackups ?? [])];
  for (const source of incoming.importSources ?? []) {
    const serialized = sourceKey(source);
    if (!imports.some(item => sourceKey(item) === serialized)) imports.push(source);
  }
  const hits = combineImportedHits(mode === 'merge' ? current.hits : [], incoming.hits).sort((a, b) => a.at - b.at);
  return { ...current, hits, importBackups: imports };
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
  } finally { link.remove(); URL.revokeObjectURL(url); }
};
export const exportUserData = async (selection: ExportSelection): Promise<void> => {
  download(await createExportDocument(selection), `runawaylog-${new Date().toISOString().split('T')[0]}.zip`);
};
export const exportRecoveryData = async (): Promise<void> => {
  download(await createRecoveryArchive(await readRecoverySnapshot()), 'runawaylog-recovery.zip');
};
const readBytes = (file: File): Promise<Uint8Array> => {
  if (file.size > 64 * 1024 * 1024) return Promise.reject(new ExportError('compressed-limit', 'Archive exceeds 64 MiB compressed.'));
  if (typeof file.arrayBuffer === 'function') return file.arrayBuffer().then(buffer => new Uint8Array(buffer));
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new ExportError('file', 'Archive bytes are inaccessible.'));
    reader.onload = () => reader.result instanceof ArrayBuffer ? resolve(new Uint8Array(reader.result)) : reject(new ExportError('file', 'Archive bytes are inaccessible.'));
    reader.readAsArrayBuffer(file);
  });
};

/** Entire-archive validation and preview are write-free; source handles never select identity. */
export const importUserData = async (file: File, sourceAccountId?: string): Promise<ImportedUserData> => {
  const { manifest, files } = await readArchive(await readBytes(file));
  await validateCanonicalTree(manifest, files, { import: true });
  const load = <T>(path: string): T => decodeCanonical(files.get(path)!) as T;
  const directory = load<{ accounts: { accountId: string; handle: string; registeredAt: number }[] }>('shared/accounts.json');
  const selected = sourceAccountId === undefined ? directory.accounts.length === 1 ? directory.accounts[0] : undefined
    : directory.accounts.find(entry => entry.accountId === sourceAccountId);
  if (!selected) throw new ExportError('source-account', 'Select an explicit source account UUID; the archive is ambiguous or the source is absent.');
  const root = `accounts/${selected.accountId}/`;
  const entries = [...files].filter(([path]) => path.startsWith(`${root}run/`) && path !== `${root}run/index.json`)
    .flatMap(([path]) => load<Chunk>(path).entries).sort((a, b) => a.ordinal - b.ordinal);
  const profile = load<Envelope<{ fields: Record<string, unknown>; email?: string }>>(`${root}profile.json`).payload;
  const settings = load<Envelope<Record<string, unknown>>>(`${root}settings.json`).payload;
  const games = load<Envelope<{ settings: Record<string, unknown>; cardCollections: Record<string, number> }>>(`${root}plugins/games.json`).payload;
  const sourcePayloads = load<Envelope<ImportEntry[]>>(`${root}imports/index.json`).payload.map(entry => load<Envelope>(entry.path).payload);
  const sources = await decodeImportSources(sourcePayloads);
  // Sources remain flat documents: do not wrap earlier import envelopes or export-time metadata.
  sources.push({ accountId: selected.accountId,
    files: Object.fromEntries([...files.keys()].filter(path => path.startsWith(root) && !path.startsWith(`${root}imports/`)).map(path => [path.slice(root.length), load(path)])),
    shared: Object.fromEntries(['shared/extensions.json', 'shared/export-metadata.json', 'device/preferences.json'].map(path => [path, load(path)])) });
  const preview: ImportedUserData = Object.freeze({ username: selected.handle, accountId: selected.accountId, registeredAt: selected.registeredAt,
    hits: entries.map(entry => entry.hit), profile: { ...profile.fields, ...(profile.email === undefined ? {} : { email: profile.email }) },
    settings: { ...settings, games: games.settings }, cardCollections: games.cardCollections, importBackups: sources, importSources: sources });
  previews.set(preview, structuredClone({ hits: preview.hits, sources }));
  return preview;
};

export const confirmImportedData = async (targetAccountId: string, incoming: ImportedUserData, mode: 'merge' | 'replace'): Promise<UserData> => {
  if (!UUID.test(targetAccountId)) throw new ExportError('target-account', 'Confirm an explicit target account UUID.');
  const intent = previews.get(incoming);
  if (!intent) throw new ExportError('preview', 'Validate the original ZIP before confirming an import.');
  await importHits(targetAccountId, intent, mode);
  return readFullRecord(targetAccountId);
};
