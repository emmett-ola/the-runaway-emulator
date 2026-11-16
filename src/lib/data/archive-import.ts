import { Inflate } from 'fflate';
import { sha256 } from '../../../shared/codec';
import type { Manifest } from '../storage';
import { EXPORT_LIMITS, ExportError, decodeExportJson, preflightExport, refuse, validateManifest } from './validation';
import { preflightZip, type ZipEntry } from './zip-preflight';

const crcTable = Uint32Array.from({ length: 256 }, (_, byte) => {
  let value = byte;
  for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0);
  return value >>> 0;
});

/** No allocation uses an advertised uncompressed size. Feed at most 1 KiB compressed. */
const decodeEntry = (input: Uint8Array, entry: ZipEntry, tally: { bytes: number }): Uint8Array => {
  const cap = entry.path === 'manifest.json' ? EXPORT_LIMITS.manifest : EXPORT_LIMITS.payload;
  const chunks: Uint8Array[] = [];
  let length = 0, crc = -1, completed = false;
  const collect = (chunk: Uint8Array, final: boolean): void => {
    length += chunk.byteLength;
    tally.bytes += chunk.byteLength;
    if (length > cap) refuse(entry.path === 'manifest.json' ? 'manifest-limit' : 'payload-limit', 'Actual ZIP output exceeds the manifest/payload byte cap.');
    if (tally.bytes > EXPORT_LIMITS.total) refuse('total-limit', 'Actual ZIP output exceeds 256 MiB uncompressed.');
    if (length > entry.bytes) refuse('integrity', `Actual ZIP output exceeds its declared length: ${entry.path}`);
    for (const byte of chunk) crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 255];
    chunks.push(chunk);
    completed = final;
  };
  try {
    if (entry.method === 0) {
      for (let offset = entry.start; offset < entry.end; offset += 1024) {
        collect(input.slice(offset, Math.min(offset + 1024, entry.end)), offset + 1024 >= entry.end);
      }
      if (entry.start === entry.end) collect(new Uint8Array(), true);
    } else {
      const stream = new Inflate(collect);
      for (let offset = entry.start; offset < entry.end; offset += 1024) {
        stream.push(input.subarray(offset, Math.min(offset + 1024, entry.end)), offset + 1024 >= entry.end);
      }
      if (entry.start === entry.end) stream.push(new Uint8Array(), true);
      // fflate 0.8 does not expose consumed bytes: gate its endpoint state rather
      // than parse DEFLATE ourselves. Reject a missing final block or unused bytes.
      const endpoint = stream as unknown as { s: { f?: number; l?: unknown; p: number }; p: Uint8Array };
      if (endpoint.s.f !== 1 || endpoint.s.l || endpoint.p.byteLength !== Math.ceil(endpoint.s.p / 8)) {
        refuse('zip', `Incomplete DEFLATE stream or trailing compressed bytes: ${entry.path}`);
      }
    }
  } catch (error) {
    if (error instanceof ExportError) throw error;
    return refuse('zip', `Invalid DEFLATE stream: ${entry.path}`);
  }
  if (!completed || length !== entry.bytes || ((crc ^ -1) >>> 0) !== entry.crc) refuse('integrity', `ZIP length or CRC mismatch: ${entry.path}`);
  const result = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.byteLength; }
  return result;
};

/** Decode only: no storage access, source selection, or canonical-tree interpretation. */
export const readArchive = async (bytes: Uint8Array): Promise<{ manifest: Manifest; files: Map<string, Uint8Array> }> => {
  // Freeze the bounded caller-owned view before any asynchronous digest yields.
  if (bytes.byteLength > EXPORT_LIMITS.compressed) refuse('compressed-limit', 'Import exceeds 64 MiB compressed.');
  const input = new Uint8Array(bytes);
  const entries = preflightZip(input);
  const tally = { bytes: 0 };
  const manifestBytes = decodeEntry(input, entries[0], tally);
  const manifest = validateManifest(decodeExportJson(manifestBytes));
  if (manifest.kind !== 'user') refuse('recovery', 'Raw recovery archives are not ordinary account imports.');
  preflightExport(manifest.files, manifestBytes.byteLength);
  const descriptors = new Map(manifest.files.map(file => [file.path, file]));
  if (descriptors.size !== entries.length - 1 || entries.slice(1).some(entry => !descriptors.has(entry.path))) {
    refuse('membership', 'ZIP payload membership and manifest disagree.');
  }
  // All central lengths must agree before expanding any payload.
  for (const entry of entries.slice(1)) {
    if (descriptors.get(entry.path)!.bytes !== entry.bytes) refuse('integrity', `ZIP and manifest lengths disagree: ${entry.path}`);
  }
  const files = new Map<string, Uint8Array>([['manifest.json', manifestBytes]]);
  for (const entry of entries.slice(1)) {
    const payload = decodeEntry(input, entry, tally);
    const descriptor = descriptors.get(entry.path)!;
    if (payload.byteLength !== descriptor.bytes || await sha256(payload) !== descriptor.sha256) {
      refuse('integrity', `Import payload hash or length mismatch: ${entry.path}`);
    }
    files.set(entry.path, payload);
  }
  // No payload JSON, including a nonselected account/import source, is parsed until
  // every exact payload has passed length and SHA-256. Tree semantics follow outside.
  for (const [path, payload] of files) if (path !== 'manifest.json') decodeExportJson(payload);
  return { manifest, files };
};
